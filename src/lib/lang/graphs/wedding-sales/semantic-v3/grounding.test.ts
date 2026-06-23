import assert from "node:assert/strict";
import test from "node:test";

import { selectWeddingSalesActionPlan } from "../action-plan/selector";
import { createInitialWeddingSalesState } from "../state";
import { applySemanticV2StateMutation } from "../state-v2/mutator";
import { adaptGroundedWeddingUnderstanding } from "./grounding";
import type { GroundedWeddingUnderstanding } from "./schema";

function understanding(
  update: Partial<GroundedWeddingUnderstanding>,
): GroundedWeddingUnderstanding {
  return {
    schemaVersion: 3,
    summary: "Customer provided wedding details.",
    facts: [],
    questions: [],
    decisions: [],
    clientType: null,
    unclear: [],
    ...update,
  };
}

test("grounds names, date, venue, and location from the Harborside message", () => {
  const state = createInitialWeddingSalesState({
    channel: "gmail",
    message:
      "It's 10/18/26 at Harborside Chapel in Safety Harbor FL. Cindy & Paul",
  });
  const adapted = adaptGroundedWeddingUnderstanding({
    state,
    understanding: understanding({
      facts: [
        {
          field: "customerName",
          value: "Cindy",
          normalizedValue: "Cindy",
          evidence: "Cindy & Paul",
          relation: "speaker_self",
          mode: "assert",
          confidence: 0.98,
        },
        {
          field: "partnerName",
          value: "Paul",
          normalizedValue: "Paul",
          evidence: "Cindy & Paul",
          relation: "speaker_partner",
          mode: "assert",
          confidence: 0.98,
        },
        {
          field: "weddingDate",
          value: "10/18/26",
          normalizedValue: "2026-10-18",
          evidence: "10/18/26",
          relation: "wedding",
          mode: "assert",
          confidence: 0.99,
        },
        {
          field: "venue",
          value: "Harborside Chapel",
          normalizedValue: "Harborside Chapel",
          evidence: "Harborside Chapel",
          relation: "wedding",
          mode: "assert",
          confidence: 0.99,
        },
        {
          field: "location",
          value: "Safety Harbor FL",
          normalizedValue: "Safety Harbor, FL",
          evidence: "Safety Harbor FL",
          relation: "wedding",
          mode: "assert",
          confidence: 0.99,
        },
      ],
    }),
  });
  const mutation = applySemanticV2StateMutation({
    state,
    analysis: adapted.analysis,
  });

  assert.equal(mutation.customerName, "Cindy");
  assert.equal(mutation.partnerName, "Paul");
  assert.equal(mutation.weddingDate, "2026-10-18");
  assert.equal(mutation.venue, "Harborside Chapel");
  assert.equal(mutation.location, "Safety Harbor, FL");
});

test("does not ground ceremony and reception as people", () => {
  const message =
    "April 17 2027, Miami Florida. Church ceremony and reception at different location afterwards.";
  const state = createInitialWeddingSalesState({
    channel: "instagram",
    message,
  });
  const adapted = adaptGroundedWeddingUnderstanding({
    state,
    understanding: understanding({
      facts: [
        {
          field: "customerName",
          value: "ceremony",
          normalizedValue: "ceremony",
          evidence: "ceremony and reception",
          relation: "unknown",
          mode: "assert",
          confidence: 0.96,
        },
        {
          field: "partnerName",
          value: "reception",
          normalizedValue: "reception",
          evidence: "ceremony and reception",
          relation: "unknown",
          mode: "assert",
          confidence: 0.96,
        },
        {
          field: "weddingDate",
          value: "April 17 2027",
          normalizedValue: "2027-04-17",
          evidence: "April 17 2027",
          relation: "wedding",
          mode: "assert",
          confidence: 0.99,
        },
        {
          field: "location",
          value: "Miami Florida",
          normalizedValue: "Miami, FL",
          evidence: "Miami Florida",
          relation: "wedding",
          mode: "assert",
          confidence: 0.99,
        },
      ],
    }),
  });

  assert.equal(adapted.analysis.providedInfo.customerName, null);
  assert.equal(adapted.analysis.providedInfo.partnerName, null);
  assert.deepEqual(
    adapted.rejectedFacts.map((fact) => fact.field),
    ["customerName", "partnerName"],
  );
});

test("rejects third-party names even when evidence exists", () => {
  const state = createInitialWeddingSalesState({
    channel: "instagram",
    message: "My friends Anna and Mark used you last year.",
  });
  const adapted = adaptGroundedWeddingUnderstanding({
    state,
    understanding: understanding({
      facts: [
        {
          field: "customerName",
          value: "Anna",
          normalizedValue: "Anna",
          evidence: "Anna and Mark",
          relation: "third_party",
          mode: "assert",
          confidence: 0.99,
        },
      ],
    }),
  });

  assert.equal(adapted.analysis.providedInfo.customerName, null);
  assert.equal(adapted.rejectedFacts.length, 1);
});

test("keeps every customer question when availability is ready to run", () => {
  const message = "Do you include raw footage? And what about travel fees?";
  const state = createInitialWeddingSalesState({
    channel: "instagram",
    message,
    previousState: {
      leadStage: "ready_for_availability",
      customerName: "Cindy",
      partnerName: "Paul",
      coupleDisplayName: "Cindy and Paul",
      names: "Cindy and Paul",
      nameCollectionStatus: "complete",
      weddingDate: "2026-10-18",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Safety Harbor, FL",
    },
  });
  const adapted = adaptGroundedWeddingUnderstanding({
    state,
    understanding: understanding({
      questions: [
        {
          topicId: "package_inclusions",
          normalizedQuestion: "Is raw footage included?",
          evidence: "Do you include raw footage?",
          confidence: 0.99,
        },
        {
          topicId: "travel_fees",
          normalizedQuestion: "Are there travel fees?",
          evidence: "what about travel fees?",
          confidence: 0.99,
        },
      ],
    }),
  });
  const plan = selectWeddingSalesActionPlan({
    state,
    analysis: adapted.analysis,
  });

  assert.deepEqual(
    plan.actions.map((action) => [action.type, action.topicId]),
    [
      ["check_wedding_availability", null],
      ["answer_question", "package_inclusions"],
      ["answer_question", "travel_fees"],
    ],
  );
});

test("normalizes known package and shooter questions before action planning", () => {
  const message =
    "I’m Cindy and my fiancé is Paul. Our wedding is 10/18/26 at Harborside Chapel in Safety Harbor FL. Also do you include raw footage and who is the shooter?";
  const state = createInitialWeddingSalesState({
    channel: "instagram",
    message,
  });
  const adapted = adaptGroundedWeddingUnderstanding({
    state,
    understanding: understanding({
      facts: [
        {
          field: "customerName",
          value: "Cindy",
          normalizedValue: "Cindy",
          evidence: "I’m Cindy",
          relation: "speaker_self",
          mode: "assert",
          confidence: 0.99,
        },
        {
          field: "partnerName",
          value: "Paul",
          normalizedValue: "Paul",
          evidence: "my fiancé is Paul",
          relation: "speaker_partner",
          mode: "assert",
          confidence: 0.99,
        },
        {
          field: "weddingDate",
          value: "10/18/26",
          normalizedValue: "2026-10-18",
          evidence: "Our wedding is 10/18/26",
          relation: "wedding",
          mode: "assert",
          confidence: 0.99,
        },
        {
          field: "venue",
          value: "Harborside Chapel",
          normalizedValue: "Harborside Chapel",
          evidence: "at Harborside Chapel",
          relation: "wedding",
          mode: "assert",
          confidence: 0.99,
        },
        {
          field: "location",
          value: "Safety Harbor FL",
          normalizedValue: "Safety Harbor, FL",
          evidence: "Safety Harbor FL",
          relation: "wedding",
          mode: "assert",
          confidence: 0.99,
        },
      ],
      questions: [
        {
          topicId: null,
          normalizedQuestion: "Do you include raw footage?",
          evidence: "do you include raw footage",
          confidence: 0.99,
        },
        {
          topicId: "unknown_service_request",
          normalizedQuestion: "Who is the shooter?",
          evidence: "who is the shooter?",
          confidence: 0.99,
        },
      ],
    }),
  });
  const mutation = applySemanticV2StateMutation({
    state,
    analysis: adapted.analysis,
  });
  const nextState = { ...state, ...mutation };
  const plan = selectWeddingSalesActionPlan({
    state: nextState,
    analysis: adapted.analysis,
  });

  assert.deepEqual(
    adapted.analysis.questions.map((question) => question.topicId),
    ["package_inclusions", "team_florida"],
  );
  assert.notEqual(plan.responseGoal, "handoff");
  assert.deepEqual(
    plan.actions.map((action) => [action.type, action.topicId]),
    [
      ["check_wedding_availability", null],
      ["answer_question", "package_inclusions"],
      ["answer_question", "team_florida"],
    ],
  );
});

test("an explicit date correction clears only dependent availability and scheduling state", () => {
  const state = createInitialWeddingSalesState({
    channel: "instagram",
    message: "Sorry, our wedding date is actually October 19, 2026.",
    previousState: {
      leadStage: "call_proposed",
      customerName: "Cindy",
      partnerName: "Paul",
      names: "Cindy and Paul",
      weddingDate: "2026-10-18",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Safety Harbor, FL",
      venue: "Harborside Chapel",
      availability: "available",
      availabilityRegion: "FL",
      guideSent: true,
      callProposed: true,
      proposedCallTime: "2026-06-24T13:00:00",
      calendarStatus: "available",
      checkedCallDate: "2026-06-24",
      checkedCallTime: "13:00",
      bookingConfirmed: false,
    },
  });
  const adapted = adaptGroundedWeddingUnderstanding({
    state,
    understanding: understanding({
      facts: [
        {
          field: "weddingDate",
          value: "October 19, 2026",
          normalizedValue: "2026-10-19",
          evidence: "wedding date is actually October 19, 2026",
          relation: "wedding",
          mode: "correct",
          confidence: 0.99,
        },
      ],
    }),
  });
  const mutation = applySemanticV2StateMutation({
    state,
    analysis: adapted.analysis,
  });

  assert.equal(mutation.weddingDate, "2026-10-19");
  assert.equal(mutation.availability, undefined);
  assert.equal(mutation.calendarStatus, undefined);
  assert.equal(mutation.checkedCallDate, undefined);
  assert.equal(mutation.location, undefined);
  assert.equal(state.location, "Safety Harbor, FL");
});

test("a grounded location correction invalidates regional availability and guide selection", () => {
  const state = createInitialWeddingSalesState({
    channel: "instagram",
    message: "Actually, the wedding will be in Charlotte, NC.",
    previousState: {
      leadStage: "availability_checked",
      customerName: "Cindy",
      partnerName: "Paul",
      names: "Cindy and Paul",
      weddingDate: "2026-10-18",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Safety Harbor, FL",
      venue: "Harborside Chapel",
      availability: "available",
      availabilityRegion: "FL",
      guideSent: true,
    },
  });
  const adapted = adaptGroundedWeddingUnderstanding({
    state,
    understanding: understanding({
      facts: [
        {
          field: "location",
          value: "Charlotte, NC",
          normalizedValue: "Charlotte, NC",
          evidence: "wedding will be in Charlotte, NC",
          relation: "wedding",
          mode: "correct",
          confidence: 0.99,
        },
      ],
    }),
  });
  const mutation = applySemanticV2StateMutation({
    state,
    analysis: adapted.analysis,
  });

  assert.equal(mutation.location, "Charlotte, NC");
  assert.equal(mutation.venue, undefined);
  assert.equal(mutation.availability, undefined);
  assert.equal(mutation.availabilityRegion, undefined);
  assert.equal(mutation.guideSent, false);
});
