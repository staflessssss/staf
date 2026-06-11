import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateWeddingSalesCase,
  weddingSalesStressCases,
  type WeddingSalesEvalCase,
} from "./stress-cases";

const criticalRegressionIds = [
  "regression-pending-date-correction-confirms-once",
  "regression-complete-first-message-keeps-names",
  "regression-question-before-names-answers-first",
  "regression-final-film-delivery-faq",
  "regression-call-objection-does-not-check-calendar",
  "regression-existing-client-question-handoffs",
  "regression-address-is-venue-not-date",
  "regression-partner-name-later-not-reasked",
  "regression-travel-faq-after-venue-no-name-loop",
  "regression-location-correction-overrides-raw-old-location",
  "regression-completed-lead-faq-no-requalification",
  "regression-multi-goal-faq-and-ambiguous-date",
] as const;

test("wedding sales stress baseline contains every critical regression scenario", () => {
  const ids = new Set(weddingSalesStressCases.map((testCase) => testCase.id));

  for (const id of criticalRegressionIds) {
    assert.ok(ids.has(id), `Missing critical wedding-sales regression case: ${id}`);
  }
});

test("wedding sales stress baseline uses unique case and assertion ids", () => {
  const caseIds = weddingSalesStressCases.map((testCase) => testCase.id);
  assert.equal(new Set(caseIds).size, caseIds.length, "Stress case IDs must be unique.");

  for (const testCase of weddingSalesStressCases) {
    const assertionIds = testCase.assertions.map((assertion) => assertion.id);
    assert.equal(
      new Set(assertionIds).size,
      assertionIds.length,
      `Assertion IDs must be unique within ${testCase.id}.`,
    );
  }
});

test("wedding sales evaluator catches repeated wording and forbidden tooling", () => {
  const testCase: WeddingSalesEvalCase = {
    id: "evaluator-regression",
    title: "Evaluator regression",
    input: {
      contactId: "evaluator@example.com",
      message: "I am not ready to schedule a call.",
    },
    assertions: [
      {
        id: "no-calendar",
        description: "Do not check Calendar.",
        mustNotInclude: ["already taken"],
        usedToolingExcludes: ["Calendar"],
      },
    ],
  };

  const result = evaluateWeddingSalesCase({
    testCase,
    runtime: "langgraph_wedding_sales",
    response: "That time is already taken.",
    usedTooling: ["check_consultation_calendar"],
  });

  assert.equal(result.passed, false);
  assert.equal(result.failures.length, 2);
});
