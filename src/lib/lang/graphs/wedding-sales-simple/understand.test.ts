import assert from "node:assert/strict";
import test from "node:test";

import {
  understandTurnHeuristically,
  weddingSalesSimpleUnderstandTestHelpers,
} from "./understand";

test("LLM understanding requires every fact and allows unknown facts to be null", () => {
  const result = weddingSalesSimpleUnderstandTestHelpers.llmTurnUnderstandingSchema.parse({
      customerMessageType: "availability_question",
      facts: {
        customerName: null,
        partnerName: null,
        weddingDate: "2027-06-14",
        weddingDateText: "June 14 2027",
        location: "Tampa",
        venue: null,
        email: null,
        proposedCallTime: null,
        senderRole: null,
      },
      questionsAskedByCustomer: ["availability", "pricing"],
      confidence: 0.95,
    });

  assert.equal(result.facts.weddingDate, "2027-06-14");
  assert.equal(result.facts.customerName, null);
});

test("LLM understanding rejects a facts object that omits a property", () => {
  assert.throws(() =>
    weddingSalesSimpleUnderstandTestHelpers.llmTurnUnderstandingSchema.parse({
        customerMessageType: "availability_question",
        facts: {
          partnerName: null,
          weddingDate: "2027-06-14",
          weddingDateText: "June 14 2027",
          location: "Tampa",
          venue: null,
          email: null,
          proposedCallTime: null,
          senderRole: null,
        },
        questionsAskedByCustomer: ["availability"],
        confidence: 0.95,
    }),
  );
});

test("LLM understanding restores a complete date from deterministic extraction", () => {
  const state = {
    channel: "instagram" as const,
    latestCustomerMessage:
      "Hi! Are you available for June 14 2027 in Tampa? How much are your packages?",
    bookingConfirmed: false,
    mode: "bot_active" as const,
    unclearAttemptCount: 0,
    questionsAskedByCustomer: [],
    toolObservations: [],
  };
  const result = weddingSalesSimpleUnderstandTestHelpers.normalizeLlmUnderstanding(state, {
    customerMessageType: "new_lead",
    facts: {
      customerName: null,
      partnerName: null,
      weddingDate: null,
      weddingDateText: "June 14",
      location: "Tampa",
      venue: null,
      email: null,
      proposedCallTime: null,
      senderRole: "unknown",
    },
    questionsAskedByCustomer: ["availability", "pricing"],
    confidence: 0.95,
  });

  assert.equal(result.facts.weddingDate, "2027-06-14");
});

test("LLM understanding splits a combined couple name", () => {
  const state = {
    channel: "instagram" as const,
    latestCustomerMessage: "Mike and Sarah",
    bookingConfirmed: false,
    mode: "bot_active" as const,
    unclearAttemptCount: 0,
    questionsAskedByCustomer: [],
    toolObservations: [],
  };
  const result = weddingSalesSimpleUnderstandTestHelpers.normalizeLlmUnderstanding(state, {
    customerMessageType: "answer_to_question",
    facts: {
      customerName: "Mike and Sarah",
      partnerName: null,
      weddingDate: null,
      weddingDateText: null,
      location: null,
      venue: null,
      email: null,
      proposedCallTime: null,
      senderRole: "unknown",
    },
    questionsAskedByCustomer: [],
    confidence: 0.9,
  });

  assert.equal(result.facts.customerName, "Mike");
  assert.equal(result.facts.partnerName, "Sarah");
});

test("deterministic understanding treats a request for Taras as an identity question", () => {
  const result = understandTurnHeuristically({
    channel: "instagram",
    latestCustomerMessage: "Before we finish, can I speak directly with Taras?",
    bookingConfirmed: false,
    mode: "bot_active",
    unclearAttemptCount: 0,
    questionsAskedByCustomer: [],
    toolObservations: [],
  });

  assert.equal(result.customerMessageType, "business_question");
  assert.deepEqual(result.questionsAskedByCustomer, ["identity"]);
});
