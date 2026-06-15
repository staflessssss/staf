import assert from "node:assert/strict";
import test from "node:test";

import { analyzeWeddingSalesSemanticsV2 } from "./analyzer";
import { calculateEffectiveEntityConfidence } from "./effective-confidence";
import { evaluateSemanticV2Case, semanticV2EvalCases } from "./evals";
import { buildSemanticV2Prompt, semanticV2SystemPrompt } from "./prompt";
import { semanticAnalysisV2Schema, type SemanticAnalysisV2 } from "./schema";
import { isSemanticV2ShadowEnabled } from "./shadow";
import { createInitialWeddingSalesState } from "../state";

function analysis(
  update: Partial<SemanticAnalysisV2> = {},
): SemanticAnalysisV2 {
  return {
    schemaVersion: 2,
    intents: [
      {
        category: "provide_info",
        confidence: 0.95,
        targetField: null,
        evidence: "Olivia and Daniel",
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

test("semantic v2 schema preserves multiple intents in one message", () => {
  const parsed = semanticAnalysisV2Schema.parse(
    analysis({
      intents: [
        {
          category: "ask_question",
          confidence: 0.96,
          targetField: null,
          evidence: "How long is the film?",
        },
        {
          category: "request_modification",
          confidence: 0.72,
          targetField: "weddingDate",
          evidence: "we may change our date to June 15",
        },
      ],
      primaryIntent: "ask_question",
      questions: [
        {
          topicId: "film_length",
          normalizedQuestion: "How long is the final film?",
          confidence: 0.96,
          evidence: "How long is the film?",
        },
      ],
      pendingResolution: {
        field: "weddingDate",
        type: "ambiguous",
        proposedValue: "June 15",
        confidence: 0.72,
        evidence: "we may change our date to June 15",
      },
      ambiguity: ["The customer is unsure whether the wedding date will change."],
    }),
  );

  assert.equal(parsed.intents.length, 2);
  assert.equal(parsed.questions[0]?.topicId, "film_length");
  assert.equal(parsed.pendingResolution?.type, "ambiguous");
});

test("semantic v2 schema supports structured customer and partner name roles", () => {
  const parsed = semanticAnalysisV2Schema.parse(
    analysis({
      providedInfo: {
        customerName: {
          value: "Bob",
          normalizedValue: null,
          confidence: 0.97,
          evidence: "this is Bob",
          alternatives: [],
        },
        partnerName: {
          value: "Marie",
          normalizedValue: null,
          confidence: 0.97,
          evidence: "My fiance is Marie",
          alternatives: [],
        },
      },
    }),
  );

  assert.equal(parsed.providedInfo?.customerName?.value, "Bob");
  assert.equal(parsed.providedInfo?.partnerName?.value, "Marie");
});

test("semantic v2 eval baseline contains Cases A-I", () => {
  assert.deepEqual(
    semanticV2EvalCases.map((testCase) => testCase.id),
    [
      "A-confirmed-date-correction",
      "B-complete-details",
      "C-call-objection",
      "D-final-film-faq",
      "E-past-client-operational-question",
      "F-question-before-missing-info",
      "G-address-is-venue",
      "H-multi-goal-question-and-uncertain-date",
      "I-complete-venue-location-date-and-names",
    ],
  );
});

test("semantic v2 evaluator rejects forbidden entities", () => {
  const testCase = semanticV2EvalCases.find(
    (entry) => entry.id === "C-call-objection",
  );
  assert.ok(testCase);

  const result = evaluateSemanticV2Case({
    testCase,
    analysis: analysis({
      entities: [
        {
          field: "callTime",
          value: "yet",
          normalizedValue: null,
          confidence: 0.9,
          evidence: "yet",
          alternatives: [],
        },
      ],
    }),
  });

  assert.equal(result.passed, false);
  assert.ok(result.failures.includes("forbidden entity field: callTime"));
});

test("semantic v2 analyzer validates injected structured output and receives current context", async () => {
  const state = createInitialWeddingSalesState({
    channel: "instagram",
    message: "Olivia and Daniel here. Wedding is November 8, 2026 in Tampa.",
    previousState: {
      leadStage: "missing_names_or_date",
      responseDraft: "What are both of your names and your wedding date?",
    },
  });
  let receivedPrompt = "";
  let receivedSystem = "";

  const result = await analyzeWeddingSalesSemanticsV2(state, {
    generate: async ({ prompt, system }) => {
      receivedPrompt = prompt;
      receivedSystem = system;
      return analysis({
        entities: [
          {
            field: "names",
            value: "Olivia and Daniel",
            normalizedValue: null,
            confidence: 0.98,
            evidence: "Olivia and Daniel",
            alternatives: [],
          },
          {
            field: "weddingDate",
            value: "November 8, 2026",
            normalizedValue: "2026-11-08",
            confidence: 0.98,
            evidence: "November 8, 2026",
            alternatives: [],
          },
          {
            field: "location",
            value: "Tampa",
            normalizedValue: null,
            confidence: 0.98,
            evidence: "Tampa",
            alternatives: [],
          },
        ],
      });
    },
  });

  assert.equal(result.entities.length, 3);
  assert.match(receivedPrompt, /Olivia and Daniel here/);
  assert.match(receivedPrompt, /missing_names_or_date/);
  assert.match(receivedSystem, /never write a customer reply/i);
});

test("semantic v2 effective confidence suppresses call time inferred from a scheduling objection", () => {
  const state = createInitialWeddingSalesState({
    channel: "instagram",
    message: "I am not ready to schedule a call yet, can I ask more questions?",
    previousState: {
      leadStage: "asking_call_time",
      callProposed: true,
    },
  });

  const result = calculateEffectiveEntityConfidence({
    state,
    analysis: analysis({
      intents: [
        {
          category: "express_objection",
          confidence: 0.99,
          targetField: null,
          evidence: "not ready to schedule a call yet",
        },
        {
          category: "ask_question",
          confidence: 0.95,
          targetField: null,
          evidence: "can I ask more questions?",
        },
      ],
      primaryIntent: "express_objection",
      entities: [
        {
          field: "callTime",
          value: "yet",
          normalizedValue: null,
          confidence: 0.91,
          evidence: "yet",
          alternatives: [],
        },
      ],
      objections: [
        {
          type: "not_ready_to_schedule",
          confidence: 0.99,
          evidence: "not ready to schedule a call yet",
        },
      ],
    }),
  });

  assert.ok((result[0]?.effectiveConfidence ?? 1) <= 0.2);
  assert.ok(result[0]?.reasons.includes("suppressed_by_scheduling_objection"));
});

test("semantic v2 effective confidence rejects a hallucinated date from a venue address", () => {
  const state = createInitialWeddingSalesState({
    channel: "instagram",
    message: "The venue is 333 S Franklin Street, Tampa, FL 33602.",
    previousState: {
      weddingDate: "2026-10-11",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Tampa",
      askedForVenue: true,
    },
  });

  const result = calculateEffectiveEntityConfidence({
    state,
    analysis: analysis({
      entities: [
        {
          field: "weddingDate",
          value: "2026-10-10",
          normalizedValue: "2026-10-10",
          confidence: 0.94,
          evidence: "333",
          alternatives: [],
        },
      ],
    }),
  });

  assert.ok((result[0]?.effectiveConfidence ?? 1) <= 0.45);
  assert.equal(result[0]?.conflictsWithCommittedState, true);
  assert.ok(result[0]?.reasons.includes("conflicts_without_explicit_correction"));
});

test("semantic v2 effective confidence allows an evidenced explicit date correction", () => {
  const state = createInitialWeddingSalesState({
    channel: "instagram",
    message: "Actually our new date is October 17, 2027.",
    previousState: {
      weddingDate: "2027-06-14",
      weddingYear: "2027",
      weddingYearKnown: true,
    },
  });

  const result = calculateEffectiveEntityConfidence({
    state,
    analysis: analysis({
      intents: [
        {
          category: "request_modification",
          confidence: 0.99,
          targetField: "weddingDate",
          evidence: "Actually our new date is October 17, 2027",
        },
      ],
      primaryIntent: "request_modification",
      entities: [
        {
          field: "weddingDate",
          value: "October 17, 2027",
          normalizedValue: "2027-10-17",
          confidence: 0.98,
          evidence: "October 17, 2027",
          alternatives: [],
        },
      ],
      pendingResolution: {
        field: "weddingDate",
        type: "correct",
        proposedValue: "2027-10-17",
        confidence: 0.99,
        evidence: "Actually our new date is October 17, 2027",
      },
    }),
  });

  assert.ok((result[0]?.effectiveConfidence ?? 0) >= 0.95);
  assert.equal(result[0]?.conflictsWithCommittedState, true);
  assert.ok(!result[0]?.reasons.includes("conflicts_without_explicit_correction"));
});

test("semantic v2 effective confidence allows confirmation of the pending date", () => {
  const state = createInitialWeddingSalesState({
    channel: "instagram",
    message: "Yes, I mean October 17, 2027 is our new wedding date.",
    previousState: {
      weddingDate: "2027-06-14",
      weddingYear: "2027",
      weddingYearKnown: true,
      pendingChangeField: "weddingDate",
      pendingChangeValue: "2027-10-17",
      pendingChangeDisplay: "October 17, 2027",
      leadStage: "confirming_change",
    },
  });

  const result = calculateEffectiveEntityConfidence({
    state,
    analysis: analysis({
      intents: [
        {
          category: "confirm",
          confidence: 0.99,
          targetField: "weddingDate",
          evidence: "Yes",
        },
      ],
      primaryIntent: "confirm",
      entities: [
        {
          field: "weddingDate",
          value: "October 17, 2027",
          normalizedValue: "2027-10-17",
          confidence: 0.98,
          evidence: "October 17, 2027",
          alternatives: [],
        },
      ],
      pendingResolution: {
        field: "weddingDate",
        type: "confirm",
        proposedValue: "2027-10-17",
        confidence: 0.99,
        evidence: "Yes",
      },
    }),
  });

  assert.ok((result[0]?.effectiveConfidence ?? 0) >= 0.95);
  assert.ok(!result[0]?.reasons.includes("conflicts_without_explicit_correction"));
});

test("semantic v2 effective confidence allows a confirmed alternate date after unavailable availability", () => {
  const state = createInitialWeddingSalesState({
    channel: "instagram",
    message: "Yeah, October 18 works, can we do a call tomorrow at 11am?",
    previousState: {
      weddingDate: "2026-10-17",
      weddingYear: "2026",
      weddingYearKnown: true,
      availability: "unavailable",
    },
  });

  const result = calculateEffectiveEntityConfidence({
    state,
    analysis: analysis({
      intents: [
        {
          category: "confirm",
          confidence: 0.95,
          targetField: "weddingDate",
          evidence: "Yeah, October 18 works",
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
      ],
    }),
  });

  assert.ok((result[0]?.effectiveConfidence ?? 0) >= 0.95);
  assert.equal(result[0]?.conflictsWithCommittedState, true);
  assert.ok(!result[0]?.reasons.includes("conflicts_without_explicit_correction"));
});

test("semantic v2 prompt explicitly protects tool and response boundaries", () => {
  const state = createInitialWeddingSalesState({
    channel: "gmail",
    message: "How long until we receive the final film?",
  });

  assert.match(semanticV2SystemPrompt, /never write a customer reply/i);
  assert.match(semanticV2SystemPrompt, /never.*choose tools/i);
  assert.match(semanticV2SystemPrompt, /providedInfo\.customerName/i);
  assert.match(semanticV2SystemPrompt, /providedInfo\.partnerName/i);
  assert.match(semanticV2SystemPrompt, /preserve the customer's exact scheduling phrase/i);
  assert.match(semanticV2SystemPrompt, /exact evidence in the latest customer message/i);
  const prompt = buildSemanticV2Prompt(state);
  assert.match(prompt, /final film/);
  assert.match(prompt, /availableFields/);
  assert.match(prompt, /customerName/);
  assert.match(prompt, /partnerName/);
  assert.match(prompt, /weddingDate/);
  assert.match(prompt, /location/);
  assert.match(prompt, /venue/);
  assert.match(prompt, /callTime/);
});

test("semantic v2 shadow is disabled unless explicitly enabled with an API key", () => {
  const originalFlag = process.env.WEDDING_SALES_SEMANTIC_V2_SHADOW;
  const originalKey = process.env.OPENAI_API_KEY;
  const originalLangSmithKey = process.env.LANGSMITH_API_KEY;
  const originalAgentIds = process.env.WEDDING_SALES_SEMANTIC_V2_SHADOW_AGENT_IDS;

  try {
    delete process.env.WEDDING_SALES_SEMANTIC_V2_SHADOW;
    delete process.env.OPENAI_API_KEY;
    delete process.env.LANGSMITH_API_KEY;
    delete process.env.WEDDING_SALES_SEMANTIC_V2_SHADOW_AGENT_IDS;
    assert.equal(isSemanticV2ShadowEnabled("agent-1"), false);

    process.env.WEDDING_SALES_SEMANTIC_V2_SHADOW = "true\n";
    assert.equal(isSemanticV2ShadowEnabled("agent-1"), false);

    process.env.OPENAI_API_KEY = "test-key";
    assert.equal(isSemanticV2ShadowEnabled("agent-1"), false);

    process.env.LANGSMITH_API_KEY = "test-langsmith-key";
    assert.equal(isSemanticV2ShadowEnabled("agent-1"), false);

    process.env.WEDDING_SALES_SEMANTIC_V2_SHADOW_AGENT_IDS = "agent-2,agent-3";
    assert.equal(isSemanticV2ShadowEnabled("agent-1"), false);

    process.env.WEDDING_SALES_SEMANTIC_V2_SHADOW_AGENT_IDS = "agent-2, agent-1";
    assert.equal(isSemanticV2ShadowEnabled("agent-1"), true);
  } finally {
    if (originalFlag === undefined) {
      delete process.env.WEDDING_SALES_SEMANTIC_V2_SHADOW;
    } else {
      process.env.WEDDING_SALES_SEMANTIC_V2_SHADOW = originalFlag;
    }

    if (originalKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalKey;
    }

    if (originalLangSmithKey === undefined) {
      delete process.env.LANGSMITH_API_KEY;
    } else {
      process.env.LANGSMITH_API_KEY = originalLangSmithKey;
    }

    if (originalAgentIds === undefined) {
      delete process.env.WEDDING_SALES_SEMANTIC_V2_SHADOW_AGENT_IDS;
    } else {
      process.env.WEDDING_SALES_SEMANTIC_V2_SHADOW_AGENT_IDS = originalAgentIds;
    }
  }
});
