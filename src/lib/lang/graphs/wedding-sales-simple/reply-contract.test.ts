import assert from "node:assert/strict";
import test from "node:test";

import { buildWeddingSalesSimpleOutbound } from "@/lib/agents/wedding-sales-simple/outbound";
import {
  buildSimpleWeddingKnowledgeContext,
  type SimpleWeddingKnowledgeContext,
} from "./knowledge";
import { buildReplyActionContract } from "./reply-contract";
import { validateGeneratedReply } from "./reply-guards";
import {
  simpleWeddingReplyWriterTestHelpers,
  writeConstrainedWeddingReply,
} from "./reply-writer";
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
      replyContract: contract,
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
  assert.equal(contract.mentionPolicy.consultation.mode, "first_available");
  assert.match(reply, /10:00 AM works on my calendar/i);
  assert.doesNotMatch(reply, /June 14|date is available/i);
});

test("calendar result contract does not repeat an already acknowledged consultation slot", () => {
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
    checkedCallDate: "2026-06-24",
    checkedCallTime: "10:00",
    customerEmail: "mike@example.com",
    replyMemory: {
      mentioned: {
        consultation: {
          slot: "2026-06-24 10:00",
          status: "available",
          turnId: "turn-1",
          lastMentionedAt: "2026-06-24T00:00:00.000Z",
        },
      },
    },
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
      nextStep: "ask_call_time",
      replyType: "ask_call_time",
      reason: "calendar slot is available and customer must explicitly confirm before booking",
    },
    nextStep: "ask_call_time",
    missingField: undefined,
  });
  const knowledge = guideKnowledge();
  const contract = buildReplyActionContract({ state, knowledge });
  const reply = writeConstrainedWeddingReply({ state, knowledge, contract }).text;

  assert.equal(contract.mustMentionCalendarAvailability, false);
  assert.equal(contract.mentionPolicy.consultation.mode, "ask_booking_confirmation");
  assert.match(reply, /lock in 10:00 AM/i);
  assert.doesNotMatch(reply, /works perfectly|works on my calendar/i);
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
  assert.equal(contract.mentionPolicy.consultation.mode, "booking_success");
  assert.equal(contract.mustMentionBookingConfirmation, true);
  assert.match(reply, /10:00 AM/i);
  assert.match(reply, /calendar invite.*mike@example\.com/i);
  assert.doesNotMatch(reply, /booked the call for Mike and Sarah/i);
  assert.doesNotMatch(reply, /works perfectly|works on my calendar/i);
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

test("writer can use response catalog for ask venue", () => {
  const state = baseState({
    latestCustomerMessage: "Mike and Sarah",
    isFirstTurn: false,
    customerName: "Mike",
    partnerName: "Sarah",
    questionsAskedByCustomer: [],
    nextStep: "ask_venue",
    missingField: undefined,
    decisionTrace: {
      extractedFacts: { customerName: "Mike", partnerName: "Sarah" },
      missingFields: ["venue"],
      nextStep: "ask_venue",
      replyType: "ask_venue",
      responseKey: "utter_ask_venue",
      reason: "names are known and venue is needed",
    },
  });
  const knowledge = guideKnowledge();
  const contract = buildReplyActionContract({ state, knowledge });
  const result = writeConstrainedWeddingReply({ state, knowledge, contract });

  assert.equal(result.writer.mode, "response_catalog");
  assert.equal(result.writer.responseKey, "utter_ask_venue");
  assert.match(result.text, /venue|taking place/i);
});

test("writer can use response catalog for ask call time", () => {
  const state = baseState({
    latestCustomerMessage: "Sounds good",
    isFirstTurn: false,
    customerName: "Mike",
    partnerName: "Sarah",
    questionsAskedByCustomer: [],
    nextStep: "ask_call_time",
    missingField: undefined,
    decisionTrace: {
      extractedFacts: {},
      missingFields: ["callTime"],
      nextStep: "ask_call_time",
      replyType: "ask_call_time",
      responseKey: "utter_ask_call_time",
      reason: "venue is known and call time is needed",
    },
  });
  const knowledge = guideKnowledge();
  const contract = buildReplyActionContract({ state, knowledge });
  const result = writeConstrainedWeddingReply({ state, knowledge, contract });

  assert.equal(result.writer.mode, "response_catalog");
  assert.equal(result.writer.responseKey, "utter_ask_call_time");
  assert.match(result.text, /quick consult|quick consult|quick call/i);
});

test("writer can use response catalog for booking confirmed", () => {
  const state = baseState({
    latestCustomerMessage: "Yes book it",
    isFirstTurn: false,
    checkedCallTime: "13:30",
    customerEmail: "anna@example.com",
    bookingConfirmed: true,
    questionsAskedByCustomer: [],
    nextStep: "reply_only",
    missingField: undefined,
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
  const knowledge = guideKnowledge();
  const contract = buildReplyActionContract({ state, knowledge });
  const result = writeConstrainedWeddingReply({ state, knowledge, contract });

  assert.equal(result.writer.mode, "response_catalog");
  assert.equal(result.writer.responseKey, "utter_booking_confirmed");
  assert.match(result.text, /1:30 PM/);
  assert.match(result.text, /anna@example\.com/);
});

test("writer can use response catalog for raw footage FAQ", () => {
  const state = baseState({
    latestCustomerMessage: "Can we get raw footage?",
    isFirstTurn: false,
    questionsAskedByCustomer: ["raw_footage"],
    replyObligations: ["raw_footage"],
    nextStep: "reply_only",
    missingField: undefined,
    decisionTrace: {
      extractedFacts: {},
      missingFields: [],
      nextStep: "reply_only",
      replyObligations: ["raw_footage"],
      replyType: "reply_only",
      responseKey: "utter_answer_raw_footage",
      reason: "customer asked raw footage FAQ",
    },
  });
  const knowledge = guideKnowledge();
  const contract = buildReplyActionContract({ state, knowledge });
  const result = writeConstrainedWeddingReply({ state, knowledge, contract });

  assert.equal(result.writer.mode, "response_catalog");
  assert.equal(result.writer.responseKey, "utter_answer_raw_footage");
  assert.match(result.text, /raw footage/i);
});

test("writer can use response catalog for acknowledgement", () => {
  const state = baseState({
    latestCustomerMessage: "Thank you",
    isFirstTurn: false,
    questionsAskedByCustomer: [],
    nextStep: "reply_only",
    missingField: undefined,
    decisionTrace: {
      extractedFacts: {},
      missingFields: [],
      nextStep: "reply_only",
      replyType: "acknowledgement_only",
      responseKey: "utter_acknowledgement",
      reason: "customer only acknowledged",
    },
  });
  const knowledge = guideKnowledge();
  const contract = buildReplyActionContract({ state, knowledge });
  const result = writeConstrainedWeddingReply({ state, knowledge, contract });

  assert.equal(result.writer.mode, "response_catalog");
  assert.equal(result.writer.responseKey, "utter_acknowledgement");
  assert.match(result.text, /of course|absolutely|you got it/i);
});

test("writer falls back when response catalog fails guard", () => {
  const state = baseState({
    latestCustomerMessage: "mike@example.com",
    isFirstTurn: false,
    customerName: "Mike",
    partnerName: "Sarah",
    checkedCallTime: "13:30",
    customerEmail: "mike@example.com",
    questionsAskedByCustomer: [],
    calendarStatus: "available",
    nextStep: "ask_call_time",
    missingField: undefined,
    decisionTrace: {
      extractedFacts: { email: "mike@example.com" },
      missingFields: [],
      nextStep: "ask_call_time",
      replyType: "ask_call_time",
      responseKey: "utter_ask_booking_confirmation",
      reason: "calendar slot is available and customer must explicitly confirm before booking",
    },
  });
  const knowledge = guideKnowledge();
  const baseContract = buildReplyActionContract({ state, knowledge });
  const catalogDraft =
    simpleWeddingReplyWriterTestHelpers.tryBuildResponseFromCatalog({
      state,
      contract: baseContract,
    });
  const contract = {
    ...baseContract,
    forbiddenPhrases: [catalogDraft?.text ?? ""],
  };
  const result = writeConstrainedWeddingReply({ state, knowledge, contract });

  assert.equal(result.writer.mode, "deterministic_fallback");
  assert.equal(result.writer.fallbackReason, "response_catalog_guard_failed");
  assert.equal(result.writer.responseKey, "utter_ask_booking_confirmation");
  assert.ok(result.writer.attemptedVariationId);
  assert.match(result.text, /lock in 1:30 PM/i);
});
