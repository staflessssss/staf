import assert from "node:assert/strict";
import test from "node:test";

import {
  contextualRephraserTestHelpers,
  runContextualRephraserShadow,
} from "./contextual-rephraser";
import {
  buildSimpleWeddingKnowledgeContext,
  type SimpleWeddingKnowledgeContext,
} from "./knowledge";
import { buildReplyActionContract } from "./reply-contract";
import type { SimpleWeddingSalesState } from "./state";

function baseState(update: Partial<SimpleWeddingSalesState> = {}): SimpleWeddingSalesState {
  return {
    channel: "instagram",
    latestCustomerMessage: "Thank you",
    bookingConfirmed: false,
    mode: "bot_active",
    unclearAttemptCount: 0,
    questionsAskedByCustomer: [],
    toolObservations: [],
    nextStep: "ask_venue",
    decisionTrace: {
      extractedFacts: {},
      missingFields: [],
      nextStep: "ask_venue",
      replyType: "ask_venue",
      responseKey: "utter_ask_venue",
      reason: "venue is needed",
    },
    ...update,
  };
}

function knowledge(state: Partial<SimpleWeddingSalesState> = {}): SimpleWeddingKnowledgeContext {
  return buildSimpleWeddingKnowledgeContext({
    channel: "instagram",
    state,
  });
}

function baseInput(update: Partial<Parameters<typeof runContextualRephraserShadow>[0]> = {}) {
  const state = baseState(update.state);
  const context = knowledge(state);
  const contract = buildReplyActionContract({ state, knowledge: context });

  return {
    responseKey: "utter_ask_venue" as const,
    baseText: "So nice to meet you both. Do you already have a venue picked out?",
    variationId: "ask_venue_v1",
    latestCustomerMessage: state.latestCustomerMessage,
    recentTurns: [
      {
        role: "customer" as const,
        text: state.latestCustomerMessage,
      },
    ],
    slots: {},
    replyContract: contract,
    forbiddenPhrases: contract.forbiddenPhrases,
    allowedEmojis: ["🤍", "✨"],
    maxEmojis: 1,
    state,
    knowledge: context,
    ...update,
  };
}

async function withRephraserEnv<T>(
  env: Record<string, string | undefined>,
  run: () => Promise<T>,
) {
  const previous = new Map<string, string | undefined>();

  for (const key of Object.keys(env)) {
    previous.set(key, process.env[key]);

    if (env[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = env[key];
    }
  }

  try {
    return await run();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("eligible safe responseKey runs shadow rephraser", async () => {
  const result = await runContextualRephraserShadow(
    baseInput({
      generateDraft: () => "Love that - do you already have a venue picked out?",
    }),
  );

  assert.equal(result.mode, "shadow");
  assert.equal(result.eligible, true);
  assert.equal(result.guardOk, true);
  assert.equal(result.wouldUse, true);
  assert.equal(result.draftText, "Love that - do you already have a venue picked out?");
});

test("allowlisted contact can run active rephraser", async () => {
  await withRephraserEnv(
    {
      WEDDING_SALES_SIMPLE_REPHRASER_ACTIVE: "true",
      WEDDING_SALES_SIMPLE_REPHRASER_ACTIVE_CONTACT_IDS: "contact-1",
      WEDDING_SALES_SIMPLE_REPHRASER_ACTIVE_AGENT_IDS: "agent-1",
    },
    async () => {
      const result = await runContextualRephraserShadow(
        baseInput({
          agentId: "agent-1",
          contactId: "contact-1",
          generateDraft: () => "Love that - do you already have a venue picked out?",
        }),
      );

      assert.equal(result.mode, "active");
      assert.equal(result.activeAllowed, true);
      assert.equal(result.eligible, true);
      assert.equal(result.guardOk, true);
      assert.equal(result.wouldUse, true);
      assert.equal(result.draftText, "Love that - do you already have a venue picked out?");
    },
  );
});

test("active env without contact allowlist stays shadow", async () => {
  await withRephraserEnv(
    {
      WEDDING_SALES_SIMPLE_REPHRASER_ACTIVE: "true",
      WEDDING_SALES_SIMPLE_REPHRASER_ACTIVE_CONTACT_IDS: "contact-1",
      WEDDING_SALES_SIMPLE_REPHRASER_ACTIVE_AGENT_IDS: undefined,
    },
    async () => {
      const result = await runContextualRephraserShadow(
        baseInput({
          contactId: "contact-2",
        }),
      );

      assert.equal(result.mode, "shadow");
      assert.equal(result.activeAllowed, false);
      assert.equal(result.eligible, true);
      assert.equal(result.wouldUse, false);
      assert.equal(result.fallbackReason, "contact_not_allowlisted");
    },
  );
});

test("active env with unmatched agent allowlist stays shadow", async () => {
  await withRephraserEnv(
    {
      WEDDING_SALES_SIMPLE_REPHRASER_ACTIVE: "true",
      WEDDING_SALES_SIMPLE_REPHRASER_ACTIVE_CONTACT_IDS: "contact-1",
      WEDDING_SALES_SIMPLE_REPHRASER_ACTIVE_AGENT_IDS: "agent-1",
    },
    async () => {
      const result = await runContextualRephraserShadow(
        baseInput({
          agentId: "agent-2",
          contactId: "contact-1",
        }),
      );

      assert.equal(result.mode, "shadow");
      assert.equal(result.activeAllowed, false);
      assert.equal(result.eligible, true);
      assert.equal(result.wouldUse, false);
      assert.equal(result.fallbackReason, "agent_not_allowlisted");
    },
  );
});

test("ineligible responseKey skips rephraser", async () => {
  const result = await runContextualRephraserShadow(
    baseInput({
      responseKey: "utter_available_with_pricing_guide",
      generateDraft: () => "Anything",
    }),
  );

  assert.equal(result.eligible, false);
  assert.equal(result.wouldUse, false);
  assert.equal(result.fallbackReason, "response_key_not_allowed");
});

test("unsafe responseKey is not active even for allowlisted contact", async () => {
  await withRephraserEnv(
    {
      WEDDING_SALES_SIMPLE_REPHRASER_ACTIVE: "true",
      WEDDING_SALES_SIMPLE_REPHRASER_ACTIVE_CONTACT_IDS: "contact-1",
      WEDDING_SALES_SIMPLE_REPHRASER_ACTIVE_AGENT_IDS: undefined,
    },
    async () => {
      const result = await runContextualRephraserShadow(
        baseInput({
          responseKey: "utter_available_with_pricing_guide",
          contactId: "contact-1",
          generateDraft: () => "Anything",
        }),
      );

      assert.equal(result.mode, "shadow");
      assert.equal(result.activeAllowed, false);
      assert.equal(result.eligible, false);
      assert.equal(result.wouldUse, false);
      assert.equal(result.fallbackReason, "response_key_not_allowed");
    },
  );
});

test("guard blocks changed email", () => {
  const state = baseState({
    customerEmail: "anna@example.com",
    bookingConfirmed: true,
    checkedCallTime: "13:30",
    decisionTrace: {
      extractedFacts: {},
      missingFields: [],
      nextStep: "reply_only",
      toolCalled: "bookCall",
      replyType: "booking_confirmed",
      responseKey: "utter_booking_confirmed",
      reason: "booking has been confirmed",
    },
  });
  const context = knowledge(state);
  const contract = buildReplyActionContract({ state, knowledge: context });
  const guard = contextualRephraserTestHelpers.validateContextualRephrase({
    baseText: "Done — I locked us in for 1:30 PM ✨\n\nThe calendar invite should come through at anna@example.com.",
    draftText: "Done — I locked us in for 1:30 PM ✨\n\nThe calendar invite should come through at bob@example.com.",
    replyContract: contract,
    forbiddenPhrases: contract.forbiddenPhrases,
    allowedEmojis: ["🤍", "✨"],
    maxEmojis: 1,
    state,
    knowledge: context,
  });

  assert.equal(guard.ok, false);
  assert.ok(guard.errors.includes("changed_email"));
});

test("guard blocks changed call time", () => {
  const state = baseState({
    customerEmail: "anna@example.com",
    bookingConfirmed: true,
    checkedCallTime: "13:30",
    decisionTrace: {
      extractedFacts: {},
      missingFields: [],
      nextStep: "reply_only",
      toolCalled: "bookCall",
      replyType: "booking_confirmed",
      responseKey: "utter_booking_confirmed",
      reason: "booking has been confirmed",
    },
  });
  const context = knowledge(state);
  const contract = buildReplyActionContract({ state, knowledge: context });
  const guard = contextualRephraserTestHelpers.validateContextualRephrase({
    baseText: "Done — I locked us in for 1:30 PM ✨\n\nThe calendar invite should come through at anna@example.com.",
    draftText: "Done — I locked us in for 2:30 PM ✨\n\nThe calendar invite should come through at anna@example.com.",
    replyContract: contract,
    forbiddenPhrases: contract.forbiddenPhrases,
    allowedEmojis: ["🤍", "✨"],
    maxEmojis: 1,
    state,
    knowledge: context,
  });

  assert.equal(guard.ok, false);
  assert.ok(guard.errors.includes("changed_call_time"));
});

test("guard blocks forbidden phrase", async () => {
  const result = await runContextualRephraserShadow(
    baseInput({
      generateDraft: () => "I don't want to guess here 🤍",
    }),
  );

  assert.equal(result.guardOk, false);
  assert.equal(result.wouldUse, false);
  assert.equal(result.fallbackReason, "guard_failed");
  assert.ok(result.guardErrors?.some((error) => /forbidden/i.test(error)));
});

test("guard blocks too many emojis", async () => {
  const result = await runContextualRephraserShadow(
    baseInput({
      allowedEmojis: ["OK"],
      maxEmojis: 1,
      generateDraft: () => "OK OK do you already have a venue picked out?",
    }),
  );

  assert.equal(result.guardOk, false);
  assert.ok(result.guardErrors?.includes("too_many_emojis"));
});

test("guard blocks unresolved template variable", async () => {
  const result = await runContextualRephraserShadow(
    baseInput({
      generateDraft: () => "Do you already have {{venue}} picked out?",
    }),
  );

  assert.equal(result.guardOk, false);
  assert.ok(result.guardErrors?.includes("unresolved_template_variable"));
});
