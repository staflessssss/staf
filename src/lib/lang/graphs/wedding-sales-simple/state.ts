import { z } from "zod";

import type { WeddingSalesChannel } from "../wedding-sales/state";
import type { ReplyActionContract } from "./reply-contract";
import type { ReplyGuardResult } from "./reply-guards";

export type SimpleWeddingSalesChannel = WeddingSalesChannel;

export const turnUnderstandingSchema = z.object({
  customerMessageType: z.enum([
    "new_lead",
    "answer_to_question",
    "business_question",
    "availability_question",
    "call_time_proposed",
    "email_provided",
    "booking_confirmation",
    "unclear",
  ]),
  facts: z.object({
    customerName: z.string().trim().min(1).optional(),
    partnerName: z.string().trim().min(1).optional(),
    weddingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    weddingDateText: z.string().trim().min(1).optional(),
    location: z.string().trim().min(1).optional(),
    venue: z.string().trim().min(1).optional(),
    email: z.string().trim().email().optional(),
    proposedCallTime: z.string().trim().min(1).optional(),
    senderRole: z.enum(["bride", "groom", "mother", "planner", "friend", "unknown"]).optional(),
  }),
  questionsAskedByCustomer: z.array(
    z.enum([
      "pricing",
      "availability",
      "portfolio",
      "travel",
      "package_inclusions",
      "team",
      "booking",
      "identity",
      "other",
    ]),
  ),
  confidence: z.number().min(0).max(1),
});

export type TurnUnderstanding = z.infer<typeof turnUnderstandingSchema>;

export type SimpleWeddingSalesQuestion = TurnUnderstanding["questionsAskedByCustomer"][number];

export type SimpleWeddingSalesNextStep =
  | "reply_only"
  | "ask_missing_info"
  | "check_availability"
  | "ask_venue"
  | "ask_call_time"
  | "check_calendar"
  | "ask_email"
  | "book_call"
  | "handoff";

export type SimpleWeddingSalesMode =
  | "bot_active"
  | "human_needed"
  | "human_active"
  | "bot_paused";

export type SimpleWeddingSalesHandoffReason =
  | "angry_customer"
  | "pricing_negotiation"
  | "unclear_after_2_attempts"
  | "tool_error"
  | "booking_conflict"
  | "unanswered_business_question"
  | "customer_requests_human";

export type SimpleWeddingSalesDecisionTrace = {
  extractedFacts: TurnUnderstanding["facts"];
  missingFields: Array<"names" | "weddingDate" | "location" | "venue" | "callTime" | "email">;
  nextStep: SimpleWeddingSalesNextStep;
  toolCalled?: "checkAvailability" | "checkCalendar" | "bookCall";
  replyObligations?: SimpleWeddingSalesReplyObligation[];
  replyType:
    | "availability_available"
    | "availability_unavailable"
    | "pricing_answer"
    | "missing_info"
    | "ask_venue"
    | "ask_call_time"
    | "ask_email"
    | "calendar_available"
    | "calendar_busy"
    | "call_time_ambiguous"
    | "call_time_out_of_window"
    | "availability_unknown"
    | "team_answer"
    | "booking_confirmed"
    | "identity_answer"
    | "clarification"
    | "handoff"
    | "reply_only";
  reason: string;
};

export type SimpleWeddingSalesReplyObligation =
  | "availability"
  | "pricing"
  | "guide"
  | "team"
  | "identity"
  | "portfolio";

export type SimpleWeddingSalesReplyMemory = {
  greeted?: boolean;
  turnIndex?: number;
  mentioned?: {
    pricing?: {
      value: string;
      turnId?: string;
      lastMentionedAt: string;
    };
    availability?: {
      date: string;
      location?: string;
      status: "available" | "unavailable" | "unknown";
      turnId?: string;
      lastMentionedAt: string;
    };
    guide?: {
      imageUrl?: string;
      link?: string;
      turnId?: string;
      lastMentionedAt: string;
    };
  };
  questionMemory?: {
    lastRequiredQuestion?: string;
    lastQuestionText?: string;
    askedQuestions?: Array<{
      type: string;
      turnId: string;
      text: string;
    }>;
    complimentedVenue?: string;
    lastCtaText?: string;
  };
  lastReplyType?: SimpleWeddingSalesDecisionTrace["replyType"];
  lastRequiredQuestion?: string;
  lastOutboundText?: string;
};

export type SimpleWeddingSalesCallTimeOption = {
  label: string;
  hour: number;
  minute: number;
};

export type SimpleWeddingSalesCallTimeContext = {
  requiredQuestion: "callTime";
  dateContext?: string;
  rejected?: {
    value: string;
    reason: "out_of_window" | "business_day";
  };
  options: SimpleWeddingSalesCallTimeOption[];
  source: "out_of_window_suggestions" | "calendar_suggestions";
};

export type SimpleWeddingSalesState = {
  tenantId?: string;
  agentId?: string;
  contactId?: string;
  channel: SimpleWeddingSalesChannel;
  latestCustomerMessage: string;
  isFirstTurn?: boolean;
  customerName?: string;
  partnerName?: string;
  weddingDate?: string;
  weddingDateText?: string;
  location?: string;
  venue?: string;
  customerEmail?: string;
  senderRole?: "bride" | "groom" | "mother" | "planner" | "friend" | "unknown";
  availability?: "available" | "unavailable" | "unknown";
  availabilityContextDate?: string;
  availabilityRegion?: string;
  suggestedWeddingDates?: string[];
  availabilityCheck?: {
    date: string;
    location?: string;
    status: "available" | "unavailable" | "unknown";
    checkedAt: string;
  };
  proposedCallTime?: string;
  callTimeAmbiguousChoice?: boolean;
  callTimeContext?: SimpleWeddingSalesCallTimeContext;
  calendarStatus?: "available" | "busy";
  calendarContextDate?: string;
  suggestedCallTimes?: string[];
  consultationCheck?: {
    proposedTime: string;
    status: "available" | "unavailable" | "unknown";
    checkedAt: string;
  };
  checkedCallDate?: string;
  checkedCallTime?: string;
  checkedCallStartTime?: string;
  checkedCallEndTime?: string;
  customerConfirmedCallSlot?: boolean;
  bookingConfirmed: boolean;
  bookingAttempt?: {
    status: "booked" | "failed";
    attemptedAt: string;
  };
  bookedEventId?: string;
  callBookingWindow?: {
    startHour: number;
    endHour: number;
    businessDays: number[];
    timezone: string;
  };
  replyMemory?: SimpleWeddingSalesReplyMemory;
  /** @deprecated Use replyMemory. Kept only to migrate live persisted simple-runtime state. */
  lastMentionedStartPrice?: string;
  /** @deprecated Use replyMemory. Kept only to migrate live persisted simple-runtime state. */
  guideMentioned?: boolean;
  mode: SimpleWeddingSalesMode;
  handoffReason?: SimpleWeddingSalesHandoffReason;
  unclearAttemptCount: number;
  questionsAskedByCustomer: SimpleWeddingSalesQuestion[];
  lastUnderstanding?: TurnUnderstanding;
  nextStep?: SimpleWeddingSalesNextStep;
  missingField?: "names" | "weddingDate" | "location";
  decisionTrace?: SimpleWeddingSalesDecisionTrace;
  replyContract?: ReplyActionContract;
  replyGuardResult?: ReplyGuardResult;
  replyObligations?: SimpleWeddingSalesReplyObligation[];
  invariantChecks?: Array<{
    name: string;
    passed: boolean;
    reason?: string;
  }>;
  responseDraft?: string;
  toolObservations: Array<{ toolName: string; result: string }>;
};

export function createInitialSimpleWeddingSalesState(args: {
  channel: SimpleWeddingSalesChannel;
  message: string;
  tenantId?: string;
  agentId?: string;
  contactId?: string;
  customerEmail?: string;
  callBookingWindow?: SimpleWeddingSalesState["callBookingWindow"];
  previousState?: Partial<SimpleWeddingSalesState>;
}): SimpleWeddingSalesState {
  return {
    tenantId: args.tenantId ?? args.previousState?.tenantId,
    agentId: args.agentId ?? args.previousState?.agentId,
    contactId: args.contactId ?? args.previousState?.contactId,
    channel: args.channel,
    latestCustomerMessage: args.message,
    isFirstTurn: !args.previousState,
    customerName: args.previousState?.customerName,
    partnerName: args.previousState?.partnerName,
    weddingDate: args.previousState?.weddingDate,
    weddingDateText: args.previousState?.weddingDateText,
    location: args.previousState?.location,
    venue: args.previousState?.venue,
    customerEmail: args.customerEmail ?? args.previousState?.customerEmail,
    senderRole: args.previousState?.senderRole,
    availability: args.previousState?.availability,
    availabilityContextDate: args.previousState?.availabilityContextDate,
    availabilityRegion: args.previousState?.availabilityRegion,
    suggestedWeddingDates: args.previousState?.suggestedWeddingDates,
    availabilityCheck: args.previousState?.availabilityCheck,
    proposedCallTime: args.previousState?.proposedCallTime,
    callTimeAmbiguousChoice: false,
    callTimeContext: args.previousState?.callTimeContext,
    calendarStatus: args.previousState?.calendarStatus,
    calendarContextDate: args.previousState?.calendarContextDate,
    suggestedCallTimes: args.previousState?.suggestedCallTimes,
    consultationCheck: args.previousState?.consultationCheck,
    checkedCallDate: args.previousState?.checkedCallDate,
    checkedCallTime: args.previousState?.checkedCallTime,
    checkedCallStartTime: args.previousState?.checkedCallStartTime,
    checkedCallEndTime: args.previousState?.checkedCallEndTime,
    customerConfirmedCallSlot: args.previousState?.customerConfirmedCallSlot,
    bookingConfirmed: args.previousState?.bookingConfirmed ?? false,
    bookingAttempt: args.previousState?.bookingAttempt,
    bookedEventId: args.previousState?.bookedEventId,
    callBookingWindow: args.callBookingWindow ?? args.previousState?.callBookingWindow,
    replyMemory: args.previousState?.replyMemory,
    lastMentionedStartPrice: args.previousState?.lastMentionedStartPrice,
    guideMentioned: args.previousState?.guideMentioned,
    mode: args.previousState?.mode ?? "bot_active",
    handoffReason: args.previousState?.handoffReason,
    unclearAttemptCount: args.previousState?.unclearAttemptCount ?? 0,
    questionsAskedByCustomer: [],
    lastUnderstanding: args.previousState?.lastUnderstanding,
    nextStep: args.previousState?.nextStep,
    missingField: args.previousState?.missingField,
    decisionTrace: args.previousState?.decisionTrace,
    replyContract: args.previousState?.replyContract,
    replyGuardResult: args.previousState?.replyGuardResult,
    replyObligations: args.previousState?.replyObligations,
    invariantChecks: args.previousState?.invariantChecks,
    responseDraft: args.previousState?.responseDraft,
    toolObservations: [],
  };
}

export function mergeTurnUnderstanding(
  state: SimpleWeddingSalesState,
  understanding: TurnUnderstanding,
): SimpleWeddingSalesState {
  const facts = understanding.facts;
  const customerName = facts.customerName ?? state.customerName;
  const partnerName = facts.partnerName ?? state.partnerName;
  const callTimeCompletion = completeCallTimeFromAnswerContext(state, facts.proposedCallTime);
  const proposedCallTime = callTimeCompletion.clearProposedCallTime
    ? undefined
    : callTimeCompletion.proposedCallTime ?? state.proposedCallTime;
  const customerConfirmedCallSlot = Boolean(
    state.customerConfirmedCallSlot ||
      understanding.customerMessageType === "booking_confirmation" ||
      understanding.questionsAskedByCustomer.includes("booking"),
  );
  const callTimeChanged = Boolean(
    callTimeCompletion.proposedCallTime &&
      callTimeCompletion.proposedCallTime !== state.proposedCallTime,
  );

  return {
    ...state,
    customerName,
    partnerName,
    weddingDate: facts.weddingDate ?? state.weddingDate,
    weddingDateText: facts.weddingDateText ?? state.weddingDateText,
    location: facts.location ?? state.location,
    venue: facts.venue ?? state.venue,
    customerEmail: facts.email ?? state.customerEmail,
    senderRole: facts.senderRole ?? state.senderRole,
    proposedCallTime,
    customerConfirmedCallSlot: callTimeChanged ? false : customerConfirmedCallSlot,
    callTimeAmbiguousChoice: callTimeCompletion.ambiguousChoice,
    calendarStatus: callTimeChanged ? undefined : state.calendarStatus,
    calendarContextDate: callTimeChanged ? undefined : state.calendarContextDate,
    suggestedCallTimes: callTimeChanged ? undefined : state.suggestedCallTimes,
    consultationCheck: callTimeChanged ? undefined : state.consultationCheck,
    checkedCallDate: callTimeChanged ? undefined : state.checkedCallDate,
    checkedCallTime: callTimeChanged ? undefined : state.checkedCallTime,
    checkedCallStartTime: callTimeChanged ? undefined : state.checkedCallStartTime,
    checkedCallEndTime: callTimeChanged ? undefined : state.checkedCallEndTime,
    unclearAttemptCount:
      understanding.customerMessageType === "unclear" || understanding.confidence < 0.35
        ? state.unclearAttemptCount + 1
        : 0,
    questionsAskedByCustomer: understanding.questionsAskedByCustomer,
    lastUnderstanding: understanding,
  };
}

function wasAnsweringCallTimeQuestion(state: SimpleWeddingSalesState) {
  return Boolean(
    state.replyMemory?.lastRequiredQuestion === "callTime" ||
      state.replyMemory?.questionMemory?.lastRequiredQuestion === "callTime",
  );
}

function isAmbiguousCallTimeChoice(message: string) {
  return /^\s*(?:either|both|any|whatever|whichever)(?:\s+(?:works?|is fine|is good))?[.!]?\s*$/i.test(
    message,
  );
}

function extractShortCallTimeAnswer(message: string) {
  const match = /^\s*(?:at\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?(?:\s+(?:works?|works too|is fine|is good|sounds good|please|pls|ok|okay))?[.!]?\s*$/i.exec(
    message,
  );

  if (!match) {
    return undefined;
  }

  return {
    hour: match[1],
    minutes: match[2],
    suffix: match[3],
  };
}

function isBareCallTime(value: string) {
  return /^\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*$/i.test(value);
}

function toTwentyFourHourTime(value: string) {
  const match = /^\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*$/i.exec(value);

  if (!match) {
    return undefined;
  }

  let hour = Number(match[1]);
  const minutes = match[2] ?? "00";
  const suffix = match[3].toLowerCase();

  if (suffix === "pm" && hour < 12) {
    hour += 12;
  }

  if (suffix === "am" && hour === 12) {
    hour = 0;
  }

  return `${String(hour).padStart(2, "0")}:${minutes}`;
}

function inferCallTimeSuffix(args: {
  hour: string;
  explicitSuffix?: string;
  previousProposedCallTime?: string;
  lastQuestionText?: string;
}) {
  if (args.explicitSuffix) {
    return args.explicitSuffix.toLowerCase();
  }

  const hourPattern = new RegExp(`\\b${Number(args.hour)}(?::\\d{2})?\\s*(am|pm)\\b`, "i");
  const optionSuffix = hourPattern.exec(args.lastQuestionText ?? "")?.[1];

  if (optionSuffix) {
    return optionSuffix.toLowerCase();
  }

  return /\b\d{1,2}(?::\d{2})?\s*(pm)\b/i.exec(args.previousProposedCallTime ?? "")?.[1]?.toLowerCase() ??
    /\b\d{1,2}(?::\d{2})?\s*(am)\b/i.exec(args.previousProposedCallTime ?? "")?.[1]?.toLowerCase();
}

function normalizeShortCallTimeAnswer(args: {
  hour: string;
  minutes?: string;
  suffix?: string;
  previousProposedCallTime?: string;
  lastQuestionText?: string;
}) {
  const suffix = inferCallTimeSuffix({
    hour: args.hour,
    explicitSuffix: args.suffix,
    previousProposedCallTime: args.previousProposedCallTime,
    lastQuestionText: args.lastQuestionText,
  });

  return suffix ? `${Number(args.hour)}${args.minutes ? `:${args.minutes}` : ""}${suffix}` : undefined;
}

function completeCallTimeFromAnswerContext(
  state: SimpleWeddingSalesState,
  proposedCallTime?: string,
) {
  const lastQuestionText = state.replyMemory?.questionMemory?.lastQuestionText;
  const answeringCallTime = wasAnsweringCallTimeQuestion(state);
  const optionResolution = answeringCallTime
    ? resolveAnswerToOfferedCallTimeOptions({
        text: state.latestCustomerMessage,
        lastCallTimeQuestion: state.callTimeContext,
      })
    : { kind: "no_match" as const };

  if (optionResolution.kind === "matched_option") {
    return {
      proposedCallTime: optionResolution.proposedCallTime,
      ambiguousChoice: false,
    };
  }

  if (optionResolution.kind === "ambiguous_choice") {
    return {
      ambiguousChoice: true,
      clearProposedCallTime: true,
    };
  }

  if (answeringCallTime && !proposedCallTime && isAmbiguousCallTimeChoice(state.latestCustomerMessage)) {
    return {
      ambiguousChoice: true,
      clearProposedCallTime: Boolean(state.callTimeContext?.rejected),
    };
  }

  const shortAnswer = answeringCallTime
    ? extractShortCallTimeAnswer(proposedCallTime ?? state.latestCustomerMessage)
    : undefined;
  const normalizedShortAnswer = shortAnswer
    ? normalizeShortCallTimeAnswer({
        ...shortAnswer,
        previousProposedCallTime: state.proposedCallTime,
        lastQuestionText,
      })
    : undefined;
  const candidate = normalizedShortAnswer ?? proposedCallTime;

  return {
    proposedCallTime: candidate
      ? resolveProposedCallTimeFromPreviousContext(candidate, state.proposedCallTime)
      : undefined,
    ambiguousChoice: false,
    clearProposedCallTime: Boolean(answeringCallTime && !candidate && state.callTimeContext?.rejected),
  };
}

function resolveAnswerToOfferedCallTimeOptions(args: {
  text: string;
  lastCallTimeQuestion?: SimpleWeddingSalesCallTimeContext;
}):
  | {
      kind: "matched_option";
      proposedCallTime: string;
      matchedLabel: string;
    }
  | {
      kind: "ambiguous_choice";
      options: string[];
    }
  | {
      kind: "no_match";
    } {
  const options = args.lastCallTimeQuestion?.options ?? [];

  if (options.length === 0) {
    return { kind: "no_match" };
  }

  if (isAmbiguousCallTimeChoice(args.text) && options.length > 1) {
    return {
      kind: "ambiguous_choice",
      options: options.map((option) => option.label),
    };
  }

  const shortAnswer = extractShortCallTimeAnswer(args.text);

  if (!shortAnswer) {
    return { kind: "no_match" };
  }

  const hour = Number(shortAnswer.hour);
  const minute = Number(shortAnswer.minutes ?? "0");
  const suffix = shortAnswer.suffix?.toLowerCase();
  const matches = options.filter((option) => {
    const optionDisplayHour = option.hour % 12 || 12;
    const optionSuffix = option.hour >= 12 ? "pm" : "am";

    return (
      optionDisplayHour === hour &&
      option.minute === minute &&
      (!suffix || optionSuffix === suffix)
    );
  });

  if (matches.length !== 1) {
    return { kind: "no_match" };
  }

  const matched = matches[0]!;

  return {
    kind: "matched_option",
    matchedLabel: matched.label,
    proposedCallTime: combineCallTimeOptionWithDateContext(
      matched,
      args.lastCallTimeQuestion?.dateContext,
    ),
  };
}

function combineCallTimeOptionWithDateContext(
  option: SimpleWeddingSalesCallTimeOption,
  dateContext?: string,
) {
  const normalizedDateContext = dateContext?.trim();
  const time = `${String(option.hour).padStart(2, "0")}:${String(option.minute).padStart(2, "0")}`;

  if (!normalizedDateContext) {
    return option.label;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalizedDateContext)) {
    return `${normalizedDateContext}T${time}:00`;
  }

  return `${normalizedDateContext} at ${option.label}`;
}

function resolveProposedCallTimeFromPreviousContext(
  proposedCallTime: string,
  previousProposedCallTime?: string,
) {
  if (!previousProposedCallTime || !isBareCallTime(proposedCallTime)) {
    return proposedCallTime;
  }

  const previousCanonical = /^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}(:\d{2})?((?:Z|[+-]\d{2}:\d{2})?)$/.exec(
    previousProposedCallTime.trim(),
  );

  if (previousCanonical) {
    const time = toTwentyFourHourTime(proposedCallTime);

    return time
      ? `${previousCanonical[1]}T${time}${previousCanonical[2] ?? ":00"}${previousCanonical[3]}`
      : proposedCallTime;
  }

  const previousNaturalTime = /\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i;

  if (previousNaturalTime.test(previousProposedCallTime)) {
    return previousProposedCallTime.replace(previousNaturalTime, proposedCallTime.trim());
  }

  return proposedCallTime;
}

export function getCoupleName(state: Pick<SimpleWeddingSalesState, "customerName" | "partnerName">) {
  return [state.customerName, state.partnerName].filter(Boolean).join(" and ") || undefined;
}
