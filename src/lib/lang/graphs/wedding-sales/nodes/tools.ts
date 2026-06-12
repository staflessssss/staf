import type { StructuredToolInterface } from "@langchain/core/tools";

import {
  bookConsultationTool,
  checkConsultationCalendarTool,
  checkWeddingAvailabilityTool,
  type WeddingSalesToolContext,
} from "@/lib/lang/tools/wedding-sales";

import type { WeddingSalesConfig } from "../config";
import { buildWeddingSalesConversationSummary } from "../memory";
import { buildWeddingSalesDialogPolicy, getWeddingSalesBehavioralStateUpdate } from "../policy";
import { composeHumanWeddingSalesResponse } from "../response-composer";
import type { WeddingSalesResponseIntent } from "../response-composer";
import type { WeddingSalesState } from "../state";

function parseToolJson(result: string) {
  try {
    const parsed = JSON.parse(result);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function getStepResults(toolResult: Record<string, unknown>) {
  const stepResults = Array.isArray(toolResult.steps)
    ? toolResult.steps
        .map((step) => {
          if (!step || typeof step !== "object" || Array.isArray(step) || !("result" in step)) {
            return null;
          }

          const result = step.result;
          return result && typeof result === "object" && !Array.isArray(result)
            ? (result as Record<string, unknown>)
            : null;
        })
        .filter((result): result is Record<string, unknown> => Boolean(result))
    : [];

  return typeof toolResult.status === "string" ? [toolResult, ...stepResults] : stepResults;
}

function getSummary(toolResult: Record<string, unknown>) {
  return typeof toolResult.summary === "string" ? toolResult.summary : "";
}

function getBookingOutcome(toolResult: Record<string, unknown>) {
  const steps = getStepResults(toolResult);
  const bookedStep = steps.find((step) => step.status === "booked");

  return {
    bookingConfirmed: Boolean(bookedStep),
    eventId: typeof bookedStep?.eventId === "string" ? bookedStep.eventId : undefined,
  };
}

async function invokeTool(toolInstance: StructuredToolInterface, input: Record<string, unknown>) {
  const result = await toolInstance.invoke(input);
  return typeof result === "string" ? result : JSON.stringify(result);
}

function buildToolObservationUpdate(
  state: WeddingSalesState,
  observation: { toolName: string; result: string },
) {
  return {
    toolObservations: [observation],
    turnToolObservations: [...state.turnToolObservations, observation],
  };
}

function buildAvailabilityToolRequest(state: WeddingSalesState) {
  return [
    "Check wedding availability",
    state.weddingDate ? `for wedding date ${state.weddingDate}` : null,
    state.location ? `in ${state.location}` : null,
    state.venue ? `at ${state.venue}` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

function buildCalendarToolRequest(state: WeddingSalesState) {
  return [
    "Check consultation calendar",
    state.proposedCallTime ? `for ${state.proposedCallTime}` : null,
    state.names ? `with ${state.names}` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

function buildBookingToolRequest(state: WeddingSalesState) {
  return [
    "Book consultation call",
    state.proposedCallTime ? `for ${state.proposedCallTime}` : null,
    state.names ? `with ${state.names}` : null,
    state.customerEmail ? `at ${state.customerEmail}` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

async function composeReplyUpdate(args: {
  intent: WeddingSalesResponseIntent;
  config: WeddingSalesConfig;
  state: WeddingSalesState;
  summary?: string;
  testMode?: boolean;
  statePatch?: Partial<WeddingSalesState>;
  summaryStatePatch?: Partial<WeddingSalesState>;
}) {
  const stateForPolicy = {
    ...args.state,
    ...args.statePatch,
  };
  const policy = buildWeddingSalesDialogPolicy({
    ...args,
    state: stateForPolicy,
  });
  const responseDraft = await composeHumanWeddingSalesResponse({
    ...args,
    state: stateForPolicy,
    policy,
  });
  const behavioralUpdate = getWeddingSalesBehavioralStateUpdate({
    ...args,
    state: stateForPolicy,
    policy,
  });
  const nextState = {
    ...stateForPolicy,
    ...(args.summaryStatePatch ?? args.statePatch),
    ...behavioralUpdate,
    responseDraft,
  };

  return {
    responseDraft,
    ...behavioralUpdate,
    conversationSummary: buildWeddingSalesConversationSummary({
      state: nextState,
      intent: args.intent,
    }),
  };
}

export function createWeddingSalesToolNodes(args: {
  config: WeddingSalesConfig;
  toolContext?: WeddingSalesToolContext | null;
}) {
  const { config, toolContext } = args;

  return {
    checkAvailability: async (state: WeddingSalesState): Promise<Partial<WeddingSalesState>> => {
      if (!toolContext || !state.weddingDate) {
        return {
          ...(await composeReplyUpdate({
            intent: "availability_tool_missing",
            config,
            state,
          })),
        };
      }

      if (config.coverage.unavailableDates?.includes(state.weddingDate)) {
        return {
          availability: "unavailable",
          leadStage: "availability_checked",
          ...(await composeReplyUpdate({
            intent: "availability_unavailable",
            config,
            state,
            summary: "If you have flexibility, I can help look at alternative dates.",
            statePatch: {
              availability: "unavailable",
              leadStage: "availability_checked",
            },
          })),
          ...buildToolObservationUpdate(state, {
            toolName: "check_wedding_availability",
            result: JSON.stringify({
              status: "unavailable",
              date: state.weddingDate,
              summary: "Configured unavailable date.",
            }),
          }),
        };
      }

      const result = await invokeTool(checkWeddingAvailabilityTool(toolContext), {
        request: buildAvailabilityToolRequest(state),
        date: state.weddingDate,
        weddingDate: state.weddingDate,
        coupleName: state.names,
        location: state.location,
        channel: state.channel,
      });
      const parsedResult = parseToolJson(result);
      const steps = getStepResults(parsedResult);
      const available = steps.some((step) => step.status === "available");
      const unavailable = steps.some((step) => step.status === "unavailable");
      const summary = getSummary(parsedResult);

      if (unavailable && !available) {
        return {
          availability: "unavailable",
          leadStage: "availability_checked",
          ...(await composeReplyUpdate({
            intent: "availability_unavailable",
            config,
            state,
            summary,
            statePatch: {
              availability: "unavailable",
              leadStage: "availability_checked",
            },
          })),
          ...buildToolObservationUpdate(state, { toolName: "check_wedding_availability", result }),
        };
      }

      const askVenueBeforeCall = state.channel === "instagram" && !state.venue;

      return {
        availability: "available",
        guideSent: true,
        callProposed: !askVenueBeforeCall,
        leadStage: "availability_checked",
        ...(await composeReplyUpdate({
          intent: "availability_available",
          config,
          state,
          statePatch: {
            availability: "available",
            leadStage: "availability_checked",
          },
          summaryStatePatch: {
            availability: "available",
            guideSent: true,
            callProposed: !askVenueBeforeCall,
            leadStage: "availability_checked",
          },
        })),
        ...buildToolObservationUpdate(state, { toolName: "check_wedding_availability", result }),
      };
    },
    checkCalendar: async (state: WeddingSalesState): Promise<Partial<WeddingSalesState>> => {
      if (!toolContext || !state.proposedCallTime) {
        return {
          ...(await composeReplyUpdate({
            intent: "calendar_time_missing",
            config,
            state,
          })),
        };
      }

      const result = await invokeTool(checkConsultationCalendarTool(toolContext), {
        request: buildCalendarToolRequest(state),
        timeText: state.proposedCallTime,
        coupleName: state.names,
        weddingDate: state.weddingDate,
        location: state.location,
        email: state.customerEmail,
        channel: state.channel,
      });
      const parsedResult = parseToolJson(result);
      const steps = getStepResults(parsedResult);
      const available = steps.some((step) => step.status === "available");
      const busy = steps.some((step) => step.status === "busy");
      const needsTime = steps.some((step) => step.status === "needs_time");
      const outsideWindow = steps.some(
        (step) => step.status === "outside_business_days" || step.status === "outside_business_hours",
      );
      const summary = getSummary(parsedResult) || steps.map(getSummary).find(Boolean);

      const nextIntent: WeddingSalesResponseIntent = available && !state.customerEmail
        ? "ask_email"
        : available
          ? "calendar_available"
          : outsideWindow
            ? "calendar_outside_window"
            : needsTime || !busy
              ? "calendar_time_missing"
              : "calendar_busy";
      const nextLeadStage = available && !state.customerEmail ? "waiting_customer_email" : available ? "call_proposed" : "checking_calendar";
      const nextCalendarStatus = available ? "available" : busy ? "busy" : undefined;

      return {
        calendarStatus: nextCalendarStatus,
        customerEmail: state.customerEmail,
        leadStage: nextLeadStage,
        ...(await composeReplyUpdate({
          intent: nextIntent,
          config,
          state,
          summary,
          statePatch: {
            calendarStatus: nextCalendarStatus,
            customerEmail: state.customerEmail,
            leadStage: nextLeadStage,
          },
        })),
        ...buildToolObservationUpdate(state, { toolName: "check_consultation_calendar", result }),
      };
    },
    bookCall: async (state: WeddingSalesState): Promise<Partial<WeddingSalesState>> => {
      if (!toolContext || !state.proposedCallTime) {
        return {
          bookingConfirmed: false,
          ...(await composeReplyUpdate({
            intent: "booking_tool_missing",
            config,
            state,
            statePatch: {
              bookingConfirmed: false,
            },
          })),
        };
      }

      if (!state.customerEmail) {
        return {
          leadStage: "waiting_customer_email",
          bookingConfirmed: false,
          ...(await composeReplyUpdate({
            intent: "ask_email",
            config,
            state,
            statePatch: {
              leadStage: "waiting_customer_email",
              bookingConfirmed: false,
            },
          })),
        };
      }

      const result = await invokeTool(bookConsultationTool(toolContext), {
        request: buildBookingToolRequest(state),
        timeText: state.proposedCallTime,
        coupleName: state.names,
        weddingDate: state.weddingDate,
        location: state.location,
        email: state.customerEmail,
        channel: state.channel,
      });
      const parsedResult = parseToolJson(result);
      const { bookingConfirmed, eventId } = getBookingOutcome(parsedResult);
      const summary = getSummary(parsedResult);
      const testMode = parsedResult.mode === "test";

      return {
        bookingConfirmed,
        bookedEventId: eventId,
        leadStage: bookingConfirmed ? "booked" : "ready_to_book",
        ...(await composeReplyUpdate({
          intent: bookingConfirmed ? "booking_confirmed" : "booking_failed",
          config,
          state,
          summary,
          testMode,
          statePatch: {
            bookingConfirmed,
            bookedEventId: eventId,
            leadStage: bookingConfirmed ? "booked" : "ready_to_book",
          },
        })),
        ...buildToolObservationUpdate(state, { toolName: "book_consultation", result }),
      };
    },
  };
}

export const weddingSalesToolNodeTestHelpers = {
  getBookingOutcome,
  buildAvailabilityToolRequest,
  buildCalendarToolRequest,
  buildBookingToolRequest,
};
