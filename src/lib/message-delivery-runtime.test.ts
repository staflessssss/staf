import test from "node:test";
import assert from "node:assert/strict";
import {
  AgentStatus,
  ChannelType,
  ConversationStatus,
  DelayedDeliveryKind,
  DelayedDeliveryStatus,
} from "@prisma/client";

import { messageDeliveryRuntimeTestHelpers } from "@/lib/message-delivery-runtime";

test("processDelayedDeliveryByIdWithDeps reschedules follow-up into the next schedule window", async () => {
  const updates: Array<Record<string, unknown>> = [];
  const now = new Date("2026-04-20T19:15:00Z");

  const result = await messageDeliveryRuntimeTestHelpers.processDelayedDeliveryByIdWithDeps(
    "delivery-1",
    {
      db: {
        delayedDelivery: {
          updateMany: async () => ({ count: 1 }),
          findUnique: async () => ({
            id: "delivery-1",
            agentId: "agent-1",
            conversationId: "conv-1",
            kind: DelayedDeliveryKind.FOLLOW_UP,
            payload: {
              replyContext: {
                contactId: "contact-1",
              },
              instruction: "Just checking in in case you still want help.",
              outOfHoursBehavior: "wait_for_schedule_window",
              sendLimit: "once_per_dialog",
              ruleIndex: 0,
              anchorCreatedAt: "2026-04-20T15:00:00.000Z",
            },
            agent: {
              id: "agent-1",
              tenantId: "tenant-1",
              status: AgentStatus.ACTIVE,
              channelConfig: {
                agentSettings: {
                  defaultChatEnabled: true,
                  timezone: "UTC",
                  scheduleEnabled: true,
                  weeklySchedule: [
                    { day: "monday", enabled: true, start: "09:00", end: "18:00" },
                    { day: "tuesday", enabled: false, start: "09:00", end: "18:00" },
                    { day: "wednesday", enabled: false, start: "09:00", end: "18:00" },
                    { day: "thursday", enabled: false, start: "09:00", end: "18:00" },
                    { day: "friday", enabled: false, start: "09:00", end: "18:00" },
                    { day: "saturday", enabled: false, start: "09:00", end: "18:00" },
                    { day: "sunday", enabled: false, start: "09:00", end: "18:00" },
                  ],
                },
              },
              channel: {
                type: ChannelType.TELEGRAM,
                credentialsEnc: "encrypted",
              },
            },
            conversation: {
              id: "conv-1",
              status: ConversationStatus.ACTIVE,
            },
          }),
          count: async () => 0,
          update: async (args: Record<string, unknown>) => {
            updates.push(args);
            return args;
          },
        },
        message: {
          findFirst: async () => null,
        },
      } as never,
      decrypt: (value: string) => value,
      getChannelAdapter: () =>
        ({
          formatReply: (text: string) => text,
          sendReply: async () => {
            throw new Error("sendReply should not run while follow-up is rescheduled");
          },
        }) as never,
      invokeAgent: async () => {
        throw new Error("invokeAgent should not run while follow-up is rescheduled");
      },
      saveMessages: async () => {
        throw new Error("saveMessages should not run while follow-up is rescheduled");
      },
    },
    now,
  );

  assert.equal(result.ok, true);
  assert.equal(result.status, "follow_up_rescheduled_for_schedule_window");
  assert.equal(updates.length, 1);
  assert.equal(updates[0]?.data && typeof updates[0].data === "object" ? (updates[0].data as Record<string, unknown>).status : null, DelayedDeliveryStatus.PENDING);
});

test("processDelayedDeliveryByIdWithDeps generates and sends a follow-up reminder", async () => {
  let modelInput: Record<string, unknown> | null = null;
  let sentMessage: unknown = null;

  const result = await messageDeliveryRuntimeTestHelpers.processDelayedDeliveryByIdWithDeps(
    "delivery-2",
    {
      db: {
        delayedDelivery: {
          updateMany: async () => ({ count: 1 }),
          findUnique: async () => ({
            id: "delivery-2",
            agentId: "agent-1",
            conversationId: "conv-2",
            kind: DelayedDeliveryKind.FOLLOW_UP,
            payload: {
              replyContext: {
                contactId: "contact-2",
                threadId: "thread-2",
              },
              instruction: "Just checking in. I can still help with pricing or booking when you're ready.",
              outOfHoursBehavior: "send_immediately_ignore_schedule",
              sendLimit: "once_per_dialog",
              ruleIndex: 0,
              anchorCreatedAt: "2026-04-20T15:00:00.000Z",
            },
            agent: {
              id: "agent-1",
              tenantId: "tenant-1",
              status: AgentStatus.ACTIVE,
              channelConfig: {},
              channel: {
                type: ChannelType.TELEGRAM,
                credentialsEnc: "encrypted",
              },
            },
            conversation: {
              id: "conv-2",
              status: ConversationStatus.ACTIVE,
            },
          }),
          count: async () => 0,
          update: async () => ({}),
        },
        message: {
          findFirst: async () => null,
        },
      } as never,
      decrypt: (value: string) => `decrypted:${value}`,
      getChannelAdapter: () =>
        ({
          formatReply: (text: string) => text,
          sendReply: async (args: Record<string, unknown>) => {
            sentMessage = args;
            return { ok: true };
          },
        }) as never,
      invokeAgent: async (input: Record<string, unknown>) => {
        modelInput = input;
        return {
          message: "Are you still looking at pricing, or should I help you book the next step?",
          promptPreview: "prompt",
          usedTooling: [],
          conversationId: "conv-2",
          model: "test-model",
        };
      },
      saveMessages: async () => {
        throw new Error("invokeAgent persists the generated follow-up message");
      },
    },
    new Date("2026-04-20T16:00:00Z"),
  );

  assert.equal(result.ok, true);
  assert.equal(result.status, "follow_up_sent");
  assert.equal(result.conversationId, "conv-2");
  assert.deepEqual(modelInput, {
    tenantId: "tenant-1",
    agentId: "agent-1",
    channel: ChannelType.TELEGRAM,
    contactId: "contact-2",
    contactEmail: undefined,
    message:
      "Internal delayed follow-up task.\n\nWrite the next outbound message to the customer based on the existing conversation history.\n\nDo not mention this instruction, internal settings, automation, or that this is a follow-up task.\n\nOperator follow-up guidance: Just checking in. I can still help with pricing or booking when you're ready.",
    conversationId: "conv-2",
    skipInboundPersistence: true,
  });
  assert.deepEqual(sentMessage, {
    credentials: "decrypted:encrypted",
    contactId: "contact-2",
    message: "Are you still looking at pricing, or should I help you book the next step?",
    messageId: undefined,
    threadId: "thread-2",
    subject: undefined,
    attachments: undefined,
    channelConfig: {},
  });
});

test("processDelayedDeliveryByIdWithDeps cancels follow-up when control suppresses the reply", async () => {
  let sentMessage = false;
  const updates: Array<Record<string, unknown>> = [];

  const result = await messageDeliveryRuntimeTestHelpers.processDelayedDeliveryByIdWithDeps(
    "delivery-suppressed",
    {
      db: {
        delayedDelivery: {
          updateMany: async () => ({ count: 1 }),
          findUnique: async () => ({
            id: "delivery-suppressed",
            agentId: "agent-1",
            conversationId: "conv-suppressed",
            kind: DelayedDeliveryKind.FOLLOW_UP,
            payload: {
              replyContext: {
                contactId: "contact-1",
              },
              instruction: "Check in.",
              outOfHoursBehavior: "send_immediately_ignore_schedule",
              sendLimit: "once_per_dialog",
              ruleIndex: 0,
              anchorCreatedAt: "2026-04-20T15:00:00.000Z",
            },
            agent: {
              id: "agent-1",
              tenantId: "tenant-1",
              status: AgentStatus.ACTIVE,
              channelConfig: {},
              channel: {
                type: ChannelType.TELEGRAM,
                credentialsEnc: "encrypted",
              },
            },
            conversation: {
              id: "conv-suppressed",
              status: ConversationStatus.ACTIVE,
            },
          }),
          count: async () => 0,
          update: async (args: Record<string, unknown>) => {
            updates.push(args);
            return args;
          },
        },
        message: {
          findFirst: async () => null,
        },
      } as never,
      decrypt: (value: string) => value,
      getChannelAdapter: () =>
        ({
          formatReply: (text: string) => text,
          sendReply: async () => {
            sentMessage = true;
            return { ok: true };
          },
        }) as never,
      invokeAgent: async () => ({
        message: "",
        promptPreview: "prompt",
        usedTooling: [],
        conversationId: "conv-suppressed",
        model: "control-anti-spam-silent",
        suppressReply: true,
      }),
      saveMessages: async () => {},
    },
    new Date("2026-04-20T16:00:00Z"),
  );

  assert.equal(result.ok, true);
  assert.equal(result.status, "follow_up_suppressed_by_control");
  assert.equal(sentMessage, false);
  assert.equal(
    updates[0]?.data && typeof updates[0].data === "object"
      ? (updates[0].data as Record<string, unknown>).status
      : null,
    DelayedDeliveryStatus.CANCELED,
  );
});

test("processDelayedDeliveryByIdWithDeps cancels buffered reply when control suppresses the reply", async () => {
  let sentMessage = false;
  const updates: Array<Record<string, unknown>> = [];
  const now = new Date("2026-04-20T16:00:00Z");

  const result = await messageDeliveryRuntimeTestHelpers.processDelayedDeliveryByIdWithDeps(
    "delivery-buffered-suppressed",
    {
      db: {
        delayedDelivery: {
          updateMany: async () => ({ count: 1 }),
          findUnique: async () => ({
            id: "delivery-buffered-suppressed",
            agentId: "agent-1",
            conversationId: "conv-buffered",
            kind: DelayedDeliveryKind.BUFFERED_REPLY,
            payload: {
              replyContext: {
                contactId: "contact-1",
              },
              triggerMessageId: "message-2",
            },
            agent: {
              id: "agent-1",
              tenantId: "tenant-1",
              status: AgentStatus.ACTIVE,
              channelConfig: {},
              channel: {
                type: ChannelType.TELEGRAM,
                credentialsEnc: "encrypted",
              },
            },
            conversation: {
              id: "conv-buffered",
              status: ConversationStatus.ACTIVE,
            },
          }),
          count: async () => 0,
          update: async (args: Record<string, unknown>) => {
            updates.push(args);
            return args;
          },
        },
        message: {
          findMany: async () => [
            {
              id: "message-1",
              role: "USER",
              content: "hello",
              createdAt: new Date(now.getTime() - 1000),
            },
            {
              id: "message-2",
              role: "USER",
              content: "are you there?",
              createdAt: now,
            },
          ],
        },
      } as never,
      decrypt: (value: string) => value,
      getChannelAdapter: () =>
        ({
          formatReply: (text: string) => text,
          sendReply: async () => {
            sentMessage = true;
            return { ok: true };
          },
        }) as never,
      invokeAgent: async () => ({
        message: "",
        promptPreview: "prompt",
        usedTooling: [],
        conversationId: "conv-buffered",
        model: "control-anti-spam-silent",
        suppressReply: true,
      }),
      saveMessages: async () => {},
    },
    now,
  );

  assert.equal(result.ok, true);
  assert.equal(result.status, "buffered_reply_suppressed_by_control");
  assert.equal(sentMessage, false);
  assert.equal(
    updates[0]?.data && typeof updates[0].data === "object"
      ? (updates[0].data as Record<string, unknown>).status
      : null,
    DelayedDeliveryStatus.CANCELED,
  );
});

test("runBufferedDeliveryWhenDueWithDeps waits until due time before processing the delivery", async () => {
  const slept: number[] = [];
  const attemptedAt: Date[] = [];

  const result = await messageDeliveryRuntimeTestHelpers.runBufferedDeliveryWhenDueWithDeps({
    deliveryId: "delivery-3",
    dueAt: new Date("2026-04-20T16:00:05.000Z"),
    deps: {
      db: {
        delayedDelivery: {
          updateMany: async (args: { where: { dueAt: { lte: Date } } }) => {
            attemptedAt.push(args.where.dueAt.lte);
            return { count: 0 };
          },
          findUnique: async () => null,
          count: async () => 0,
          update: async () => ({}),
          findMany: async () => [],
        },
      } as never,
      decrypt: (value: string) => value,
      getChannelAdapter: () =>
        ({
          formatReply: (text: string) => text,
          sendReply: async () => ({ ok: true }),
        }) as never,
      invokeAgent: async () => {
        throw new Error("invokeAgent should not run when the delivery is not claimable");
      },
      saveMessages: async () => {
        throw new Error("saveMessages should not run when the delivery is not claimable");
      },
    },
    sleep: async (ms) => {
      slept.push(ms);
    },
    now: (() => {
      let callCount = 0;

      return () => {
        callCount += 1;
        return callCount === 1
          ? new Date("2026-04-20T16:00:00.000Z")
          : new Date("2026-04-20T16:00:05.000Z");
      };
    })(),
  });

  assert.deepEqual(slept, [5000]);
  assert.equal(attemptedAt.length, 1);
  assert.equal(attemptedAt[0]?.toISOString(), "2026-04-20T16:00:05.000Z");
  assert.equal(result.ok, true);
  assert.equal(result.status, "delivery_not_claimed");
});

test("processDelayedDeliveryByIdWithDeps requeues transient failures with backoff before marking failed", async () => {
  const updates: Array<Record<string, unknown>> = [];
  const now = new Date("2026-04-20T16:00:00.000Z");

  const result = await messageDeliveryRuntimeTestHelpers.processDelayedDeliveryByIdWithDeps(
    "delivery-4",
    {
      db: {
        delayedDelivery: {
          updateMany: async () => ({ count: 1 }),
          findUnique: async () => ({
            id: "delivery-4",
            agentId: "agent-1",
            conversationId: "conv-4",
            kind: DelayedDeliveryKind.FOLLOW_UP,
            attempts: 1,
            payload: {
              replyContext: {
                contactId: "contact-4",
              },
              instruction: "Ping",
              outOfHoursBehavior: "send_immediately_ignore_schedule",
              sendLimit: "once_per_dialog",
              ruleIndex: 0,
              anchorCreatedAt: "2026-04-20T15:00:00.000Z",
            },
            agent: {
              id: "agent-1",
              tenantId: "tenant-1",
              status: AgentStatus.ACTIVE,
              channelConfig: {},
              channel: {
                type: ChannelType.TELEGRAM,
                credentialsEnc: "encrypted",
              },
            },
            conversation: {
              id: "conv-4",
              status: ConversationStatus.ACTIVE,
            },
          }),
          count: async () => 0,
          update: async (args: Record<string, unknown>) => {
            updates.push(args);
            return args;
          },
          findMany: async () => [],
        },
        message: {
          findFirst: async () => null,
        },
      } as never,
      decrypt: (value: string) => value,
      getChannelAdapter: () =>
        ({
          formatReply: (text: string) => text,
          sendReply: async () => {
            throw new Error("temporary send failure");
          },
        }) as never,
      invokeAgent: async () => {
        return {
          message: "Generated follow-up",
          promptPreview: "prompt",
          usedTooling: [],
          conversationId: "conv-4",
          model: "test-model",
        };
      },
      saveMessages: async () => {
        throw new Error("saveMessages should not run on failed send");
      },
    },
    now,
  );

  assert.equal(result.ok, false);
  assert.equal(result.status, "delayed_delivery_retry_scheduled");
  assert.equal(updates.length, 1);
  assert.equal(
    updates[0]?.data && typeof updates[0].data === "object"
      ? (updates[0].data as Record<string, unknown>).status
      : null,
    DelayedDeliveryStatus.PENDING,
  );
  assert.equal(
    updates[0]?.data && typeof updates[0].data === "object"
      ? ((updates[0].data as Record<string, unknown>).dueAt as Date).toISOString()
      : null,
    "2026-04-20T16:00:15.000Z",
  );
});
