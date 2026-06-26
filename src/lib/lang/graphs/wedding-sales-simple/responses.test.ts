import assert from "node:assert/strict";
import test from "node:test";

import {
  renderResponseVariation,
  selectResponseVariation,
} from "./responses";
import type { SimpleWeddingSalesResponseKey } from "./state";

test("response catalog selects deterministic variation for same seed", () => {
  const first = selectResponseVariation({
    responseKey: "utter_ask_venue",
    conversationId: "conversation-1",
    contactId: "contact-1",
    turnIndex: 2,
  });
  const second = selectResponseVariation({
    responseKey: "utter_ask_venue",
    conversationId: "conversation-1",
    contactId: "contact-1",
    turnIndex: 2,
  });

  assert.ok(first);
  assert.equal(first?.id, second?.id);
});

test("response catalog avoids last variation when alternatives exist", () => {
  const first = selectResponseVariation({
    responseKey: "utter_acknowledgement",
    contactId: "contact-1",
    turnIndex: 1,
  });
  const second = selectResponseVariation({
    responseKey: "utter_acknowledgement",
    contactId: "contact-1",
    turnIndex: 1,
    lastVariationIds: first ? [first.id] : [],
  });

  assert.ok(first);
  assert.ok(second);
  assert.notEqual(second?.id, first?.id);
});

test("response catalog interpolates callTimeDisplay", () => {
  const variation = selectResponseVariation({
    responseKey: "utter_ask_booking_confirmation",
    contactId: "contact-1",
    turnIndex: 1,
  });

  assert.ok(variation);
  assert.match(
    renderResponseVariation(variation!, {
      callTimeDisplay: "1:30 PM",
    }),
    /1:30 PM/,
  );
});

test("response catalog interpolates email", () => {
  const variation = selectResponseVariation({
    responseKey: "utter_booking_confirmed",
    contactId: "contact-1",
    turnIndex: 1,
  });

  assert.ok(variation);
  assert.match(
    renderResponseVariation(variation!, {
      callTimeDisplay: "1:30 PM",
      email: "anna@example.com",
    }),
    /anna@example\.com/,
  );
});

test("response catalog returns null for unknown responseKey", () => {
  assert.equal(
    selectResponseVariation({
      responseKey: "utter_unknown" as SimpleWeddingSalesResponseKey,
    }),
    null,
  );
});
