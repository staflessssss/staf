import type { StructuredToolInterface } from "@langchain/core/tools";

import {
  bookConsultationTool,
  checkConsultationCalendarTool,
  checkWeddingAvailabilityTool,
  type WeddingSalesToolContext,
} from "@/lib/lang/tools/wedding-sales";

import { normalizeWeddingSalesRegionKey, type WeddingSalesConfig } from "../config";
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

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map(getString).filter((entry): entry is string => Boolean(entry))
    : [];
}

function getCalendarSlotState(
  steps: Record<string, unknown>[],
  previousContextDate?: string,
) {
  const availableStep = steps.find((step) => step.status === "available");
  const busyStep = steps.find((step) => step.status === "busy");
  const available = Boolean(availableStep);
  const busy = Boolean(busyStep);

  return {
    available,
    busy,
    calendarContextDate:
      getString(availableStep?.date) ??
      getString(busyStep?.date) ??
      previousContextDate,
    suggestedCallTimes: busy
      ? getStringArray(busyStep?.suggestedTimes)
      : [],
    checkedCallDate: available ? getString(availableStep?.date) : undefined,
    checkedCallTime: available ? getString(availableStep?.time) : undefined,
    checkedCallStartTime: available ? getString(availableStep?.startTime) : undefined,
    checkedCallEndTime: available ? getString(availableStep?.endTime) : undefined,
  };
}

function getAvailabilityRegion(steps: Record<string, unknown>[]) {
  for (const step of steps) {
    const region = normalizeWeddingSalesRegionKey(
      getString(step.requestedRegion) ?? getString(step.region),
    );

    if (region) {
      return region;
    }
  }

  return undefined;
}

function getAvailabilitySuggestionState(steps: Record<string, unknown>[]) {
  const unavailableStep = steps.find((step) => step.status === "unavailable");
  const suggestedDates = unavailableStep
    ? [
        ...getStringArray(unavailableStep.suggestedDates),
        getString((unavailableStep.nearestAvailableDates as Record<string, unknown> | undefined)?.before),
        getString((unavailableStep.nearestAvailableDates as Record<string, unknown> | undefined)?.after),
      ].filter((date): date is string => Boolean(date))
    : [];

  return {
    availabilityContextDate: getString(unavailableStep?.date),
    suggestedWeddingDates: [...new Set(suggestedDates)],
  };
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

function buildCalendarToolTimeInput(proposedCallTime: string) {
  const canonicalMatch = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})?$/.exec(
    proposedCallTime.trim(),
  );

  if (canonicalMatch) {
    return {
      date: canonicalMatch[1],
      timeText: canonicalMatch[2],
    };
  }

  return {
    timeText: proposedCallTime,
  };
}

function buildPostToolResponseState(
  state: WeddingSalesState,
  statePatch?: Partial<WeddingSalesState>,
) {
  return {
    ...state,
    ...statePatch,
    // The action plan was selected before the tool ran. Once a tool result
    // chooses the response intent, that stale plan must not suppress the
    // deterministic post-tool reply or next question.
    lastActionPlan: undefined,
  };
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
  const stateForPolicy = buildPostToolResponseState(args.state, args.statePatch);
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
          availabilityContextDate: state.weddingDate,
          suggestedWeddingDates: undefined,
          leadStage: "availability_checked",
          ...(await composeReplyUpdate({
            intent: "availability_unavailable",
            config,
            state,
            summary: "If you have flexibility, I can help look at alternative dates.",
            statePatch: {
              availability: "unavailable",
              availabilityContextDate: state.weddingDate,
              suggestedWeddingDates: undefined,
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
      const availabilityRegion = getAvailabilityRegion(steps);
      const { availabilityContextDate, suggestedWeddingDates } =
        getAvailabilitySuggestionState(steps);
      const summary = getSummary(parsedResult);

      if (unavailable && !available) {
        return {
          availability: "unavailable",
          availabilityContextDate,
          availabilityRegion,
          suggestedWeddingDates,
          leadStage: "availability_checked",
          ...(await composeReplyUpdate({
            intent: "availability_unavailable",
            config,
            state,
            summary,
            statePatch: {
              availability: "unavailable",
              availabilityContextDate,
              availabilityRegion,
              suggestedWeddingDates,
              leadStage: "availability_checked",
            },
          })),
          ...buildToolObservationUpdate(state, { toolName: "check_wedding_availability", result }),
        };
      }

      const askVenueBeforeCall = state.channel === "instagram" && !state.venue;
      const bookedConsultation = Boolean(state.bookingConfirmed || state.bookedEventId || state.leadStage === "booked");
      const nextCallProposed = bookedConsultation ? state.callProposed : !askVenueBeforeCall;
      const nextLeadStage = bookedConsultation ? "booked" : "availability_checked";

      return {
        availability: "available",
        availabilityContextDate: undefined,
        availabilityRegion,
        suggestedWeddingDates: undefined,
        guideSent: true,
        callProposed: nextCallProposed,
        leadStage: nextLeadStage,
        ...(await composeReplyUpdate({
          intent: "availability_available",
          config,
          state,
          statePatch: {
            availability: "available",
            availabilityContextDate: undefined,
            availabilityRegion,
            suggestedWeddingDates: undefined,
            leadStage: nextLeadStage,
          },
          summaryStatePatch: {
            availability: "available",
            availabilityContextDate: undefined,
            availabilityRegion,
            suggestedWeddingDates: undefined,
            guideSent: true,
            callProposed: nextCallProposed,
            leadStage: nextLeadStage,
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
        ...buildCalendarToolTimeInput(state.proposedCallTime),
        coupleName: state.names,
        weddingDate: state.weddingDate,
        location: state.location,
        email: state.customerEmail,
        channel: state.channel,
      });
      const parsedResult = parseToolJson(result);
      const steps = getStepResults(parsedResult);
      const {
        available,
        busy,
        calendarContextDate,
        suggestedCallTimes,
        checkedCallDate,
        checkedCallTime,
        checkedCallStartTime,
        checkedCallEndTime,
      } = getCalendarSlotState(steps, state.calendarContextDate);
      const needsTime = steps.some((step) => step.status === "needs_time");
      const dateMismatch = steps.some((step) => step.status === "date_weekday_mismatch");
      const outsideWindow = steps.some(
        (step) => step.status === "outside_business_days" || step.status === "outside_business_hours",
      );
      const summary = getSummary(parsedResult) || steps.map(getSummary).find(Boolean);

      const nextIntent: WeddingSalesResponseIntent = available && !state.customerEmail
        ? "ask_email"
        : available
          ? "calendar_available"
          : dateMismatch
            ? "calendar_date_mismatch"
            : outsideWindow
              ? "calendar_outside_window"
              : needsTime || !busy
                ? "calendar_time_missing"
                : "calendar_busy";
      const nextLeadStage = available && !state.customerEmail ? "waiting_customer_email" : available ? "call_proposed" : "checking_calendar";
      const nextCalendarStatus = available ? "available" : busy ? "busy" : undefined;
      return {
        calendarStatus: nextCalendarStatus,
        calendarContextDate,
        suggestedCallTimes,
        checkedCallDate,
        checkedCallTime,
        checkedCallStartTime,
        checkedCallEndTime,
        customerEmail: state.customerEmail,
        leadStage: nextLeadStage,
        ...(await composeReplyUpdate({
          intent: nextIntent,
          config,
          state,
          summary,
          statePatch: {
            calendarStatus: nextCalendarStatus,
            calendarContextDate,
            suggestedCallTimes,
            checkedCallDate,
            checkedCallTime,
            checkedCallStartTime,
            checkedCallEndTime,
            customerEmail: state.customerEmail,
            leadStage: nextLeadStage,
          },
        })),
        ...buildToolObservationUpdate(state, { toolName: "check_consultation_calendar", result }),
      };
    },
    bookCall: async (state: WeddingSalesState): Promise<Partial<WeddingSalesState>> => {
      if (!toolContext) {
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

      if (!state.proposedCallTime || !state.checkedCallDate || !state.checkedCallTime) {
        return {
          bookingConfirmed: false,
          ...(await composeReplyUpdate({
            intent: "calendar_time_missing",
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
        date: state.checkedCallDate,
        timeText: state.checkedCallTime,
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
  getCalendarSlotState,
  buildCalendarToolTimeInput,
  buildPostToolResponseState,
  buildAvailabilityToolRequest,
  buildCalendarToolRequest,
  buildBookingToolRequest,
};
