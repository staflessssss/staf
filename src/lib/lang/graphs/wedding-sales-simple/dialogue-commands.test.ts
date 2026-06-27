import assert from "node:assert/strict";
import test from "node:test";

import type { DialogueUnderstanding } from "./dialogue-understanding";
import { buildDialogueCommands } from "./dialogue-commands";
import type { TurnUnderstanding } from "./state";

function understanding(
  overrides: Partial<DialogueUnderstanding> = {},
): DialogueUnderstanding {
  return {
    messageAct: "new_fact",
    pendingAnswer: { type: "none", appliesTo: "none" },
    explicitQuestions: [],
    conversationalFiller: [],
    shouldSuppressOldContext: false,
    confidence: 0.95,
    ...overrides,
  };
}

function commands(args: {
  understanding: DialogueUnderstanding;
  facts?: TurnUnderstanding["facts"];
  state?: Parameters<typeof buildDialogueCommands>[0]["state"];
  message?: string;
}) {
  return buildDialogueCommands({
    understanding: args.understanding,
    extractedFacts: args.facts ?? {},
    pendingUserAction: {
      type: "booking_confirmation",
      slot: "Monday at 1:30pm",
      email: "anna@example.com",
    },
    state: args.state,
    latestCustomerMessage: args.message,
  });
}

test("dialogue commands map yes please to booking confirmation affirmative", () => {
  const result = commands({
    understanding: understanding({
      messageAct: "answer_pending_question",
      pendingAnswer: { type: "affirmative", appliesTo: "booking_confirmation" },
    }),
  });

  assert.deepEqual(result, [
    {
      type: "answer_pending_action",
      action: "booking_confirmation",
      value: "affirmative",
    },
  ]);
});

test("dialogue commands map yes comma please to booking confirmation affirmative", () => {
  const result = commands({
    understanding: understanding({
      messageAct: "answer_pending_question",
      pendingAnswer: { type: "affirmative", appliesTo: "booking_confirmation" },
    }),
  });

  assert.deepEqual(result, [
    {
      type: "answer_pending_action",
      action: "booking_confirmation",
      value: "affirmative",
    },
  ]);
});

test("dialogue commands map acknowledgement plus raw footage question", () => {
  const result = commands({
    understanding: understanding({
      messageAct: "mixed_ack_and_question",
      explicitQuestions: ["raw_footage"],
      conversationalFiller: ["thank you", "and yes"],
      shouldSuppressOldContext: true,
    }),
  });

  assert.deepEqual(result, [
    { type: "acknowledgement_only" },
    { type: "answer_question", question: "raw_footage" },
  ]);
});

test("dialogue commands map thank you to acknowledgement only", () => {
  const result = commands({
    understanding: understanding({
      messageAct: "acknowledgement_only",
    }),
  });

  assert.deepEqual(result, [{ type: "acknowledgement_only" }]);
});

test("dialogue commands map venue fact to set slot", () => {
  const result = commands({
    understanding: understanding(),
    facts: {
      venue: "Evergreen Park",
    },
  });

  assert.deepEqual(result, [
    {
      type: "set_slot",
      slot: "venue",
      value: "Evergreen Park",
    },
  ]);
});

test("dialogue commands start lead qualification flow for generic wedding inquiry", () => {
  const result = commands({
    understanding: understanding({
      messageAct: "generic_lead_inquiry",
    }),
  });

  assert.deepEqual(result, [
    {
      type: "start_flow",
      flow: "wedding_lead_qualification",
      reason: "generic_lead_inquiry",
    },
  ]);
});

test("dialogue commands detect post-booking details request", () => {
  const result = commands({
    message: "What time is our call again?",
    state: {
      bookingConfirmed: true,
      latestCustomerMessage: "What time is our call again?",
    } as Parameters<typeof buildDialogueCommands>[0]["state"],
    understanding: understanding({
      messageAct: "new_business_question",
    }),
  });

  assert.deepEqual(result, [{ type: "ask_booking_details", detail: "time" }]);
});

test("dialogue commands detect post-booking reschedule request", () => {
  const result = commands({
    message: "Can we move the call to Tuesday?",
    state: {
      bookingConfirmed: true,
      latestCustomerMessage: "Can we move the call to Tuesday?",
    } as Parameters<typeof buildDialogueCommands>[0]["state"],
    understanding: understanding({
      messageAct: "new_business_question",
    }),
  });

  assert.deepEqual(result, [{ type: "reschedule_request" }]);
});
