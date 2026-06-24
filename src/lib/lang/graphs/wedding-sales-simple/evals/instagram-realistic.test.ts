import assert from "node:assert/strict";
import test from "node:test";

import { invokeWeddingSalesSimpleGraph } from "../graph";
import type { SimpleWeddingSalesState } from "../state";
import {
  instagramBookingReplay,
  instagramEdgeCaseTurns,
  type SimpleWeddingSalesReplayTurn,
} from "./fixtures/instagram-short-dms";
import {
  callTimeChangeReplay,
  dateChangeAfterAvailabilityReplay,
  locationChangeAfterAvailabilityReplay,
} from "./fixtures/edge-cases";

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

async function runReplay(args: {
  turns: SimpleWeddingSalesReplayTurn[];
  initialState?: Partial<SimpleWeddingSalesState>;
}) {
  let state: SimpleWeddingSalesState | undefined = args.initialState as
    | SimpleWeddingSalesState
    | undefined;

  for (const [index, turn] of args.turns.entries()) {
    state = await invokeWeddingSalesSimpleGraph({
      channel: "instagram",
      message: turn.message,
      previousState: state,
      toolContext,
      understand: () => turn.understanding,
    });

    assert.equal(
      state.decisionTrace?.nextStep,
      turn.expect.nextStep,
      `turn ${index + 1}: nextStep`,
    );
    assert.deepEqual(
      state.toolObservations.map((observation) => observation.toolName),
      turn.expect.toolCalls,
      `turn ${index + 1}: tool calls`,
    );
    assert.equal(state.mode, turn.expect.nextStep === "handoff" ? "human_needed" : "bot_active");
    assert.doesNotMatch(state.responseDraft ?? "", /please provide|to better assist|tailored/i);

    for (const pattern of turn.expect.replyIncludes ?? []) {
      assert.match(state.responseDraft ?? "", pattern, `turn ${index + 1}: reply includes`);
    }

    for (const pattern of turn.expect.replyExcludes ?? []) {
      assert.doesNotMatch(state.responseDraft ?? "", pattern, `turn ${index + 1}: reply excludes`);
    }
  }

  assert.ok(state);
  return state;
}

test("instagram realistic replay books a consultation across short DMs", async () => {
  const finalState = await runReplay({ turns: instagramBookingReplay });

  assert.equal(finalState.bookingConfirmed, true);
  assert.equal(finalState.customerEmail, "anna@gmail.com");
  assert.equal(finalState.availabilityCheck?.status, "available");
  assert.equal(finalState.consultationCheck?.status, "available");
});

test("instagram replay routes explicit human requests to handoff", async () => {
  const finalState = await runReplay({ turns: instagramEdgeCaseTurns });

  assert.equal(finalState.mode, "human_needed");
  assert.equal(finalState.handoffReason, "customer_requests_human");
});

test("instagram replay rechecks availability after date changes", async () => {
  const finalState = await runReplay({ turns: dateChangeAfterAvailabilityReplay });

  assert.equal(finalState.weddingDate, "2027-06-15");
  assert.equal(finalState.availabilityCheck?.date, "2027-06-15");
});

test("instagram replay rechecks availability after location changes", async () => {
  const finalState = await runReplay({ turns: locationChangeAfterAvailabilityReplay });

  assert.equal(finalState.location, "Orlando");
  assert.equal(finalState.availabilityCheck?.location, "Orlando");
});

test("instagram replay rechecks calendar after call time changes", async () => {
  const finalState = await runReplay({
    initialState: {
      customerName: "Anna",
      partnerName: "Mark",
      weddingDate: "2027-06-14",
      location: "Tampa",
      venue: "Oxford Exchange",
      availability: "available",
      availabilityCheck: {
        date: "2027-06-14",
        location: "Tampa",
        status: "available",
        checkedAt: "2026-06-23T00:00:00.000Z",
      },
      bookingConfirmed: false,
      mode: "bot_active",
      unclearAttemptCount: 0,
      questionsAskedByCustomer: [],
      toolObservations: [],
      latestCustomerMessage: "",
      channel: "instagram",
    },
    turns: callTimeChangeReplay,
  });

  assert.equal(finalState.proposedCallTime, "2026-06-24T16:00:00-04:00");
  assert.equal(finalState.consultationCheck?.proposedTime, "2026-06-24T16:00:00-04:00");
});
