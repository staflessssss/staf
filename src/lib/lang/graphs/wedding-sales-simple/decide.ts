import type {
  SimpleWeddingSalesDecisionTrace,
  SimpleWeddingSalesHandoffReason,
  SimpleWeddingSalesInvariantCheck,
  SimpleWeddingSalesNextStep,
  SimpleWeddingSalesQuestion,
  SimpleWeddingSalesResponseKey,
  SimpleWeddingSalesReplyObligation,
  SimpleWeddingSalesState,
} from "./state";

function hasNames(state: SimpleWeddingSalesState) {
  return Boolean(state.customerName && state.partnerName);
}

function hasQuestion(state: SimpleWeddingSalesState) {
  return state.questionsAskedByCustomer.length > 0;
}

function getReplyObligations(
  questions: SimpleWeddingSalesQuestion[],
  latestCustomerMessage = "",
): SimpleWeddingSalesReplyObligation[] {
  const obligations = new Set<SimpleWeddingSalesReplyObligation>();
  const normalizedQuestions = normalizeQuestionsForDecision(questions, latestCustomerMessage);

  if (normalizedQuestions.includes("availability")) {
    obligations.add("availability");
  }

  if (normalizedQuestions.includes("pricing")) {
    obligations.add("pricing");
    obligations.add("guide");
  }

  if (normalizedQuestions.includes("package_inclusions")) {
    obligations.add("pricing");
    obligations.add("guide");
  }

  if (normalizedQuestions.includes("team")) {
    obligations.add("team");
  }

  if (normalizedQuestions.includes("identity")) {
    obligations.add("identity");
  }

  if (normalizedQuestions.includes("portfolio")) {
    obligations.add("portfolio");
  }

  if (normalizedQuestions.includes("travel")) {
    obligations.add("travel");
  }

  if (normalizedQuestions.includes("raw_footage")) {
    obligations.add("raw_footage");
  }

  return [...obligations];
}

function normalizeQuestionsForDecision(
  questions: SimpleWeddingSalesQuestion[],
  latestCustomerMessage: string,
) {
  const normalized = new Set(questions);
  const lower = latestCustomerMessage.toLowerCase();
  const isShooterQuestion =
    /\bwho\b[\s\S]{0,60}\b(?:shoot|shoots|shooter|filming|film|films|filmmaker|videographer)\b/.test(
      lower,
    ) ||
    /\bwho\s+(?:would|will)\s+shoot\b/.test(lower) ||
    /\blead filmmaker\b/.test(lower);

  if (isShooterQuestion) {
    normalized.add("team");
    normalized.delete("identity");
  }

  return [...normalized];
}

function responseKeyForDecision(args: {
  replyType: SimpleWeddingSalesDecisionTrace["replyType"];
  replyObligations: SimpleWeddingSalesReplyObligation[];
  nextStep: SimpleWeddingSalesNextStep;
  missingField?: SimpleWeddingSalesState["missingField"];
  state: SimpleWeddingSalesState;
}): SimpleWeddingSalesResponseKey | undefined {
  if (args.replyObligations.includes("raw_footage")) {
    return "utter_answer_raw_footage";
  }

  if (args.replyObligations.includes("travel")) {
    return args.nextStep === "ask_call_time"
      ? "utter_answer_travel_resume_call_time"
      : "utter_answer_travel";
  }

  if (args.replyType === "availability_available" && args.replyObligations.includes("pricing")) {
    return "utter_available_with_pricing_guide";
  }

  if (args.replyType === "booking_confirmed") {
    return "utter_booking_confirmed";
  }

  if (args.replyType === "acknowledgement_only") {
    return "utter_acknowledgement";
  }

  if (args.replyType === "handoff") {
    return "utter_handoff_ack";
  }

  if (args.replyType === "call_time_out_of_window") {
    return "utter_call_time_out_of_window";
  }

  if (args.replyType === "ask_email" || args.replyType === "calendar_available") {
    return args.replyType === "ask_email" && args.state.calendarStatus === "available"
      ? "utter_calendar_available_ask_email"
      : "utter_ask_email";
  }

  if (args.nextStep === "ask_call_time") {
    if (args.replyType !== "ask_call_time") {
      return "utter_ask_booking_confirmation";
    }

    return args.state.venue
      ? "utter_venue_collected_ask_call_time"
      : "utter_ask_call_time";
  }

  if (args.nextStep === "ask_venue" || args.replyType === "ask_venue") {
    return "utter_ask_venue";
  }

  if (
    args.nextStep === "ask_missing_info" &&
    args.missingField === "weddingDate"
  ) {
    return args.state.location ? "utter_ask_wedding_date_only" : "utter_ask_wedding_details";
  }

  if (
    args.nextStep === "ask_missing_info" &&
    args.missingField === "location"
  ) {
    return args.state.weddingDate ? "utter_ask_location_only" : "utter_ask_wedding_details";
  }

  if (
    args.nextStep === "ask_missing_info" &&
    args.missingField === "names"
  ) {
    if (
      args.replyType === "availability_available" &&
      args.state.availability === "available" &&
      args.replyObligations.includes("pricing")
    ) {
      return "utter_availability_available_ask_names";
    }

    if (args.replyObligations.includes("pricing") && args.state.replyMemory?.mentioned?.pricing) {
      return "utter_pricing_repeat_send_guide_ask_names";
    }

    if (
      args.state.weddingDate &&
      args.state.location &&
      args.state.senderRole !== "mother" &&
      args.state.senderRole !== "planner"
    ) {
      return "utter_ask_names_after_details";
    }

    return "utter_ask_names";
  }

  return undefined;
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

function effectiveAvailability(state: SimpleWeddingSalesState) {
  return isAvailabilityContextCurrent(state) ? state.availability : undefined;
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

  const startMinutes = (state.callBookingWindow?.startHour ?? 9) * 60;
  const endMinutes = (state.callBookingWindow?.endHour ?? 14) * 60;

  return proposedMinutes < startMinutes || proposedMinutes > endMinutes;
}

function proposedCallTimeViolatesBusinessDay(state: SimpleWeddingSalesState) {
  if (!state.proposedCallTime) {
    return false;
  }

  const businessDays = state.callBookingWindow?.businessDays ?? [1, 2, 3, 4, 5];
  const explicitWeekday = /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i.exec(
    state.proposedCallTime,
  )?.[1]?.toLowerCase();
  const weekdayMap: Record<string, number> = {
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
    sunday: 7,
  };
  const explicitDay = explicitWeekday ? weekdayMap[explicitWeekday] : undefined;

  if (explicitDay) {
    return !businessDays.includes(explicitDay);
  }

  const isoDate = /^(\d{4}-\d{2}-\d{2})T/.exec(state.proposedCallTime.trim())?.[1];

  if (!isoDate) {
    return false;
  }

  const day = new Date(`${isoDate}T00:00:00Z`).getUTCDay();
  const businessDay = day === 0 ? 7 : day;
  return !businessDays.includes(businessDay);
}

export function decideNextStep(state: SimpleWeddingSalesState): {
  nextStep: SimpleWeddingSalesNextStep;
  missingField?: SimpleWeddingSalesState["missingField"];
  mode?: SimpleWeddingSalesState["mode"];
  handoffReason?: SimpleWeddingSalesHandoffReason;
  statePatch?: Partial<SimpleWeddingSalesState>;
  trace: SimpleWeddingSalesDecisionTrace;
} {
  const replyObligations = getReplyObligations(
    state.questionsAskedByCustomer,
    state.latestCustomerMessage,
  );
  const traceBase = {
    extractedFacts: state.lastUnderstanding?.facts ?? {},
    missingFields: getMissingFields(state),
  };
  const decision = (args: {
    nextStep: SimpleWeddingSalesNextStep;
    missingField?: SimpleWeddingSalesState["missingField"];
    mode?: SimpleWeddingSalesState["mode"];
    handoffReason?: SimpleWeddingSalesHandoffReason;
    statePatch?: Partial<SimpleWeddingSalesState>;
    invariantCheck?: SimpleWeddingSalesInvariantCheck;
    replyType: SimpleWeddingSalesDecisionTrace["replyType"];
    reason: string;
  }) => ({
    nextStep: args.nextStep,
    missingField: args.missingField,
    mode: args.mode,
    handoffReason: args.handoffReason,
    statePatch: {
      ...args.statePatch,
      replyObligations,
      invariantChecks: args.invariantCheck
        ? [...(state.invariantChecks ?? []), args.invariantCheck]
        : state.invariantChecks,
    },
    trace: {
      ...traceBase,
      nextStep: args.nextStep,
      responseKey: responseKeyForDecision({
        replyType: args.replyType,
        replyObligations,
        nextStep: args.nextStep,
        missingField: args.missingField,
        state,
      }),
      replyType: args.replyType,
      replyObligations,
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

  const availability = effectiveAvailability(state);
  const hasUncheckedAvailability = Boolean(
    state.weddingDate && state.location && !isAvailabilityContextCurrent(state),
  );
  const hasActionableCallTime = Boolean(state.proposedCallTime);
  const hasStartFlowCommand = Boolean(
    state.dialogueCommands?.some(
      (command) =>
        command.type === "start_flow" &&
        command.flow === "wedding_lead_qualification",
    ),
  );
  const checkedAvailabilityThisTurn = state.toolObservations.some(
    (observation) => observation.toolName === "check_wedding_availability",
  );

  if (hasStartFlowCommand && !state.weddingDate) {
    return decision({
      nextStep: "ask_missing_info",
      missingField: "weddingDate",
      replyType: "missing_info",
      reason: "generic wedding lead inquiry starts qualification flow",
    });
  }

  if (checkedAvailabilityThisTurn && availability === "available") {
    const missingFields = getMissingFields(state);
    const firstMissing = missingFields[0];

    if (firstMissing) {
      if (firstMissing === "names" || firstMissing === "weddingDate" || firstMissing === "location") {
        return decision({
          nextStep: "ask_missing_info",
          missingField: firstMissing,
          replyType: "availability_available",
          reason:
            "invariant: reply_only cannot override missing qualification fields after successful availability check",
          invariantCheck: {
            name: "reply_only_cannot_override_missing_fields_after_availability",
            passed: true,
          },
        });
      }

      if (firstMissing === "venue") {
        return decision({
          nextStep: "ask_venue",
          replyType: "ask_venue",
          reason:
            "invariant: availability checked and venue is the next missing qualification field",
          invariantCheck: {
            name: "reply_only_cannot_override_missing_fields_after_availability",
            passed: true,
          },
        });
      }

      if (firstMissing === "callTime") {
        return decision({
          nextStep: "ask_call_time",
          replyType: "ask_call_time",
          reason:
            "invariant: availability checked and call time is the next missing qualification field",
          invariantCheck: {
            name: "reply_only_cannot_override_missing_fields_after_availability",
            passed: true,
          },
        });
      }
    }
  }

  if (
    state.questionsAskedByCustomer.includes("team") &&
    !hasActionableCallTime &&
    !hasUncheckedAvailability &&
    !checkedAvailabilityThisTurn
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

  if (
    state.questionsAskedByCustomer.includes("other") &&
    !hasKnownQuestion &&
    !state.proposedCallTime &&
    !hasStartFlowCommand
  ) {
    return decision({
      nextStep: "handoff",
      mode: "human_needed",
      handoffReason: "unanswered_business_question",
      replyType: "handoff",
      reason: "customer asked a business question that is not covered by configured knowledge",
    });
  }

  if (state.bookingAttempt?.status === "failed" && !state.bookingConfirmed) {
    return decision({
      nextStep: "handoff",
      mode: "human_needed",
      handoffReason: "tool_error",
      replyType: "handoff",
      reason: "booking was attempted but the booking tool did not confirm success",
    });
  }

  if (state.dialogueUnderstanding?.messageAct === "acknowledgement_only") {
    return decision({
      nextStep: "reply_only",
      replyType: "acknowledgement_only",
      reason: "customer only acknowledged the previous message",
    });
  }

  if (
    state.bookingConfirmed &&
    replyObligations.length > 0 &&
    !hasUncheckedAvailability
  ) {
    return decision({
      nextStep: "reply_only",
      replyType: state.questionsAskedByCustomer.includes("pricing")
        ? "pricing_answer"
        : "reply_only",
      reason: "customer asked a known business question that should be answered without changing the flow",
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

  if ((wantsAvailability || availability) && !state.weddingDate) {
    return decision({
      nextStep: "ask_missing_info",
      missingField: "weddingDate",
      replyType: state.questionsAskedByCustomer.includes("pricing")
        ? "pricing_answer"
        : "missing_info",
      reason: "availability cannot be checked until wedding date is known",
    });
  }

  if ((wantsAvailability || availability) && !state.location) {
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

  if (availability === "unknown") {
    return decision({
      nextStep: "handoff",
      mode: "human_needed",
      handoffReason: "tool_error",
      replyType: "availability_unknown",
      reason: "availability tool returned an unknown result for the current date/location",
    });
  }

  if (availability === "unavailable") {
    return decision({
      nextStep: "reply_only",
      replyType: "availability_unavailable",
      reason: "availability was checked and date is unavailable",
    });
  }

  if (availability === "available" && !hasNames(state)) {
    return decision({
      nextStep: "ask_missing_info",
      missingField: "names",
      replyType: "availability_available",
      reason: "availability is open and names are the next qualification field",
    });
  }

  if (availability === "available" && !state.venue) {
    return decision({
      nextStep: "ask_venue",
      replyType: "ask_venue",
      reason: "availability is open and venue is not known",
    });
  }

  if (state.callTimeAmbiguousChoice) {
    return decision({
      nextStep: "ask_call_time",
      replyType: "call_time_ambiguous",
      reason: "customer accepted multiple suggested call times without choosing one",
    });
  }

  if (availability === "available" && !state.proposedCallTime) {
    return decision({
      nextStep: "ask_call_time",
      replyType: "ask_call_time",
      reason: "availability is open and call time is not known",
    });
  }

  if (
    state.proposedCallTime &&
    !isCalendarContextCurrent(state) &&
    (isProposedCallTimeOutsideConsultWindow(state) ||
      proposedCallTimeViolatesBusinessDay(state))
  ) {
    const violatesBusinessDay = proposedCallTimeViolatesBusinessDay(state);
    const callTimeContext = buildOutOfWindowCallTimeContext({
      proposedCallTime: state.proposedCallTime,
      reason: violatesBusinessDay ? "business_day" : "out_of_window",
      state,
    });

    return decision({
      nextStep: "ask_call_time",
      replyType: "call_time_out_of_window",
      reason: "customer proposed a consultation time outside the configured consult window",
      statePatch: {
        proposedCallTime: undefined,
        callTimeContext,
      },
      invariantCheck: buildOfferedCallTimeOptionsInvariant(state, callTimeContext),
    });
  }

  if (
    state.proposedCallTime &&
    isCalendarContextCurrent(state) &&
    (state.consultationCheck?.status === "outside_business_hours" ||
      state.consultationCheck?.status === "outside_business_days")
  ) {
    const callTimeContext = buildOutOfWindowCallTimeContext({
      proposedCallTime: state.proposedCallTime,
      reason:
        state.consultationCheck.status === "outside_business_days"
          ? "business_day"
          : "out_of_window",
      state,
    });

    return decision({
      nextStep: "ask_call_time",
      replyType: "call_time_out_of_window",
      reason: "calendar tool parsed the consultation time and rejected it outside the consult window",
      statePatch: {
        proposedCallTime: undefined,
        callTimeContext,
      },
      invariantCheck: buildOfferedCallTimeOptionsInvariant(state, callTimeContext),
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

  if (state.calendarStatus === "available" && state.customerEmail && !state.customerConfirmedCallSlot) {
    return decision({
      nextStep: "ask_call_time",
      replyType: "ask_call_time",
      reason: "calendar slot is available and customer must explicitly confirm before booking",
    });
  }

  if (
    state.calendarStatus === "available" &&
    state.customerEmail &&
    hasNames(state) &&
    state.checkedCallDate &&
    state.checkedCallTime &&
    state.customerConfirmedCallSlot
  ) {
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

function buildOutOfWindowCallTimeContext(args: {
  proposedCallTime: string;
  reason: "out_of_window" | "business_day";
  state: SimpleWeddingSalesState;
}): NonNullable<SimpleWeddingSalesState["callTimeContext"]> {
  const endHour = args.state.callBookingWindow?.endHour ?? 14;
  const firstHour = Math.max(args.state.callBookingWindow?.startHour ?? 9, endHour - 1);

  return {
    requiredQuestion: "callTime",
    rejected: {
      value: args.proposedCallTime,
      reason: args.reason,
    },
    dateContext: extractCallTimeDateContext(args.proposedCallTime),
    options: [firstHour, endHour].map((hour) => ({
      label: formatCallTimeOptionLabel(hour, 0),
      hour,
      minute: 0,
    })),
    source: "out_of_window_suggestions",
  };
}

function buildOfferedCallTimeOptionsInvariant(
  state: SimpleWeddingSalesState,
  callTimeContext: NonNullable<SimpleWeddingSalesState["callTimeContext"]>,
) {
  const startHour = state.callBookingWindow?.startHour ?? 9;
  const latestStartHour = state.callBookingWindow?.endHour ?? 14;
  const startMinutes = startHour * 60;
  const latestStartMinutes = latestStartHour * 60;
  const invalidOptions = callTimeContext.options.filter((option) => {
    const minutes = option.hour * 60 + option.minute;
    return minutes < startMinutes || minutes > latestStartMinutes;
  });

  return {
    name: "offered_call_time_options_must_pass_tool_window_validation",
    passed: invalidOptions.length === 0,
    reason:
      invalidOptions.length > 0
        ? "one or more offered call time options are outside the configured latest-start window"
        : undefined,
    details: {
      offeredOptions: callTimeContext.options.map((option) => option.label),
      invalidOptions: invalidOptions.map((option) => option.label),
      window: {
        startHour,
        latestStartHour,
        semantics: "latest_start_inclusive",
      },
    },
  };
}

function extractCallTimeDateContext(value: string) {
  const trimmed = value.trim();
  const isoDate = /^(\d{4}-\d{2}-\d{2})T/.exec(trimmed)?.[1];

  if (isoDate) {
    return isoDate;
  }

  return /\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next monday|next tuesday|next wednesday|next thursday|next friday|next saturday|next sunday)\b/i.exec(
    trimmed,
  )?.[1]?.toLowerCase();
}

function formatCallTimeOptionLabel(hour: number, minute: number) {
  const suffix = hour >= 12 ? "pm" : "am";
  const displayHour = hour % 12 || 12;
  const minutes = minute === 0 ? "" : `:${String(minute).padStart(2, "0")}`;

  return `${displayHour}${minutes}${suffix}`;
}

function getMissingFields(state: SimpleWeddingSalesState) {
  const fields: SimpleWeddingSalesDecisionTrace["missingFields"] = [];
  const availability = effectiveAvailability(state);

  if (!hasNames(state)) {
    fields.push("names");
  }

  if (!state.weddingDate) {
    fields.push("weddingDate");
  }

  if (!state.location) {
    fields.push("location");
  }

  if (availability === "available" && !state.venue) {
    fields.push("venue");
  }

  if (availability === "available" && !state.proposedCallTime) {
    fields.push("callTime");
  }

  if (state.calendarStatus === "available" && !state.customerEmail) {
    fields.push("email");
  }

  return fields;
}
