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
  assert.equal((firstData.payload as Record<string, unknown>).context, undefined);
  assert.equal(logs.length, 1);
});

test("uses investment guide day 1 follow-up after available date price guide", async () => {
  const created: Array<Record<string, unknown>> = [];

  await scheduleWeddingSalesSimpleSlotFollowUpsForReplyWithDb({
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
      bookingConfirmed: false,
      location: "Tampa",
      replyMemory: {
        turnIndex: 2,
        lastRequiredQuestion: "names",
        mentioned: {
          guide: {
            mode: "image",
            reason: "availability_available",
            lastMentionedAt: "2026-06-29T12:00:00.000Z",
          },
        },
      },
      decisionTrace: {
        extractedFacts: {},
        missingFields: ["names"],
        nextStep: "ask_missing_info",
        replyType: "availability_available",
        responseKey: "utter_availability_available_ask_names",
        reason: "date available",
      },
    },
  });

  const firstPayload = created[0]?.data
    ? ((created[0].data as Record<string, unknown>).payload as Record<string, unknown>)
    : null;
  const secondPayload = created[1]?.data
    ? ((created[1].data as Record<string, unknown>).payload as Record<string, unknown>)
    : null;

  assert.equal(firstPayload?.context, "availability_price_guide");
  assert.equal(secondPayload?.context, "availability_price_guide");
  assert.match(buildWeddingSalesSimpleSlotFollowUpText(firstPayload as never), /investment guide/);
  assert.match(buildWeddingSalesSimpleSlotFollowUpText(firstPayload as never), /Summer Special with 20% off ends July 15/);
  assert.match(buildWeddingSalesSimpleSlotFollowUpText(firstPayload as never), /What are both of your names?/);
  assert.doesNotMatch(buildWeddingSalesSimpleSlotFollowUpText(secondPayload as never), /Summer Special with 20% off ends July 15/);
});

test("schedule supports short follow-up intervals through env overrides", async () => {
  const previousDay1 = process.env.WEDDING_FOLLOWUP_DAY_1_MINUTES;
  const previousDay3 = process.env.WEDDING_FOLLOWUP_DAY_3_MINUTES;
  const previousDay7 = process.env.WEDDING_FOLLOWUP_DAY_7_MINUTES;
  process.env.WEDDING_FOLLOWUP_DAY_1_MINUTES = "2";
  process.env.WEDDING_FOLLOWUP_DAY_3_MINUTES = "4";
  process.env.WEDDING_FOLLOWUP_DAY_7_MINUTES = "6";

  try {
    const created: Array<Record<string, unknown>> = [];
    const anchorCreatedAt = new Date("2026-06-29T12:00:00.000Z");

    await scheduleWeddingSalesSimpleSlotFollowUpsForReplyWithDb({
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
      anchorCreatedAt,
      anchorAssistantMessageId: "assistant-1",
      state: {
        mode: "bot_active",
        bookingConfirmed: false,
        replyMemory: {
          turnIndex: 2,
          lastRequiredQuestion: "venue",
        },
      },
    });

    assert.deepEqual(
      created.map((entry) =>
        ((entry.data as Record<string, unknown>).dueAt as Date).getTime() -
        anchorCreatedAt.getTime(),
      ),
      [2 * 60 * 1000, 4 * 60 * 1000, 6 * 60 * 1000],
    );
  } finally {
    if (previousDay1 === undefined) {
      delete process.env.WEDDING_FOLLOWUP_DAY_1_MINUTES;
    } else {
      process.env.WEDDING_FOLLOWUP_DAY_1_MINUTES = previousDay1;
    }

    if (previousDay3 === undefined) {
      delete process.env.WEDDING_FOLLOWUP_DAY_3_MINUTES;
    } else {
      process.env.WEDDING_FOLLOWUP_DAY_3_MINUTES = previousDay3;
    }

    if (previousDay7 === undefined) {
      delete process.env.WEDDING_FOLLOWUP_DAY_7_MINUTES;
    } else {
      process.env.WEDDING_FOLLOWUP_DAY_7_MINUTES = previousDay7;
    }
  }
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
