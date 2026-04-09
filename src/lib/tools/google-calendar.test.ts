import assert from "node:assert/strict";
import test from "node:test";

import { calendarSchedulingTestHelpers } from "@/lib/tools/google-calendar";

test("parseSchedulingRequest parses relative consultation time in ET", () => {
  const parsed = calendarSchedulingTestHelpers.parseSchedulingRequest({
    request: "tomorrow at 10:30am works for us",
    timeZone: "America/New_York",
    slotDurationMinutes: 30,
    referenceDate: new Date("2026-04-09T15:00:00Z"),
  });

  assert.ok(parsed);
  assert.equal(parsed?.date, "2026-04-10");
  assert.equal(parsed?.time, "10:30");
  assert.match(parsed?.startTime ?? "", /^2026-04-10T10:30:00-0[45]:00$/);
});

test("validateSchedulingWindow rejects weekend and outside-hour bookings", () => {
  const weekend = calendarSchedulingTestHelpers.validateSchedulingWindow(
    {
      date: "2026-04-11",
      time: "10:00",
      startTime: "2026-04-11T10:00:00-04:00",
      endTime: "2026-04-11T10:30:00-04:00",
    },
    {
      calendarId: "primary",
      timeZone: "America/New_York",
      slotDurationMinutes: 30,
      businessWindowStartHour: 9,
      businessWindowEndHour: 14,
      businessDays: [1, 2, 3, 4, 5],
      leadHeaderRow: 1,
      leadColumns: {
        coupleName: "couple_name",
        weddingDate: "wedding_date",
        location: "location",
        callDate: "call_date",
        callTime: "call_time",
        email: "email",
        channel: "channel",
      },
    },
  );
  const late = calendarSchedulingTestHelpers.validateSchedulingWindow(
    {
      date: "2026-04-10",
      time: "14:00",
      startTime: "2026-04-10T14:00:00-04:00",
      endTime: "2026-04-10T14:30:00-04:00",
    },
    {
      calendarId: "primary",
      timeZone: "America/New_York",
      slotDurationMinutes: 30,
      businessWindowStartHour: 9,
      businessWindowEndHour: 14,
      businessDays: [1, 2, 3, 4, 5],
      leadHeaderRow: 1,
      leadColumns: {
        coupleName: "couple_name",
        weddingDate: "wedding_date",
        location: "location",
        callDate: "call_date",
        callTime: "call_time",
        email: "email",
        channel: "channel",
      },
    },
  );

  assert.equal(weekend.ok, false);
  assert.equal(late.ok, false);
});
