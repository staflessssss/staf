import assert from "node:assert/strict";
import test from "node:test";

import { calendarSchedulingTestHelpers } from "@/lib/tools/google-calendar";

import { defaultWeddingSalesConfig } from "../config";
import { composeWeddingSalesResponse } from "../response-composer";
import { createInitialWeddingSalesState } from "../state";
import { weddingSalesToolNodeTestHelpers } from "./tools";

test("wedding sales tool node treats booked status as confirmed without event id", () => {
  assert.deepEqual(
    weddingSalesToolNodeTestHelpers.getBookingOutcome({
      status: "booked",
      eventId: null,
    }),
    {
      bookingConfirmed: true,
      eventId: undefined,
    },
  );
});

test("wedding sales tool node preserves booked event id when present", () => {
  assert.deepEqual(
    weddingSalesToolNodeTestHelpers.getBookingOutcome({
      steps: [
        {
          result: {
            status: "booked",
            eventId: "event-1",
          },
        },
      ],
    }),
    {
      bookingConfirmed: true,
      eventId: "event-1",
    },
  );
});

test("wedding sales tool node preserves busy date context without marking the slot checked", () => {
  assert.deepEqual(
    weddingSalesToolNodeTestHelpers.getCalendarSlotState([
      {
        status: "busy",
        date: "2026-06-24",
        requestedTime: "12:30",
        suggestedTimes: ["11:30", "12:00", "13:00"],
      },
    ]),
    {
      available: false,
      busy: true,
      calendarContextDate: "2026-06-24",
      suggestedCallTimes: ["11:30", "12:00", "13:00"],
      checkedCallDate: undefined,
      checkedCallTime: undefined,
      checkedCallStartTime: undefined,
      checkedCallEndTime: undefined,
    },
  );
});

test("wedding sales tool node passes canonical state datetime through the explicit date and time contract", () => {
  assert.deepEqual(
    weddingSalesToolNodeTestHelpers.buildCalendarToolTimeInput("2026-06-24T13:00:00"),
    {
      date: "2026-06-24",
      timeText: "13:00",
    },
  );
});

test("wedding sales tool node keeps raw customer scheduling text on the parser path", () => {
  assert.deepEqual(
    weddingSalesToolNodeTestHelpers.buildCalendarToolTimeInput("Friday at 10am"),
    {
      timeText: "Friday at 10am",
    },
  );
});

test("canonical state datetime survives the wedding tool boundary and calendar parser", () => {
  const input = weddingSalesToolNodeTestHelpers.buildCalendarToolTimeInput(
    "2026-06-24T13:00:00",
  );
  const parsed = calendarSchedulingTestHelpers.parseSchedulingRequest({
    request: "Check consultation calendar for 2026-06-24T13:00:00",
    explicitDate: input.date,
    timeText: input.timeText,
    timeZone: "America/New_York",
    slotDurationMinutes: 30,
    referenceDate: new Date("2026-06-15T12:00:00Z"),
  });

  assert.ok(parsed);
  assert.equal(parsed?.date, "2026-06-24");
  assert.equal(parsed?.time, "13:00");
});

test("post-tool response is not suppressed by the stale pre-tool action plan", () => {
  const state = createInitialWeddingSalesState({
    channel: "instagram",
    message: "13:00 works too",
    previousState: {
      semanticStateVersion: 2,
      names: "Samantha and Collin",
      proposedCallTime: "2026-06-24T13:00:00",
      lastActionPlan: {
        schemaVersion: 1,
        actions: [
          {
            type: "check_consultation_calendar",
            field: null,
            topicId: null,
            reason: "call_time_is_ready_and_wedding_date_is_available",
          },
        ],
        responseGoal: "run_tools_then_reply",
        guardrailTrace: [],
      },
    },
  });
  const postToolState = weddingSalesToolNodeTestHelpers.buildPostToolResponseState(state, {
    calendarStatus: "available",
    checkedCallDate: "2026-06-24",
    checkedCallTime: "13:00",
    leadStage: "waiting_customer_email",
  });

  assert.equal(postToolState.lastActionPlan, undefined);
  assert.match(
    composeWeddingSalesResponse({
      intent: "ask_email",
      config: defaultWeddingSalesConfig,
      state: postToolState,
    }),
    /email/i,
  );
});
