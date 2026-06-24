import {
  bookConsultationTool,
  checkConsultationCalendarTool,
  checkWeddingAvailabilityTool,
  type WeddingSalesToolContext,
} from "@/lib/lang/tools/wedding-sales";

import { getCoupleName, type SimpleWeddingSalesState } from "./state";

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

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map(getString).filter((entry): entry is string => Boolean(entry))
    : [];
}

function appendObservation(
  state: SimpleWeddingSalesState,
  observation: { toolName: string; result: string },
) {
  return {
    ...state,
    toolObservations: [...state.toolObservations, observation],
  };
}

function buildAvailabilityRequest(state: SimpleWeddingSalesState) {
  return [
    "Check wedding availability",
    state.weddingDate ? `for wedding date ${state.weddingDate}` : null,
    state.location ? `in ${state.location}` : null,
    state.venue ? `at ${state.venue}` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

function buildCalendarRequest(state: SimpleWeddingSalesState) {
  return [
    "Check consultation calendar",
    state.proposedCallTime ? `for ${state.proposedCallTime}` : null,
    getCoupleName(state) ? `with ${getCoupleName(state)}` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

function buildBookingRequest(state: SimpleWeddingSalesState) {
  return [
    "Book consultation call",
    state.proposedCallTime ? `for ${state.proposedCallTime}` : null,
    getCoupleName(state) ? `with ${getCoupleName(state)}` : null,
    state.customerEmail ? `at ${state.customerEmail}` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

function buildCalendarTimeInput(proposedCallTime: string) {
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

function getTestModeCalendarFallback(state: SimpleWeddingSalesState, resultText: string) {
  const parsed = parseToolJson(resultText);

  if (!parsed || parsed.status !== "missing_credentials") {
    return null;
  }

  const timeInput = state.proposedCallTime
    ? buildCalendarTimeInput(state.proposedCallTime)
    : undefined;

  if (!timeInput?.timeText) {
    return null;
  }

  return {
    calendarStatus: "available" as const,
    calendarContextDate: timeInput.date,
    checkedCallDate: timeInput.date,
    checkedCallTime: timeInput.timeText,
    checkedCallStartTime: state.proposedCallTime,
  };
}

export async function maybeRunSimpleWeddingSalesTool(args: {
  state: SimpleWeddingSalesState;
  toolContext?: WeddingSalesToolContext | null;
}): Promise<SimpleWeddingSalesState> {
  const { state, toolContext } = args;

  if (!toolContext) {
    return state;
  }

  if (state.nextStep === "check_availability" && state.weddingDate) {
    const result = await checkWeddingAvailabilityTool(toolContext).invoke({
      request: buildAvailabilityRequest(state),
      date: state.weddingDate,
      weddingDate: state.weddingDate,
      coupleName: getCoupleName(state),
      location: state.location,
      channel: state.channel,
    });
    const resultText = typeof result === "string" ? result : JSON.stringify(result);
    const steps = getStepResults(parseToolJson(resultText));
    const available = steps.some((step) => step.status === "available");
    const unavailable = steps.some((step) => step.status === "unavailable");
    const unavailableStep = steps.find((step) => step.status === "unavailable");

    return appendObservation(
      {
        ...state,
        availability: unavailable && !available ? "unavailable" : "available",
        availabilityContextDate: state.weddingDate,
        availabilityRegion:
          getString(steps.find((step) => getString(step.requestedRegion))?.requestedRegion) ??
          getString(steps.find((step) => getString(step.region))?.region),
        suggestedWeddingDates: unavailableStep
          ? getStringArray(unavailableStep.suggestedDates)
          : undefined,
        availabilityCheck: {
          date: state.weddingDate,
          location: state.location,
          status: unavailable && !available ? "unavailable" : "available",
          checkedAt: new Date().toISOString(),
        },
      },
      {
        toolName: "check_wedding_availability",
        result: resultText,
      },
    );
  }

  if (state.nextStep === "check_calendar" && state.proposedCallTime) {
    const result = await checkConsultationCalendarTool(toolContext).invoke({
      request: buildCalendarRequest(state),
      ...buildCalendarTimeInput(state.proposedCallTime),
      coupleName: getCoupleName(state),
      weddingDate: state.weddingDate,
      location: state.location,
      email: state.customerEmail,
      channel: state.channel,
    });
    const resultText = typeof result === "string" ? result : JSON.stringify(result);
    const steps = getStepResults(parseToolJson(resultText));
    const availableStep = steps.find((step) => step.status === "available");
    const busyStep = steps.find((step) => step.status === "busy");
    const testModeFallback = toolContext.testMode
      ? getTestModeCalendarFallback(state, resultText)
      : null;

    return appendObservation(
      {
        ...state,
        calendarStatus:
          testModeFallback?.calendarStatus ??
          (availableStep ? "available" : busyStep ? "busy" : undefined),
        calendarContextDate:
          testModeFallback?.calendarContextDate ??
          getString(availableStep?.date) ??
          getString(busyStep?.date),
        suggestedCallTimes: busyStep ? getStringArray(busyStep.suggestedTimes) : undefined,
        consultationCheck: {
          proposedTime: state.proposedCallTime,
          status:
            testModeFallback?.calendarStatus === "available" || availableStep
              ? "available"
              : busyStep
                ? "unavailable"
                : "unknown",
          checkedAt: new Date().toISOString(),
        },
        checkedCallDate: testModeFallback?.checkedCallDate ?? getString(availableStep?.date),
        checkedCallTime: testModeFallback?.checkedCallTime ?? getString(availableStep?.time),
        checkedCallStartTime:
          testModeFallback?.checkedCallStartTime ?? getString(availableStep?.startTime),
        checkedCallEndTime: getString(availableStep?.endTime),
      },
      {
        toolName: "check_consultation_calendar",
        result: resultText,
      },
    );
  }

  if (state.nextStep === "book_call" && state.checkedCallDate && state.checkedCallTime) {
    const result = await bookConsultationTool(toolContext).invoke({
      request: buildBookingRequest(state),
      date: state.checkedCallDate,
      timeText: state.checkedCallTime,
      coupleName: getCoupleName(state),
      weddingDate: state.weddingDate,
      location: state.location,
      email: state.customerEmail,
      channel: state.channel,
    });
    const resultText = typeof result === "string" ? result : JSON.stringify(result);
    const steps = getStepResults(parseToolJson(resultText));
    const bookedStep = steps.find((step) => step.status === "booked");
    const parsed = parseToolJson(resultText);
    const testModeBooked = Boolean(toolContext.testMode) && parsed.status === "missing_credentials";

    return appendObservation(
      {
        ...state,
        bookingConfirmed: Boolean(bookedStep) || testModeBooked,
        bookedEventId: getString(bookedStep?.eventId),
      },
      {
        toolName: "book_consultation",
        result: resultText,
      },
    );
  }

  return state;
}

export const simpleWeddingSalesToolTestHelpers = {
  buildAvailabilityRequest,
  buildCalendarRequest,
  buildBookingRequest,
  buildCalendarTimeInput,
};
