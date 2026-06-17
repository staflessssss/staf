import assert from "node:assert/strict";
import test from "node:test";

import { encrypt } from "@/lib/crypto";

import { defaultWeddingSalesConfig } from "../config";
import { createInitialWeddingSalesState, type WeddingSalesState } from "../state";
import { applySemanticV2StateMutation } from "../state-v2/mutator";
import type { SemanticAnalysisV2 } from "../semantic-v2/schema";
import { createWeddingSalesActionPlanExecutor } from "./executor";
import { selectWeddingSalesActionPlan } from "./selector";

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

function runPlanner(args: {
  state: WeddingSalesState;
  semantic: SemanticAnalysisV2;
}) {
  const mutation = applySemanticV2StateMutation({
    state: args.state,
    analysis: args.semantic,
  });
  const nextState = {
    ...args.state,
    ...mutation,
  };
  const actionPlan = selectWeddingSalesActionPlan({
    state: nextState,
    analysis: args.semantic,
  });

  return {
    mutation,
    actionPlan,
    state: {
      ...nextState,
      lastActionPlan: actionPlan,
    },
  };
}

function testToolContext() {
  return {
    tenantId: "tenant-1",
    testMode: true,
    weddingAvailability: {
      action: "capacity availability",
      params: {},
    },
    consultationCalendar: {
      action: "check calendar",
      params: {
        businessDays: [1, 2, 3, 4, 5],
        businessWindowStartHour: 9,
        businessWindowEndHour: 14,
        slotDurationMinutes: 30,
        checkConflictsBeforeBooking: false,
      },
    },
    bookConsultation: {
      action: "book call",
      params: {
        businessDays: [1, 2, 3, 4, 5],
        businessWindowStartHour: 9,
        businessWindowEndHour: 14,
        slotDurationMinutes: 30,
        inviteEmailSource: "customer_email",
        bookingDateSource: "time_text",
        bookingTimeSource: "time_text",
        checkConflictsBeforeBooking: false,
      },
      credentialsEnc: encrypt(JSON.stringify({ access_token: "test-token" })),
    },
  };
}

test("v2 pipeline stores names and asks for date next without repeating names", () => {
  const state = createInitialWeddingSalesState({
    runtimeMode: "unified_v2",
    agentId: "agent-v2",
    channel: "instagram",
    message: "We are Bob and Sara",
  });
  const semantic = analysis({
    providedInfo: {
      customerName: {
        value: "Bob",
        normalizedValue: "Bob",
        confidence: 0.95,
        evidence: "Bob",
        alternatives: [],
      },
      partnerName: {
        value: "Sara",
        normalizedValue: "Sara",
        confidence: 0.95,
        evidence: "Sara",
        alternatives: [],
      },
    },
  });

  const result = runPlanner({ state, semantic });

  assert.equal(result.mutation.customerName, "Bob");
  assert.equal(result.mutation.partnerName, "Sara");
  assert.equal(result.actionPlan.actions[0]?.type, "ask_missing_field");
  assert.equal(result.actionPlan.actions[0]?.field, "weddingDate");
  assert.equal(
    result.actionPlan.actions.some(
      (action) =>
        action.type === "ask_missing_field" &&
        (action.field === "customerName" || action.field === "partnerName" || action.field === "names"),
    ),
    false,
  );
});

test("v2 pipeline checks availability when names, date, year, and location arrive together", async () => {
  const state = createInitialWeddingSalesState({
    runtimeMode: "unified_v2",
    agentId: "agent-v2",
    channel: "instagram",
    message: "We are Cindy and Paul. It's 10/18/26 at Harborside Chapel in Safety Harbor FL.",
  });
  const semantic = analysis({
    providedInfo: {
      customerName: {
        value: "Cindy",
        normalizedValue: "Cindy",
        confidence: 0.95,
        evidence: "Cindy",
        alternatives: [],
      },
      partnerName: {
        value: "Paul",
        normalizedValue: "Paul",
        confidence: 0.95,
        evidence: "Paul",
        alternatives: [],
      },
    },
    entities: [
      {
        field: "weddingDate",
        value: "2026-10-18",
        normalizedValue: "2026-10-18",
        confidence: 0.95,
        evidence: "10/18/26",
        alternatives: [],
      },
      {
        field: "venue",
        value: "Harborside Chapel",
        normalizedValue: "Harborside Chapel",
        confidence: 0.95,
        evidence: "Harborside Chapel",
        alternatives: [],
      },
      {
        field: "location",
        value: "Safety Harbor, FL",
        normalizedValue: "Safety Harbor, FL",
        confidence: 0.95,
        evidence: "Safety Harbor FL",
        alternatives: [],
      },
    ],
  });

  const planned = runPlanner({ state, semantic });

  assert.equal(planned.state.customerName, "Cindy");
  assert.equal(planned.state.partnerName, "Paul");
  assert.equal(planned.state.weddingDate, "2026-10-18");
  assert.equal(planned.state.venue, "Harborside Chapel");
  assert.equal(planned.state.location, "Safety Harbor, FL");
  assert.equal(planned.actionPlan.actions[0]?.type, "check_wedding_availability");

  const execute = createWeddingSalesActionPlanExecutor({
    config: defaultWeddingSalesConfig,
    toolContext: testToolContext(),
  });
  const executed = await execute(planned.state);

  assert.equal(executed.availability, "available");
  assert.equal(executed.turnToolObservations?.[0]?.toolName, "check_wedding_availability");
  assert.doesNotMatch(executed.responseDraft ?? "", /share.*names/i);
  assert.doesNotMatch(executed.responseDraft ?? "", /city|location/i);
});

test("v2 pipeline answers pricing first and continues with qualification", async () => {
  const state = createInitialWeddingSalesState({
    runtimeMode: "unified_v2",
    agentId: "agent-v2",
    channel: "instagram",
    message: "Hey, what's your price?",
  });
  const semantic = analysis({
    intents: [
      {
        category: "greeting",
        confidence: 0.9,
        targetField: null,
        evidence: "Hey",
      },
      {
        category: "ask_question",
        confidence: 0.95,
        targetField: null,
        evidence: "what's your price?",
      },
    ],
    primaryIntent: "ask_question",
    questions: [
      {
        topicId: "pricing",
        normalizedQuestion: "What is your pricing?",
        confidence: 0.95,
        evidence: "what's your price?",
      },
    ],
  });
  const planned = runPlanner({ state, semantic });

  assert.deepEqual(
    planned.actionPlan.actions.map((action) => action.type),
    ["answer_question", "ask_missing_field"],
  );

  const execute = createWeddingSalesActionPlanExecutor({
    config: defaultWeddingSalesConfig,
    toolContext: testToolContext(),
  });
  const executed = await execute(planned.state);

  assert.match(executed.responseDraft ?? "", /2,950|3,490|start/i);
  assert.match(executed.responseDraft ?? "", /names/i);
  assert.match(executed.responseDraft ?? "", /wedding date/i);
});

test("v2 pipeline routes unknown service questions to owner handoff instead of guessing", () => {
  const state = createInitialWeddingSalesState({
    runtimeMode: "unified_v2",
    agentId: "agent-v2",
    channel: "instagram",
    message: "Can you do rehearsal dinner photography too?",
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
  const semantic = analysis({
    intents: [
      {
        category: "ask_question",
        confidence: 0.95,
        targetField: null,
        evidence: "rehearsal dinner photography",
      },
    ],
    primaryIntent: "ask_question",
    questions: [
      {
        topicId: "unknown_service_request",
        normalizedQuestion: "Can you provide rehearsal dinner photography?",
        confidence: 0.95,
        evidence: "rehearsal dinner photography",
      },
    ],
  });
  const planned = runPlanner({ state, semantic });

  assert.equal(planned.actionPlan.actions[0]?.type, "recommend_owner_handoff");
});

test("v2 pipeline recovers from owner handoff and checks calendar on the next call-time message", async () => {
  const state = createInitialWeddingSalesState({
    runtimeMode: "unified_v2",
    agentId: "agent-v2",
    channel: "instagram",
    message: "Do you also do photography for rehearsal dinner?",
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
  const handoffSemantic = analysis({
    intents: [
      {
        category: "ask_question",
        confidence: 0.95,
        targetField: null,
        evidence: "rehearsal dinner photography",
      },
    ],
    primaryIntent: "ask_question",
    questions: [
      {
        topicId: "unknown_service_request",
        normalizedQuestion: "Can you provide rehearsal dinner photography?",
        confidence: 0.95,
        evidence: "rehearsal dinner photography",
      },
    ],
  });
  const handoffPlanned = runPlanner({ state, semantic: handoffSemantic });
  const execute = createWeddingSalesActionPlanExecutor({
    config: defaultWeddingSalesConfig,
    toolContext: testToolContext(),
  });
  const handoffExecuted = await execute(handoffPlanned.state);

  assert.equal(handoffPlanned.actionPlan.actions[0]?.type, "recommend_owner_handoff");
  assert.equal(handoffExecuted.responseDraft ?? "", "");

  const callTimeState = createInitialWeddingSalesState({
    runtimeMode: "unified_v2",
    agentId: "agent-v2",
    channel: "instagram",
    message: "Okay, no worries. Can we book a call Wednesday June 24 at 12:30?",
    previousState: {
      ...handoffPlanned.state,
      ...handoffExecuted,
    },
  });
  const callTimeSemantic = analysis({
    primaryIntent: "request_modification",
    intents: [
      {
        category: "request_modification",
        confidence: 0.95,
        targetField: "callTime",
        evidence: "Can we book a call Wednesday June 24 at 12:30?",
      },
    ],
    pendingResolution: {
      field: "callTime",
      type: "correct",
      proposedValue: "Wednesday June 24 at 12:30",
      confidence: 0.95,
      evidence: "Can we book a call Wednesday June 24 at 12:30?",
    },
  });
  const callTimePlanned = runPlanner({
    state: callTimeState,
    semantic: callTimeSemantic,
  });

  assert.equal(callTimePlanned.state.proposedCallTime, "Wednesday June 24 at 12:30");
  assert.deepEqual(
    callTimePlanned.actionPlan.actions.map((action) => action.type),
    ["check_consultation_calendar"],
  );
});

test("v2 pipeline books only after a checked available call slot and email", async () => {
  const state = createInitialWeddingSalesState({
    runtimeMode: "unified_v2",
    agentId: "agent-v2",
    channel: "instagram",
    message: "cindy@example.com",
    previousState: {
      leadStage: "waiting_customer_email",
      customerName: "Cindy",
      partnerName: "Paul",
      names: "Cindy and Paul",
      weddingDate: "2026-10-18",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Safety Harbor, FL",
      venue: "Harborside Chapel",
      availability: "available",
      calendarStatus: "available",
      checkedCallDate: "2026-06-24",
      checkedCallTime: "12:30",
      checkedCallStartTime: "2026-06-24T12:30:00",
      checkedCallEndTime: "2026-06-24T13:00:00",
      proposedCallTime: "2026-06-24T12:30:00",
    },
  });
  const semantic = analysis({
    entities: [
      {
        field: "email",
        value: "cindy@example.com",
        normalizedValue: "cindy@example.com",
        confidence: 0.95,
        evidence: "cindy@example.com",
        alternatives: [],
      },
    ],
  });
  const planned = runPlanner({ state, semantic });

  assert.equal(planned.actionPlan.actions[0]?.type, "book_consultation");

  const execute = createWeddingSalesActionPlanExecutor({
    config: defaultWeddingSalesConfig,
    toolContext: testToolContext(),
  });
  const executed = await execute(planned.state);

  assert.equal(executed.bookingConfirmed, true);
  assert.equal(executed.turnToolObservations?.at(-1)?.toolName, "book_consultation");
  assert.match(executed.responseDraft ?? "", /calendar invite|test mode/i);
});
