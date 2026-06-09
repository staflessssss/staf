import test from "node:test";
import assert from "node:assert/strict";
import { AgentStatus, ConversationStatus, MessageRole } from "@prisma/client";

import { aiRuntimeTestHelpers, invokeAgent } from "@/lib/ai-runtime";
import { getDefaultControlConfig } from "@/lib/agent-config";
import { splitOutgoingMessage } from "@/lib/channels/message-behavior";

test("gmail classifier mirrors n8n client/other routing rules", () => {
  assert.deepEqual(
    aiRuntimeTestHelpers.classifyGmailClientMessage({
      subject: "Re: Wedding video",
      message: "Can we do tomorrow at 10?",
    }),
    {
      kind: "client",
      reason: "reply_thread",
    },
  );
  assert.deepEqual(
    aiRuntimeTestHelpers.classifyGmailClientMessage({
      subject: "Timeline",
      message: "Please send the vendor list and COI.",
    }),
    {
      kind: "other",
      reason: "non_client_signal",
    },
  );
  assert.equal(
    aiRuntimeTestHelpers.classifyGmailClientMessage({
      subject: "Availability",
      message: "June 14 2027",
    }).kind,
    "client",
  );
});

test("handleIncomingEventWithDeps ignores Gmail non-client messages when classifier is enabled", async () => {
  const fakeDb = {
    agent: {
      findFirst: async () => ({
        id: "agent-1",
        tenantId: "tenant-1",
        channelConfig: {
          gmailClientClassifier: {
            enabled: true,
          },
        },
        channel: {
          type: "GMAIL",
          credentialsEnc: "encrypted",
        },
      }),
    },
  } as never;
  let invokeCalled = false;

  const result = await aiRuntimeTestHelpers.handleIncomingEventWithDeps(
    {
      agentId: "agent-1",
      channel: "GMAIL" as never,
      payload: {},
    },
    {
      db: fakeDb,
      decrypt: (value: string) => value,
      invokeAgent: async () => {
        invokeCalled = true;
        throw new Error("invokeAgent should not run");
      },
      getChannelAdapter: () =>
        ({
          parseIncoming: () => ({
            contactId: "planner@example.com",
            contactEmail: "planner@example.com",
            message: "Can you send the wedding timeline and vendor list?",
            subject: "Timeline",
          }),
          formatReply: (text: string) => text,
          sendReply: async () => {
            throw new Error("sendReply should not run");
          },
        }) as never,
      sleep: async () => {},
    },
  );

  assert.equal(result.ok, true);
  assert.equal("status" in result ? result.status : null, "ignored_gmail_non_client_message");
  assert.equal(invokeCalled, false);
});

test("invokeAgent sandbox mentions runtime tooling from functionBlocks", async () => {
  const result = await invokeAgent({
    tenantId: "tenant-1",
    channel: "INSTAGRAM",
    contactId: "sandbox-contact",
    message: "Is July 14 available?",
    promptPreview: "preview",
    languagePreference: "English",
    knowledgeBlocks: [
      {
        name: "Services",
        description: "Wedding films",
        knowledgeContent: "We focus on weddings.",
      },
    ],
    functionBlocks: [
      {
        name: "Calendar check",
        description: "Verify date availability",
        active: true,
        parameters: [],
        reactionAction: "ai_agent_decides",
        postAction: "continue_dialog",
        disableDelayedMessages: false,
        resultTargets: [],
        steps: [
          {
            integrationId: "integration-calendar",
            action: "check calendar",
            params: {},
          },
        ],
      },
    ],
  });

  assert.match(result.message, /multilingual-first/i);
  assert.doesNotMatch(result.message, /default business voice in English/i);
  assert.match(result.message, /shared runtime configuration/i);
  assert.match(result.message, /configured tools/i);
  assert.deepEqual(result.usedTooling, ["Calendar check"]);
});

test("invokeAgent sandbox stays multilingual-first without tools", async () => {
  const result = await invokeAgent({
    tenantId: "tenant-1",
    channel: "TELEGRAM",
    contactId: "sandbox-contact",
    message: "Please book me in and capture this lead.",
  });

  assert.match(result.message, /multilingual-first/i);
  assert.match(result.message, /No runtime tool needed/i);
  assert.deepEqual(result.usedTooling, []);
});

test("finalizeAssistantText strips emojis outside the allowed set", () => {
  const finalized = aiRuntimeTestHelpers.finalizeAssistantText({
    text: "Thanks so much 😊 Sunset in Miami feels amazing 🤍",
    toolExecutions: [],
  });

  assert.equal(finalized.includes("😊"), false);
  assert.equal(finalized.includes("🤍"), true);
});

test("finalizeAssistantText softens false booking confirmations without a booking result", () => {
  const finalized = aiRuntimeTestHelpers.finalizeAssistantText({
    text: `You're all set for Monday at 11:30 AM Eastern.\n\nTaras Mynd\nFounder & Creative Director / MYNDFUL FILMS LLC`,
    toolExecutions: [
      {
        toolName: "Check consultation calendar",
        toolResult: {
          steps: [
            {
              result: {
                status: "available",
                date: "2026-04-20",
                time: "11:30",
              },
            },
          ],
        },
      },
    ],
  });

  assert.match(finalized, /looks available on my end/i);
  assert.doesNotMatch(finalized, /you'?re all set/i);
});

test("finalizeAssistantText does not rewrite unavailable wedding-date language", () => {
  const text = [
    "May 29, 2027 is already booked for Charlotte NC.",
    "We could still look at May 28 or May 30 if you have flexibility.",
  ].join("\n\n");
  const finalized = aiRuntimeTestHelpers.finalizeAssistantText({
    text,
    toolExecutions: [
      {
        toolName: "Check wedding availability",
        toolResult: {
          steps: [
            {
              result: {
                status: "unavailable",
                date: "2027-05-29",
                suggestedDates: ["2027-05-28", "2027-05-30"],
              },
            },
          ],
        },
      },
    ],
  });

  assert.equal(finalized, text);
  assert.doesNotMatch(finalized, /booking action has actually succeeded/i);
});

test("finalizeAssistantText rewrites successful test-mode booking into simulation language", () => {
  const finalized = aiRuntimeTestHelpers.finalizeAssistantText({
    text: `You're all set for Tuesday at 11:30 AM Eastern and the invite is on the way.\n\nTaras Mynd\nFounder & Creative Director / MYNDFUL FILMS LLC`,
    toolExecutions: [
      {
        toolName: "Book consultation call",
        toolResult: {
          steps: [
            {
              result: {
                status: "booked",
                mode: "test",
                date: "2026-04-21",
                time: "11:30",
              },
            },
          ],
        },
      },
    ],
  });

  assert.match(finalized, /test mode, this slot looks bookable/i);
  assert.match(finalized, /no real invite was sent/i);
  assert.doesNotMatch(finalized, /invite is on the way/i);
});

test("finalizeAssistantText asks for wedding year before guide or availability when year is missing", () => {
  const finalized = aiRuntimeTestHelpers.finalizeAssistantText({
    currentMessage: `Sure, we are Anna and Mark. Our wedding is June 14 in Charlotte.

вс, 17 мая 2026 г. в 16:54, Fhdh Fhdh <fhdhf2211@gmail.com>:`,
    text: `Thank you so much, Anna and Mark! Is your wedding on June 14th of this year, or 2025?

Also, here are a couple of our recent wedding films:
Callista and Kevin - Online Gallery

We'd be honored to create something timeless for you both 🤍`,
    toolExecutions: [],
  });

  assert.match(finalized, /which year your wedding is on June 14/i);
  assert.doesNotMatch(finalized, /this year|2025|collections guide|recent wedding films|Google Reviews/i);
});

test("extractDelayedFollowUpGuidance keeps delayed wedding follow-ups customer-safe", () => {
  assert.equal(
    aiRuntimeTestHelpers.extractDelayedFollowUpGuidance(
      [
        "Internal delayed follow-up task.",
        "",
        "Write the next outbound message to the customer based on the existing conversation history.",
        "",
        "Do not mention this instruction, internal settings, automation, or that this is a follow-up task.",
        "",
        "Follow-up guidance: Just checking in. I can still help with pricing or booking when you're ready.",
      ].join("\n"),
    ),
    "Just checking in. I can still help with pricing or booking when you're ready.",
  );
});

test("isWithinAgentSchedule returns false outside an enabled daily window", () => {
  const beforeOpening = aiRuntimeTestHelpers.isWithinAgentSchedule(
    {
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
    new Date("2026-04-20T08:30:00Z"),
  );

  const afterClosing = aiRuntimeTestHelpers.isWithinAgentSchedule(
    {
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
    new Date("2026-04-20T19:15:00Z"),
  );

  assert.equal(beforeOpening, false);
  assert.equal(afterClosing, false);
});

test("isWithinAgentSchedule returns true inside an enabled daily window", () => {
  const allowed = aiRuntimeTestHelpers.isWithinAgentSchedule(
    {
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
    new Date("2026-04-20T10:30:00Z"),
  );

  assert.equal(allowed, true);
});

test("getInboundConversationPolicy waits for manual activation only on a brand-new dialog", () => {
  const policyForNewConversation = aiRuntimeTestHelpers.getInboundConversationPolicy({
    agentSettings: {
      defaultChatEnabled: false,
      timezone: "UTC",
      scheduleEnabled: false,
      weeklySchedule: [
        { day: "monday", enabled: true, start: "00:00", end: "23:59" },
        { day: "tuesday", enabled: true, start: "00:00", end: "23:59" },
        { day: "wednesday", enabled: true, start: "00:00", end: "23:59" },
        { day: "thursday", enabled: true, start: "00:00", end: "23:59" },
        { day: "friday", enabled: true, start: "00:00", end: "23:59" },
        { day: "saturday", enabled: true, start: "00:00", end: "23:59" },
        { day: "sunday", enabled: true, start: "00:00", end: "23:59" },
      ],
    },
    existingConversationStatus: null,
  });

  const policyForExistingConversation = aiRuntimeTestHelpers.getInboundConversationPolicy({
    agentSettings: {
      defaultChatEnabled: false,
      timezone: "UTC",
      scheduleEnabled: false,
      weeklySchedule: [
        { day: "monday", enabled: true, start: "00:00", end: "23:59" },
        { day: "tuesday", enabled: true, start: "00:00", end: "23:59" },
        { day: "wednesday", enabled: true, start: "00:00", end: "23:59" },
        { day: "thursday", enabled: true, start: "00:00", end: "23:59" },
        { day: "friday", enabled: true, start: "00:00", end: "23:59" },
        { day: "saturday", enabled: true, start: "00:00", end: "23:59" },
        { day: "sunday", enabled: true, start: "00:00", end: "23:59" },
      ],
    },
    existingConversationStatus: ConversationStatus.ACTIVE,
  });

  assert.equal(policyForNewConversation, "waiting_for_manual_dialog_activation");
  assert.equal(policyForExistingConversation, "auto_reply");
});

test("getInboundConversationPolicy keeps an escalated dialog paused until manual activation", () => {
  const policy = aiRuntimeTestHelpers.getInboundConversationPolicy({
    agentSettings: {
      defaultChatEnabled: false,
      timezone: "UTC",
      scheduleEnabled: false,
      weeklySchedule: [
        { day: "monday", enabled: true, start: "00:00", end: "23:59" },
        { day: "tuesday", enabled: true, start: "00:00", end: "23:59" },
        { day: "wednesday", enabled: true, start: "00:00", end: "23:59" },
        { day: "thursday", enabled: true, start: "00:00", end: "23:59" },
        { day: "friday", enabled: true, start: "00:00", end: "23:59" },
        { day: "saturday", enabled: true, start: "00:00", end: "23:59" },
        { day: "sunday", enabled: true, start: "00:00", end: "23:59" },
      ],
    },
    existingConversationStatus: ConversationStatus.ESCALATED,
  });

  assert.equal(policy, "waiting_for_manual_dialog_activation");
});

test("getInboundConversationPolicy treats closed dialogs as terminal", () => {
  const policy = aiRuntimeTestHelpers.getInboundConversationPolicy({
    agentSettings: {
      defaultChatEnabled: true,
      timezone: "UTC",
      scheduleEnabled: false,
      weeklySchedule: [
        { day: "monday", enabled: true, start: "00:00", end: "23:59" },
        { day: "tuesday", enabled: true, start: "00:00", end: "23:59" },
        { day: "wednesday", enabled: true, start: "00:00", end: "23:59" },
        { day: "thursday", enabled: true, start: "00:00", end: "23:59" },
        { day: "friday", enabled: true, start: "00:00", end: "23:59" },
        { day: "saturday", enabled: true, start: "00:00", end: "23:59" },
        { day: "sunday", enabled: true, start: "00:00", end: "23:59" },
      ],
    },
    existingConversationStatus: ConversationStatus.CLOSED,
  });

  assert.equal(policy, "closed_conversation");
});

test("getInboundConversationPolicy blocks replies outside the configured schedule window", () => {
  const policy = aiRuntimeTestHelpers.getInboundConversationPolicy({
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
    existingConversationStatus: ConversationStatus.ACTIVE,
    now: new Date("2026-04-20T19:15:00Z"),
  });

  assert.equal(policy, "waiting_for_schedule_window");
});

test("buildRuntimeContextLines does not expose hidden prompting visibility flags", () => {
  const hidden = aiRuntimeTestHelpers.buildRuntimeContextLines({
    prompting: {
      instruction: null,
      showContactIdentity: false,
      showChannelContext: false,
      notes: null,
    },
    input: {
      channel: "INSTAGRAM",
      contactId: "contact-1",
      contactEmail: "lead@example.com",
    },
  });

  const visible = aiRuntimeTestHelpers.buildRuntimeContextLines({
    prompting: {
      instruction: null,
      showContactIdentity: true,
      showChannelContext: true,
      notes: null,
    },
    input: {
      channel: "INSTAGRAM",
      contactId: "contact-1",
      contactEmail: "lead@example.com",
    },
  });

  assert.equal(hidden, "");
  assert.match(visible, /Known customer email: lead@example\.com/);
  assert.match(visible, /Current channel: instagram/);
});

test("handleIncomingEventWithDeps records inbound and does not auto-reply when manual activation is required", async () => {
  const createdMessages: Array<{ conversationId: string; role: string; content: string }> = [];
  const delayedDeliveryUpdates: Array<Record<string, unknown>> = [];
  const txConversation = {
    id: "conv-new",
    status: ConversationStatus.ESCALATED,
  };
  const fakeDb = {
    agent: {
      findFirst: async () => ({
        id: "agent-1",
        tenantId: "tenant-1",
        channelConfig: {
          agentSettings: {
            defaultChatEnabled: false,
            timezone: "UTC",
            scheduleEnabled: false,
            weeklySchedule: [],
          },
        },
        channel: {
          type: "TELEGRAM",
          credentialsEnc: "encrypted",
        },
      }),
    },
    message: {
      findFirst: async () => null,
      create: async (args: { data: { conversationId: string; role: string; content: string } }) => {
        createdMessages.push(args.data);
        return { id: "message-1" };
      },
    },
    conversation: {
      findUnique: async () => null,
      create: async () => txConversation,
      update: async () => txConversation,
    },
    $transaction: async (
      callback: (tx: {
        conversation: {
          findUnique: () => Promise<null>;
          create: () => Promise<typeof txConversation>;
          update: () => Promise<typeof txConversation>;
        };
        message: {
          create: (args: {
            data: { conversationId: string; role: string; content: string };
          }) => Promise<{ id: string }>;
        };
      }) => Promise<unknown>,
    ) =>
      callback({
        conversation: {
          findUnique: async () => null,
          create: async () => txConversation,
          update: async () => txConversation,
        },
        message: {
          create: async (args) => {
            createdMessages.push(args.data);
            return { id: "message-1" };
          },
        },
      }),
    delayedDelivery: {
      updateMany: async (args: Record<string, unknown>) => {
        delayedDeliveryUpdates.push(args);
        return { count: 0 };
      },
    },
  } as never;
  let invokeCalled = false;
  let sendReplyCalled = false;

  const result = await aiRuntimeTestHelpers.handleIncomingEventWithDeps(
    {
      agentId: "agent-1",
      channel: "TELEGRAM" as never,
      payload: { text: "hello" },
    },
    {
      db: fakeDb,
      decrypt: (value: string) => value,
      invokeAgent: async () => {
        invokeCalled = true;
        throw new Error("invokeAgent should not run");
      },
      getChannelAdapter: () =>
        ({
          parseIncoming: () => ({
            contactId: "contact-1",
            message: "hello",
            messageId: "msg-1",
          }),
          formatReply: (text: string) => text,
          sendReply: async () => {
            sendReplyCalled = true;
            return {};
          },
        }) as never,
      sleep: async () => {},
    },
  );

  assert.equal(result.ok, true);
  assert.equal("status" in result ? result.status : null, "waiting_for_manual_dialog_activation");
  assert.equal(invokeCalled, false);
  assert.equal(sendReplyCalled, false);
  assert.deepEqual(createdMessages, [
    {
      conversationId: "conv-new",
      role: "USER",
      content: "hello",
      toolInput: {
        messageId: "msg-1",
      },
    },
  ]);
  assert.deepEqual(delayedDeliveryUpdates, [
    {
      where: {
        conversationId: "conv-new",
        status: "PENDING",
        kind: { in: ["FOLLOW_UP"] },
        NOT: {
          OR: [
            {
              payload: {
                path: ["kind"],
                equals: "business_auto_resume",
              },
            },
            {
              payload: {
                path: ["kind"],
                equals: "operator_auto_resume",
              },
            },
          ],
        },
      },
      data: {
        status: "CANCELED",
        canceledAt: delayedDeliveryUpdates[0]?.data
          ? (delayedDeliveryUpdates[0].data as { canceledAt?: Date }).canceledAt
          : undefined,
        error: "superseded_by_newer_runtime_state",
      },
    },
  ]);
});

test("handleIncomingEventWithDeps pauses a dialog after a manual business reply", async () => {
  const createdMessages: Array<Record<string, unknown>> = [];
  const conversationUpdates: Array<Record<string, unknown>> = [];
  const deliveryCreates: Array<Record<string, unknown>> = [];
  const deliveryUpdates: Array<Record<string, unknown>> = [];
  const existingConversation = {
    id: "conv-1",
    status: ConversationStatus.ACTIVE,
  };
  const priorMessages = [
    {
      id: "customer-message-1",
      role: MessageRole.USER,
      content: "How much does it cost?",
      toolName: null,
      toolInput: {
        messageId: "customer-message-id",
        threadId: "thread-1",
        subject: "Pricing",
      },
      createdAt: new Date("2026-04-20T10:00:00.000Z"),
    },
  ];
  const fakeDb = {
    agent: {
      findFirst: async () => ({
        id: "agent-1",
        tenantId: "tenant-1",
        channelConfig: {
          control: {
            pauseOnBusinessIntervention: true,
            autoResumeEnabled: true,
            autoResumeAfterValue: 3,
            autoResumeAfterUnit: "hours",
            resumeMessageEnabled: false,
            businessExceptionPhrases: [],
          },
        },
        channel: {
          type: "GMAIL",
          credentialsEnc: "encrypted",
        },
      }),
    },
    message: {
      findFirst: async () => null,
      findMany: async () => priorMessages,
      create: async (args: Record<string, unknown>) => {
        createdMessages.push(args);
        return { id: "business-message-1" };
      },
    },
    conversation: {
      findUnique: async () => existingConversation,
      create: async () => existingConversation,
      update: async (args: Record<string, unknown>) => {
        conversationUpdates.push(args);
        return { ...existingConversation, status: ConversationStatus.ESCALATED };
      },
    },
    delayedDelivery: {
      updateMany: async (args: Record<string, unknown>) => {
        deliveryUpdates.push(args);
        return { count: 0 };
      },
      create: async (args: Record<string, unknown>) => {
        deliveryCreates.push(args);
        return { id: "delivery-1" };
      },
    },
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        conversation: {
          findUnique: async () => existingConversation,
          create: async () => existingConversation,
        },
        message: {
          create: async (args: Record<string, unknown>) => {
            createdMessages.push(args);
            return { id: "business-message-1" };
          },
        },
      }),
  } as never;
  let invokeCalled = false;
  let sendReplyCalled = false;

  const result = await aiRuntimeTestHelpers.handleIncomingEventWithDeps(
    {
      agentId: "agent-1",
      channel: "GMAIL" as never,
      payload: {
        contactId: "customer@example.com",
        text: "The price is 25000.",
        isBusinessManualReply: true,
      },
    },
    {
      db: fakeDb,
      decrypt: (value: string) => value,
      invokeAgent: async () => {
        invokeCalled = true;
        throw new Error("invokeAgent should not run for manual business replies");
      },
      getChannelAdapter: () =>
        ({
          parseIncoming: () => ({
            contactId: "customer@example.com",
            message: "The price is 25000.",
            messageId: "business-message-id",
            threadId: "thread-1",
            subject: "Pricing",
            isBusinessManualReply: true,
          }),
          formatReply: (text: string) => text,
          sendReply: async () => {
            sendReplyCalled = true;
            return {};
          },
        }) as never,
      sleep: async () => {},
    },
  );

  assert.equal(result.ok, true);
  assert.equal("status" in result ? result.status : null, "business_handoff_paused");
  assert.equal(invokeCalled, false);
  assert.equal(sendReplyCalled, false);
  assert.equal(
    createdMessages[0]?.data && typeof createdMessages[0].data === "object"
      ? (createdMessages[0].data as Record<string, unknown>).toolName
      : null,
    "business_manual_message",
  );
  assert.deepEqual(conversationUpdates[0], {
    where: { id: "conv-1" },
    data: {
      status: ConversationStatus.ESCALATED,
    },
  });
  assert.equal(
    deliveryCreates[0]?.data && typeof deliveryCreates[0].data === "object"
      ? ((deliveryCreates[0].data as Record<string, unknown>).payload as Record<string, unknown>).kind
      : null,
    "business_auto_resume",
  );
  assert.equal(deliveryUpdates.length, 2);
});

test("handleIncomingEventWithDeps records messages without invoking the agent while globally paused", async () => {
  const createdMessages: Array<Record<string, unknown>> = [];
  const conversation = {
    id: "conv-paused",
    status: ConversationStatus.ESCALATED,
  };
  const fakeDb = {
    agent: {
      findFirst: async () => ({
        id: "agent-paused",
        tenantId: "tenant-1",
        status: AgentStatus.PAUSED,
        channelConfig: {},
        channel: {
          type: "INSTAGRAM",
          credentialsEnc: "encrypted",
        },
      }),
    },
    message: {
      findFirst: async () => null,
    },
    conversation: {
      findUnique: async () => conversation,
    },
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        conversation: {
          findUnique: async () => conversation,
          create: async () => conversation,
          update: async () => conversation,
        },
        message: {
          create: async (args: Record<string, unknown>) => {
            createdMessages.push(args);
            return { id: "message-paused" };
          },
        },
      }),
  } as never;
  let invokeCalled = false;
  let sendReplyCalled = false;

  const result = await aiRuntimeTestHelpers.handleIncomingEventWithDeps(
    {
      agentId: "agent-paused",
      channel: "INSTAGRAM" as never,
      payload: {},
    },
    {
      db: fakeDb,
      decrypt: (value: string) => value,
      invokeAgent: async () => {
        invokeCalled = true;
        throw new Error("Paused agent must not be invoked.");
      },
      getChannelAdapter: () =>
        ({
          parseIncoming: () => ({
            contactId: "customer-1",
            message: "Are you still there?",
            messageId: "paused-message-1",
          }),
          formatReply: (text: string) => text,
          sendReply: async () => {
            sendReplyCalled = true;
            return {};
          },
        }) as never,
      sleep: async () => {},
    },
  );

  assert.equal("status" in result ? result.status : null, "inbound_recorded_agent_paused");
  assert.equal(invokeCalled, false);
  assert.equal(sendReplyCalled, false);
  assert.equal(
    createdMessages[0]?.data && typeof createdMessages[0].data === "object"
      ? (createdMessages[0].data as Record<string, unknown>).content
      : null,
    "Are you still there?",
  );
});

test("handleIncomingEventWithDeps keeps closed dialogs closed and avoids auto-reply", async () => {
  const createdMessages: Array<{ conversationId: string; role: string; content: string }> = [];
  const fakeDb = {
    agent: {
      findFirst: async () => ({
        id: "agent-1",
        tenantId: "tenant-1",
        channelConfig: {
          agentSettings: {
            defaultChatEnabled: true,
            timezone: "UTC",
            scheduleEnabled: false,
            weeklySchedule: [],
          },
        },
        channel: {
          type: "TELEGRAM",
          credentialsEnc: "encrypted",
        },
      }),
    },
    message: {
      findFirst: async () => null,
      create: async (args: { data: { conversationId: string; role: string; content: string } }) => {
        createdMessages.push(args.data);
        return { id: "message-1" };
      },
    },
    conversation: {
      findUnique: async () => ({
        id: "conv-closed",
        status: ConversationStatus.CLOSED,
      }),
      create: async () => ({
        id: "conv-closed",
        status: ConversationStatus.CLOSED,
      }),
      update: async () => ({
        id: "conv-closed",
        status: ConversationStatus.CLOSED,
      }),
    },
    $transaction: async (
      callback: (tx: {
        conversation: {
          findUnique: () => Promise<{ id: string; status: ConversationStatus }>;
          create: () => Promise<{ id: string; status: ConversationStatus }>;
          update: () => Promise<{ id: string; status: ConversationStatus }>;
        };
        message: {
          create: (args: {
            data: { conversationId: string; role: string; content: string };
          }) => Promise<{ id: string }>;
        };
      }) => Promise<unknown>,
    ) =>
      callback({
        conversation: {
          findUnique: async () => ({
            id: "conv-closed",
            status: ConversationStatus.CLOSED,
          }),
          create: async () => ({
            id: "conv-closed",
            status: ConversationStatus.CLOSED,
          }),
          update: async () => ({
            id: "conv-closed",
            status: ConversationStatus.CLOSED,
          }),
        },
        message: {
          create: async (args) => {
            createdMessages.push(args.data);
            return { id: "message-1" };
          },
        },
      }),
    delayedDelivery: {
      updateMany: async () => ({ count: 0 }),
    },
  } as never;
  let invokeCalled = false;

  const result = await aiRuntimeTestHelpers.handleIncomingEventWithDeps(
    {
      agentId: "agent-1",
      channel: "TELEGRAM" as never,
      payload: { text: "follow up" },
    },
    {
      db: fakeDb,
      decrypt: (value: string) => value,
      invokeAgent: async () => {
        invokeCalled = true;
        throw new Error("invokeAgent should not run");
      },
      getChannelAdapter: () =>
        ({
          parseIncoming: () => ({
            contactId: "contact-1",
            message: "follow up",
          }),
          formatReply: (text: string) => text,
          sendReply: async () => ({}),
        }) as never,
      sleep: async () => {},
    },
  );

  assert.equal(result.ok, true);
  assert.equal("status" in result ? result.status : null, "closed_conversation_requires_review");
  assert.equal(invokeCalled, false);
  assert.deepEqual(createdMessages, [
    {
      conversationId: "conv-closed",
      role: "USER",
      content: "follow up",
      toolInput: undefined,
    },
  ]);
});

test("handleIncomingEventWithDeps auto-replies through the channel adapter when policy allows it", async () => {
  let sendReplyArgs: Record<string, unknown> | null = null;
  let invokeAgentArgs: { messageId?: unknown; threadId?: unknown; subject?: unknown } | null = null;

  const result = await aiRuntimeTestHelpers.handleIncomingEventWithDeps(
    {
      agentId: "agent-1",
      channel: "TELEGRAM" as never,
      payload: { text: "hello" },
    },
    {
      db: {
        agent: {
          findFirst: async () => ({
            id: "agent-1",
            tenantId: "tenant-1",
            channelConfig: {},
            channel: {
              type: "TELEGRAM",
              credentialsEnc: "encrypted-credentials",
            },
          }),
        },
        message: {
          findFirst: async () => null,
        },
        conversation: {
          findUnique: async () => ({
            id: "conv-active",
            status: ConversationStatus.ACTIVE,
          }),
        },
        delayedDelivery: {
          updateMany: async () => ({ count: 0 }),
          create: async () => ({ id: "delivery-1" }),
        },
      } as never,
      decrypt: (value: string) => `decrypted:${value}`,
      invokeAgent: async (args) => {
        invokeAgentArgs = args as Record<string, unknown>;
        return {
          message: "Agent reply",
          promptPreview: "preview",
          usedTooling: ["Calendar check"],
          conversationId: "conv-active",
        };
      },
      getChannelAdapter: () =>
        ({
          parseIncoming: () => ({
            contactId: "contact-1",
            message: "hello",
            messageId: "message-1",
            threadId: "thread-1",
            subject: "Question",
          }),
          formatReply: (text: string) => text,
          sendReply: async (args: Record<string, unknown>) => {
            sendReplyArgs = args;
            return { delivered: true };
          },
        }) as never,
      sleep: async () => {},
    },
  );

  assert.equal(result.ok, true);
  assert.equal("reply" in result ? result.reply : null, "Agent reply");
  assert.deepEqual(sendReplyArgs, {
    credentials: "decrypted:encrypted-credentials",
    contactId: "contact-1",
    message: "Agent reply",
    messageId: "message-1",
    threadId: "thread-1",
    subject: "Question",
    attachments: undefined,
    channelConfig: {},
  });
  assert.ok(invokeAgentArgs);
  const capturedInvokeAgentArgs = invokeAgentArgs as {
    messageId?: unknown;
    threadId?: unknown;
    subject?: unknown;
  };
  assert.equal(capturedInvokeAgentArgs.messageId, "message-1");
  assert.equal(capturedInvokeAgentArgs.threadId, "thread-1");
  assert.equal(capturedInvokeAgentArgs.subject, "Question");
});

test("handleIncomingEventWithDeps routes Gmail through wedding sales graph when runtime flag is enabled", async () => {
  let invokeAgentCalled = false;
  let sentMessage: unknown = null;
  const createdMessages: Array<{ role: string; content: string; model?: string; toolName?: string | null }> = [];

  const result = await aiRuntimeTestHelpers.handleIncomingEventWithDeps(
    {
      agentId: "agent-1",
      channel: "GMAIL" as never,
      payload: { text: "hello" },
    },
    {
      db: {
        agent: {
          findFirst: async () => ({
            id: "agent-1",
            tenantId: "tenant-1",
            channelConfig: {
              runtimeType: "langgraph_wedding_sales",
            },
            channel: {
              type: "GMAIL",
              credentialsEnc: "gmail-credentials",
            },
          }),
        },
        message: {
          findFirst: async () => null,
          create: async (args: { data: { role: string; content: string; model?: string; toolName?: string | null } }) => {
            createdMessages.push(args.data);
            return { id: "message-1" };
          },
        },
        conversation: {
          findUnique: async () => null,
        },
        $transaction: async (
          callback: (tx: {
            conversation: {
              findUnique: () => Promise<null>;
              create: () => Promise<{ id: string; status: ConversationStatus }>;
            };
            message: {
              create: (args: {
                data: { role: string; content: string; model?: string; toolName?: string | null };
              }) => Promise<{ id: string }>;
            };
          }) => Promise<unknown>,
        ) =>
          callback({
            conversation: {
              findUnique: async () => null,
              create: async () => ({
                id: "conv-langgraph",
                status: ConversationStatus.ACTIVE,
              }),
            },
            message: {
              create: async (args) => {
                createdMessages.push(args.data);
                return { id: "message-1" };
              },
            },
          }),
        delayedDelivery: {
          updateMany: async () => ({ count: 0 }),
          create: async () => ({ id: "delivery-1" }),
        },
      } as never,
      decrypt: (value: string) => value,
      invokeAgent: async () => {
        invokeAgentCalled = true;
        throw new Error("legacy invokeAgent should not run for the LangGraph runtime flag");
      },
      getChannelAdapter: () =>
        ({
          parseIncoming: () => ({
            contactId: "contact@example.com",
            contactEmail: "contact@example.com",
            message: "We are Anna and Mark. Our wedding is June 14 in Charlotte.",
          }),
          formatReply: (text: string) => text,
          sendReply: async (args: { message: unknown }) => {
            sentMessage = args.message;
            return { delivered: true };
          },
        }) as never,
      sleep: async () => {},
    },
  );

  assert.equal(result.ok, true);
  assert.equal(invokeAgentCalled, false);
  assert.match(String(sentMessage), /year/i);
  assert.equal(
    createdMessages.some(
      (message) =>
        message.role === "ASSISTANT" &&
        message.model === "langgraph_wedding_sales" &&
        /year/i.test(message.content),
    ),
    true,
  );
  assert.equal(
    createdMessages.some(
      (message) => message.role === "TOOL" && message.model === "langgraph_wedding_sales",
    ),
    false,
  );
});

test("handleIncomingEventWithDeps routes Instagram through wedding sales graph when runtime flag is enabled", async () => {
  let invokeAgentCalled = false;
  let sentMessage: unknown = null;
  const createdMessages: Array<{ role: string; content: string; model?: string; toolName?: string | null }> = [];

  const result = await aiRuntimeTestHelpers.handleIncomingEventWithDeps(
    {
      agentId: "agent-1",
      channel: "INSTAGRAM" as never,
      payload: { text: "hello" },
    },
    {
      db: {
        agent: {
          findFirst: async () => ({
            id: "agent-1",
            tenantId: "tenant-1",
            channelConfig: {
              runtimeType: "langgraph_wedding_sales",
            },
            channel: {
              type: "INSTAGRAM",
              credentialsEnc: "instagram-credentials",
            },
          }),
        },
        message: {
          findFirst: async () => null,
          create: async (args: { data: { role: string; content: string; model?: string; toolName?: string | null } }) => {
            createdMessages.push(args.data);
            return { id: "message-1" };
          },
        },
        conversation: {
          findUnique: async () => null,
        },
        $transaction: async (
          callback: (tx: {
            conversation: {
              findUnique: () => Promise<null>;
              create: () => Promise<{ id: string; status: ConversationStatus }>;
            };
            message: {
              create: (args: {
                data: { role: string; content: string; model?: string; toolName?: string | null };
              }) => Promise<{ id: string }>;
            };
          }) => Promise<unknown>,
        ) =>
          callback({
            conversation: {
              findUnique: async () => null,
              create: async () => ({
                id: "conv-instagram-langgraph",
                status: ConversationStatus.ACTIVE,
              }),
            },
            message: {
              create: async (args) => {
                createdMessages.push(args.data);
                return { id: "message-1" };
              },
            },
          }),
        delayedDelivery: {
          updateMany: async () => ({ count: 0 }),
          create: async () => ({ id: "delivery-1" }),
        },
      } as never,
      decrypt: (value: string) => `decrypted:${value}`,
      invokeAgent: async () => {
        invokeAgentCalled = true;
        throw new Error("legacy invokeAgent should not run for Instagram LangGraph runtime");
      },
      getChannelAdapter: () =>
        ({
          parseIncoming: () => ({
            contactId: "ig-user-1",
            message: "We are Anna and Mark. Our wedding is June 14 in Charlotte.",
          }),
          formatReply: (text: string) => text,
          sendReply: async (args: { message: unknown }) => {
            sentMessage = args.message;
            return { mode: "meta_send_pending" };
          },
        }) as never,
      sleep: async () => {},
    },
  );

  assert.equal(result.ok, true);
  assert.equal(invokeAgentCalled, false);
  assert.match(String(sentMessage), /year/i);
  assert.equal(
    createdMessages.some(
      (message) =>
        message.role === "ASSISTANT" &&
        message.model === "langgraph_wedding_sales" &&
        /year/i.test(message.content),
    ),
    true,
  );
});

test("handleIncomingEventWithDeps treats Instagram get in touch as the first inquiry prompt", async () => {
  let sentMessage: unknown = null;

  const result = await aiRuntimeTestHelpers.handleIncomingEventWithDeps(
    {
      agentId: "agent-1",
      channel: "INSTAGRAM" as never,
      payload: { text: "Get in touch" },
    },
    {
      db: {
        agent: {
          findFirst: async () => ({
            id: "agent-1",
            tenantId: "tenant-1",
            channelConfig: {
              runtimeType: "langgraph_wedding_sales",
            },
            channel: {
              type: "INSTAGRAM",
              credentialsEnc: "instagram-credentials",
            },
          }),
        },
        message: {
          findFirst: async () => null,
          create: async () => ({ id: "message-1" }),
        },
        conversation: {
          findUnique: async () => null,
        },
        $transaction: async (
          callback: (tx: {
            conversation: {
              findUnique: () => Promise<null>;
              create: () => Promise<{ id: string; status: ConversationStatus }>;
            };
            message: {
              create: () => Promise<{ id: string }>;
            };
          }) => Promise<unknown>,
        ) =>
          callback({
            conversation: {
              findUnique: async () => null,
              create: async () => ({
                id: "conv-instagram-langgraph",
                status: ConversationStatus.ACTIVE,
              }),
            },
            message: {
              create: async () => ({ id: "message-1" }),
            },
          }),
        delayedDelivery: {
          updateMany: async () => ({ count: 0 }),
          create: async () => ({ id: "delivery-1" }),
        },
      } as never,
      decrypt: (value: string) => `decrypted:${value}`,
      invokeAgent: async () => {
        throw new Error("legacy invokeAgent should not run for Instagram LangGraph runtime");
      },
      getChannelAdapter: () =>
        ({
          parseIncoming: () => ({
            contactId: "ig-user-1",
            message: "Get in touch",
          }),
          formatReply: (text: string) => text,
          sendReply: async (args: { message: unknown }) => {
            sentMessage = args.message;
            return { mode: "meta_send_pending" };
          },
        }) as never,
      sleep: async () => {},
    },
  );

  assert.equal(result.ok, true);
  assert.match(String(sentMessage), /Hey there!/);
  assert.match(String(sentMessage), /founder of Myndful Films/);
  assert.match(String(sentMessage), /both of your names/i);
  assert.match(String(sentMessage), /wedding date/i);
  assert.doesNotMatch(String(sentMessage), /tell me a little more/i);
});

test("control user message limit can suppress replies without a fallback message", () => {
  const intercept = aiRuntimeTestHelpers.getAntiSpamIntercept({
    control: {
      ...getDefaultControlConfig(),
      antiSpamEnabled: true,
      antiSpamMessageCount: 3,
      antiSpamWindowSeconds: 3600,
      antiSpamAutoReply: "",
    },
    historyMessages: [
      {
        role: MessageRole.USER,
        content: "one",
        createdAt: new Date(),
      },
      {
        role: MessageRole.USER,
        content: "two",
        createdAt: new Date(),
      },
    ],
  });

  assert.deepEqual(intercept, { kind: "silent" });
});

test("control user message limit suppresses later messages after one auto-reply", () => {
  const now = new Date();
  const intercept = aiRuntimeTestHelpers.getAntiSpamIntercept({
    control: {
      ...getDefaultControlConfig(),
      antiSpamEnabled: true,
      antiSpamMessageCount: 3,
      antiSpamWindowSeconds: 3600,
      antiSpamAutoReply: "Please wait a moment.",
    },
    historyMessages: [
      {
        role: MessageRole.USER,
        content: "one",
        createdAt: now,
      },
      {
        role: MessageRole.USER,
        content: "two",
        createdAt: now,
      },
      {
        role: MessageRole.ASSISTANT,
        content: "Please wait a moment.",
        createdAt: now,
        model: "control-anti-spam",
      },
    ],
  });

  assert.deepEqual(intercept, { kind: "silent" });
});

test("handleIncomingEventWithDeps skips channel delivery when control suppresses the reply", async () => {
  let sendReplyCalled = false;

  const result = await aiRuntimeTestHelpers.handleIncomingEventWithDeps(
    {
      agentId: "agent-1",
      channel: "TELEGRAM" as never,
      payload: { text: "hello" },
    },
    {
      db: {
        agent: {
          findFirst: async () => ({
            id: "agent-1",
            tenantId: "tenant-1",
            channelConfig: {},
            channel: {
              type: "TELEGRAM",
              credentialsEnc: "encrypted-credentials",
            },
          }),
        },
        message: {
          findFirst: async () => null,
        },
        conversation: {
          findUnique: async () => ({
            id: "conv-active",
            status: ConversationStatus.ACTIVE,
          }),
        },
        delayedDelivery: {
          updateMany: async () => ({ count: 0 }),
          create: async () => ({ id: "delivery-1" }),
        },
      } as never,
      decrypt: (value: string) => value,
      invokeAgent: async () => ({
        message: "",
        promptPreview: "preview",
        usedTooling: [],
        conversationId: "conv-active",
        suppressReply: true,
      }),
      getChannelAdapter: () =>
        ({
          parseIncoming: () => ({
            contactId: "contact-1",
            message: "hello",
          }),
          formatReply: (text: string) => text,
          sendReply: async () => {
            sendReplyCalled = true;
            return { delivered: true };
          },
        }) as never,
      sleep: async () => {},
    },
  );

  assert.equal(result.ok, true);
  assert.equal("status" in result ? result.status : null, "reply_suppressed_by_control");
  assert.equal(sendReplyCalled, false);
});

test("handleIncomingEventWithDeps strips outbound attachments when Messages disallow them", async () => {
  let sendReplyArgs: Record<string, unknown> | null = null;

  await aiRuntimeTestHelpers.handleIncomingEventWithDeps(
    {
      agentId: "agent-1",
      channel: "TELEGRAM" as never,
      payload: { text: "hello" },
    },
    {
      db: {
        agent: {
          findFirst: async () => ({
            id: "agent-1",
            tenantId: "tenant-1",
            channelConfig: {
              channelBehavior: {
                allowAttachments: false,
                messageFormat: "split_into_2_3_messages",
                bufferDelaySeconds: 0,
                followUpEnabled: false,
                followUpRules: [],
              },
            },
            channel: {
              type: "TELEGRAM",
              credentialsEnc: "encrypted-credentials",
            },
          }),
        },
        message: {
          findFirst: async () => null,
        },
        conversation: {
          findUnique: async () => ({
            id: "conv-active",
            status: ConversationStatus.ACTIVE,
          }),
        },
        delayedDelivery: {
          updateMany: async () => ({ count: 0 }),
          create: async () => ({ id: "delivery-1" }),
        },
      } as never,
      decrypt: (value: string) => value,
      invokeAgent: async () => ({
        message: "Part one\n\nPart two",
        promptPreview: "preview",
        usedTooling: [],
        conversationId: "conv-active",
        attachments: [
          {
            source: "google_drive" as const,
            fileId: "file-1",
            fileName: "pricing.pdf",
            mimeType: "application/pdf",
          },
        ],
      }),
      getChannelAdapter: () =>
        ({
          parseIncoming: () => ({
            contactId: "contact-1",
            message: "hello",
          }),
          formatReply: (text: string, config?: unknown) => splitOutgoingMessage(text, config),
          sendReply: async (args: Record<string, unknown>) => {
            sendReplyArgs = args;
            return { delivered: true };
          },
        }) as never,
      sleep: async () => {},
    },
  );

  assert.deepEqual(sendReplyArgs, {
    credentials: "encrypted-credentials",
    contactId: "contact-1",
    message: ["Part one", "Part two"],
    messageId: undefined,
    threadId: undefined,
    subject: undefined,
    attachments: undefined,
    channelConfig: {
      channelBehavior: {
        allowAttachments: false,
        messageFormat: "split_into_2_3_messages",
        bufferDelaySeconds: 0,
        followUpEnabled: false,
        followUpRules: [],
      },
    },
  });
});

test("handleIncomingEventWithDeps surfaces partial delivery from the channel adapter", async () => {
  const result = await aiRuntimeTestHelpers.handleIncomingEventWithDeps(
    {
      agentId: "agent-1",
      channel: "TELEGRAM" as never,
      payload: { text: "hello" },
    },
    {
      db: {
        agent: {
          findFirst: async () => ({
            id: "agent-1",
            tenantId: "tenant-1",
            channelConfig: {
              channelBehavior: {
                messageFormat: "split_into_2_3_messages",
                allowAttachments: false,
                bufferDelaySeconds: 0,
                followUpEnabled: false,
                followUpRules: [],
              },
            },
            channel: {
              type: "TELEGRAM",
              credentialsEnc: "encrypted-credentials",
            },
          }),
        },
        message: {
          findFirst: async () => null,
        },
        conversation: {
          findUnique: async () => ({
            id: "conv-active",
            status: ConversationStatus.ACTIVE,
          }),
        },
        delayedDelivery: {
          updateMany: async () => ({ count: 0 }),
          create: async () => ({ id: "delivery-1" }),
        },
      } as never,
      decrypt: (value: string) => value,
      invokeAgent: async () => ({
        message: "Part one\n\nPart two",
        promptPreview: "preview",
        usedTooling: [],
        conversationId: "conv-active",
      }),
      getChannelAdapter: () =>
        ({
          parseIncoming: () => ({
            contactId: "contact-1",
            message: "hello",
          }),
          formatReply: (text: string, config?: unknown) => splitOutgoingMessage(text, config),
          sendReply: async () => ({
            ok: false,
            mode: "telegram_partial_delivery",
            deliveredCount: 1,
            totalParts: 2,
            deliveries: [{ ok: true }],
            error: "Telegram send failed with 500.",
          }),
        }) as never,
      sleep: async () => {},
    },
  );

  assert.equal(result.ok, true);
  assert.equal(
    "status" in result ? result.status : null,
    "partial_delivery_requires_review",
  );
  assert.deepEqual("delivery" in result ? result.delivery : null, {
    ok: false,
    mode: "telegram_partial_delivery",
    deliveredCount: 1,
    totalParts: 2,
    deliveries: [{ ok: true }],
    error: "Telegram send failed with 500.",
  });
});

test("handleIncomingEventWithDeps returns buffered delivery metadata when message buffering is enabled", async () => {
  const createdMessages: Array<{ conversationId: string; role: string; content: string }> = [];

  const result = await aiRuntimeTestHelpers.handleIncomingEventWithDeps(
    {
      agentId: "agent-1",
      channel: "TELEGRAM" as never,
      payload: { text: "hello" },
    },
    {
      db: {
        agent: {
          findFirst: async () => ({
            id: "agent-1",
            tenantId: "tenant-1",
            channelConfig: {
              channelBehavior: {
                messageFormat: "single_message",
                allowAttachments: false,
                bufferDelaySeconds: 1,
                followUpEnabled: false,
                followUpRules: [],
              },
            },
            channel: {
              type: "TELEGRAM",
              credentialsEnc: "encrypted-credentials",
            },
          }),
        },
        message: {
          findFirst: async () => ({ id: "message-1" }),
          create: async (args: { data: { conversationId: string; role: string; content: string } }) => {
            createdMessages.push(args.data);
            return { id: "message-1" };
          },
        },
        conversation: {
          findUnique: async () => ({
            id: "conv-active",
            status: ConversationStatus.ACTIVE,
          }),
          create: async () => ({
            id: "conv-active",
            status: ConversationStatus.ACTIVE,
          }),
          update: async () => ({
            id: "conv-active",
            status: ConversationStatus.ACTIVE,
          }),
        },
        $transaction: async (
          callback: (tx: {
            conversation: {
              findUnique: () => Promise<{ id: string; status: ConversationStatus }>;
              create: () => Promise<{ id: string; status: ConversationStatus }>;
              update: () => Promise<{ id: string; status: ConversationStatus }>;
            };
            message: {
              create: (args: {
                data: { conversationId: string; role: string; content: string };
              }) => Promise<{ id: string }>;
            };
          }) => Promise<unknown>,
        ) =>
          callback({
            conversation: {
              findUnique: async () => ({
                id: "conv-active",
                status: ConversationStatus.ACTIVE,
              }),
              create: async () => ({
                id: "conv-active",
                status: ConversationStatus.ACTIVE,
              }),
              update: async () => ({
                id: "conv-active",
                status: ConversationStatus.ACTIVE,
              }),
            },
            message: {
              create: async (args) => {
                createdMessages.push(args.data);
                return { id: "message-1" };
              },
            },
          }),
        delayedDelivery: {
          updateMany: async () => ({ count: 0 }),
          create: async () => ({ id: "delivery-1" }),
        },
      } as never,
      decrypt: (value: string) => value,
      invokeAgent: async () => {
        throw new Error("invokeAgent should not run before the buffer window closes");
      },
      getChannelAdapter: () =>
        ({
          parseIncoming: () => ({
            contactId: "contact-1",
            message: "hello",
          }),
          formatReply: (text: string) => text,
          sendReply: async () => {
            throw new Error("sendReply should not run before buffered processing");
          },
        }) as never,
      sleep: async () => {},
    },
  );

  assert.equal(result.ok, true);
  assert.equal("status" in result ? result.status : null, "buffered_reply_scheduled");
  assert.equal("bufferedDeliveryId" in result ? result.bufferedDeliveryId : null, "delivery-1");
  assert.equal(
    "bufferedDueAt" in result && result.bufferedDueAt instanceof Date,
    true,
  );
  assert.deepEqual(createdMessages, [
    {
      conversationId: "conv-active",
      role: "USER",
      content: "hello",
      toolInput: undefined,
    },
  ]);
});

test("handleIncomingEventWithDeps evaluates schedule using the inbound event timestamp", async () => {
  let invokeCalled = false;
  let sendReplyCalled = false;
  const createdMessages: Array<{ conversationId: string; role: string; content: string }> = [];

  const result = await aiRuntimeTestHelpers.handleIncomingEventWithDeps(
    {
      agentId: "agent-1",
      channel: "TELEGRAM" as never,
      payload: { text: "late webhook delivery" },
    },
    {
      db: {
        agent: {
          findFirst: async () => ({
            id: "agent-1",
            tenantId: "tenant-1",
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
              type: "TELEGRAM",
              credentialsEnc: "encrypted",
            },
          }),
        },
        message: {
          findFirst: async () => null,
          create: async (args: { data: { conversationId: string; role: string; content: string } }) => {
            createdMessages.push(args.data);
            return { id: "message-1" };
          },
        },
        conversation: {
          findUnique: async () => ({
            id: "conv-active",
            status: ConversationStatus.ACTIVE,
          }),
          create: async () => ({
            id: "conv-active",
            status: ConversationStatus.ACTIVE,
          }),
          update: async () => ({
            id: "conv-active",
            status: ConversationStatus.ACTIVE,
          }),
        },
        $transaction: async (
          callback: (tx: {
            conversation: {
              findUnique: () => Promise<{ id: string; status: ConversationStatus }>;
              create: () => Promise<{ id: string; status: ConversationStatus }>;
              update: () => Promise<{ id: string; status: ConversationStatus }>;
            };
            message: {
              create: (args: {
                data: { conversationId: string; role: string; content: string };
              }) => Promise<{ id: string }>;
            };
          }) => Promise<unknown>,
        ) =>
          callback({
            conversation: {
              findUnique: async () => ({
                id: "conv-active",
                status: ConversationStatus.ACTIVE,
              }),
              create: async () => ({
                id: "conv-active",
                status: ConversationStatus.ACTIVE,
              }),
              update: async () => ({
                id: "conv-active",
                status: ConversationStatus.ACTIVE,
              }),
            },
            message: {
              create: async (args) => {
                createdMessages.push(args.data);
                return { id: "message-1" };
              },
            },
          }),
        delayedDelivery: {
          updateMany: async () => ({ count: 0 }),
          create: async () => ({ id: "delivery-1" }),
        },
      } as never,
      decrypt: (value: string) => value,
      invokeAgent: async () => {
        invokeCalled = true;
        throw new Error("invokeAgent should not run outside the schedule window");
      },
      getChannelAdapter: () =>
        ({
          parseIncoming: () => ({
            contactId: "contact-1",
            message: "late webhook delivery",
            eventTimestamp: new Date("2026-04-20T19:15:00Z"),
          }),
          formatReply: (text: string) => text,
          sendReply: async () => {
            sendReplyCalled = true;
            return {};
          },
        }) as never,
      sleep: async () => {},
    },
  );

  assert.equal(result.ok, true);
  assert.equal("status" in result ? result.status : null, "waiting_for_schedule_window");
  assert.equal(invokeCalled, false);
  assert.equal(sendReplyCalled, false);
  assert.deepEqual(createdMessages, [
    {
      conversationId: "conv-active",
      role: "USER",
      content: "late webhook delivery",
      toolInput: undefined,
    },
  ]);
});
