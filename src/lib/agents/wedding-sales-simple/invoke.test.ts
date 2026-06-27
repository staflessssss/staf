import assert from "node:assert/strict";
import test from "node:test";

import type { SimpleWeddingSalesState } from "@/lib/lang/graphs/wedding-sales-simple/state";

import type { WeddingSalesSimpleSafetyLogEntry } from "./contracts";
import {
  invokeWeddingSalesSimpleAdapter,
  resolveWeddingSalesRuntimeForCanary,
} from "./invoke";
import {
  normalizeGmailWeddingSalesIncoming,
  normalizeInstagramWeddingSalesIncoming,
} from "./normalize";

const toolContext = {
  tenantId: "tenant-1",
  testMode: true,
  weddingAvailability: {
    action: "capacity availability",
    params: {},
  },
  consultationCalendar: {
    action: "check calendar",
    params: {
      checkConflictsBeforeBooking: false,
    },
  },
  bookConsultation: {
    action: "book call",
    params: {
      checkConflictsBeforeBooking: false,
    },
  },
};

test("wedding-sales-simple adapter normalizes Instagram, invokes graph, and returns outbound trace", async () => {
  const incoming = normalizeInstagramWeddingSalesIncoming({
    tenantId: "tenant-1",
    agentId: "agent-wedding",
    entry: [
      {
        messaging: [
          {
            sender: { id: "ig-contact-1", username: "anna" },
            message: {
              mid: "mid-1",
              text: "Hi! Are you available for June 14 2027 in Tampa? Also how much are packages?",
            },
            timestamp: Date.parse("2026-06-23T12:00:00.000Z"),
          },
        ],
      },
    ],
  });
  const safetyLogs: WeddingSalesSimpleSafetyLogEntry[] = [];
  let savedState: SimpleWeddingSalesState | undefined;
  const result = await invokeWeddingSalesSimpleAdapter({
    incoming,
    toolContext,
    config: {
      guide: {
        imageUrl: "https://example.com/price-fl.png",
        link: "https://example.com/guide",
      },
    },
    deps: {
      recordSafetyLog: (entry) => {
        safetyLogs.push(entry);
      },
      saveState: ({ state }) => {
        savedState = state;
      },
      invokeGraph: (input) =>
        import("@/lib/lang/graphs/wedding-sales-simple/graph").then(
          ({ invokeWeddingSalesSimpleGraph }) =>
            invokeWeddingSalesSimpleGraph({
              ...input,
              understand: () => ({
                customerMessageType: "availability_question",
                facts: {
                  weddingDate: "2027-06-14",
                  weddingDateText: "June 14 2027",
                  location: "Tampa",
                },
                questionsAskedByCustomer: ["availability", "pricing"],
                confidence: 0.95,
              }),
            }),
        ),
    },
  });

  assert.equal(result.status, "processed");
  assert.equal(result.outbound.channel, "instagram");
  assert.equal(result.outbound.conversationId, "agent-wedding:ig-contact-1");
  assert.equal(result.outbound.handoffMode, "bot_active");
  assert.equal(result.outbound.decisionTrace.toolCalled, "checkAvailability");
  assert.match(result.outbound.text, /wedding films start at/i);
  assert.match(result.outbound.text, /both of your names/i);
  assert.equal(savedState?.availabilityCheck?.status, "available");
  assert.equal(safetyLogs.length, 1);
  assert.equal(safetyLogs[0]?.runtime, "wedding-sales-simple");
  assert.deepEqual(safetyLogs[0]?.toolCalls, ["check_wedding_availability"]);
  assert.equal(safetyLogs[0]?.dialogueUnderstanding?.messageAct, "new_business_question");
  assert.deepEqual(safetyLogs[0]?.dialogueCommands, [
    { type: "set_slot", slot: "weddingDate", value: "2027-06-14" },
    { type: "set_slot", slot: "weddingDateText", value: "June 14 2027" },
    { type: "set_slot", slot: "location", value: "Tampa" },
    { type: "answer_question", question: "pricing" },
  ]);
  assert.deepEqual(safetyLogs[0]?.dialogueUnderstanding?.commands, safetyLogs[0]?.dialogueCommands);
  assert.deepEqual(safetyLogs[0]?.pendingUserActionBefore, undefined);
  assert.equal(safetyLogs[0]?.pendingUserActionAfter, null);
  assert.match(safetyLogs[0]?.writer?.mode ?? "", /response_catalog|contextual_rephrase/);
  assert.equal(safetyLogs[0]?.writer?.responseKey, "utter_availability_available_ask_names");
  assert.equal(safetyLogs[0]?.writerCatalog?.guardOk, true);
  assert.equal(safetyLogs[0]?.domainDecision?.activeFlow, "wedding_lead_qualification");
  assert.equal(safetyLogs[0]?.domainDecision?.currentRequestedSlot, "names");
  assert.equal(safetyLogs[0]?.domainDecision?.nextDomainAction, "ask_names_after_available_date");
  assert.equal(
    safetyLogs[0]?.domainDecision?.matchedRule,
    "availability_available_and_names_missing",
  );
  assert.deepEqual(safetyLogs[0]?.domainDecision?.allowedResponseKeys, [
    "utter_availability_available_ask_names",
    "utter_ask_names_after_details",
    "utter_ask_names",
  ]);
  assert.equal(result.outbound.channelDeliveryPlan?.channel, "instagram");
  assert.equal(result.outbound.channelDeliveryPlan?.mode, "single_message");
  assert.equal(safetyLogs[0]?.channelDeliveryPlan?.mode, "single_message");
});

test("wedding-sales-simple adapter normalizes Gmail thread and preserves sender email", async () => {
  const incoming = normalizeGmailWeddingSalesIncoming({
    tenantId: "tenant-1",
    agentId: "agent-wedding",
    from: "Anna Smith <anna@example.com>",
    threadId: "thread-1",
    gmailMessageId: "gmail-1",
    text: "How much are packages?",
    receivedAt: "2026-06-23T12:00:00.000Z",
  });
  const result = await invokeWeddingSalesSimpleAdapter({
    incoming,
    deps: {
      invokeGraph: (input) =>
        import("@/lib/lang/graphs/wedding-sales-simple/graph").then(
          ({ invokeWeddingSalesSimpleGraph }) =>
            invokeWeddingSalesSimpleGraph({
              ...input,
              understand: () => ({
                customerMessageType: "business_question",
                facts: {},
                questionsAskedByCustomer: ["pricing"],
                confidence: 0.95,
              }),
            }),
        ),
    },
  });

  assert.equal(incoming.senderEmail, "anna@example.com");
  assert.equal(incoming.senderName, "Anna Smith");
  assert.equal(result.status, "processed");
  assert.equal(result.outbound.channel, "gmail");
  assert.equal(result.outbound.conversationId, "thread-1");
  assert.equal(result.outbound.channelDeliveryPlan?.channel, "gmail");
  assert.equal(result.outbound.channelDeliveryPlan?.mode, "email");
  assert.match(result.outbound.text, /wedding films start at/i);
  assert.match(result.outbound.text, /What date are you looking at/i);
});

test("wedding-sales-simple adapter logs active flow runner decision without changing behavior", async () => {
  const incoming = normalizeInstagramWeddingSalesIncoming({
    tenantId: "tenant-1",
    agentId: "agent-wedding",
    entry: [
      {
        messaging: [
          {
            sender: { id: "ig-contact-1", username: "anna" },
            message: {
              mid: "mid-flow-shadow",
              text: "Thank you",
            },
            timestamp: Date.parse("2026-06-23T12:00:00.000Z"),
          },
        ],
      },
    ],
  });
  const safetyLogs: WeddingSalesSimpleSafetyLogEntry[] = [];
  const previousState: Partial<SimpleWeddingSalesState> = {
    customerName: "Mark",
    partnerName: "Rachel",
    customerEmail: "anna@example.com",
    weddingDate: "2027-06-15",
    location: "Tampa",
    venue: "Evergreen Park",
    availability: "available",
    proposedCallTime: "Monday at 1:30pm",
    bookingConfirmed: true,
    customerConfirmedCallSlot: true,
    mode: "bot_active",
    unclearAttemptCount: 0,
    questionsAskedByCustomer: [],
    toolObservations: [],
  };

  const result = await invokeWeddingSalesSimpleAdapter({
    incoming,
    deps: {
      loadState: () => previousState,
      recordSafetyLog: (entry) => {
        safetyLogs.push(entry);
      },
      invokeGraph: (input) =>
        import("@/lib/lang/graphs/wedding-sales-simple/graph").then(
          ({ invokeWeddingSalesSimpleGraph }) =>
            invokeWeddingSalesSimpleGraph({
              ...input,
              understand: () => ({
                customerMessageType: "answer_to_question",
                facts: {},
                questionsAskedByCustomer: [],
                confidence: 0.95,
              }),
            }),
        ),
    },
  });

  assert.equal(result.status, "processed");
  assert.equal(result.outbound.decisionTrace.nextStep, "reply_only");
  assert.equal(result.outbound.decisionTrace.replyType, "acknowledgement_only");
  assert.match(result.outbound.text, /^(?:Of course|Absolutely|You got it)/);
  assert.equal(safetyLogs[0]?.toolCalls.length, 0);
  assert.deepEqual(safetyLogs[0]?.dialogueCommands, [
    { type: "acknowledgement_only" },
  ]);
  assert.equal(safetyLogs[0]?.dialogueUnderstanding?.messageAct, "acknowledgement_only");
  assert.equal(safetyLogs[0]?.flowRunner?.mode, "active");
  assert.equal(safetyLogs[0]?.flowRunner?.branch, "acknowledgement_only");
  assert.equal(safetyLogs[0]?.flowRunner?.predictedNextStep, "reply_only");
  assert.equal(safetyLogs[0]?.flowRunner?.predictedResponseKey, "utter_acknowledgement");
  assert.equal(safetyLogs[0]?.flowRunner?.preserveFlow, true);
  assert.equal(safetyLogs[0]?.flowRunner?.matchedLegacy, true);
  assert.equal(safetyLogs[0]?.flowRunner?.usedAsFinalDecision, true);
  assert.equal(safetyLogs[0]?.flowRunner?.fallbackToLegacy, false);
  assert.equal(safetyLogs[0]?.writerCatalog?.eligible, true);
  assert.equal(safetyLogs[0]?.writerCatalog?.guardOk, true);
  assert.equal(safetyLogs[0]?.writerCatalog?.responseKey, "utter_acknowledgement");
  assert.equal(result.state.replyMemory?.responseVariations?.at(-1)?.responseKey, "utter_acknowledgement");
  assert.equal(
    result.state.replyMemory?.responseVariations?.at(-1)?.variationId,
    safetyLogs[0]?.writer?.variationId,
  );
});

test("wedding-sales-simple adapter logs Instagram semantic delivery plan when flag is on", async () => {
  const incoming = normalizeInstagramWeddingSalesIncoming({
    tenantId: "tenant-1",
    agentId: "agent-wedding",
    contactId: "ig-contact-1",
    text: "Hi! Are you available June 15 2027 in Tampa? How much? Who would shoot our wedding?",
    messageId: "mid-semantic-plan",
  });
  const safetyLogs: WeddingSalesSimpleSafetyLogEntry[] = [];
  const result = await invokeWeddingSalesSimpleAdapter({
    incoming,
    toolContext,
    config: {
      guide: {
        imageUrl: "https://example.com/price.png",
        fileName: "price.png",
      },
    },
    channelConfig: {
      enableInstagramSemanticDeliveryPlan: true,
    },
    deps: {
      recordSafetyLog: (entry) => {
        safetyLogs.push(entry);
      },
      invokeGraph: (input) =>
        import("@/lib/lang/graphs/wedding-sales-simple/graph").then(
          ({ invokeWeddingSalesSimpleGraph }) =>
            invokeWeddingSalesSimpleGraph({
              ...input,
              understand: () => ({
                customerMessageType: "availability_question",
                facts: {
                  weddingDate: "2027-06-15",
                  weddingDateText: "June 15 2027",
                  location: "Tampa",
                },
                questionsAskedByCustomer: ["availability", "pricing", "team"],
                confidence: 0.95,
              }),
            }),
        ),
    },
  });

  assert.equal(result.status, "processed");
  const plan = result.outbound.channelDeliveryPlan;

  assert.equal(plan?.channel, "instagram");
  assert.equal(plan?.mode, "semantic_split");
  assert.equal(safetyLogs[0]?.channelDeliveryPlan?.mode, "semantic_split");
  assert.equal(safetyLogs[0]?.deliveryPlanGuard?.ok, true);
  assert.ok(plan && "parts" in plan);
  assert.ok(plan.parts.some((part) => part.kind === "sender_action" && part.action === "mark_seen"));
  assert.ok(
    plan.parts.some(
      (part) =>
        part.kind === "text" &&
        (part.reason === "availability" || part.reason === "greeting_availability"),
    ),
  );
  assert.ok(plan.parts.some((part) => part.kind === "text" && part.reason === "pricing"));
  assert.ok(plan.parts.some((part) => part.kind === "text" && /both of your names/i.test(part.text)));
  assert.ok(plan.totalDelayMs <= 12_000);
});

test("wedding-sales-simple adapter returns pricing guide image attachment when guide is mentioned", async () => {
  const incoming = normalizeInstagramWeddingSalesIncoming({
    tenantId: "tenant-1",
    agentId: "agent-wedding",
    contactId: "ig-contact-1",
    text: "Yes send me here price image",
    messageId: "mid-guide",
  });
  const result = await invokeWeddingSalesSimpleAdapter({
    incoming,
    config: {
      guide: {
        imageUrl: "https://example.com/price.png",
        fileName: "price.png",
      },
    },
    deps: {
      loadState: () => ({
        weddingDate: "2027-06-14",
        location: "Tampa",
        availability: "available",
        availabilityCheck: {
          date: "2027-06-14",
          location: "Tampa",
          status: "available",
          checkedAt: "2026-06-23T00:00:00.000Z",
        },
      }),
      invokeGraph: (input) =>
        import("@/lib/lang/graphs/wedding-sales-simple/graph").then(
          ({ invokeWeddingSalesSimpleGraph }) =>
            invokeWeddingSalesSimpleGraph({
              ...input,
              understand: () => ({
                customerMessageType: "business_question",
                facts: {},
                questionsAskedByCustomer: ["pricing"],
                confidence: 0.95,
              }),
            }),
        ),
    },
  });

  assert.equal(result.status, "processed");
  assert.match(result.outbound.text, /guide image/i);
  assert.deepEqual(result.outbound.attachments, [
    {
      type: "image",
      url: "https://example.com/price.png",
      label: "price.png",
      purpose: "pricing_guide",
    },
  ]);
});

test("wedding-sales-simple adapter does not resend guide attachment when guide was already sent", async () => {
  const incoming = normalizeInstagramWeddingSalesIncoming({
    tenantId: "tenant-1",
    agentId: "agent-wedding",
    contactId: "ig-contact-1",
    text: "Can you send the guide again?",
    messageId: "mid-guide-again",
  });
  const result = await invokeWeddingSalesSimpleAdapter({
    incoming,
    config: {
      guide: {
        imageUrl: "https://example.com/price.png",
        fileName: "price.png",
      },
    },
    deps: {
      loadState: () => ({
        weddingDate: "2027-06-14",
        location: "Tampa",
        availability: "available",
        availabilityCheck: {
          date: "2027-06-14",
          location: "Tampa",
          status: "available",
          checkedAt: "2026-06-23T00:00:00.000Z",
        },
        replyMemory: {
          mentioned: {
            guide: {
              imageUrl: "https://example.com/price.png",
              turnId: "turn-1",
              lastMentionedAt: "2026-06-24T00:00:00.000Z",
            },
          },
        },
      }),
      invokeGraph: (input) =>
        import("@/lib/lang/graphs/wedding-sales-simple/graph").then(
          ({ invokeWeddingSalesSimpleGraph }) =>
            invokeWeddingSalesSimpleGraph({
              ...input,
              understand: () => ({
                customerMessageType: "business_question",
                facts: {},
                questionsAskedByCustomer: [],
                confidence: 0.95,
              }),
            }),
        ),
    },
  });

  assert.equal(result.status, "processed");
  assert.match(result.outbound.text, /already sent the collections guide/i);
  assert.equal(result.outbound.attachments, undefined);
  assert.equal(result.state.replyContract?.mentionPolicy.guide.mode, "mention_already_sent");
});

test("wedding-sales-simple adapter skips duplicate incoming message ids", async () => {
  const incoming = normalizeInstagramWeddingSalesIncoming({
    tenantId: "tenant-1",
    agentId: "agent-wedding",
    contactId: "ig-contact-1",
    text: "price?",
    messageId: "mid-dup",
  });
  let invoked = false;
  let saved = false;
  let logged = false;
  let marked = false;
  const result = await invokeWeddingSalesSimpleAdapter({
    incoming,
    deps: {
      hasProcessedIncoming: () => true,
      saveState: () => {
        saved = true;
      },
      recordSafetyLog: () => {
        logged = true;
      },
      markProcessedIncoming: () => {
        marked = true;
      },
      invokeGraph: () => {
        invoked = true;
        throw new Error("duplicate should not invoke graph");
      },
    },
  });

  assert.equal(result.status, "duplicate");
  assert.equal(result.outbound, null);
  assert.equal(invoked, false);
  assert.equal(saved, false);
  assert.equal(logged, false);
  assert.equal(marked, false);
});

test("wedding-sales-simple adapter marks processed after successful invocation", async () => {
  const incoming = normalizeInstagramWeddingSalesIncoming({
    tenantId: "tenant-1",
    agentId: "agent-wedding",
    contactId: "ig-contact-1",
    text: "Can I speak to a person?",
    messageId: "mid-2",
  });
  const processed: string[] = [];
  const result = await invokeWeddingSalesSimpleAdapter({
    incoming,
    deps: {
      markProcessedIncoming: ({ incomingMessageId }) => {
        processed.push(incomingMessageId);
      },
      invokeGraph: (input) =>
        import("@/lib/lang/graphs/wedding-sales-simple/graph").then(
          ({ invokeWeddingSalesSimpleGraph }) =>
            invokeWeddingSalesSimpleGraph({
              ...input,
              understand: () => ({
                customerMessageType: "business_question",
                facts: {},
                questionsAskedByCustomer: ["other"],
                confidence: 0.95,
              }),
            }),
        ),
    },
  });

  assert.equal(result.status, "processed");
  assert.deepEqual(processed, ["mid-2"]);
});

test("wedding-sales-simple adapter persists bot_paused after repeated unresolved input", async () => {
  const incoming = normalizeInstagramWeddingSalesIncoming({
    tenantId: "tenant-1",
    agentId: "agent-wedding",
    contactId: "ig-contact-1",
    text: "the other thing maybe",
    messageId: "mid-unclear",
  });
  let savedState: SimpleWeddingSalesState | undefined;
  const result = await invokeWeddingSalesSimpleAdapter({
    incoming,
    deps: {
      loadState: () => ({
        unclearAttemptCount: 1,
      }),
      saveState: ({ state }) => {
        savedState = state;
      },
      invokeGraph: (input) =>
        import("@/lib/lang/graphs/wedding-sales-simple/graph").then(
          ({ invokeWeddingSalesSimpleGraph }) =>
            invokeWeddingSalesSimpleGraph({
              ...input,
              understand: () => ({
                customerMessageType: "unclear",
                facts: {},
                questionsAskedByCustomer: [],
                confidence: 0.2,
              }),
            }),
        ),
    },
  });

  assert.equal(result.status, "processed");
  assert.equal(result.outbound.handoffMode, "human_needed");
  assert.equal(result.state.mode, "bot_paused");
  assert.equal(savedState?.mode, "bot_paused");
});

test("wedding-sales-simple graph does not auto-resume from prior human_needed state", async () => {
  const incoming = normalizeInstagramWeddingSalesIncoming({
    tenantId: "tenant-1",
    agentId: "agent-wedding",
    contactId: "ig-contact-1",
    text: "June 14 2027",
    messageId: "mid-after-human",
  });
  const result = await invokeWeddingSalesSimpleAdapter({
    incoming,
    deps: {
      loadState: () => ({
        mode: "human_needed",
        handoffReason: "unclear_after_2_attempts",
      }),
      invokeGraph: (input) =>
        import("@/lib/lang/graphs/wedding-sales-simple/graph").then(
          ({ invokeWeddingSalesSimpleGraph }) =>
            invokeWeddingSalesSimpleGraph({
              ...input,
              understand: () => ({
                customerMessageType: "answer_to_question",
                facts: {
                  weddingDate: "2027-06-14",
                  weddingDateText: "June 14 2027",
                },
                questionsAskedByCustomer: [],
                confidence: 0.95,
              }),
            }),
        ),
    },
  });

  assert.equal(result.status, "processed");
  assert.equal(result.outbound.handoffMode, "bot_paused");
  assert.equal(result.state.mode, "bot_paused");
  assert.equal(result.state.handoffReason, "unclear_after_2_attempts");
});

test("wedding-sales-simple canary routing matches tenant, agent, and channel", () => {
  const canaryTargets = [
    {
      tenantId: "tenant-1",
      agentId: "agent-wedding",
      channel: "gmail" as const,
    },
  ];

  assert.equal(
    resolveWeddingSalesRuntimeForCanary({
      incoming: { tenantId: "tenant-1", agentId: "agent-wedding", channel: "gmail" },
      canaryTargets,
    }),
    "wedding-sales-simple",
  );
  assert.equal(
    resolveWeddingSalesRuntimeForCanary({
      incoming: { tenantId: "tenant-1", agentId: "agent-wedding", channel: "instagram" },
      canaryTargets,
    }),
    "legacy",
  );
});
