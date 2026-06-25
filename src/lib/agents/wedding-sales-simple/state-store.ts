import { ConversationStatus, MessageRole } from "@prisma/client";

import { db } from "@/lib/db";
import type { SimpleWeddingSalesState } from "@/lib/lang/graphs/wedding-sales-simple/state";

export const WEDDING_SALES_SIMPLE_STATE_TOOL_NAME = "__wedding_sales_simple_state";

type WeddingSalesSimpleStateDatabase = Pick<typeof db, "message" | "conversation">;

function parseSimpleWeddingSalesState(value: unknown): Partial<SimpleWeddingSalesState> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const maybeState = value as { state?: unknown };
  const state = maybeState.state ?? value;

  return state && typeof state === "object" && !Array.isArray(state)
    ? (state as Partial<SimpleWeddingSalesState>)
    : undefined;
}

export async function loadWeddingSalesSimpleStateWithDb(args: {
  database: WeddingSalesSimpleStateDatabase;
  conversationId: string;
}) {
  const stateMessage = await args.database.message.findFirst({
    where: {
      conversationId: args.conversationId,
      role: MessageRole.TOOL,
      toolName: WEDDING_SALES_SIMPLE_STATE_TOOL_NAME,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return parseSimpleWeddingSalesState(stateMessage?.toolResult);
}

export async function saveWeddingSalesSimpleStateWithDb(args: {
  database: WeddingSalesSimpleStateDatabase;
  conversationId: string;
  state: Partial<SimpleWeddingSalesState>;
}) {
  await args.database.message.create({
    data: {
      conversationId: args.conversationId,
      role: MessageRole.TOOL,
      toolName: WEDDING_SALES_SIMPLE_STATE_TOOL_NAME,
      content: `wedding-sales-simple state: ${args.state.mode ?? "unknown"}`,
      toolResult: { state: args.state },
      model: "wedding_sales_simple",
    },
  });

  if (args.state.mode === "bot_paused") {
    await args.database.conversation.update({
      where: { id: args.conversationId },
      data: { status: ConversationStatus.ESCALATED },
    });
  }
}

export async function recordOwnerReplyInWeddingSalesSimpleState(args: {
  database?: WeddingSalesSimpleStateDatabase;
  conversationId: string;
  text: string;
  sentAt?: Date;
  source?: "telegram_owner";
}) {
  const database = args.database ?? db;
  const previous = await loadWeddingSalesSimpleStateWithDb({
    database,
    conversationId: args.conversationId,
  });

  if (!previous) {
    return { status: "skipped_no_simple_state" as const };
  }

  const sentAt = (args.sentAt ?? new Date()).toISOString();
  const manualReply = {
    text: args.text,
    source: args.source ?? ("telegram_owner" as const),
    sentAt,
  };
  const manualReplies = [
    ...(previous.replyMemory?.manualIntervention?.manualReplies ?? []),
    manualReply,
  ].slice(-10);

  await saveWeddingSalesSimpleStateWithDb({
    database,
    conversationId: args.conversationId,
    state: {
      ...previous,
      mode: "bot_paused",
      replyMemory: {
        ...previous.replyMemory,
        lastOutboundText: args.text,
        manualIntervention: {
          lastOwnerReplyText: args.text,
          lastOwnerReplyAt: sentAt,
          source: args.source ?? "telegram_owner",
          manualReplies,
        },
      },
      responseDraft: undefined,
    },
  });

  return { status: "recorded" as const };
}

export async function pauseWeddingSalesSimpleStateForConversation(args: {
  database?: WeddingSalesSimpleStateDatabase;
  conversationId: string;
  handoffReason?: SimpleWeddingSalesState["handoffReason"];
}) {
  const database = args.database ?? db;
  const previous = await loadWeddingSalesSimpleStateWithDb({
    database,
    conversationId: args.conversationId,
  });

  if (!previous) {
    return { status: "skipped_no_simple_state" as const };
  }

  await saveWeddingSalesSimpleStateWithDb({
    database,
    conversationId: args.conversationId,
    state: {
      ...previous,
      mode: "bot_paused",
      handoffReason: args.handoffReason ?? previous.handoffReason,
      nextStep: "handoff",
      responseDraft: undefined,
    },
  });

  return { status: "paused" as const };
}

export async function resumeWeddingSalesSimpleStateForConversation(args: {
  database?: WeddingSalesSimpleStateDatabase;
  conversationId: string;
}) {
  const database = args.database ?? db;
  const previous = await loadWeddingSalesSimpleStateWithDb({
    database,
    conversationId: args.conversationId,
  });

  if (!previous) {
    return { status: "skipped_no_simple_state" as const };
  }

  await saveWeddingSalesSimpleStateWithDb({
    database,
    conversationId: args.conversationId,
    state: {
      ...previous,
      mode: "bot_active",
      handoffReason: undefined,
      nextStep: undefined,
      missingField: undefined,
      responseDraft: undefined,
    },
  });

  return { status: "resumed" as const };
}
