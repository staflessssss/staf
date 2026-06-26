import assert from "node:assert/strict";
import test from "node:test";

import {
  markFlowDecisionSelection,
  runWeddingLeadFlowShadow,
  shouldActivateFlowDecision,
} from "./flow-runner";
import type {
  SimpleWeddingSalesDialogueCommand,
  SimpleWeddingSalesState,
} from "./state";

function state(overrides: Partial<SimpleWeddingSalesState> = {}): SimpleWeddingSalesState {
  return {
    channel: "instagram",
    latestCustomerMessage: "",
    bookingConfirmed: false,
    mode: "bot_active",
    unclearAttemptCount: 0,
    questionsAskedByCustomer: [],
    toolObservations: [],
    ...overrides,
  };
}

function run(args: {
  state?: Partial<SimpleWeddingSalesState>;
  commands: SimpleWeddingSalesDialogueCommand[];
}) {
  const currentState = state(args.state);

  return runWeddingLeadFlowShadow({
    state: currentState,
    dialogueCommands: args.commands,
    pendingUserAction: currentState.pendingUserAction ?? null,
    legacyDecision: currentState.decisionTrace,
  });
}

test("flow runner predicts booking when pending confirmation is affirmed", () => {
  const result = run({
    state: {
      pendingUserAction: {
        type: "booking_confirmation",
        slot: "Monday at 1:30pm",
        email: "anna@example.com",
      },
    },
    commands: [
      {
        type: "answer_pending_action",
        action: "booking_confirmation",
        value: "affirmative",
      },
    ],
  });

  assert.equal(result?.mode, "shadow");
  assert.equal(result?.predictedNextStep, "book_call");
  assert.equal(result?.predictedResponseKey, "utter_booking_confirmed");
  assert.equal(result?.toolName, "book_consultation");
  assert.equal(result?.shouldCallTool, true);
  assert.equal(shouldActivateFlowDecision(result), true);
  assert.equal(markFlowDecisionSelection(result, true)?.mode, "active");
  assert.equal(markFlowDecisionSelection(result, true)?.usedAsFinalDecision, true);
});

test("flow runner predicts raw footage FAQ interruption and preserves flow", () => {
  const result = run({
    state: { bookingConfirmed: true },
    commands: [{ type: "answer_question", question: "raw_footage" }],
  });

  assert.equal(result?.predictedNextStep, "reply_only");
  assert.equal(result?.predictedResponseKey, "utter_answer_raw_footage");
  assert.equal(result?.preserveFlow, true);
  assert.equal(shouldActivateFlowDecision(result), true);
});

test("flow runner predicts acknowledgement-only reply", () => {
  const result = run({
    commands: [{ type: "acknowledgement_only" }],
  });

  assert.equal(result?.predictedNextStep, "reply_only");
  assert.equal(result?.predictedResponseKey, "utter_acknowledgement");
  assert.equal(result?.preserveFlow, true);
  assert.equal(shouldActivateFlowDecision(result), true);
});

test("flow runner predicts call time after venue is collected", () => {
  const result = run({
    state: {
      customerName: "Mark",
      partnerName: "Rachel",
      availability: "available",
      venue: "Evergreen Park",
    },
    commands: [{ type: "set_slot", slot: "venue", value: "Evergreen Park" }],
  });

  assert.equal(result?.predictedNextStep, "ask_call_time");
  assert.equal(result?.predictedResponseKey, "utter_ask_call_time");
  assert.equal(shouldActivateFlowDecision(result), true);
});

test("flow runner predicts venue after couple names are collected", () => {
  const result = run({
    state: {
      customerName: "Mark",
      partnerName: "Rachel",
      availability: "available",
    },
    commands: [
      { type: "set_slot", slot: "customerName", value: "Mark" },
      { type: "set_slot", slot: "partnerName", value: "Rachel" },
    ],
  });

  assert.equal(result?.predictedNextStep, "ask_venue");
  assert.equal(result?.predictedResponseKey, "utter_ask_venue");
  assert.equal(shouldActivateFlowDecision(result), true);
});

test("flow runner falls back to legacy when a prediction does not match legacy", () => {
  const result = runWeddingLeadFlowShadow({
    state: state({
      pendingUserAction: {
        type: "booking_confirmation",
        slot: "Monday at 1:30pm",
        email: "anna@example.com",
      },
    }),
    dialogueCommands: [
      {
        type: "answer_pending_action",
        action: "booking_confirmation",
        value: "affirmative",
      },
    ],
    pendingUserAction: {
      type: "booking_confirmation",
      slot: "Monday at 1:30pm",
      email: "anna@example.com",
    },
    legacyDecision: {
      extractedFacts: {},
      missingFields: [],
      nextStep: "handoff",
      replyType: "handoff",
      reason: "legacy selected a non-allowlisted fallback",
    },
  });
  const selected = markFlowDecisionSelection(result, shouldActivateFlowDecision(result));

  assert.equal(result?.matchedLegacy, false);
  assert.equal(shouldActivateFlowDecision(result), false);
  assert.equal(selected?.mode, "shadow");
  assert.equal(selected?.usedAsFinalDecision, false);
  assert.equal(selected?.fallbackToLegacy, true);
});
