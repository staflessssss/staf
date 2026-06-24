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
    | "call_time_out_of_window"
    | "booking_confirmed"
    | "identity_answer"
    | "clarification"
    | "handoff"
    | "reply_only";
  reason: string;
};

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
  availability?: "available" | "unavailable";
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
  bookingConfirmed: boolean;
  bookedEventId?: string;
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
    calendarStatus: args.previousState?.calendarStatus,
    calendarContextDate: args.previousState?.calendarContextDate,
    suggestedCallTimes: args.previousState?.suggestedCallTimes,
    consultationCheck: args.previousState?.consultationCheck,
    checkedCallDate: args.previousState?.checkedCallDate,
    checkedCallTime: args.previousState?.checkedCallTime,
    checkedCallStartTime: args.previousState?.checkedCallStartTime,
    checkedCallEndTime: args.previousState?.checkedCallEndTime,
    bookingConfirmed: args.previousState?.bookingConfirmed ?? false,
    bookedEventId: args.previousState?.bookedEventId,
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
  const proposedCallTime = facts.proposedCallTime
    ? resolveProposedCallTimeFromPreviousContext(facts.proposedCallTime, state.proposedCallTime)
    : state.proposedCallTime;
  const callTimeChanged = Boolean(
    facts.proposedCallTime && facts.proposedCallTime !== state.proposedCallTime,
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

function isBareCallTime(value: string) {
  return /^\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)\s*$/i.test(value);
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
