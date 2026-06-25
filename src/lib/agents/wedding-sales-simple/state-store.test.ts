import assert from "node:assert/strict";
import test from "node:test";

import { ConversationStatus, MessageRole } from "@prisma/client";

import {
  WEDDING_SALES_SIMPLE_STATE_TOOL_NAME,
  recordOwnerReplyInWeddingSalesSimpleState,
  resumeWeddingSalesSimpleStateForConversation,
} from "./state-store";

function createMockDatabase(initialState: Record<string, unknown>) {
  const createdMessages: Array<Record<string, unknown>> = [];
  const conversationUpdates: Array<Record<string, unknown>> = [];

  return {
    createdMessages,
    conversationUpdates,
    database: {
      message: {
        findFirst: async () => ({
          toolResult: {
            state: initialState,
          },
        }),
        create: async ({ data }: { data: Record<string, unknown> }) => {
          createdMessages.push(data);
          return data;
        },
      },
      conversation: {
        update: async ({ data }: { data: Record<string, unknown> }) => {
          conversationUpdates.push(data);
          return data;
        },
      },
    },
  };
}

test("records Telegram owner reply in the latest wedding-sales-simple state and keeps bot paused", async () => {
  const mock = createMockDatabase({
    mode: "bot_paused",
    replyMemory: {
      lastOutboundText: "Old bot text",
    },
  });

  const result = await recordOwnerReplyInWeddingSalesSimpleState({
    database: mock.database as never,
    conversationId: "conversation-1",
    text: "Yes, we can handle that custom ceremony detail.",
    sentAt: new Date("2026-06-25T10:00:00.000Z"),
  });

  assert.equal(result.status, "recorded");
  assert.equal(mock.createdMessages.length, 1);
  assert.equal(mock.createdMessages[0]?.role, MessageRole.TOOL);
  assert.equal(mock.createdMessages[0]?.toolName, WEDDING_SALES_SIMPLE_STATE_TOOL_NAME);

  const state = (mock.createdMessages[0]?.toolResult as { state: Record<string, unknown> }).state;
  const replyMemory = state.replyMemory as {
    lastOutboundText?: string;
    manualIntervention?: {
      lastOwnerReplyText?: string;
      lastOwnerReplyAt?: string;
      source?: string;
      manualReplies?: unknown[];
    };
  };

  assert.equal(state.mode, "bot_paused");
  assert.equal(replyMemory.lastOutboundText, "Yes, we can handle that custom ceremony detail.");
  assert.equal(
    replyMemory.manualIntervention?.lastOwnerReplyText,
    "Yes, we can handle that custom ceremony detail.",
  );
  assert.equal(replyMemory.manualIntervention?.lastOwnerReplyAt, "2026-06-25T10:00:00.000Z");
  assert.equal(replyMemory.manualIntervention?.source, "telegram_owner");
  assert.equal(replyMemory.manualIntervention?.manualReplies?.length, 1);
  assert.deepEqual(mock.conversationUpdates, [{ status: ConversationStatus.ESCALATED }]);
});

test("resume appends active wedding-sales-simple state without editing the old paused snapshot", async () => {
  const mock = createMockDatabase({
    mode: "bot_paused",
    handoffReason: "unanswered_business_question",
    nextStep: "handoff",
    missingField: "location",
    responseDraft: "Paused reply",
    replyMemory: {
      manualIntervention: {
        lastOwnerReplyText: "Manual answer",
        lastOwnerReplyAt: "2026-06-25T10:00:00.000Z",
        source: "telegram_owner",
      },
    },
  });

  const result = await resumeWeddingSalesSimpleStateForConversation({
    database: mock.database as never,
    conversationId: "conversation-1",
  });

  assert.equal(result.status, "resumed");
  assert.equal(mock.createdMessages.length, 1);

  const state = (mock.createdMessages[0]?.toolResult as { state: Record<string, unknown> }).state;

  assert.equal(state.mode, "bot_active");
  assert.equal(state.handoffReason, undefined);
  assert.equal(state.nextStep, undefined);
  assert.equal(state.missingField, undefined);
  assert.equal(state.responseDraft, undefined);
  assert.deepEqual(mock.conversationUpdates, []);
});
