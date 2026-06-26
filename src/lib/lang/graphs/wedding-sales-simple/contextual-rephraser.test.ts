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
    nextStep: "reply_only",
    decisionTrace: {
      extractedFacts: {},
      missingFields: [],
      nextStep: "reply_only",
      replyType: "acknowledgement_only",
      responseKey: "utter_acknowledgement",
      reason: "customer only acknowledged",
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
    responseKey: "utter_acknowledgement" as const,
    baseText: "Of course 🤍",
    variationId: "ack_v1",
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

test("eligible safe responseKey runs shadow rephraser", async () => {
  const result = await runContextualRephraserShadow(
    baseInput({
      generateDraft: () => "Absolutely 🤍",
    }),
  );

  assert.equal(result.mode, "shadow");
  assert.equal(result.eligible, true);
  assert.equal(result.guardOk, true);
  assert.equal(result.wouldUse, true);
  assert.equal(result.draftText, "Absolutely 🤍");
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
      generateDraft: () => "Absolutely 🤍✨",
    }),
  );

  assert.equal(result.guardOk, false);
  assert.ok(result.guardErrors?.includes("too_many_emojis"));
});

test("guard blocks unresolved template variable", async () => {
  const result = await runContextualRephraserShadow(
    baseInput({
      generateDraft: () => "Absolutely {{name}} 🤍",
    }),
  );

  assert.equal(result.guardOk, false);
  assert.ok(result.guardErrors?.includes("unresolved_template_variable"));
});
