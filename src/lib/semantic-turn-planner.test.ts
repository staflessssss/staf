import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeSemanticTurnPlan,
  hasGroundedWeddingYear,
  renderSemanticTurnPlan,
} from "@/lib/semantic-turn-planner";

test("incomplete wedding date cannot request availability execution", () => {
  const plan = normalizeSemanticTurnPlan({
    action: "check_wedding_availability",
    replyObjective: "Answer the location question and ask for the wedding year.",
    directCustomerQuestion: "Where are you located?",
    nextInformationNeeded: "wedding_year",
    alreadyAnsweredFacts: [],
    conversationStage: "ongoing",
    customerIsClosing: false,
    weddingDateCompleteness: "missing_year",
    weddingYearSource: "not_established",
    weddingYearEvidence: null,
    weddingDate: "2026-11-21",
    location: "Port Saint Lucie, Florida",
    sendGuideAfterAvailability: true,
    confidence: 0.96,
  });

  assert.equal(plan.action, "respond");
  assert.equal(plan.weddingDate, null);
  assert.equal(plan.sendGuideAfterAvailability, false);
});

test("customer close disables tools and renders no-CTA guidance", () => {
  const plan = normalizeSemanticTurnPlan({
    action: "model_choice",
    replyObjective: "Close warmly.",
    directCustomerQuestion: null,
    nextInformationNeeded: "none",
    alreadyAnsweredFacts: ["Myndful operates in Florida and North Carolina"],
    conversationStage: "ongoing",
    customerIsClosing: true,
    weddingDateCompleteness: "complete",
    weddingYearSource: "recent_customer_message",
    weddingYearEvidence: "2026",
    weddingDate: "2026-11-21",
    location: "Port Saint Lucie, Florida",
    sendGuideAfterAvailability: false,
    confidence: 0.98,
  });

  assert.equal(plan.action, "respond");
  assert.match(renderSemanticTurnPlan(plan), /without a new CTA/);
});

test("wedding year evidence must exist in the claimed customer message", () => {
  const plan = {
    action: "check_wedding_availability" as const,
    replyObjective: "Check availability.",
    directCustomerQuestion: null,
    nextInformationNeeded: "none" as const,
    alreadyAnsweredFacts: [],
    conversationStage: "ongoing" as const,
    customerIsClosing: false,
    weddingDateCompleteness: "complete" as const,
    weddingYearSource: "current_message" as const,
    weddingYearEvidence: "2026",
    weddingDate: "2026-11-21",
    location: "Port Saint Lucie, Florida",
    sendGuideAfterAvailability: true,
    confidence: 0.99,
  };

  assert.equal(
    hasGroundedWeddingYear(plan, {
      currentMessage: "The wedding is November 21.",
      recentCustomerMessages: ["Good afternoon!"],
    }),
    false,
  );
  assert.equal(
    hasGroundedWeddingYear(plan, {
      currentMessage: "The wedding is November 21, 2026.",
      recentCustomerMessages: ["Good afternoon!"],
    }),
    true,
  );
});

test("collections guide plan keeps internal location labels out of the guide name", () => {
  const rendered = renderSemanticTurnPlan({
    action: "send_collections_guide",
    replyObjective: "Send the guide and state the applicable price and promotion.",
    directCustomerQuestion: null,
    nextInformationNeeded: "none",
    alreadyAnsweredFacts: [],
    conversationStage: "first_reply",
    customerIsClosing: false,
    weddingDateCompleteness: "unknown",
    weddingYearSource: "not_established",
    weddingYearEvidence: null,
    weddingDate: null,
    location: "Tampa, Florida",
    sendGuideAfterAvailability: false,
    confidence: 0.99,
  });

  assert.match(rendered, /call the attachment only/);
  assert.match(rendered, /Do not append a city, state, or service-region label/);
  assert.match(rendered, /repeat that location to introduce the starting price/);
  assert.match(rendered, /write the reply freely/);
});
