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
  assert.match(result.outbound.text, /wedding films start at/i);
  assert.match(result.outbound.text, /What date are you looking at/i);
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

test("wedding-sales-simple adapter persists bot_paused after human-needed handoff", async () => {
  const incoming = normalizeInstagramWeddingSalesIncoming({
    tenantId: "tenant-1",
    agentId: "agent-wedding",
    contactId: "ig-contact-1",
    text: "Can I speak to a person?",
    messageId: "mid-human",
  });
  let savedState: SimpleWeddingSalesState | undefined;
  const result = await invokeWeddingSalesSimpleAdapter({
    incoming,
    deps: {
      saveState: ({ state }) => {
        savedState = state;
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
        handoffReason: "customer_requests_human",
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
  assert.equal(result.state.handoffReason, "customer_requests_human");
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
