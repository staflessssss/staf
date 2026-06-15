import assert from "node:assert/strict";
import test from "node:test";

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
