import test from "node:test";
import assert from "node:assert/strict";
import { DelayedDeliveryKind } from "@prisma/client";

import {
  buildWeddingSalesSimpleSlotFollowUpText,
  scheduleWeddingSalesSimpleSlotFollowUpsForReplyWithDb,
  weddingSalesSimpleSlotIsStillMissing,
} from "@/lib/agents/wedding-sales-simple/followups";

test("schedules 1/3/7 day slot follow-ups when simple runtime asked for names", async () => {
  const created: Array<Record<string, unknown>> = [];
  const logs: Array<Record<string, unknown>> = [];

  const result = await scheduleWeddingSalesSimpleSlotFollowUpsForReplyWithDb({
    database: {
      delayedDelivery: {
        findMany: async () => [],
        updateMany: async () => ({ count: 0 }),
        create: async (args: Record<string, unknown>) => {
          created.push(args);
          return args;
        },
      },
      message: {
        create: async (args: Record<string, unknown>) => {
          logs.push(args);
          return args;
        },
      },
    } as never,
    agentId: "agent-1",
    conversationId: "conv-1",
    replyContext: { contactId: "contact-1" },
    anchorCreatedAt: new Date("2026-06-29T12:00:00.000Z"),
    anchorAssistantMessageId: "assistant-1",
    state: {
      mode: "bot_active",
      bookingConfirmed: false,
      location: "Tampa",
      replyMemory: {
        turnIndex: 2,
        lastRequiredQuestion: "names",
      },
      decisionTrace: {
        extractedFacts: {},
        missingFields: ["names"],
        nextStep: "ask_missing_info",
        replyType: "availability_available",
        reason: "date available",
      },
    },
  });

  assert.equal(result.length, 3);
  assert.equal(created.length, 3);
  const firstData = created[0]?.data as Record<string, unknown>;
  assert.equal(firstData.kind, DelayedDeliveryKind.FOLLOW_UP);
  assert.equal((firstData.payload as Record<string, unknown>).kind, "wedding_sales_simple_slot_follow_up");
  assert.equal((firstData.payload as Record<string, unknown>).chainId, "conv-1:names:turn-2:assistant-1");
  assert.equal((firstData.payload as Record<string, unknown>).slot, "names");
  assert.equal((firstData.payload as Record<string, unknown>).stage, "day_1");
  assert.equal((firstData.payload as Record<string, unknown>).responseKey, "utter_follow_up_names");
  assert.equal(logs.length, 1);
});

test("does not schedule simple slot follow-ups for booking confirmed state", async () => {
  const created: Array<Record<string, unknown>> = [];

  const result = await scheduleWeddingSalesSimpleSlotFollowUpsForReplyWithDb({
    database: {
      delayedDelivery: {
        findMany: async () => [],
        updateMany: async () => ({ count: 0 }),
        create: async (args: Record<string, unknown>) => {
          created.push(args);
          return args;
        },
      },
      message: {
        create: async () => ({}),
      },
    } as never,
    agentId: "agent-1",
    conversationId: "conv-1",
    replyContext: { contactId: "contact-1" },
    anchorCreatedAt: new Date("2026-06-29T12:00:00.000Z"),
    anchorAssistantMessageId: "assistant-1",
    state: {
      mode: "bot_active",
      bookingConfirmed: true,
      replyMemory: {
        lastRequiredQuestion: "names",
      },
    },
  });

  assert.deepEqual(result, []);
  assert.equal(created.length, 0);
});

test("slot missing helper treats booking confirmation as active command only while pending", () => {
  assert.equal(
    weddingSalesSimpleSlotIsStillMissing("bookingConfirmation", {
      bookingConfirmed: false,
      pendingUserAction: {
        type: "booking_confirmation",
        slot: "1:30 PM",
        email: "client@example.com",
      },
    }),
    true,
  );

  assert.equal(
    weddingSalesSimpleSlotIsStillMissing("bookingConfirmation", {
      bookingConfirmed: true,
      pendingUserAction: null,
    }),
    false,
  );
});

test("builds deterministic booking confirmation follow-up copy", () => {
  assert.equal(
    buildWeddingSalesSimpleSlotFollowUpText({
      kind: "wedding_sales_simple_slot_follow_up",
      chainId: "chain-1",
      slot: "bookingConfirmation",
      stage: "day_1",
      responseKey: "utter_follow_up_booking_confirmation",
      replyContext: { contactId: "contact-1" },
      anchorCreatedAt: "2026-06-29T12:00:00.000Z",
      anchorTurnIndex: 4,
      anchorAssistantMessageId: "assistant-1",
      lastRequiredQuestion: "bookingConfirmation",
      proposedCallTimeDisplay: "1:30 PM",
      stateSnapshot: {},
      killOnUserMessage: true,
    }),
    "Quick check - would you still like me to lock in 1:30 PM? 🤍",
  );
});
