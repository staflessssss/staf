import assert from "node:assert/strict";
import test from "node:test";

import type { SemanticAnalysisV2 } from "../semantic-v2/schema";
import { createInitialWeddingSalesState } from "../state";
import { selectWeddingSalesActionPlan } from "./selector";
import { weddingSalesActionPlanSchema } from "./schema";

function analysis(update: Partial<SemanticAnalysisV2> = {}): SemanticAnalysisV2 {
  return {
    schemaVersion: 2,
    intents: [
      {
        category: "provide_info",
        confidence: 0.95,
        targetField: null,
        evidence: "test",
      },
    ],
    primaryIntent: "provide_info",
    entities: [],
    questions: [],
    objections: [],
    pendingResolution: null,
    clientType: null,
    ambiguity: [],
    ...update,
  };
}

test("action selector plans availability then calendar for alternate date plus call time", () => {
  const state = createInitialWeddingSalesState({
    channel: "instagram",
    message: "Yeah October 18 works, can we do a call tomorrow at 11am?",
    previousState: {
      leadStage: "ready_for_availability",
      names: "Sarah and Michael",
      weddingDate: "2026-10-18",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Charlotte",
      venue: "Evergreen Park",
      proposedCallTime: "tomorrow at 11am",
    },
  });
  const plan = selectWeddingSalesActionPlan({
    state,
    analysis: analysis({
      intents: [
        {
          category: "confirm",
          confidence: 0.95,
          targetField: "weddingDate",
          evidence: "October 18 works",
        },
        {
          category: "request_modification",
          confidence: 0.9,
          targetField: "callTime",
          evidence: "call tomorrow at 11am",
        },
      ],
      entities: [
        {
          field: "callTime",
          value: "tomorrow at 11am",
          normalizedValue: "tomorrow at 11am",
          confidence: 0.95,
          evidence: "call tomorrow at 11am",
          alternatives: [],
        },
      ],
    }),
  });

  assert.deepEqual(
    plan.actions.map((item) => item.type),
    ["check_wedding_availability", "check_consultation_calendar"],
  );
  assert.equal(weddingSalesActionPlanSchema.safeParse(plan).success, true);
});

test("action selector does not reuse an old call time when the current turn only changes wedding date", () => {
  const state = createInitialWeddingSalesState({
    channel: "instagram",
    message: "Actually October 17 2026 is our date, sorry",
    previousState: {
      leadStage: "ready_for_availability",
      names: "Emily and Jake",
      weddingDate: "2026-10-17",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Charlotte, NC",
      venue: "Evergreen Park",
      proposedCallTime: "tomorrow at 11am",
      availability: undefined,
      calendarStatus: undefined,
    },
  });
  const plan = selectWeddingSalesActionPlan({
    state,
    analysis: analysis({
      intents: [
        {
          category: "request_modification",
          confidence: 0.95,
          targetField: "weddingDate",
          evidence: "Actually October 17 2026 is our date, sorry",
        },
      ],
      entities: [
        {
          field: "weddingDate",
          value: "2026-10-17",
          normalizedValue: "2026-10-17",
          confidence: 0.95,
          evidence: "Actually October 17 2026 is our date, sorry",
          alternatives: [],
        },
      ],
    }),
  });

  assert.deepEqual(
    plan.actions.map((item) => item.type),
    ["check_wedding_availability"],
  );
});

test("action selector recommends owner handoff for existing client questions", () => {
  const state = createInitialWeddingSalesState({
    channel: "instagram",
    message: "Did my parents pay for the extra hour?",
    previousState: {
      leadStage: "availability_checked",
      clientType: "existing_client",
    },
  });
  const plan = selectWeddingSalesActionPlan({
    state,
    analysis: analysis({
      clientType: {
        value: "existing_client",
        confidence: 0.95,
        evidence: "parents pay for the extra hour",
      },
      questions: [
        {
          topicId: "operational_payment_status",
          normalizedQuestion: "Did my parents pay for the extra hour?",
          confidence: 0.95,
          evidence: "Did my parents pay",
        },
      ],
    }),
  });

  assert.equal(plan.responseGoal, "handoff");
  assert.equal(plan.actions[0]?.type, "recommend_owner_handoff");
});

test("action selector keeps active sales booking questions in the sales flow", () => {
  const state = createInitialWeddingSalesState({
    channel: "instagram",
    message: "What’s next step? Are we booking?",
    previousState: {
      leadStage: "checking_calendar",
      names: "Mia and Ethan",
      customerName: "Mia",
      partnerName: "Ethan",
      weddingDate: "2026-10-18",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Charlotte, NC",
      venue: "Evergreen Park",
      availability: "available",
      proposedCallTime: "tomorrow at 11",
    },
  });
  const plan = selectWeddingSalesActionPlan({
    state,
    analysis: analysis({
      clientType: {
        value: "existing_client",
        confidence: 0.95,
        evidence: "booking",
      },
      questions: [
        {
          topicId: "booking",
          normalizedQuestion: "Are we booking?",
          confidence: 0.95,
          evidence: "Are we booking?",
        },
      ],
    }),
  });

  assert.notEqual(plan.responseGoal, "handoff");
  assert.notEqual(plan.actions[0]?.type, "recommend_owner_handoff");
});

test("action selector does not authorize availability without location", () => {
  const state = createInitialWeddingSalesState({
    channel: "instagram",
    message: "We are Sarah and Michael, November 8 2026",
    previousState: {
      leadStage: "ready_for_availability",
      names: "Sarah and Michael",
      weddingDate: "2026-11-08",
      weddingYear: "2026",
      weddingYearKnown: true,
    },
  });
  const plan = selectWeddingSalesActionPlan({
    state,
    analysis: analysis(),
  });

  assert.equal(plan.actions[0]?.type, "ask_missing_field");
  assert.equal(plan.actions[0]?.field, "location");
  assert.equal(
    plan.guardrailTrace.find((entry) => entry.action === "check_wedding_availability")?.allowed,
    false,
  );
});

test("action selector plans booking when email arrives after available calendar", () => {
  const state = createInitialWeddingSalesState({
    channel: "instagram",
    message: "sarah@example.com",
    previousState: {
      leadStage: "ready_to_book",
      names: "Sarah and Michael",
      weddingDate: "2026-10-18",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Charlotte",
      venue: "Evergreen Park",
      availability: "available",
      calendarStatus: "available",
      proposedCallTime: "tomorrow at 11am",
      customerEmail: "sarah@example.com",
    },
  });
  const plan = selectWeddingSalesActionPlan({
    state,
    analysis: analysis({
      entities: [
        {
          field: "email",
          value: "sarah@example.com",
          normalizedValue: "sarah@example.com",
          confidence: 0.95,
          evidence: "sarah@example.com",
          alternatives: [],
        },
      ],
    }),
  });

  assert.equal(plan.responseGoal, "book_call");
  assert.equal(plan.actions[0]?.type, "book_consultation");
});

test("action selector checks calendar before answering a call-time availability question", () => {
  const state = createInitialWeddingSalesState({
    channel: "instagram",
    message: "Tomorrow at 11 works for me, how about you, are you free?",
    previousState: {
      leadStage: "checking_calendar",
      names: "Mia and Ethan",
      customerName: "Mia",
      partnerName: "Ethan",
      weddingDate: "2026-10-18",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Charlotte, NC",
      venue: "Evergreen Park",
      availability: "available",
      proposedCallTime: "tomorrow at 11",
    },
  });
  const plan = selectWeddingSalesActionPlan({
    state,
    analysis: analysis({
      intents: [
        {
          category: "ask_question",
          confidence: 0.95,
          targetField: null,
          evidence: "are you free",
        },
      ],
      entities: [
        {
          field: "callTime",
          value: "tomorrow at 11",
          normalizedValue: "tomorrow at 11",
          confidence: 0.95,
          evidence: "Tomorrow at 11",
          alternatives: [],
        },
      ],
      questions: [
        {
          topicId: "booking",
          normalizedQuestion: "Are you free tomorrow at 11?",
          confidence: 0.95,
          evidence: "are you free",
        },
      ],
    }),
  });

  assert.equal(plan.responseGoal, "run_tools_then_reply");
  assert.deepEqual(
    plan.actions.map((item) => item.type),
    ["check_consultation_calendar"],
  );
});

test("action selector rechecks calendar when customer provides a new call time after an available slot", () => {
  const state = createInitialWeddingSalesState({
    channel: "instagram",
    message: "Actually Friday at 10am would be better",
    previousState: {
      leadStage: "waiting_customer_email",
      names: "Mia and Ethan",
      customerName: "Mia",
      partnerName: "Ethan",
      weddingDate: "2026-10-18",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Charlotte, NC",
      venue: "Evergreen Park",
      availability: "available",
      proposedCallTime: "tomorrow at 11",
      calendarStatus: "available",
    },
  });
  const plan = selectWeddingSalesActionPlan({
    state,
    analysis: analysis({
      intents: [
        {
          category: "request_modification",
          confidence: 0.95,
          targetField: "callTime",
          evidence: "Actually Friday at 10am would be better",
        },
      ],
      entities: [
        {
          field: "callTime",
          value: "Friday at 10am",
          normalizedValue: "Friday at 10am",
          confidence: 0.95,
          evidence: "Friday at 10am",
          alternatives: [],
        },
      ],
    }),
  });

  assert.equal(plan.responseGoal, "run_tools_then_reply");
  assert.deepEqual(
    plan.actions.map((item) => item.type),
    ["check_consultation_calendar"],
  );
});

test("action selector does not ask for names after customer and partner names are structured", () => {
  const state = createInitialWeddingSalesState({
    channel: "instagram",
    message: "Do you charge travel fees?",
    previousState: {
      leadStage: "answering_question",
      names: "Mia and Ethan",
      customerName: "Mia",
      partnerName: "Ethan",
      coupleDisplayName: "Mia and Ethan",
      nameCollectionStatus: "both",
      weddingDate: "2026-10-17",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Miami",
      venue: "Villa Woodbine",
      availability: "available",
    },
  });
  const plan = selectWeddingSalesActionPlan({
    state,
    analysis: analysis({
      intents: [
        {
          category: "ask_question",
          confidence: 0.95,
          targetField: null,
          evidence: "travel fees",
        },
      ],
      questions: [
        {
          topicId: "travel_fees",
          normalizedQuestion: "Do you charge travel fees?",
          confidence: 0.95,
          evidence: "travel fees",
        },
      ],
    }),
  });

  assert.equal(
    plan.actions.some((item) => item.type === "ask_missing_field" && item.field === "names"),
    false,
  );
});
