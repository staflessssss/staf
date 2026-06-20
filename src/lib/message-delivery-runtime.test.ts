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
        agent: {
          findFirst: async () => ({ id: "agent-1" }),
        },
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
        agent: {
          findFirst: async () => ({ id: "agent-1" }),
        },
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
      "Internal delayed follow-up task.\n\nWrite the next outbound message to the customer based on the existing conversation history.\n\nDo not mention this instruction, internal settings, automation, or that this is a follow-up task.\n\nFollow-up guidance: Just checking in. I can still help with pricing or booking when you're ready.",
    runtimeEvent: {
      type: "follow_up",
      guidance: "Just checking in. I can still help with pricing or booking when you're ready.",
    },
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
        agent: {
          findFirst: async () => ({ id: "agent-1" }),
        },
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
        agent: {
          findFirst: async () => ({ id: "agent-1" }),
        },
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
          findFirst: async () => ({
            id: "message-2",
          }),
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

test("processDelayedDeliveryByIdWithDeps auto-resumes a business-paused dialog", async () => {
  const updates: Array<Record<string, unknown>> = [];
  const savedMessages: Array<{ role: string; content: string; model?: string }> = [];
  const events: string[] = [];
  let sentMessage: unknown = null;

  const result = await messageDeliveryRuntimeTestHelpers.processDelayedDeliveryByIdWithDeps(
    "delivery-auto-resume",
    {
      db: {
        agent: {
          findFirst: async () => ({ id: "agent-1" }),
        },
        delayedDelivery: {
          updateMany: async () => ({ count: 1 }),
          findUnique: async () => ({
            id: "delivery-auto-resume",
            agentId: "agent-1",
            conversationId: "conv-auto-resume",
            kind: DelayedDeliveryKind.FOLLOW_UP,
            payload: {
              kind: "business_auto_resume",
              replyContext: {
                contactId: "contact-1",
                messageId: "message-id-1",
                threadId: "thread-1",
                subject: "Subject 1",
              },
              resumeMessage: "The agent is available again.",
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
              id: "conv-auto-resume",
              contactId: "contact-1",
              status: ConversationStatus.ESCALATED,
            },
          }),
          count: async () => 0,
          update: async (args: Record<string, unknown>) => {
            updates.push(args);
            return args;
          },
        },
        conversation: {
          update: async (args: Record<string, unknown>) => {
            events.push("conversation:update");
            updates.push(args);
            return args;
          },
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
            events.push("send");
            sentMessage = args;
            return { ok: true };
          },
        }) as never,
      invokeAgent: async () => {
        throw new Error("invokeAgent should not run for business auto-resume");
      },
      saveMessages: async (_conversationId, messages) => {
        events.push("save");
        savedMessages.push(...(messages as Array<{ role: string; content: string; model?: string }>));
      },
    },
    new Date("2026-04-20T16:00:00Z"),
  );

  assert.equal(result.ok, true);
  assert.equal(result.status, "business_auto_resumed");
  assert.deepEqual(sentMessage, {
    credentials: "decrypted:encrypted",
    contactId: "contact-1",
    message: "The agent is available again.",
    messageId: "message-id-1",
    threadId: "thread-1",
    subject: "Subject 1",
    attachments: undefined,
    channelConfig: {},
  });
  assert.deepEqual(savedMessages, [
    {
      role: "ASSISTANT",
      content: "The agent is available again.",
      model: "control-auto-resume",
    },
  ]);
  assert.equal(
    updates.some(
      (update) =>
        update.data &&
        typeof update.data === "object" &&
        (update.data as Record<string, unknown>).status === ConversationStatus.ACTIVE,
    ),
    true,
  );
  assert.deepEqual(events, ["send", "save", "conversation:update"]);
});

test("processDelayedDeliveryByIdWithDeps does not auto-resume while the agent is paused", async () => {
  let conversationUpdated = false;
  let sendCalled = false;

  const result = await messageDeliveryRuntimeTestHelpers.processDelayedDeliveryByIdWithDeps(
    "delivery-auto-resume-paused-agent",
    {
      db: {
        agent: {
          findFirst: async () => null,
        },
        delayedDelivery: {
          updateMany: async () => ({ count: 1 }),
          findUnique: async () => ({
            id: "delivery-auto-resume-paused-agent",
            agentId: "agent-1",
            conversationId: "conv-auto-resume",
            kind: DelayedDeliveryKind.FOLLOW_UP,
            payload: {
              kind: "business_auto_resume",
              resumeMessage: "The agent is available again.",
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
              id: "conv-auto-resume",
              contactId: "contact-1",
              status: ConversationStatus.ESCALATED,
            },
          }),
          update: async () => ({}),
        },
        conversation: {
          update: async () => {
            conversationUpdated = true;
            return {};
          },
        },
      } as never,
      decrypt: (value: string) => value,
      getChannelAdapter: () =>
        ({
          formatReply: (text: string) => text,
          sendReply: async () => {
            sendCalled = true;
            return { ok: true };
          },
        }) as never,
      invokeAgent: async () => {
        throw new Error("invokeAgent should not run for business auto-resume");
      },
      saveMessages: async () => {},
    },
    new Date("2026-04-20T16:00:00Z"),
  );

  assert.equal(result.ok, true);
  assert.equal(result.status, "business_auto_resume_suppressed_agent_paused");
  assert.equal(conversationUpdated, false);
  assert.equal(sendCalled, false);
});

test("processDelayedDeliveryByIdWithDeps does not resend an already-saved auto-resume message", async () => {
  let sendCalled = false;
  let saveCalled = false;

  const result = await messageDeliveryRuntimeTestHelpers.processDelayedDeliveryByIdWithDeps(
    "delivery-auto-resume-retry",
    {
      db: {
        agent: {
          findFirst: async () => ({ id: "agent-1" }),
        },
        delayedDelivery: {
          updateMany: async () => ({ count: 1 }),
          findUnique: async () => ({
            id: "delivery-auto-resume-retry",
            agentId: "agent-1",
            conversationId: "conv-auto-resume",
            kind: DelayedDeliveryKind.FOLLOW_UP,
            payload: {
              kind: "business_auto_resume",
              resumeMessage: "The agent is available again.",
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
              id: "conv-auto-resume",
              contactId: "contact-1",
              status: ConversationStatus.ESCALATED,
            },
          }),
          count: async () => 0,
          update: async (args: Record<string, unknown>) => args,
        },
        conversation: {
          update: async (args: Record<string, unknown>) => args,
        },
        message: {
          findFirst: async () => ({ id: "saved-resume-message" }),
        },
      } as never,
      decrypt: (value: string) => value,
      getChannelAdapter: () =>
        ({
          formatReply: (text: string) => text,
          sendReply: async () => {
            sendCalled = true;
            return { ok: true };
          },
        }) as never,
      invokeAgent: async () => {
        throw new Error("invokeAgent should not run for business auto-resume");
      },
      saveMessages: async () => {
        saveCalled = true;
      },
    },
    new Date("2026-04-20T16:00:00Z"),
  );

  assert.equal(result.ok, true);
  assert.equal(result.status, "business_auto_resumed");
  assert.equal(sendCalled, false);
  assert.equal(saveCalled, false);
});

test("processDelayedDeliveryByIdWithDeps resumes even when optional auto-resume message delivery fails", async () => {
  const updates: Array<Record<string, unknown>> = [];

  const result = await messageDeliveryRuntimeTestHelpers.processDelayedDeliveryByIdWithDeps(
    "delivery-auto-resume-send-fails",
    {
      db: {
        agent: {
          findFirst: async () => ({ id: "agent-1" }),
        },
        delayedDelivery: {
          updateMany: async (args: Record<string, unknown>) => {
            updates.push(args);
            return { count: 1 };
          },
          findUnique: async () => ({
            id: "delivery-auto-resume-send-fails",
            agentId: "agent-1",
            conversationId: "conv-auto-resume",
            kind: DelayedDeliveryKind.FOLLOW_UP,
            payload: {
              kind: "business_auto_resume",
              resumeMessage: "The agent is available again.",
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
              id: "conv-auto-resume",
              contactId: "contact-1",
              status: ConversationStatus.ESCALATED,
            },
          }),
          count: async () => 0,
          update: async (args: Record<string, unknown>) => {
            updates.push(args);
            return args;
          },
        },
        conversation: {
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
            throw new Error("channel unavailable");
          },
        }) as never,
      invokeAgent: async () => {
        throw new Error("invokeAgent should not run for business auto-resume");
      },
      saveMessages: async () => {
        throw new Error("saveMessages should not run after failed send");
      },
    },
    new Date("2026-04-20T16:00:00Z"),
  );

  assert.equal(result.ok, true);
  assert.equal(result.status, "business_auto_resumed_without_resume_message");
  assert.equal(
    updates.some(
      (update) =>
        update.data &&
        typeof update.data === "object" &&
        (update.data as Record<string, unknown>).status === ConversationStatus.ACTIVE,
    ),
    true,
  );
  assert.equal(
    updates.some(
      (update) =>
        update.data &&
        typeof update.data === "object" &&
        (update.data as Record<string, unknown>).status === DelayedDeliveryStatus.SENT,
    ),
    true,
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
        agent: {
          findFirst: async () => ({ id: "agent-1" }),
        },
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

test("processDelayedDeliveryByIdWithDeps cancels buffered reply superseded while processing", async () => {
  const updates: Record<string, unknown>[] = [];
  const deletedMessages: Record<string, unknown>[] = [];
  let sendReplyCalled = false;
  const now = new Date("2026-04-20T16:00:00.000Z");

  const result = await messageDeliveryRuntimeTestHelpers.processDelayedDeliveryByIdWithDeps(
    "delivery-buffered-race",
    {
      db: {
        agent: {
          findFirst: async () => ({ id: "agent-1" }),
        },
        delayedDelivery: {
          updateMany: async () => ({ count: 1 }),
          findUnique: async () => ({
            id: "delivery-buffered-race",
            agentId: "agent-1",
            conversationId: "conv-buffered-race",
            kind: DelayedDeliveryKind.BUFFERED_REPLY,
            attempts: 1,
            payload: {
              replyContext: {
                contactId: "contact-buffered-race",
              },
              triggerMessageId: "message-old",
            },
            agent: {
              id: "agent-1",
              tenantId: "tenant-1",
              status: AgentStatus.ACTIVE,
              channelConfig: {},
              channel: {
                type: ChannelType.INSTAGRAM,
                credentialsEnc: "encrypted",
              },
            },
            conversation: {
              id: "conv-buffered-race",
              status: ConversationStatus.ACTIVE,
            },
          }),
          count: async () => 0,
          update: async (args: Record<string, unknown>) => {
            updates.push(args);
            return args;
          },
          findMany: async () => [],
          create: async (args: Record<string, unknown>) => args,
        },
        message: {
          findMany: async () => [
            {
              id: "message-old",
              role: MessageRole.USER,
              content: "Who is the shooter?",
              createdAt: new Date("2026-04-20T15:59:00.000Z"),
            },
          ],
          findFirst: async () => ({
            id: "message-new",
          }),
          deleteMany: async (args: Record<string, unknown>) => {
            deletedMessages.push(args);
            return { count: 1 };
          },
        },
      } as never,
      decrypt: (value: string) => value,
      getChannelAdapter: () =>
        ({
          formatReply: (text: string) => text,
          sendReply: async () => {
            sendReplyCalled = true;
            return { ok: true };
          },
        }) as never,
      invokeAgent: async () => ({
        message: "What time works best for the quick call?",
        promptPreview: "prompt",
        usedTooling: [],
        conversationId: "conv-buffered-race",
        model: "test-model",
      }),
      saveMessages: async () => {
        throw new Error("saveMessages should not run for a superseded buffered reply");
      },
    },
    now,
  );

  assert.equal(result.ok, true);
  assert.equal(result.status, "buffered_delivery_superseded_during_processing");
  assert.equal(sendReplyCalled, false);
  assert.equal(deletedMessages.length, 1);
  assert.equal(
    deletedMessages[0]?.where && typeof deletedMessages[0].where === "object"
      ? (deletedMessages[0].where as Record<string, unknown>).conversationId
      : null,
    "conv-buffered-race",
  );
  assert.equal(
    updates[0]?.data && typeof updates[0].data === "object"
      ? (updates[0].data as Record<string, unknown>).status
      : null,
    DelayedDeliveryStatus.CANCELED,
  );
});

test("processDelayedDeliveryByIdWithDeps does not retry a partial Instagram delivery", async () => {
  const updates: Record<string, unknown>[] = [];
  const now = new Date("2026-04-20T16:00:00.000Z");

  const result = await messageDeliveryRuntimeTestHelpers.processDelayedDeliveryByIdWithDeps(
    "delivery-partial",
    {
      db: {
        agent: {
          findFirst: async () => ({ id: "agent-1" }),
        },
        delayedDelivery: {
          updateMany: async () => ({ count: 1 }),
          findUnique: async () => ({
            id: "delivery-partial",
            agentId: "agent-1",
            conversationId: "conv-partial",
            kind: DelayedDeliveryKind.FOLLOW_UP,
            attempts: 1,
            payload: {
              replyContext: {
                contactId: "contact-partial",
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
                type: ChannelType.INSTAGRAM,
                credentialsEnc: "encrypted",
              },
            },
            conversation: {
              id: "conv-partial",
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
          createMany: async () => ({ count: 1 }),
          findFirst: async () => null,
        },
      } as never,
      decrypt: (value: string) => value,
      getChannelAdapter: () =>
        ({
          formatReply: (text: string) => [text, "Second part"],
          sendReply: async () => ({
            ok: false,
            mode: "meta_partial_delivery",
            deliveredCount: 1,
            totalParts: 2,
            deliveries: [{ message_id: "mid-delivered" }],
            error: "Meta unavailable",
          }),
        }) as never,
      invokeAgent: async () => ({
        message: "Generated follow-up",
        promptPreview: "prompt",
        usedTooling: [],
        conversationId: "conv-partial",
        model: "test-model",
      }),
      saveMessages: async () => {
        throw new Error("saveMessages should not run on failed send");
      },
    },
    now,
  );

  assert.equal(result.ok, false);
  assert.equal(result.status, "delayed_delivery_partial_failed");
  assert.equal(updates.length, 1);
  assert.equal(
    updates[0]?.data && typeof updates[0].data === "object"
      ? (updates[0].data as Record<string, unknown>).status
      : null,
    DelayedDeliveryStatus.FAILED,
  );
});
