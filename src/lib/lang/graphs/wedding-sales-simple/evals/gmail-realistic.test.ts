import assert from "node:assert/strict";
import test from "node:test";

import { invokeWeddingSalesSimpleGraph } from "../graph";
import type { SimpleWeddingSalesState } from "../state";
import { gmailLongInquiryReplay } from "./fixtures/gmail-long-inquiries";

const toolContext = {
  tenantId: "tenant-1",
  testMode: true,
  weddingAvailability: {
    action: "capacity availability",
    params: {},
  },
  consultationCalendar: {
    action: "check calendar",
    params: {
      checkConflictsBeforeBooking: false,
    },
  },
  bookConsultation: {
    action: "book call",
    params: {
      checkConflictsBeforeBooking: false,
    },
  },
};

test("gmail realistic replay handles a long inquiry and books from the follow-up", async () => {
  let state: SimpleWeddingSalesState | undefined;

  for (const [index, turn] of gmailLongInquiryReplay.entries()) {
    state = await invokeWeddingSalesSimpleGraph({
      channel: "gmail",
      message: turn.message,
      previousState: state,
      toolContext,
      understand: () => turn.understanding,
    });

    assert.equal(state.decisionTrace?.nextStep, turn.expect.nextStep, `turn ${index + 1}`);
    assert.deepEqual(
      state.toolObservations.map((observation) => observation.toolName),
      turn.expect.toolCalls,
      `turn ${index + 1}: tool calls`,
    );

    for (const pattern of turn.expect.replyIncludes ?? []) {
      assert.match(state.responseDraft ?? "", pattern, `turn ${index + 1}: reply includes`);
    }

    assert.doesNotMatch(state.responseDraft ?? "", /please provide|to better assist|tailored/i);
  }

  assert.ok(state);
  assert.equal(state.bookingConfirmed, true);
  assert.equal(state.availabilityCheck?.status, "available");
  assert.equal(state.consultationCheck?.status, "available");
});
