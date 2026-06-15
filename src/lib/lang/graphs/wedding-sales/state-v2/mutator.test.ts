import assert from "node:assert/strict";
import test from "node:test";

import { selectWeddingSalesActionPlan } from "../action-plan/selector";
import { createInitialWeddingSalesState } from "../state";
import type { SemanticAnalysisV2 } from "../semantic-v2/schema";
import { applySemanticV2StateMutation, isSemanticV2ExecutionEnabled } from "./mutator";

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

test("semantic v2 execution is scoped by agent allowlist", () => {
  const originalAgentIds = process.env.WEDDING_SALES_SEMANTIC_V2_EXECUTION_AGENT_IDS;

  try {
    delete process.env.WEDDING_SALES_SEMANTIC_V2_EXECUTION_AGENT_IDS;
    assert.equal(isSemanticV2ExecutionEnabled("agent-1"), false);

    process.env.WEDDING_SALES_SEMANTIC_V2_EXECUTION_AGENT_IDS = "agent-2, agent-1";
    assert.equal(isSemanticV2ExecutionEnabled("agent-1"), true);
    assert.equal(isSemanticV2ExecutionEnabled("agent-3"), false);
  } finally {
    if (originalAgentIds === undefined) {
      delete process.env.WEDDING_SALES_SEMANTIC_V2_EXECUTION_AGENT_IDS;
    } else {
      process.env.WEDDING_SALES_SEMANTIC_V2_EXECUTION_AGENT_IDS = originalAgentIds;
    }
  }
});

test("semantic v2 mutator commits alternate date confirmation and preserves call time", () => {
  const state = createInitialWeddingSalesState({
    channel: "instagram",
    message: "Yeah, October 18 works, can we do a call tomorrow at 11am?",
    previousState: {
      leadStage: "availability_checked",
      names: "Sarah and Michael",
      weddingDate: "2026-10-17",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Charlotte",
      venue: "Evergreen Park",
      availability: "unavailable",
      guideSent: true,
      callProposed: false,
    },
  });

  const result = applySemanticV2StateMutation({
    state,
    analysis: analysis({
      intents: [
        {
          category: "confirm",
          confidence: 0.95,
          targetField: "weddingDate",
          evidence: "Yeah, October 18 works",
        },
        {
          category: "request_modification",
          confidence: 0.9,
          targetField: "callTime",
          evidence: "can we do a call tomorrow at 11am?",
        },
      ],
      primaryIntent: "confirm",
      entities: [
        {
          field: "weddingDate",
          value: "October 18",
          normalizedValue: "2026-10-18",
          confidence: 0.95,
          evidence: "October 18",
          alternatives: [],
        },
        {
          field: "callTime",
          value: "tomorrow at 11am",
          normalizedValue: null,
          confidence: 0.9,
          evidence: "tomorrow at 11am",
          alternatives: [],
        },
      ],
    }),
    fallbackLeadStage: "confirming_change",
  });

  assert.equal(result.weddingDate, "2026-10-18");
  assert.equal(result.weddingYear, "2026");
  assert.equal(result.weddingYearKnown, true);
  assert.equal(result.proposedCallTime, "tomorrow at 11am");
  assert.equal(result.availability, undefined);
  assert.equal(result.calendarStatus, undefined);
  assert.equal(result.leadStage, "ready_for_availability");
  assert.match(
    JSON.stringify(result.lastStateMutationTrace),
    /semantic_v2_state_mutator/,
  );
});

test("semantic v2 mutator keeps an ambiguous date pending until the customer confirms it", () => {
  const firstState = createInitialWeddingSalesState({
    channel: "instagram",
    message: "Maybe October 17, 2026 instead.",
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
    },
  });

  const firstResult = applySemanticV2StateMutation({
    state: firstState,
    analysis: analysis({
      entities: [
        {
          field: "weddingDate",
          value: "October 17, 2026",
          normalizedValue: "2026-10-17",
          confidence: 0.6,
          evidence: "October 17, 2026",
          alternatives: [],
        },
      ],
      pendingResolution: {
        field: "weddingDate",
        type: "ambiguous",
        proposedValue: "2026-10-17",
        confidence: 0.6,
        evidence: "Maybe October 17, 2026 instead",
      },
    }),
  });

  assert.equal(firstResult.weddingDate, undefined);
  assert.equal(firstResult.pendingChangeField, "weddingDate");
  assert.equal(firstResult.pendingChangeValue, "2026-10-17");
  assert.equal(firstResult.leadStage, "confirming_change");
  assert.match(JSON.stringify(firstResult.lastStateMutationTrace), /"action":"pending"/);

  const confirmedState = createInitialWeddingSalesState({
    channel: "instagram",
    message: "Yes, October 17 is our new date.",
    previousState: {
      ...firstState,
      ...firstResult,
    },
  });
  const confirmedResult = applySemanticV2StateMutation({
    state: confirmedState,
    analysis: analysis({
      intents: [
        {
          category: "confirm",
          confidence: 0.98,
          targetField: "weddingDate",
          evidence: "Yes, October 17 is our new date",
        },
      ],
      primaryIntent: "confirm",
      pendingResolution: {
        field: "weddingDate",
        type: "confirm",
        proposedValue: "2026-10-17",
        confidence: 0.98,
        evidence: "Yes, October 17 is our new date",
      },
    }),
  });

  assert.equal(confirmedResult.weddingDate, "2026-10-17");
  assert.equal(confirmedResult.pendingChangeField, undefined);
  assert.equal(confirmedResult.availability, undefined);
  assert.equal(confirmedResult.leadStage, "ready_for_availability");
  assert.match(JSON.stringify(confirmedResult.lastStateMutationTrace), /pending_change_confirmed/);
});

test("semantic v2 mutator rejects entities grounded only in conversation history", () => {
  const state = createInitialWeddingSalesState({
    channel: "instagram",
    message: "That sounds good.",
    previousState: {
      leadStage: "availability_checked",
      customerName: "Cindy",
      partnerName: "Paul",
      names: "Cindy and Paul",
      weddingDate: "2026-10-18",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Safety Harbor, FL",
      availability: "available",
    },
  });

  const result = applySemanticV2StateMutation({
    state,
    analysis: analysis({
      entities: [
        {
          field: "weddingDate",
          value: "October 17, 2026",
          normalizedValue: "2026-10-17",
          confidence: 0.99,
          evidence: "October 17, 2026",
          alternatives: [],
        },
      ],
    }),
  });

  assert.equal(result.weddingDate, undefined);
  assert.equal(result.pendingChangeField, undefined);
  assert.match(JSON.stringify(result.lastStateMutationTrace), /evidence_missing/);
});

test("semantic v2 mutator rejects non-informative location and venue entities", () => {
  const state = createInitialWeddingSalesState({
    channel: "instagram",
    message: "The venue and location are still unknown.",
    previousState: {
      leadStage: "missing_location_or_venue",
      customerName: "Cindy",
      partnerName: "Paul",
      names: "Cindy and Paul",
      weddingDate: "2026-10-18",
      weddingYear: "2026",
      weddingYearKnown: true,
    },
  });

  const result = applySemanticV2StateMutation({
    state,
    analysis: analysis({
      entities: [
        {
          field: "venue",
          value: "the",
          normalizedValue: null,
          confidence: 0.99,
          evidence: "The",
          alternatives: [],
        },
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

  assert.equal(result.venue, undefined);
  assert.equal(result.location, undefined);
  assert.equal(result.leadStage, "missing_location_or_venue");
  assert.match(JSON.stringify(result.lastStateMutationTrace), /deterministic_validation_failed/);
});

test("semantic v2 mutator routes accepted call time to calendar check when availability is known", () => {
  const state = createInitialWeddingSalesState({
    channel: "instagram",
    message: "Tomorrow at 11am works",
    previousState: {
      leadStage: "asking_call_time",
      names: "Sarah and Michael",
      weddingDate: "2026-11-08",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Charlotte",
      venue: "Evergreen Park",
      availability: "available",
      callProposed: true,
    },
  });

  const result = applySemanticV2StateMutation({
    state,
    analysis: analysis({
      intents: [
        {
          category: "provide_info",
          confidence: 0.95,
          targetField: "callTime",
          evidence: "Tomorrow at 11am",
        },
      ],
      entities: [
        {
          field: "callTime",
          value: "Tomorrow at 11am",
          normalizedValue: null,
          confidence: 0.95,
          evidence: "Tomorrow at 11am",
          alternatives: [],
        },
      ],
    }),
    fallbackLeadStage: "asking_call_time",
  });

  assert.equal(result.proposedCallTime, "Tomorrow at 11am");
  assert.equal(result.leadStage, "checking_calendar");
});

test("semantic v2 mutator preserves customer relative call time over normalized LLM date", () => {
  const state = createInitialWeddingSalesState({
    channel: "instagram",
    message: "Can we call tomorrow at 11am?",
    previousState: {
      leadStage: "asking_call_time",
      names: "Bob and Marie",
      weddingDate: "2026-10-23",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Raleigh",
      venue: "Evergreen Park",
      availability: "available",
      callProposed: true,
    },
  });

  const result = applySemanticV2StateMutation({
    state,
    analysis: analysis({
      intents: [
        {
          category: "provide_info",
          confidence: 0.95,
          targetField: "callTime",
          evidence: "tomorrow at 11am",
        },
      ],
      entities: [
        {
          field: "callTime",
          value: "tomorrow at 11am",
          normalizedValue: "2024-06-14T11:00:00-04:00",
          confidence: 0.95,
          evidence: "tomorrow at 11am",
          alternatives: [],
        },
      ],
    }),
    fallbackLeadStage: "asking_call_time",
  });

  assert.equal(result.proposedCallTime, "tomorrow at 11am");
  assert.equal(result.leadStage, "checking_calendar");
});

test("semantic v2 mutator preserves the semantic call-time value without reparsing raw text", () => {
  const state = createInitialWeddingSalesState({
    channel: "instagram",
    message: "Would Monday morning at ten work?",
    previousState: {
      leadStage: "asking_call_time",
      names: "Bob and Marie",
      weddingDate: "2026-10-23",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Raleigh",
      venue: "Evergreen Park",
      availability: "available",
      callProposed: true,
    },
  });

  const result = applySemanticV2StateMutation({
    state,
    analysis: analysis({
      entities: [
        {
          field: "callTime",
          value: "Monday morning at ten",
          normalizedValue: "2026-06-15T10:00:00-04:00",
          confidence: 0.95,
          evidence: "Monday morning at ten",
          alternatives: [],
        },
      ],
    }),
  });

  assert.equal(result.proposedCallTime, "Monday morning at ten");
  assert.equal(result.leadStage, "checking_calendar");
});

test("semantic v2 mutator replaces a previously rejected call time with a fresh weekday time", () => {
  const state = createInitialWeddingSalesState({
    channel: "instagram",
    message: "Okay Friday 10am",
    previousState: {
      leadStage: "checking_calendar",
      names: "Bob and Marie",
      weddingDate: "2026-10-23",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Raleigh, NC",
      venue: "201 E Hargett St",
      availability: "available",
      callProposed: true,
      proposedCallTime: "Saturday 10am",
      calendarStatus: "busy",
    },
  });

  const result = applySemanticV2StateMutation({
    state,
    analysis: analysis({
      intents: [
        {
          category: "provide_info",
          confidence: 0.95,
          targetField: "callTime",
          evidence: "Friday 10am",
        },
      ],
      entities: [
        {
          field: "callTime",
          value: "Friday 10am",
          normalizedValue: null,
          confidence: 0.95,
          evidence: "Friday 10am",
          alternatives: [],
        },
      ],
    }),
    fallbackLeadStage: "checking_calendar",
  });

  assert.equal(result.proposedCallTime, "Friday 10am");
  assert.equal(result.calendarStatus, undefined);
  assert.equal(result.bookingConfirmed, false);
  assert.equal(result.leadStage, "checking_calendar");
});

test("semantic v2 mutator resolves a bare alternative time against the busy calendar date", () => {
  const state = createInitialWeddingSalesState({
    channel: "instagram",
    message: "13:00 works too",
    previousState: {
      leadStage: "checking_calendar",
      names: "Samantha and Collin",
      weddingDate: "2027-03-06",
      weddingYear: "2027",
      weddingYearKnown: true,
      location: "Fort Lauderdale, FL",
      venue: "Ritz",
      availability: "available",
      callProposed: true,
      proposedCallTime: "Wednesday June 24 at 12:30",
      calendarStatus: "busy",
      calendarContextDate: "2026-06-24",
      suggestedCallTimes: ["11:30", "12:00", "13:00"],
    },
  });

  const result = applySemanticV2StateMutation({
    state,
    analysis: analysis({
      entities: [
        {
          field: "callTime",
          value: "13:00",
          normalizedValue: null,
          confidence: 0.98,
          evidence: "13:00",
          alternatives: [],
        },
      ],
    }),
    fallbackLeadStage: "checking_calendar",
  });

  assert.equal(result.proposedCallTime, "2026-06-24T13:00:00");
  assert.equal({ ...state, ...result }.calendarContextDate, "2026-06-24");
  assert.equal(result.calendarStatus, undefined);
  assert.equal(result.checkedCallDate, undefined);
  assert.equal(result.checkedCallTime, undefined);
  assert.equal(result.leadStage, "checking_calendar");

  const plan = selectWeddingSalesActionPlan({
    state: {
      ...state,
      ...result,
    },
    analysis: analysis(),
  });

  assert.equal(plan.actions[0]?.type, "check_consultation_calendar");
});

test("semantic v2 mutator merges structured partner name into existing customer name", () => {
  const state = createInitialWeddingSalesState({
    channel: "instagram",
    message: "My fiancé is Ethan, wedding is October 17 2026 in Miami",
    previousState: {
      leadStage: "missing_names_or_date",
      names: "Mia",
    },
  });

  const result = applySemanticV2StateMutation({
    state,
    analysis: analysis({
      intents: [
        {
          category: "provide_info",
          confidence: 0.95,
          targetField: "partnerName",
          evidence: "My fiancé is Ethan",
        },
      ],
      providedInfo: {
        customerName: null,
        partnerName: {
          value: "Ethan",
          normalizedValue: null,
          confidence: 0.95,
          evidence: "My fiancé is Ethan",
          alternatives: [],
        },
      },
    }),
    fallbackLeadStage: "missing_names_or_date",
  });

  assert.equal(result.names, "Mia and Ethan");
  assert.equal(result.customerName, "Mia");
  assert.equal(result.partnerName, "Ethan");
  assert.equal(result.coupleDisplayName, "Mia and Ethan");
  assert.equal(result.nameCollectionStatus, "both");
  assert.match(JSON.stringify(result.lastStateMutationTrace), /accepted/);
});

test("semantic v2 mutator applies structured customer and partner name roles", () => {
  const state = createInitialWeddingSalesState({
    channel: "instagram",
    message: "Hi, this is Bob. My fiance is Marie. Our wedding is October 23 2026 in Raleigh NC.",
    previousState: {
      leadStage: "missing_names_or_date",
    },
  });

  const result = applySemanticV2StateMutation({
    state,
    analysis: analysis({
      providedInfo: {
        customerName: {
          value: "Bob",
          normalizedValue: null,
          confidence: 0.96,
          evidence: "this is Bob",
          alternatives: [],
        },
        partnerName: {
          value: "Marie",
          normalizedValue: null,
          confidence: 0.96,
          evidence: "My fiance is Marie",
          alternatives: [],
        },
      },
    }),
    fallbackLeadStage: "missing_names_or_date",
  });

  assert.equal(result.names, "Bob and Marie");
  assert.equal(result.customerName, "Bob");
  assert.equal(result.partnerName, "Marie");
  assert.equal(result.coupleDisplayName, "Bob and Marie");
  assert.equal(result.nameCollectionStatus, "both");
  assert.match(JSON.stringify(result.lastStateMutationTrace), /semantic_v2_structured_name_role/);
});

test("semantic v2 mutator captures self and fiance names from the same message", () => {
  const state = createInitialWeddingSalesState({
    channel: "instagram",
    message: "Hi, this is Bob. My fiance is Marie. Our wedding is October 23 2026 in Raleigh NC.",
    previousState: {
      leadStage: "missing_names_or_date",
    },
  });

  const result = applySemanticV2StateMutation({
    state,
    analysis: analysis({
      providedInfo: {
        customerName: {
          value: "Bob",
          normalizedValue: null,
          confidence: 0.95,
          evidence: "this is Bob",
          alternatives: [],
        },
        partnerName: {
          value: "Marie",
          normalizedValue: null,
          confidence: 0.95,
          evidence: "My fiance is Marie",
          alternatives: [],
        },
      },
    }),
    fallbackLeadStage: "missing_names_or_date",
  });

  assert.equal(result.names, "Bob and Marie");
  assert.equal(result.customerName, "Bob");
  assert.equal(result.partnerName, "Marie");
  assert.equal(result.coupleDisplayName, "Bob and Marie");
  assert.equal(result.nameCollectionStatus, "both");
  assert.match(JSON.stringify(result.lastStateMutationTrace), /semantic_v2_structured_name_role/);
});

test("semantic v2 mutator captures partner reminder after the partner name was missed", () => {
  const state = createInitialWeddingSalesState({
    channel: "instagram",
    message: "As I say she's name Marie",
    previousState: {
      leadStage: "missing_names_or_date",
      names: "Bob",
      customerName: "Bob",
      nameCollectionStatus: "customer_only",
    },
  });

  const result = applySemanticV2StateMutation({
    state,
    analysis: analysis({
      providedInfo: {
        customerName: null,
        partnerName: {
          value: "Marie",
          normalizedValue: null,
          confidence: 0.95,
          evidence: "she's name Marie",
          alternatives: [],
        },
      },
    }),
    fallbackLeadStage: "missing_names_or_date",
  });

  assert.equal(result.names, "Bob and Marie");
  assert.equal(result.customerName, "Bob");
  assert.equal(result.partnerName, "Marie");
  assert.equal(result.coupleDisplayName, "Bob and Marie");
  assert.equal(result.nameCollectionStatus, "both");
  assert.match(JSON.stringify(result.lastStateMutationTrace), /semantic_v2_structured_name_role/);
});

test("semantic v2 mutator does not infer a name role from a generic single-name entity", () => {
  const state = createInitialWeddingSalesState({
    channel: "instagram",
    message: "My fiance is Marie",
    previousState: {
      leadStage: "missing_names_or_date",
      names: "Bob",
      customerName: "Bob",
      nameCollectionStatus: "customer_only",
    },
  });

  const result = applySemanticV2StateMutation({
    state,
    analysis: analysis({
      entities: [
        {
          field: "names",
          value: "Marie",
          normalizedValue: null,
          confidence: 0.98,
          evidence: "My fiance is Marie",
          alternatives: [],
        },
      ],
    }),
  });

  assert.equal(result.customerName, "Bob");
  assert.equal(result.partnerName, undefined);
  assert.equal(result.names, "Bob");
  assert.match(JSON.stringify(result.lastStateMutationTrace), /generic_names_entity_is_not_structured_name_authority/);
});

test("semantic v2 mutator grounds a requested two-name answer even when roles are generic", () => {
  const state = createInitialWeddingSalesState({
    channel: "instagram",
    message: "Hi, Samantha and Collin",
    previousState: {
      leadStage: "missing_names_or_date",
      askedForNames: true,
      lastActionPlan: {
        schemaVersion: 1,
        responseGoal: "clarify",
        actions: [
          {
            type: "ask_missing_field",
            field: "customerName",
            topicId: null,
            reason: "next_required_qualification_field_missing",
          },
        ],
        guardrailTrace: [],
      },
    },
  });

  const result = applySemanticV2StateMutation({
    state,
    analysis: analysis({
      entities: [
        {
          field: "names",
          value: "Samantha and Collin",
          normalizedValue: null,
          confidence: 0.95,
          evidence: "Samantha and Collin",
          alternatives: [],
        },
      ],
    }),
  });

  assert.equal(result.customerName, "Samantha");
  assert.equal(result.partnerName, "Collin");
  assert.deepEqual(result.knownNames, ["Samantha", "Collin"]);
  assert.equal(result.nameCount, 2);
  assert.equal(result.nameRolesUncertain, true);
  assert.equal(result.nameCollectionStatus, "both");
  assert.match(JSON.stringify(result.lastStateMutationTrace), /requested_names_answer_grounded_as_known_couple_names/);

  const plan = selectWeddingSalesActionPlan({
    state: {
      ...state,
      ...result,
    },
    analysis: analysis(),
  });

  assert.equal(plan.actions[0]?.type, "ask_missing_field");
  assert.equal(plan.actions[0]?.field, "weddingDate");
});

test("semantic v2 mutator does not derive structured roles from a generic couple display entity", () => {
  const state = createInitialWeddingSalesState({
    channel: "instagram",
    message: "Cindy and Paul",
  });

  const result = applySemanticV2StateMutation({
    state,
    analysis: analysis({
      entities: [
        {
          field: "names",
          value: "Cindy and Paul",
          normalizedValue: null,
          confidence: 0.99,
          evidence: "Cindy and Paul",
          alternatives: [],
        },
      ],
    }),
  });

  assert.equal(result.customerName, undefined);
  assert.equal(result.partnerName, undefined);
  assert.equal(result.names, undefined);
  assert.match(JSON.stringify(result.lastStateMutationTrace), /generic_names_entity_is_not_structured_name_authority/);
});

test("semantic v2 mutator treats street address as venue without changing wedding date", () => {
  const state = createInitialWeddingSalesState({
    channel: "instagram",
    message: "The venue is 333 S Franklin Street, Tampa, FL 33602.",
    previousState: {
      leadStage: "asking_venue",
      names: "Suzie and Rick",
      weddingDate: "2026-10-11",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Tampa, Florida",
      availability: "available",
    },
  });

  const result = applySemanticV2StateMutation({
    state,
    analysis: analysis({
      intents: [
        {
          category: "provide_info",
          confidence: 0.95,
          targetField: "venue",
          evidence: "333 S Franklin Street, Tampa, FL 33602",
        },
      ],
      entities: [
        {
          field: "venue",
          value: "333 S Franklin Street, Tampa, FL 33602",
          normalizedValue: "333 S Franklin Street, Tampa, FL 33602",
          confidence: 0.95,
          evidence: "333 S Franklin Street, Tampa, FL 33602",
          alternatives: [],
        },
      ],
    }),
    fallbackLeadStage: "asking_venue",
  });

  assert.equal(result.venue, "333 S Franklin Street, Tampa, FL 33602");
  assert.equal("weddingDate" in result, false);
  assert.equal("weddingYear" in result, false);
  assert.equal(result.leadStage, "asking_call_time");
});

test("semantic v2 mutator commits separately extracted venue and location", () => {
  const state = createInitialWeddingSalesState({
    channel: "gmail",
    message: "Sorry about that! It’s 10/18/26 at Harborside Chapel in Safety Harbor FL.\n\nCindy & Paul",
    previousState: {
      leadStage: "missing_location_or_venue",
      names: "Cindy and Paul",
      customerName: "Cindy",
      partnerName: "Paul",
      weddingDate: "2026-10-18",
      weddingYear: "2026",
      weddingYearKnown: true,
    },
  });

  const result = applySemanticV2StateMutation({
    state,
    analysis: analysis({
      intents: [
        {
          category: "provide_info",
          confidence: 0.95,
          targetField: "venue",
          evidence: "at Harborside Chapel in Safety Harbor FL",
        },
      ],
      entities: [
        {
          field: "venue",
          value: "Harborside Chapel",
          normalizedValue: null,
          confidence: 0.95,
          evidence: "Harborside Chapel",
          alternatives: [],
        },
        {
          field: "location",
          value: "Safety Harbor FL",
          normalizedValue: "Safety Harbor, FL",
          confidence: 0.95,
          evidence: "Safety Harbor FL",
          alternatives: [],
        },
      ],
    }),
    fallbackLeadStage: "missing_location_or_venue",
  });

  assert.equal(result.venue, "Harborside Chapel");
  assert.equal(result.location, "Safety Harbor, FL");
  assert.equal(result.leadStage, "ready_for_availability");
  assert.doesNotMatch(JSON.stringify(result.lastStateMutationTrace), /grounding_derived_location_from_current_message/);
});
