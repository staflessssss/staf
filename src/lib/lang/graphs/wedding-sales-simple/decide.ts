import type {
  SimpleWeddingSalesDecisionTrace,
  SimpleWeddingSalesHandoffReason,
  SimpleWeddingSalesNextStep,
  SimpleWeddingSalesState,
} from "./state";

function hasNames(state: SimpleWeddingSalesState) {
  return Boolean(state.customerName && state.partnerName);
}

function hasQuestion(state: SimpleWeddingSalesState) {
  return state.questionsAskedByCustomer.length > 0;
}

function isAvailabilityContextCurrent(state: SimpleWeddingSalesState) {
  if (!state.weddingDate) {
    return false;
  }

  if (state.availabilityCheck) {
    return (
      state.availabilityCheck.date === state.weddingDate &&
      (state.availabilityCheck.location ?? "") === (state.location ?? "")
    );
  }

  return Boolean(state.availability && state.availabilityContextDate === state.weddingDate);
}

function isCalendarContextCurrent(state: SimpleWeddingSalesState) {
  return Boolean(
    state.calendarStatus &&
      state.proposedCallTime &&
      state.consultationCheck?.proposedTime === state.proposedCallTime,
  );
}

export function decideNextStep(state: SimpleWeddingSalesState): {
  nextStep: SimpleWeddingSalesNextStep;
  missingField?: SimpleWeddingSalesState["missingField"];
  mode?: SimpleWeddingSalesState["mode"];
  handoffReason?: SimpleWeddingSalesHandoffReason;
  trace: SimpleWeddingSalesDecisionTrace;
} {
  const traceBase = {
    extractedFacts: state.lastUnderstanding?.facts ?? {},
    missingFields: getMissingFields(state),
  };
  const decision = (args: {
    nextStep: SimpleWeddingSalesNextStep;
    missingField?: SimpleWeddingSalesState["missingField"];
    mode?: SimpleWeddingSalesState["mode"];
    handoffReason?: SimpleWeddingSalesHandoffReason;
    replyType: SimpleWeddingSalesDecisionTrace["replyType"];
    reason: string;
  }) => ({
    nextStep: args.nextStep,
    missingField: args.missingField,
    mode: args.mode,
    handoffReason: args.handoffReason,
    trace: {
      ...traceBase,
      nextStep: args.nextStep,
      replyType: args.replyType,
      reason: args.reason,
    },
  });

  if (state.mode === "human_needed" || state.mode === "human_active" || state.mode === "bot_paused") {
    return decision({
      nextStep: "handoff",
      mode: state.mode === "human_needed" ? "bot_paused" : state.mode,
      handoffReason: state.handoffReason,
      replyType: "handoff",
      reason: "conversation is already assigned away from the bot",
    });
  }

  if (state.questionsAskedByCustomer.includes("identity")) {
    return decision({
      nextStep: "reply_only",
      replyType: "identity_answer",
      reason: "customer asked whether they are speaking with the configured founder persona",
    });
  }

  if (state.unclearAttemptCount >= 2) {
    return decision({
      nextStep: "handoff",
      mode: "human_needed",
      handoffReason: "unclear_after_2_attempts",
      replyType: "handoff",
      reason: "customer message stayed unclear after repeated attempts",
    });
  }

  if (
    state.lastUnderstanding?.customerMessageType === "unclear" ||
    (state.lastUnderstanding?.confidence ?? 1) < 0.35
  ) {
    return decision({
      nextStep: "reply_only",
      replyType: "clarification",
      reason: "customer message is unclear and needs one clarification before handoff",
    });
  }

  const hasKnownQuestion = state.questionsAskedByCustomer.some((question) => question !== "other");

  if (state.questionsAskedByCustomer.includes("other") && !hasKnownQuestion) {
    return decision({
      nextStep: "handoff",
      mode: "human_needed",
      handoffReason: "unanswered_business_question",
      replyType: "handoff",
      reason: "customer asked a business question that is not covered by configured knowledge",
    });
  }

  if (state.bookingConfirmed) {
    return decision({
      nextStep: "reply_only",
      replyType: "booking_confirmed",
      reason: "booking has already been confirmed",
    });
  }

  const wantsAvailability =
    state.questionsAskedByCustomer.includes("availability") ||
    state.lastUnderstanding?.customerMessageType === "availability_question";

  if ((wantsAvailability || state.availability) && !state.weddingDate) {
    return decision({
      nextStep: "ask_missing_info",
      missingField: "weddingDate",
      replyType: state.questionsAskedByCustomer.includes("pricing")
        ? "pricing_answer"
        : "missing_info",
      reason: "availability cannot be checked until wedding date is known",
    });
  }

  if ((wantsAvailability || state.availability) && !state.location) {
    return decision({
      nextStep: "ask_missing_info",
      missingField: "location",
      replyType: "missing_info",
      reason: "availability cannot be checked until location is known",
    });
  }

  if (state.weddingDate && state.location && !isAvailabilityContextCurrent(state)) {
    return decision({
      nextStep: "check_availability",
      replyType: "reply_only",
      reason: "date and location are present and availability has not been checked for this pair",
    });
  }

  if (state.availability === "unavailable") {
    return decision({
      nextStep: "reply_only",
      replyType: "availability_unavailable",
      reason: "availability was checked and date is unavailable",
    });
  }

  if (state.availability === "available" && !hasNames(state)) {
    return decision({
      nextStep: "ask_missing_info",
      missingField: "names",
      replyType: "availability_available",
      reason: "availability is open and names are the next qualification field",
    });
  }

  if (state.availability === "available" && !state.venue) {
    return decision({
      nextStep: "ask_venue",
      replyType: "ask_venue",
      reason: "availability is open and venue is not known",
    });
  }

  if (state.availability === "available" && !state.proposedCallTime) {
    return decision({
      nextStep: "ask_call_time",
      replyType: "ask_call_time",
      reason: "availability is open and call time is not known",
    });
  }

  if (state.proposedCallTime && !isCalendarContextCurrent(state)) {
    return decision({
      nextStep: "check_calendar",
      replyType: "reply_only",
      reason: "customer proposed a call time that has not been checked",
    });
  }

  if (state.calendarStatus === "busy") {
    return decision({
      nextStep: "reply_only",
      replyType: "calendar_busy",
      reason: "calendar slot was checked and is busy",
    });
  }

  if (state.calendarStatus === "available" && !state.customerEmail) {
    return decision({
      nextStep: "ask_email",
      replyType: "ask_email",
      reason: "calendar slot is available and email is needed for invite",
    });
  }

  if (state.calendarStatus === "available" && state.customerEmail) {
    return decision({
      nextStep: "book_call",
      replyType: "reply_only",
      reason: "calendar slot is available and email is known",
    });
  }

  if (!state.weddingDate) {
    return decision({
      nextStep: "ask_missing_info",
      missingField: "weddingDate",
      replyType: state.questionsAskedByCustomer.includes("pricing")
        ? "pricing_answer"
        : "missing_info",
      reason: "wedding date is the first required qualification field",
    });
  }

  if (!state.location) {
    return decision({
      nextStep: "ask_missing_info",
      missingField: "location",
      replyType: "missing_info",
      reason: "location is required before checking availability",
    });
  }

  if (hasQuestion(state)) {
    return decision({
      nextStep: "reply_only",
      replyType: state.questionsAskedByCustomer.includes("pricing")
        ? "pricing_answer"
        : "reply_only",
      reason: "customer question can be answered without a tool",
    });
  }

  if (!hasNames(state)) {
    return decision({
      nextStep: "ask_missing_info",
      missingField: "names",
      replyType: "missing_info",
      reason: "names are missing",
    });
  }

  return decision({
    nextStep: "reply_only",
    replyType: "reply_only",
    reason: "no tool or qualification question is needed",
  });
}

function getMissingFields(state: SimpleWeddingSalesState) {
  const fields: SimpleWeddingSalesDecisionTrace["missingFields"] = [];

  if (!hasNames(state)) {
    fields.push("names");
  }

  if (!state.weddingDate) {
    fields.push("weddingDate");
  }

  if (!state.location) {
    fields.push("location");
  }

  if (state.availability === "available" && !state.venue) {
    fields.push("venue");
  }

  if (state.availability === "available" && !state.proposedCallTime) {
    fields.push("callTime");
  }

  if (state.calendarStatus === "available" && !state.customerEmail) {
    fields.push("email");
  }

  return fields;
}
