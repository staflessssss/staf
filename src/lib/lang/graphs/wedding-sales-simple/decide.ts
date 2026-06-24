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

function answeredPreviousRequiredQuestion(state: SimpleWeddingSalesState) {
  switch (state.replyMemory?.lastRequiredQuestion) {
    case "names":
    case "coupleNames":
      return hasNames(state);
    case "weddingDate":
      return Boolean(state.weddingDate);
    case "location":
      return Boolean(state.location);
    case "venue":
      return Boolean(state.venue);
    case "callTime":
      return Boolean(state.proposedCallTime);
    case "email":
      return Boolean(state.customerEmail);
    default:
      return false;
  }
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
    state.proposedCallTime &&
      state.consultationCheck?.proposedTime === state.proposedCallTime,
  );
}

function isCalendarResultKnown(state: SimpleWeddingSalesState) {
  return Boolean(state.calendarStatus);
}

function parseProposedCallTimeMinutes(value: string) {
  const trimmed = value.trim();
  const canonicalMatch = /T(\d{2}):(\d{2})/.exec(trimmed);

  if (canonicalMatch) {
    return Number(canonicalMatch[1]) * 60 + Number(canonicalMatch[2]);
  }

  const naturalMatch = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i.exec(trimmed);

  if (!naturalMatch) {
    return undefined;
  }

  let hour = Number(naturalMatch[1]);
  const minutes = Number(naturalMatch[2] ?? "0");
  const suffix = naturalMatch[3].toLowerCase();

  if (suffix === "pm" && hour < 12) {
    hour += 12;
  }

  if (suffix === "am" && hour === 12) {
    hour = 0;
  }

  return hour * 60 + minutes;
}

function isProposedCallTimeOutsideConsultWindow(state: SimpleWeddingSalesState) {
  if (!state.proposedCallTime) {
    return false;
  }

  const proposedMinutes = parseProposedCallTimeMinutes(state.proposedCallTime);

  if (proposedMinutes === undefined) {
    return false;
  }

  const startMinutes = 9 * 60;
  const endMinutes = 14 * 60;

  return proposedMinutes < startMinutes || proposedMinutes > endMinutes;
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

  const hasUncheckedAvailability = Boolean(
    state.weddingDate && state.location && !isAvailabilityContextCurrent(state),
  );
  const hasActionableCallTime = Boolean(state.proposedCallTime);

  if (
    state.questionsAskedByCustomer.includes("team") &&
    !hasActionableCallTime &&
    !hasUncheckedAvailability
  ) {
    return decision({
      nextStep: "reply_only",
      replyType: "team_answer",
      reason: "customer asked who will film or who the shooter will be",
    });
  }

  if (
    state.questionsAskedByCustomer.includes("identity") &&
    !hasActionableCallTime &&
    !hasUncheckedAvailability
  ) {
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
    !answeredPreviousRequiredQuestion(state) &&
    (state.lastUnderstanding?.customerMessageType === "unclear" ||
      (state.lastUnderstanding?.confidence ?? 1) < 0.35)
  ) {
    return decision({
      nextStep: "reply_only",
      replyType: "clarification",
      reason: "customer message is unclear and needs one clarification before handoff",
    });
  }

  const hasKnownQuestion = state.questionsAskedByCustomer.some((question) => question !== "other");

  if (state.questionsAskedByCustomer.includes("other") && !hasKnownQuestion && !state.proposedCallTime) {
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

  if (state.callTimeAmbiguousChoice) {
    return decision({
      nextStep: "ask_call_time",
      replyType: "call_time_ambiguous",
      reason: "customer accepted multiple suggested call times without choosing one",
    });
  }

  if (
    state.proposedCallTime &&
    !isCalendarContextCurrent(state) &&
    isProposedCallTimeOutsideConsultWindow(state)
  ) {
    return decision({
      nextStep: "ask_call_time",
      replyType: "call_time_out_of_window",
      reason: "customer proposed a consultation time outside the configured consult window",
    });
  }

  if (
    state.proposedCallTime &&
    isCalendarContextCurrent(state) &&
    state.consultationCheck?.status === "unknown"
  ) {
    return decision({
      nextStep: "ask_call_time",
      replyType: "ask_call_time",
      reason: "calendar tool could not parse the proposed consultation time",
    });
  }

  if (state.proposedCallTime && !isCalendarContextCurrent(state)) {
    return decision({
      nextStep: "check_calendar",
      replyType: "reply_only",
      reason: "customer proposed a call time that has not been checked",
    });
  }

  if (isCalendarResultKnown(state) && state.calendarStatus === "busy") {
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
