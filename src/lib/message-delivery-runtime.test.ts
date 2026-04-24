import test from "node:test";
import assert from "node:assert/strict";
import {
  AgentStatus,
  ChannelType,
  ConversationStatus,
  DelayedDeliveryKind,
  DelayedDeliveryStatus,
  MessageRole,
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
        throw new Error("invokeAgent is not used for literal follow-up delivery");
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

test("processDelayedDeliveryByIdWithDeps sends a follow-up reminder and persists the assistant message", async () => {
  const savedMessages: Array<{ conversationId: string; messages: unknown[] }> = [];
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
      invokeAgent: async () => {
        throw new Error("invokeAgent is not used for literal follow-up delivery");
      },
      saveMessages: async (conversationId: string, messages: unknown[]) => {
        savedMessages.push({ conversationId, messages });
      },
    },
    new Date("2026-04-20T16:00:00Z"),
  );

  assert.equal(result.ok, true);
  assert.equal(result.status, "follow_up_sent");
  assert.deepEqual(sentMessage, {
    credentials: "decrypted:encrypted",
    contactId: "contact-2",
    message: "Just checking in. I can still help with pricing or booking when you're ready.",
    messageId: undefined,
    threadId: "thread-2",
    subject: undefined,
    attachments: undefined,
    channelConfig: {},
  });
  assert.equal(savedMessages.length, 1);
  assert.deepEqual(savedMessages[0], {
    conversationId: "conv-2",
    messages: [
      {
        role: MessageRole.ASSISTANT,
        content: "Just checking in. I can still help with pricing or booking when you're ready.",
        model: "message-follow-up",
        toolInput: {
          delayedDeliveryId: "delivery-2",
          kind: "follow_up",
          ruleIndex: 0,
        },
      },
    ],
  });
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
        throw new Error("invokeAgent is not used for literal follow-up delivery");
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
