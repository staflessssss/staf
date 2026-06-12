import assert from "node:assert/strict";
import test from "node:test";

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
          value: "2024-06-14T11:00:00-04:00",
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

test("semantic v2 mutator merges fiance name into existing customer name", () => {
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
          targetField: "names",
          evidence: "My fiancé is Ethan",
        },
      ],
      entities: [
        {
          field: "names",
          value: "Ethan",
          normalizedValue: null,
          confidence: 0.95,
          evidence: "My fiancé is Ethan",
          alternatives: [],
        },
      ],
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
      intents: [
        {
          category: "provide_info",
          confidence: 0.95,
          targetField: "names",
          evidence: "this is Bob",
        },
      ],
      entities: [
        {
          field: "names",
          value: "Bob",
          normalizedValue: null,
          confidence: 0.95,
          evidence: "this is Bob",
          alternatives: [],
        },
      ],
    }),
    fallbackLeadStage: "missing_names_or_date",
  });

  assert.equal(result.names, "Bob and Marie");
  assert.equal(result.customerName, "Bob");
  assert.equal(result.partnerName, "Marie");
  assert.equal(result.coupleDisplayName, "Bob and Marie");
  assert.equal(result.nameCollectionStatus, "both");
  assert.match(JSON.stringify(result.lastStateMutationTrace), /deterministic_name_role_extraction/);
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
      intents: [
        {
          category: "provide_info",
          confidence: 0.95,
          targetField: "names",
          evidence: "she's name Marie",
        },
      ],
      entities: [],
    }),
    fallbackLeadStage: "missing_names_or_date",
  });

  assert.equal(result.names, "Bob and Marie");
  assert.equal(result.customerName, "Bob");
  assert.equal(result.partnerName, "Marie");
  assert.equal(result.coupleDisplayName, "Bob and Marie");
  assert.equal(result.nameCollectionStatus, "both");
  assert.match(JSON.stringify(result.lastStateMutationTrace), /deterministic_name_role_extraction/);
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
