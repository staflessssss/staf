import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveWeddingDate,
  resolveWeddingLeadFormSlots,
} from "./wedding-lead-form";
import type { SimpleWeddingSalesState } from "./state";

function state(update: Partial<SimpleWeddingSalesState> = {}): SimpleWeddingSalesState {
  return {
    channel: "instagram",
    latestCustomerMessage: "",
    bookingConfirmed: false,
    mode: "bot_active",
    unclearAttemptCount: 0,
    questionsAskedByCustomer: [],
    toolObservations: [],
    ...update,
  };
}

test("wedding lead form maps date text to canonical wedding date", () => {
  const result = resolveWeddingDate("15 October 2027");

  assert.equal(result.ok, true);
  assert.equal(result.isoDate, "2027-10-15");
  assert.equal(result.rawText, "15 October 2027");
  assert.equal(result.display, "October 15, 2027");
});

test("wedding lead form maps weddingDateText command to canonical slots", () => {
  const result = resolveWeddingLeadFormSlots({
    state: state(),
    latestCustomerMessage: "We planning wedding on 15 October 2027",
    commands: [
      {
        type: "set_slot",
        slot: "weddingDateText",
        value: "15 October 2027",
      },
    ],
  });

  assert.equal(result.slotPatch.weddingDate, "2027-10-15");
  assert.equal(result.slotPatch.weddingDateText, "15 October 2027");
  assert.equal(result.slotPatch.weddingDateDisplay, "October 15, 2027");
  assert.equal(result.missingSlotsBeforeDecision.includes("weddingDate"), false);
  assert.equal(result.selectedPromptResponseKey, "utter_ask_location_only");
  assert.deepEqual(result.slotResolution.failed, []);
  assert.equal(result.slotResolution.resolved[0]?.canonicalSlot, "weddingDate");
});

test("wedding lead form does not overwrite an existing date with vague text", () => {
  const result = resolveWeddingLeadFormSlots({
    state: state({
      weddingDate: "2027-10-15",
      weddingDateText: "15 October 2027",
      weddingDateDisplay: "October 15, 2027",
    }),
    latestCustomerMessage: "yes",
    commands: [],
  });

  assert.equal(result.canonicalSlotsBeforeDecision.weddingDate, "2027-10-15");
  assert.equal(result.slotPatch.weddingDate, undefined);
  assert.equal(result.slotResolution.failed.length, 0);
});

test("wedding lead form treats numeric slash dates as ambiguous", () => {
  const result = resolveWeddingDate("10/11/2027");

  assert.equal(result.ok, false);
  assert.equal(result.reason, "ambiguous_numeric_date");
});
