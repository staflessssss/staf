import assert from "node:assert/strict";
import test from "node:test";

import type { SemanticAnalysisV2, WeddingSalesField } from "../semantic-v2/schema";
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
    providedInfo: {
      customerName: null,
      partnerName: null,
    },
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
      lastStateMutationTrace: [
        {
          action: "accepted",
          field: "callTime",
          value: "tomorrow at 11am",
          reason: "semantic_v2_committed_call_time",
        },
      ],
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

test("action selector keeps existing call questions in booking flow without a topic", () => {
  const state = createInitialWeddingSalesState({
    channel: "instagram",
    message: "Can we still keep the call?",
    previousState: {
      leadStage: "checking_calendar",
      names: "Cindy and Paul",
      customerName: "Cindy",
      partnerName: "Paul",
      coupleDisplayName: "Cindy and Paul",
      nameCollectionStatus: "both",
      weddingDate: "2026-10-19",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Safety Harbor, FL",
      venue: "Harborside Chapel",
      availability: "available",
      proposedCallTime: "Wednesday June 24 at 12:30",
      customerEmail: "cindy@example.com",
      bookingConfirmed: false,
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
          evidence: "Can we still keep the call?",
        },
      ],
      questions: [
        {
          topicId: null,
          normalizedQuestion: "Can we still keep the call?",
          confidence: 0.95,
          evidence: "Can we still keep the call?",
        },
      ],
    }),
  });

  assert.deepEqual(
    plan.actions.map((item) => item.type),
    ["check_consultation_calendar"],
  );
  assert.equal(weddingSalesActionPlanSchema.safeParse(plan).success, true);
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

test("action selector lets committed sales fields override stale owner context", () => {
  const state = createInitialWeddingSalesState({
    channel: "instagram",
    message: "Actually our date is October 19 2026",
    previousState: {
      leadStage: "ready_for_availability",
      clientType: "existing_client",
      names: "Cindy and Paul",
      customerName: "Cindy",
      partnerName: "Paul",
      weddingDate: "2026-10-19",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Safety Harbor, FL",
      venue: "Harborside Chapel",
      lastStateMutationTrace: [
        {
          action: "accepted",
          field: "weddingDate",
          value: "2026-10-19",
          reason: "test",
        },
      ],
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
          evidence: "Actually our date is October 19 2026",
        },
      ],
    }),
  });

  assert.equal(plan.responseGoal, "run_tools_then_reply");
  assert.equal(plan.actions[0]?.type, "check_wedding_availability");
});

test("action selector answers known FAQ questions after a consultation is booked", () => {
  const state = createInitialWeddingSalesState({
    channel: "instagram",
    message: "When will we get the final film?",
    previousState: {
      leadStage: "booked",
      bookingConfirmed: true,
      names: "Rick and Kris",
      customerName: "Rick",
      partnerName: "Kris",
      weddingDate: "2026-06-12",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Charlotte, NC",
      venue: "Evergreen Park",
      availability: "available",
      calendarStatus: "available",
      checkedCallDate: "2026-06-15",
      checkedCallTime: "11:00",
      proposedCallTime: "Monday 11am",
      customerEmail: "rick@example.com",
    },
  });
  const plan = selectWeddingSalesActionPlan({
    state,
    analysis: analysis({
      clientType: {
        value: "existing_client",
        confidence: 0.95,
        evidence: "get the final film",
      },
      questions: [
        {
          topicId: "final_film_delivery",
          normalizedQuestion: "When will we get the final film?",
          confidence: 0.95,
          evidence: "final film",
        },
      ],
    }),
  });

  assert.equal(plan.responseGoal, "answer_and_qualify");
  assert.equal(plan.actions[0]?.type, "answer_question");
  assert.equal(plan.actions[0]?.topicId, "final_film_delivery");
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

test("action selector does not authorize availability from a rejected semantic location", () => {
  const state = createInitialWeddingSalesState({
    channel: "instagram",
    message: "The location is unknown.",
    previousState: {
      leadStage: "ready_for_availability",
      customerName: "Cindy",
      partnerName: "Paul",
      names: "Cindy and Paul",
      weddingDate: "2026-10-18",
      weddingYear: "2026",
      weddingYearKnown: true,
      lastStateMutationTrace: [
        {
          action: "rejected",
          field: "location",
          value: "unknown",
          reason: "deterministic_validation_failed",
        },
      ],
    },
  });
  const plan = selectWeddingSalesActionPlan({
    state,
    analysis: analysis({
      entities: [
        {
          field: "location",
          value: "unknown",
          normalizedValue: null,
          confidence: 0.99,
          evidence: "unknown",
          alternatives: [],
        },
      ],
    }),
  });

  assert.equal(plan.actions[0]?.type, "ask_missing_field");
  assert.equal(plan.actions[0]?.field, "location");
  assert.equal(
    plan.guardrailTrace.find((entry) => entry.action === "check_wedding_availability")?.allowed,
    false,
  );
});

test("action selector requests confirmation instead of running tools for a pending date change", () => {
  const state = createInitialWeddingSalesState({
    channel: "instagram",
    message: "Maybe October 17 instead.",
    previousState: {
      leadStage: "confirming_change",
      customerName: "Cindy",
      partnerName: "Paul",
      names: "Cindy and Paul",
      weddingDate: "2026-10-18",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Safety Harbor, FL",
      pendingChangeField: "weddingDate",
      pendingChangeValue: "2026-10-17",
      lastStateMutationTrace: [
        {
          action: "pending",
          field: "weddingDate",
          value: "2026-10-17",
          reason: "conflicts_without_explicit_correction",
        },
      ],
    },
  });
  const plan = selectWeddingSalesActionPlan({
    state,
    analysis: analysis(),
  });

  assert.deepEqual(
    plan.actions.map((item) => item.type),
    ["request_confirmation"],
  );
  assert.equal(plan.actions[0]?.field, "weddingDate");
  assert.ok(!plan.actions.some((item) => item.type === "check_wedding_availability"));
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
      checkedCallDate: "2026-10-19",
      checkedCallTime: "11:00",
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

test("action selector rechecks calendar instead of booking when available status has no checked slot", () => {
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

  assert.equal(plan.responseGoal, "run_tools_then_reply");
  assert.deepEqual(
    plan.actions.map((item) => item.type),
    ["check_consultation_calendar"],
  );
});

test("action selector recommends owner handoff for unknown service questions", () => {
  const state = createInitialWeddingSalesState({
    channel: "instagram",
    message: "Do you offer photography for rehearsal dinner and videography for the wedding day?",
    previousState: {
      leadStage: "availability_checked",
      names: "Sam and Alex",
      customerName: "Sam",
      partnerName: "Alex",
      weddingDate: "2026-10-18",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Fort Lauderdale, FL",
      venue: "Harborside Chapel",
      availability: "available",
    },
  });
  const plan = selectWeddingSalesActionPlan({
    state,
    analysis: analysis({
      questions: [
        {
          topicId: "unknown_service_request",
          normalizedQuestion: "Do you offer photography for rehearsal dinner and videography for the wedding day?",
          confidence: 0.92,
          evidence: "photography for rehearsal dinner",
        },
      ],
    }),
  });

  assert.equal(plan.responseGoal, "handoff");
  assert.equal(plan.actions[0]?.type, "recommend_owner_handoff");
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
      lastStateMutationTrace: [
        {
          action: "accepted",
          field: "callTime",
          value: "Friday at 10am",
          reason: "semantic_v2_committed_call_time",
        },
      ],
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

test("action selector does not recheck calendar for a call-time entity rejected by state mutation", () => {
  const state = createInitialWeddingSalesState({
    channel: "instagram",
    message: "Maybe Friday at 10am, I am not sure",
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
      lastStateMutationTrace: [
        {
          action: "rejected",
          field: "callTime",
          value: "Friday at 10am",
          reason: "semantic_value_not_committed",
        },
      ],
    },
  });
  const plan = selectWeddingSalesActionPlan({
    state,
    analysis: analysis({
      entities: [
        {
          field: "callTime",
          value: "Friday at 10am",
          normalizedValue: null,
          confidence: 0.95,
          evidence: "Friday at 10am",
          alternatives: [],
        },
      ],
    }),
  });

  assert.doesNotMatch(JSON.stringify(plan.actions), /check_consultation_calendar/);
  assert.deepEqual(
    plan.actions.map((item) => [item.type, item.field]),
    [["ask_missing_field", "email"]],
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

test("action selector asks specifically for partner name when customer name is already known", () => {
  const state = createInitialWeddingSalesState({
    channel: "instagram",
    message: "What are your fees?",
    previousState: {
      leadStage: "answering_question",
      names: "Bob",
      customerName: "Bob",
      nameCollectionStatus: "customer_only",
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
          evidence: "fees",
        },
      ],
      questions: [
        {
          topicId: "pricing",
          normalizedQuestion: "What are your fees?",
          confidence: 0.95,
          evidence: "fees",
        },
      ],
    }),
  });

  const missingAction = plan.actions.find((item) => item.type === "ask_missing_field");

  assert.equal(missingAction?.field, "partnerName");
});

test("action selector does not repeat partner-name pressure after it was already asked and customer asks pricing", () => {
  const state = createInitialWeddingSalesState({
    channel: "instagram",
    message: "What are your fees?",
    previousState: {
      leadStage: "answering_question",
      names: "Bob",
      customerName: "Bob",
      nameCollectionStatus: "customer_only",
      askedFieldCounts: {
        partnerName: 1,
      },
      lastActionPlan: {
        schemaVersion: 1,
        responseGoal: "clarify",
        actions: [
          {
            type: "ask_missing_field",
            field: "partnerName",
            topicId: null,
            reason: "partner_name_missing",
          },
        ],
        guardrailTrace: [],
      },
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
          evidence: "fees",
        },
      ],
      questions: [
        {
          topicId: "pricing",
          normalizedQuestion: "What are your fees?",
          confidence: 0.95,
          evidence: "fees",
        },
      ],
    }),
  });

  assert.deepEqual(
    plan.actions.map((item) => item.type),
    ["answer_question"],
  );
});

test("action selector does not repeat call-time pressure after answering another question", () => {
  const state = createInitialWeddingSalesState({
    channel: "instagram",
    message: "Any travel fees?",
    previousState: {
      leadStage: "availability_checked",
      names: "Bob and Marie",
      customerName: "Bob",
      partnerName: "Marie",
      coupleDisplayName: "Bob and Marie",
      nameCollectionStatus: "both",
      weddingDate: "2026-10-23",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Raleigh, NC",
      venue: "Evergreen Park",
      availability: "available",
      askedForCallTime: true,
      askedFieldCounts: {
        callTime: 1,
      },
      lastActionPlan: {
        schemaVersion: 1,
        responseGoal: "clarify",
        actions: [
          {
            type: "ask_missing_field",
            field: "callTime",
            topicId: null,
            reason: "call_time_missing",
          },
        ],
        guardrailTrace: [],
      },
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
          normalizedQuestion: "Any travel fees?",
          confidence: 0.95,
          evidence: "travel fees",
        },
      ],
    }),
  });

  assert.deepEqual(
    plan.actions.map((item) => item.type),
    ["answer_question"],
  );
});

test("action selector suppresses repeated missing-field pressure across qualification fields", () => {
  const cases: Array<{
    label: string;
    field: Exclude<WeddingSalesField, "names">;
    previousState: Parameters<typeof createInitialWeddingSalesState>[0]["previousState"];
    message: string;
    topicId: string;
  }> = [
    {
      label: "customer name",
      field: "customerName",
      previousState: {
        leadStage: "new",
      },
      message: "Do you travel?",
      topicId: "travel_fees",
    },
    {
      label: "partner name",
      field: "partnerName",
      previousState: {
        leadStage: "answering_question",
        names: "Bob",
        customerName: "Bob",
        nameCollectionStatus: "customer_only",
      },
      message: "What does the package include?",
      topicId: "package_inclusions",
    },
    {
      label: "wedding date",
      field: "weddingDate",
      previousState: {
        leadStage: "missing_names_or_date",
        names: "Bob and Marie",
        customerName: "Bob",
        partnerName: "Marie",
        coupleDisplayName: "Bob and Marie",
        nameCollectionStatus: "both",
      },
      message: "Can we see your portfolio?",
      topicId: "portfolio",
    },
    {
      label: "wedding year",
      field: "weddingYear",
      previousState: {
        leadStage: "waiting_wedding_year",
        names: "Bob and Marie",
        customerName: "Bob",
        partnerName: "Marie",
        coupleDisplayName: "Bob and Marie",
        nameCollectionStatus: "both",
        weddingDate: "10-23",
        weddingYearKnown: false,
      },
      message: "Do you send raw footage?",
      topicId: "package_inclusions",
    },
    {
      label: "location",
      field: "location",
      previousState: {
        leadStage: "missing_location_or_venue",
        names: "Bob and Marie",
        customerName: "Bob",
        partnerName: "Marie",
        coupleDisplayName: "Bob and Marie",
        nameCollectionStatus: "both",
        weddingDate: "2026-10-23",
        weddingYear: "2026",
        weddingYearKnown: true,
      },
      message: "Can I see your reviews?",
      topicId: "reviews",
    },
    {
      label: "venue",
      field: "venue",
      previousState: {
        leadStage: "availability_checked",
        names: "Bob and Marie",
        customerName: "Bob",
        partnerName: "Marie",
        coupleDisplayName: "Bob and Marie",
        nameCollectionStatus: "both",
        weddingDate: "2026-10-23",
        weddingYear: "2026",
        weddingYearKnown: true,
        location: "Raleigh, NC",
        availability: "available",
      },
      message: "Who will be the shooter?",
      topicId: "team_nc_sc_ga",
    },
    {
      label: "call time",
      field: "callTime",
      previousState: {
        leadStage: "availability_checked",
        names: "Bob and Marie",
        customerName: "Bob",
        partnerName: "Marie",
        coupleDisplayName: "Bob and Marie",
        nameCollectionStatus: "both",
        weddingDate: "2026-10-23",
        weddingYear: "2026",
        weddingYearKnown: true,
        location: "Raleigh, NC",
        venue: "Evergreen Park",
        availability: "available",
      },
      message: "Do you have insurance?",
      topicId: "insurance",
    },
    {
      label: "email",
      field: "email",
      previousState: {
        leadStage: "waiting_customer_email",
        names: "Bob and Marie",
        customerName: "Bob",
        partnerName: "Marie",
        coupleDisplayName: "Bob and Marie",
        nameCollectionStatus: "both",
        weddingDate: "2026-10-23",
        weddingYear: "2026",
        weddingYearKnown: true,
        location: "Raleigh, NC",
        venue: "Evergreen Park",
        availability: "available",
        proposedCallTime: "Friday 10 AM",
        calendarStatus: "available",
      },
      message: "How long does the final film take?",
      topicId: "final_film_delivery",
    },
  ];

  for (const item of cases) {
    const state = createInitialWeddingSalesState({
      channel: "instagram",
      message: item.message,
      previousState: {
        ...item.previousState,
        askedFieldCounts: {
          [item.field]: 1,
        },
        lastActionPlan: {
          schemaVersion: 1,
          responseGoal: "clarify",
          actions: [
            {
              type: "ask_missing_field",
              field: item.field,
              topicId: null,
              reason: `${item.field}_missing`,
            },
          ],
          guardrailTrace: [],
        },
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
            evidence: item.message,
          },
        ],
        questions: [
          {
            topicId: item.topicId,
            normalizedQuestion: item.message,
            confidence: 0.95,
            evidence: item.message,
          },
        ],
      }),
    });

    assert.deepEqual(
      plan.actions.map((actionItem) => actionItem.type),
      ["answer_question"],
      item.label,
    );
  }
});
