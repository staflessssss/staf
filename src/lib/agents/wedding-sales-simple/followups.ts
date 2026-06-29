import {
  AgentStatus,
  ConversationStatus,
  DelayedDeliveryKind,
  DelayedDeliveryStatus,
  MessageRole,
  type Prisma,
} from "@prisma/client";

import { db } from "@/lib/db";
import type {
  SimpleWeddingSalesDecisionTrace,
  SimpleWeddingSalesState,
} from "@/lib/lang/graphs/wedding-sales-simple/state";
import { loadWeddingSalesSimpleStateWithDb } from "@/lib/agents/wedding-sales-simple/state-store";

export const WEDDING_SALES_SIMPLE_SLOT_FOLLOW_UP_KIND =
  "wedding_sales_simple_slot_follow_up";
export const WEDDING_SALES_SIMPLE_FOLLOW_UP_LOG_TOOL_NAME =
  "__wedding_sales_simple_follow_up_log";

export type WeddingSalesSimpleSlotFollowUpSlot =
  | "names"
  | "venue"
  | "callTime"
  | "email"
  | "weddingDateYear"
  | "bookingConfirmation";

export type WeddingSalesSimpleSlotFollowUpStage = "day_1" | "day_3" | "day_7";

export type WeddingSalesSimpleSlotFollowUpPayload = {
  kind: typeof WEDDING_SALES_SIMPLE_SLOT_FOLLOW_UP_KIND;
  chainId: string;
  slot: WeddingSalesSimpleSlotFollowUpSlot;
  stage: WeddingSalesSimpleSlotFollowUpStage;
  responseKey:
    | "utter_follow_up_names"
    | "utter_follow_up_venue"
    | "utter_follow_up_call_time"
    | "utter_follow_up_email"
    | "utter_follow_up_wedding_date_year"
    | "utter_follow_up_booking_confirmation";
  replyContext: {
    contactId: string;
    contactEmail?: string;
    messageId?: string;
    gmailMessageId?: string;
    threadId?: string;
    subject?: string;
  };
  anchorCreatedAt: string;
  anchorTurnIndex: number;
  anchorAssistantMessageId: string;
  expectedStillMissing?: string;
  lastRequiredQuestion: string;
  proposedCallTimeDisplay?: string;
  weddingDateText?: string;
  context?: "availability_price_guide";
  stateSnapshot: {
    weddingDate?: string;
    weddingDateText?: string;
    location?: string;
    venue?: string;
    proposedCallTimeDisplay?: string;
    customerEmail?: string;
    bookingConfirmed?: boolean;
    pendingUserActionType?: string;
    lastRequiredQuestion?: string;
  };
  killOnUserMessage: true;
};

type WeddingSalesSimpleFollowUpDatabase = Pick<
  typeof db,
  "delayedDelivery" | "message" | "conversation" | "agent"
>;

const DEFAULT_FOLLOW_UP_DAY_OFFSETS: Array<{
  stage: WeddingSalesSimpleSlotFollowUpStage;
  days: number;
}> = [
  { stage: "day_1", days: 1 },
  { stage: "day_3", days: 3 },
  { stage: "day_7", days: 7 },
];

function readPositiveEnvMinutes(name: string) {
  const raw = process.env[name];
  if (!raw) {
    return null;
  }

  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function getWeddingSalesSimpleFollowUpDelayMs(
  stage: WeddingSalesSimpleSlotFollowUpStage,
) {
  const envNameByStage: Record<WeddingSalesSimpleSlotFollowUpStage, string> = {
    day_1: "WEDDING_FOLLOWUP_DAY_1_MINUTES",
    day_3: "WEDDING_FOLLOWUP_DAY_3_MINUTES",
    day_7: "WEDDING_FOLLOWUP_DAY_7_MINUTES",
  };
  const overrideMinutes = readPositiveEnvMinutes(envNameByStage[stage]);

  if (overrideMinutes) {
    return overrideMinutes * 60 * 1000;
  }

  const defaultOffset = DEFAULT_FOLLOW_UP_DAY_OFFSETS.find(
    (followUp) => followUp.stage === stage,
  );
  return (defaultOffset?.days ?? 1) * 24 * 60 * 60 * 1000;
}

const CANCELABLE_STATUSES = [
  DelayedDeliveryStatus.PENDING,
  DelayedDeliveryStatus.PROCESSING,
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function toJsonValue(value: unknown): Prisma.JsonValue {
  if (value === undefined) {
    return null;
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.JsonValue;
}

function isSlot(value: unknown): value is WeddingSalesSimpleSlotFollowUpSlot {
  return (
    value === "names" ||
    value === "venue" ||
    value === "callTime" ||
    value === "email" ||
    value === "weddingDateYear" ||
    value === "bookingConfirmation"
  );
}

function isStage(value: unknown): value is WeddingSalesSimpleSlotFollowUpStage {
  return value === "day_1" || value === "day_3" || value === "day_7";
}

function getLastRequiredQuestion(state: Partial<SimpleWeddingSalesState>) {
  return (
    state.replyMemory?.lastRequiredQuestion ??
    state.replyMemory?.questionMemory?.lastRequiredQuestion
  );
}

function normalizeRequiredQuestionToSlot(
  requiredQuestion: string | undefined,
  state: Partial<SimpleWeddingSalesState>,
): WeddingSalesSimpleSlotFollowUpSlot | null {
  if (state.pendingUserAction?.type === "booking_confirmation") {
    return "bookingConfirmation";
  }

  if (requiredQuestion === "names") {
    return "names";
  }

  if (requiredQuestion === "venue") {
    return "venue";
  }

  if (requiredQuestion === "callTime") {
    return "callTime";
  }

  if (requiredQuestion === "email") {
    return "email";
  }

  if (requiredQuestion === "weddingDate" && state.weddingDateText && !state.weddingDate) {
    return "weddingDateYear";
  }

  return null;
}

function responseKeyForSlot(
  slot: WeddingSalesSimpleSlotFollowUpSlot,
): WeddingSalesSimpleSlotFollowUpPayload["responseKey"] {
  switch (slot) {
    case "names":
      return "utter_follow_up_names";
    case "venue":
      return "utter_follow_up_venue";
    case "callTime":
      return "utter_follow_up_call_time";
    case "email":
      return "utter_follow_up_email";
    case "weddingDateYear":
      return "utter_follow_up_wedding_date_year";
    case "bookingConfirmation":
      return "utter_follow_up_booking_confirmation";
  }
}

function replyTypeShouldNotSchedule(replyType?: SimpleWeddingSalesDecisionTrace["replyType"]) {
  return (
    replyType === "post_booking_faq" ||
    replyType === "acknowledgement_only" ||
    replyType === "booking_confirmed" ||
    replyType === "handoff"
  );
}

function hasBothNames(state: Partial<SimpleWeddingSalesState>) {
  return Boolean(state.customerName && state.partnerName);
}

export function weddingSalesSimpleSlotIsStillMissing(
  slot: WeddingSalesSimpleSlotFollowUpSlot,
  state: Partial<SimpleWeddingSalesState>,
) {
  switch (slot) {
    case "names":
      return !hasBothNames(state);
    case "venue":
      return !state.venue;
    case "callTime":
      return !state.checkedCallTime && !state.checkedCallStartTime && !state.proposedCallTime;
    case "email":
      return !state.customerEmail;
    case "weddingDateYear":
      return Boolean(state.weddingDateText && !state.weddingDate);
    case "bookingConfirmation":
      return state.pendingUserAction?.type === "booking_confirmation" && !state.bookingConfirmed;
  }
}

function slotStillMatchesRequiredQuestion(args: {
  slot: WeddingSalesSimpleSlotFollowUpSlot;
  lastRequiredQuestion: string;
  state: Partial<SimpleWeddingSalesState>;
}) {
  if (args.slot === "bookingConfirmation") {
    return args.state.pendingUserAction?.type === "booking_confirmation";
  }

  const currentRequiredQuestion = getLastRequiredQuestion(args.state);
  return currentRequiredQuestion === args.lastRequiredQuestion;
}

function getDisplayTime(state: Partial<SimpleWeddingSalesState>) {
  if (state.pendingUserAction?.type === "booking_confirmation") {
    return state.pendingUserAction.slot;
  }

  return (
    state.checkedCallTime ??
    state.proposedCallTime ??
    state.replyMemory?.pendingBookingConfirmation?.proposedCallTime
  );
}

function canScheduleFromState(state: Partial<SimpleWeddingSalesState>) {
  if (state.bookingConfirmed) {
    return { ok: false as const, reason: "booking_confirmed" };
  }

  if (state.mode === "bot_paused" || state.mode === "human_needed" || state.mode === "human_active") {
    return { ok: false as const, reason: "handoff_or_paused" };
  }

  if (state.nextStep === "handoff") {
    return { ok: false as const, reason: "handoff_next_step" };
  }

  if (replyTypeShouldNotSchedule(state.decisionTrace?.replyType)) {
    return { ok: false as const, reason: `reply_type_${state.decisionTrace?.replyType}` };
  }

  const lastRequiredQuestion = getLastRequiredQuestion(state);
  const slot = normalizeRequiredQuestionToSlot(lastRequiredQuestion, state);

  if (!lastRequiredQuestion || !slot) {
    return { ok: false as const, reason: "missing_required_question" };
  }

  if (!weddingSalesSimpleSlotIsStillMissing(slot, state)) {
    return { ok: false as const, reason: "slot_already_filled" };
  }

  return { ok: true as const, slot, lastRequiredQuestion };
}

export function parseWeddingSalesSimpleSlotFollowUpPayload(
  value: unknown,
): WeddingSalesSimpleSlotFollowUpPayload | null {
  if (!isRecord(value) || value.kind !== WEDDING_SALES_SIMPLE_SLOT_FOLLOW_UP_KIND) {
    return null;
  }

  if (!isSlot(value.slot) || !isStage(value.stage) || !isRecord(value.replyContext)) {
    return null;
  }

  const contactId = readString(value.replyContext.contactId);
  const anchorCreatedAt = readString(value.anchorCreatedAt);
  const lastRequiredQuestion = readString(value.lastRequiredQuestion);
  const chainId = readString(value.chainId);
  const anchorAssistantMessageId = readString(value.anchorAssistantMessageId);
  const anchorTurnIndex =
    typeof value.anchorTurnIndex === "number" && Number.isFinite(value.anchorTurnIndex)
      ? value.anchorTurnIndex
      : undefined;

  if (
    !contactId ||
    !anchorCreatedAt ||
    !lastRequiredQuestion ||
    !chainId ||
    !anchorAssistantMessageId ||
    anchorTurnIndex === undefined
  ) {
    return null;
  }

  const anchorDate = new Date(anchorCreatedAt);
  if (Number.isNaN(anchorDate.getTime())) {
    return null;
  }

  return {
    kind: WEDDING_SALES_SIMPLE_SLOT_FOLLOW_UP_KIND,
    chainId,
    slot: value.slot,
    stage: value.stage,
    responseKey: responseKeyForSlot(value.slot),
    replyContext: {
      contactId,
      contactEmail: readString(value.replyContext.contactEmail),
      messageId: readString(value.replyContext.messageId),
      gmailMessageId: readString(value.replyContext.gmailMessageId),
      threadId: readString(value.replyContext.threadId),
      subject: readString(value.replyContext.subject),
    },
    anchorCreatedAt: anchorDate.toISOString(),
    anchorTurnIndex,
    anchorAssistantMessageId,
    expectedStillMissing: readString(value.expectedStillMissing),
    lastRequiredQuestion,
    proposedCallTimeDisplay: readString(value.proposedCallTimeDisplay),
    weddingDateText: readString(value.weddingDateText),
    context: value.context === "availability_price_guide" ? "availability_price_guide" : undefined,
    stateSnapshot: isRecord(value.stateSnapshot)
      ? {
          weddingDate: readString(value.stateSnapshot.weddingDate),
          weddingDateText: readString(value.stateSnapshot.weddingDateText),
          location: readString(value.stateSnapshot.location),
          venue: readString(value.stateSnapshot.venue),
          proposedCallTimeDisplay: readString(value.stateSnapshot.proposedCallTimeDisplay),
          customerEmail: readString(value.stateSnapshot.customerEmail),
          bookingConfirmed:
            typeof value.stateSnapshot.bookingConfirmed === "boolean"
              ? value.stateSnapshot.bookingConfirmed
              : undefined,
          pendingUserActionType: readString(value.stateSnapshot.pendingUserActionType),
          lastRequiredQuestion: readString(value.stateSnapshot.lastRequiredQuestion),
        }
      : {},
    killOnUserMessage: true,
  };
}

function getFollowUpContext(
  slot: WeddingSalesSimpleSlotFollowUpSlot,
  state: Partial<SimpleWeddingSalesState>,
): WeddingSalesSimpleSlotFollowUpPayload["context"] {
  if (
    slot === "names" &&
    state.decisionTrace?.replyType === "availability_available" &&
    state.decisionTrace.responseKey === "utter_availability_available_ask_names" &&
    state.replyMemory?.mentioned?.guide?.reason === "availability_available"
  ) {
    return "availability_price_guide";
  }

  return undefined;
}

export function buildWeddingSalesSimpleSlotFollowUpText(
  payload: WeddingSalesSimpleSlotFollowUpPayload,
) {
  const proposedCallTimeDisplay = payload.proposedCallTimeDisplay ?? "that time";
  const weddingDateText = payload.weddingDateText ?? "that date";
  const availabilityPriceGuideNamesFollowUp =
    "Hey there! Just wanted to check in and see if you had a chance to look through our investment guide\u{1F90D}\u2728\n\n" +
    "Let me know if you have any questions - I\u2019d be happy to help! Also, just a quick reminder that our Summer Special with 20% off ends July 15, so these prices won\u2019t be available for much longer.\n\n" +
    "What are both of your names?";

  const texts: Record<
    WeddingSalesSimpleSlotFollowUpSlot,
    Record<WeddingSalesSimpleSlotFollowUpStage, string>
  > = {
    names: {
      day_1:
        payload.context === "availability_price_guide"
          ? availabilityPriceGuideNamesFollowUp
          : "Just checking in \u{1F90D} what are the couple's names?",
      day_3: "Still happy to help with the next steps 🤍 what are the couple's names?",
      day_7:
        "One last check-in 🤍 if you'd still like help with the wedding film, what are the couple's names?",
    },
    venue: {
      day_1: "Just checking in 🤍 do they already have a venue picked out?",
      day_3: "Still happy to help 🤍 do they know the venue yet?",
      day_7: "One last check-in 🤍 if you'd like to continue, do they have a venue picked out?",
    },
    callTime: {
      day_1:
        "Just checking in 🤍 would you like to find a quick time to chat about the wedding? I do consults Monday-Friday, 9am-2pm Eastern.",
      day_3:
        "Still happy to set up a quick consult 🤍 I do calls Monday-Friday, 9am-2pm Eastern.",
      day_7: "One last check-in 🤍 would you still like to find a time to chat about the wedding?",
    },
    email: {
      day_1: "Just checking in 🤍 what's the best email for the calendar invite?",
      day_3: "Still happy to lock this in 🤍 what email should I send the calendar invite to?",
      day_7: "One last check-in 🤍 if you'd still like to book the consult, what's the best email?",
    },
    bookingConfirmation: {
      day_1: `Quick check - would you still like me to lock in ${proposedCallTimeDisplay}? 🤍`,
      day_3: `Still want me to lock in ${proposedCallTimeDisplay} for the consult? 🤍`,
      day_7: `One last check before I let that time go - would you like me to lock in ${proposedCallTimeDisplay}? 🤍`,
    },
    weddingDateYear: {
      day_1: `Just checking in 🤍 what year is ${weddingDateText} for?`,
      day_3: `Still happy to check availability 🤍 what year should I use for ${weddingDateText}?`,
      day_7: `One last check-in 🤍 if you'd like me to check the date, what year is ${weddingDateText} for?`,
    },
  };

  return texts[payload.slot][payload.stage];
}

export async function recordWeddingSalesSimpleFollowUpLogWithDb(args: {
  database: Pick<typeof db, "message">;
  conversationId: string;
  event: "FollowupScheduled" | "FollowupTriggered" | "FollowupSent" | "FollowupCancelled" | "FollowupSkipped";
  payload?: unknown;
  reason?: string;
}) {
  await args.database.message.create({
    data: {
      conversationId: args.conversationId,
      role: MessageRole.TOOL,
      toolName: WEDDING_SALES_SIMPLE_FOLLOW_UP_LOG_TOOL_NAME,
      content: `wedding-sales-simple follow-up: ${args.event}${args.reason ? ` ${args.reason}` : ""}`,
      toolResult: {
        event: args.event,
        reason: args.reason,
        payload: toJsonValue(args.payload),
      },
      model: "wedding_sales_simple_follow_up",
    },
  });
}

export async function scheduleWeddingSalesSimpleSlotFollowUpsForReplyWithDb(args: {
  database: WeddingSalesSimpleFollowUpDatabase;
  agentId: string;
  conversationId: string;
  replyContext: WeddingSalesSimpleSlotFollowUpPayload["replyContext"];
  anchorCreatedAt: Date;
  anchorAssistantMessageId: string;
  state: Partial<SimpleWeddingSalesState>;
}) {
  await cancelWeddingSalesSimpleSlotFollowUpsWithDb({
    database: args.database,
    conversationId: args.conversationId,
    reason: "superseded_by_new_simple_runtime_reply",
  });

  const scheduleDecision = canScheduleFromState(args.state);
  if (!scheduleDecision.ok) {
    await recordWeddingSalesSimpleFollowUpLogWithDb({
      database: args.database,
      conversationId: args.conversationId,
      event: "FollowupSkipped",
      reason: scheduleDecision.reason,
    });
    return [];
  }

  const anchorTurnIndex = args.state.replyMemory?.turnIndex ?? 0;
  const proposedCallTimeDisplay = getDisplayTime(args.state);
  const chainId = [
    args.conversationId,
    scheduleDecision.slot,
    `turn-${anchorTurnIndex}`,
    args.anchorAssistantMessageId,
  ].join(":");

  const payloadBase = {
    kind: WEDDING_SALES_SIMPLE_SLOT_FOLLOW_UP_KIND,
    chainId,
    slot: scheduleDecision.slot,
    responseKey: responseKeyForSlot(scheduleDecision.slot),
    replyContext: args.replyContext,
    anchorCreatedAt: args.anchorCreatedAt.toISOString(),
    anchorTurnIndex,
    anchorAssistantMessageId: args.anchorAssistantMessageId,
    expectedStillMissing: scheduleDecision.slot,
    lastRequiredQuestion: scheduleDecision.lastRequiredQuestion,
    proposedCallTimeDisplay,
    weddingDateText: args.state.weddingDateText,
    context: getFollowUpContext(scheduleDecision.slot, args.state),
    stateSnapshot: {
      weddingDate: args.state.weddingDate,
      weddingDateText: args.state.weddingDateText,
      location: args.state.location,
      venue: args.state.venue,
      proposedCallTimeDisplay,
      customerEmail: args.state.customerEmail,
      bookingConfirmed: args.state.bookingConfirmed,
      pendingUserActionType: args.state.pendingUserAction?.type,
      lastRequiredQuestion: scheduleDecision.lastRequiredQuestion,
    },
    killOnUserMessage: true,
  } satisfies Omit<WeddingSalesSimpleSlotFollowUpPayload, "stage">;

  const created = [];
  for (const followUp of DEFAULT_FOLLOW_UP_DAY_OFFSETS) {
    const payload: WeddingSalesSimpleSlotFollowUpPayload = {
      ...payloadBase,
      stage: followUp.stage,
    };
    created.push(
      await args.database.delayedDelivery.create({
        data: {
          agentId: args.agentId,
          conversationId: args.conversationId,
          kind: DelayedDeliveryKind.FOLLOW_UP,
          dueAt: new Date(
            args.anchorCreatedAt.getTime() + getWeddingSalesSimpleFollowUpDelayMs(followUp.stage),
          ),
          payload,
        },
      }),
    );
  }

  await recordWeddingSalesSimpleFollowUpLogWithDb({
    database: args.database,
    conversationId: args.conversationId,
    event: "FollowupScheduled",
      payload: {
        chainId,
        slot: scheduleDecision.slot,
      stages: DEFAULT_FOLLOW_UP_DAY_OFFSETS.map((followUp) => followUp.stage),
      },
  });

  return created;
}

export async function cancelWeddingSalesSimpleSlotFollowUpsWithDb(args: {
  database: Pick<typeof db, "delayedDelivery" | "message">;
  conversationId: string;
  reason: string;
}) {
  const pending = await args.database.delayedDelivery.findMany({
    where: {
      conversationId: args.conversationId,
      kind: DelayedDeliveryKind.FOLLOW_UP,
      status: { in: [...CANCELABLE_STATUSES] },
    },
    select: {
      id: true,
      payload: true,
    },
  });
  const ids = pending
    .filter((delivery) => parseWeddingSalesSimpleSlotFollowUpPayload(delivery.payload))
    .map((delivery) => delivery.id);

  if (!ids.length) {
    return { count: 0 };
  }

  const result = await args.database.delayedDelivery.updateMany({
    where: {
      id: { in: ids },
    },
    data: {
      status: DelayedDeliveryStatus.CANCELED,
      canceledAt: new Date(),
      error: args.reason,
    },
  });

  await recordWeddingSalesSimpleFollowUpLogWithDb({
    database: args.database,
    conversationId: args.conversationId,
    event: "FollowupCancelled",
    reason: args.reason,
    payload: { count: result.count },
  });

  return result;
}

export async function validateWeddingSalesSimpleSlotFollowUpWithDb(args: {
  database: WeddingSalesSimpleFollowUpDatabase;
  conversationId: string;
  agentId: string;
  anchorCreatedAt: Date;
  payload: WeddingSalesSimpleSlotFollowUpPayload;
}) {
  const [agent, conversation, customerReply, state] = await Promise.all([
    args.database.agent.findFirst({
      where: {
        id: args.agentId,
        status: AgentStatus.ACTIVE,
      },
      select: { id: true },
    }),
    args.database.conversation.findFirst({
      where: {
        id: args.conversationId,
        status: ConversationStatus.ACTIVE,
      },
      select: { id: true },
    }),
    args.database.message.findFirst({
      where: {
        conversationId: args.conversationId,
        role: MessageRole.USER,
        createdAt: {
          gt: args.anchorCreatedAt,
        },
      },
      select: { id: true },
    }),
    loadWeddingSalesSimpleStateWithDb({
      database: args.database,
      conversationId: args.conversationId,
    }),
  ]);

  if (!agent) {
    return { ok: false as const, reason: "agent_inactive" };
  }

  if (!conversation) {
    return { ok: false as const, reason: "conversation_inactive" };
  }

  if (customerReply) {
    return { ok: false as const, reason: "customer_replied_after_anchor" };
  }

  if (!state) {
    return { ok: false as const, reason: "missing_simple_state" };
  }

  if (state.bookingConfirmed) {
    return { ok: false as const, reason: "booking_confirmed" };
  }

  if (state.mode === "bot_paused" || state.mode === "human_needed" || state.mode === "human_active") {
    return { ok: false as const, reason: "handoff_or_paused" };
  }

  if (state.nextStep === "handoff" || state.decisionTrace?.replyType === "handoff") {
    return { ok: false as const, reason: "handoff" };
  }

  if (
    !slotStillMatchesRequiredQuestion({
      slot: args.payload.slot,
      lastRequiredQuestion: args.payload.lastRequiredQuestion,
      state,
    })
  ) {
    return { ok: false as const, reason: "last_required_question_changed" };
  }

  if (!weddingSalesSimpleSlotIsStillMissing(args.payload.slot, state)) {
    return { ok: false as const, reason: "slot_filled" };
  }

  return { ok: true as const, state };
}
