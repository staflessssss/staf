import assert from "node:assert/strict";
import test from "node:test";

import { buildWeddingSalesSimpleOutbound } from "@/lib/agents/wedding-sales-simple/outbound";
import {
  buildSimpleWeddingKnowledgeContext,
  type SimpleWeddingKnowledgeContext,
} from "./knowledge";
import { buildReplyActionContract } from "./reply-contract";
import { validateGeneratedReply } from "./reply-guards";
import { writeConstrainedWeddingReply } from "./reply-writer";
import type { SimpleWeddingSalesState } from "./state";

function baseState(update: Partial<SimpleWeddingSalesState> = {}): SimpleWeddingSalesState {
  return {
    channel: "instagram",
    latestCustomerMessage: "How much are your packages?",
    bookingConfirmed: false,
    mode: "bot_active",
    unclearAttemptCount: 0,
    questionsAskedByCustomer: ["pricing"],
    toolObservations: [],
    nextStep: "ask_missing_info",
    missingField: "names",
    decisionTrace: {
      extractedFacts: {},
      missingFields: ["names"],
      nextStep: "ask_missing_info",
      replyType: "pricing_answer",
      reason: "pricing question can be answered while collecting names",
    },
    ...update,
  };
}

function guideKnowledge(channel: "instagram" | "gmail" = "instagram"): SimpleWeddingKnowledgeContext {
  return buildSimpleWeddingKnowledgeContext({
    channel,
    state: {
      location: "Tampa",
    },
    config: {
      guide: {
        imageUrl: "https://example.com/price-fl.png",
        link: "https://example.com/guide",
        fileName: "price-fl.png",
      },
      portfolio: [
        {
          label: "Callista and Kevin",
          url: "https://galleries.example/callista",
        },
      ],
      reviews: {
        label: "Google Reviews",
        url: "https://reviews.example",
      },
    },
    features: [
      {
        name: "Founder identity and voice",
        knowledgeContent: "Taras Mynd is founder-led, warm, human, and never robotic.",
      },
      {
        name: "Collections and pricing",
        knowledgeContent:
          "Classic Collection - $2,750: 8 hours. Premium Collection - $3,500: 8 hours. Exclusive Collection - $4,250: 10 hours.",
      },
    ],
  });
}

test("reply contract requires price and names after pricing question", () => {
  const state = baseState();
  const knowledge = guideKnowledge();
  const contract = buildReplyActionContract({ state, knowledge });
  const reply = writeConstrainedWeddingReply({ state, knowledge, contract }).text;
  const guard = validateGeneratedReply({ reply, state, knowledge, contract });

  assert.equal(contract.mustMentionPricing, true);
  assert.equal(contract.requiredQuestion, "names");
  assert.equal(contract.mustMentionGuide, false);
  assert.equal(guard.ok, true);
  assert.match(reply, /\$2,950/);
  assert.match(reply, /both of your names/i);
});

test("instagram guide image and link prefer image attachment without long link text", () => {
  const state = baseState({
    latestCustomerMessage: "Can you send the price image?",
  });
  const knowledge = guideKnowledge("instagram");
  const contract = buildReplyActionContract({ state, knowledge });
  const reply = writeConstrainedWeddingReply({ state, knowledge, contract }).text;
  const guard = validateGeneratedReply({ reply, state, knowledge, contract });
  const outbound = buildWeddingSalesSimpleOutbound({
    incoming: {
      channel: "instagram",
      tenantId: "tenant-1",
      agentId: "agent-1",
      contactId: "contact-1",
      conversationId: "conversation-1",
      text: state.latestCustomerMessage,
      receivedAt: "2026-06-24T00:00:00.000Z",
    },
    state: {
      ...state,
      responseDraft: reply,
    },
    attachments: [
      {
        type: "image",
        url: knowledge.guide.imageUrl ?? "",
        label: knowledge.guide.fileName,
        purpose: "pricing_guide",
      },
    ],
  });

  assert.equal(contract.mustMentionGuide, true);
  assert.equal(guard.ok, true);
  assert.match(reply, /guide image/i);
  assert.doesNotMatch(reply, /example\.com\/guide/i);
  assert.doesNotMatch(reply, /don'?t have|cannot|can't|unable/i);
  assert.deepEqual(outbound.attachments, [
    {
      type: "image",
      url: "https://example.com/price-fl.png",
      label: "price-fl.png",
      purpose: "pricing_guide",
    },
  ]);
});

test("gmail guide link may appear while guard still blocks guide-unavailable language", () => {
  const state = baseState({
    channel: "gmail",
    latestCustomerMessage: "Please send the collections guide",
  });
  const knowledge = guideKnowledge("gmail");
  const contract = buildReplyActionContract({ state, knowledge });
  const reply = writeConstrainedWeddingReply({ state, knowledge, contract }).text;
  const guard = validateGeneratedReply({ reply, state, knowledge, contract });
  const badGuard = validateGeneratedReply({
    reply: "I don't have the guide image to send.",
    state,
    knowledge,
    contract,
  });

  assert.equal(contract.mustMentionGuide, true);
  assert.equal(guard.ok, true);
  assert.match(reply, /collections guide/i);
  assert.match(reply, /example\.com\/guide/i);
  assert.equal(badGuard.ok, false);
  assert.ok(
    badGuard.reasons.includes("reply says guide/image is unavailable even though it exists"),
  );
});
