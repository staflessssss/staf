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
  assert.equal(contract.mentionPolicy.pricing.mode, "full");
  assert.equal(contract.mentionPolicy.guide.mode, "send_attachment");
  assert.equal(guard.ok, true);
  assert.match(reply, /\$2,950/);
  assert.match(reply, /both of your names/i);
});

test("reply contract uses same-as-before pricing when customer asks again", () => {
  const state = baseState({
    replyMemory: {
      mentioned: {
        pricing: {
          value: "$2,950",
          turnId: "turn-1",
          lastMentionedAt: "2026-06-24T00:00:00.000Z",
        },
      },
    },
  });
  const knowledge = guideKnowledge();
  const contract = buildReplyActionContract({ state, knowledge });
  const reply = writeConstrainedWeddingReply({ state, knowledge, contract }).text;

  assert.equal(contract.mentionPolicy.pricing.mode, "same_as_before");
  assert.match(contract.mentionPolicy.pricing.reason, /already mentioned/i);
  assert.match(reply, /same as I mentioned/i);
  assert.match(reply, /\$2,950/);
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
  assert.equal(contract.mentionPolicy.guide.mode, "send_attachment");
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
  assert.equal(contract.mentionPolicy.guide.mode, "send_attachment");
  assert.equal(guard.ok, true);
  assert.match(reply, /collections guide/i);
  assert.match(reply, /example\.com\/guide/i);
  assert.equal(badGuard.ok, false);
  assert.ok(
    badGuard.reasons.includes("reply says guide/image is unavailable even though it exists"),
  );
});

test("calendar result contract does not repeat persistent wedding availability", () => {
  const state = baseState({
    latestCustomerMessage: "Can we call tomorrow at 10am?",
    isFirstTurn: false,
    customerName: "Mike",
    partnerName: "Sarah",
    weddingDate: "2027-06-14",
    location: "Tampa",
    venue: "Evergreen Park",
    availability: "available",
    calendarStatus: "available",
    checkedCallTime: "10:00",
    questionsAskedByCustomer: ["availability"],
    lastUnderstanding: {
      customerMessageType: "call_time_proposed",
      facts: { proposedCallTime: "tomorrow at 10am" },
      questionsAskedByCustomer: ["availability"],
      confidence: 0.9,
    },
    decisionTrace: {
      extractedFacts: { proposedCallTime: "tomorrow at 10am" },
      missingFields: ["email"],
      nextStep: "ask_email",
      toolCalled: "checkCalendar",
      replyType: "ask_email",
      reason: "calendar slot is available and email is needed",
    },
    nextStep: "ask_email",
    missingField: undefined,
  });
  const knowledge = guideKnowledge();
  const contract = buildReplyActionContract({ state, knowledge });
  const reply = writeConstrainedWeddingReply({ state, knowledge, contract }).text;

  assert.equal(contract.mustMentionWeddingAvailability, false);
  assert.equal(contract.mustMentionCalendarAvailability, true);
  assert.match(reply, /10:00 AM works perfectly for a call/i);
  assert.doesNotMatch(reply, /June 14|date is available/i);
});

test("booking result contract does not repeat the previously confirmed calendar slot", () => {
  const state = baseState({
    latestCustomerMessage: "mike@example.com",
    isFirstTurn: false,
    customerName: "Mike",
    partnerName: "Sarah",
    weddingDate: "2027-06-14",
    location: "Tampa",
    venue: "Evergreen Park",
    availability: "available",
    calendarStatus: "available",
    checkedCallTime: "10:00",
    customerEmail: "mike@example.com",
    bookingConfirmed: true,
    questionsAskedByCustomer: [],
    lastUnderstanding: {
      customerMessageType: "email_provided",
      facts: { email: "mike@example.com" },
      questionsAskedByCustomer: [],
      confidence: 0.95,
    },
    decisionTrace: {
      extractedFacts: { email: "mike@example.com" },
      missingFields: [],
      nextStep: "reply_only",
      toolCalled: "bookCall",
      replyType: "booking_confirmed",
      reason: "booking has been confirmed",
    },
    nextStep: "reply_only",
    missingField: undefined,
  });
  const knowledge = guideKnowledge();
  const contract = buildReplyActionContract({ state, knowledge });
  const reply = writeConstrainedWeddingReply({ state, knowledge, contract }).text;

  assert.equal(contract.mustMentionCalendarAvailability, false);
  assert.equal(contract.mustMentionBookingConfirmation, true);
  assert.match(reply, /I booked the call for Mike and Sarah/i);
  assert.doesNotMatch(reply, /10:00 works/i);
});

test("reply guard rejects stale wedding availability outside the contract", () => {
  const state = baseState({
    isFirstTurn: false,
    availability: "available",
    weddingDate: "2027-06-14",
    location: "Tampa",
    questionsAskedByCustomer: [],
  });
  const knowledge = guideKnowledge();
  const contract = buildReplyActionContract({ state, knowledge });
  const guard = validateGeneratedReply({
    reply: "I checked June 14, 2027 in Tampa, and the date is available.",
    state,
    knowledge,
    contract,
  });

  assert.equal(contract.mustMentionWeddingAvailability, false);
  assert.equal(guard.ok, false);
  assert.ok(guard.reasons.includes("stale wedding availability was repeated"));
});

test("writer reads founder greeting from structured knowledge instead of fixed copy", () => {
  const state = baseState({
    isFirstTurn: true,
  });
  const knowledge = buildSimpleWeddingKnowledgeContext({
    channel: "instagram",
    channelConfig: {
      prompting: {
        persona: "You are Elena, the founder of Northlight Weddings.",
        replyStyle: {
          greetingOpening: "Hello from Northlight 🤍✨",
          greetingIntroduction: "I’m {{name}}, founder of {{company}}.",
          greetingCelebration: "Congratulations on this beautiful chapter!",
        },
      },
    },
    state: { location: "Tampa" },
  });
  const contract = buildReplyActionContract({ state, knowledge });
  const reply = writeConstrainedWeddingReply({ state, knowledge, contract }).text;

  assert.match(reply, /^Hello from Northlight 🤍✨/);
  assert.match(reply, /I’m Elena, founder of Northlight Weddings/);
  assert.match(reply, /Congratulations on this beautiful chapter/);
  assert.doesNotMatch(reply, /Taras|Myndful/);
});
