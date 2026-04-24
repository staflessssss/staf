import assert from "node:assert/strict";
import test from "node:test";

import {
  calendarSchedulingTestHelpers,
  executeGoogleCalendarStep,
} from "@/lib/tools/google-calendar";

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

test("parseSchedulingRequest normalizes dashed and spaced time selections", () => {
  const dashed = calendarSchedulingTestHelpers.parseSchedulingRequest({
    request: "Tuesday at 10-00 looks good",
    timeZone: "America/New_York",
    slotDurationMinutes: 30,
    referenceDate: new Date("2026-04-15T15:00:00Z"),
  });
  const spaced = calendarSchedulingTestHelpers.parseSchedulingRequest({
    request: "Tuesday at 10 30 works",
    timeZone: "America/New_York",
    slotDurationMinutes: 30,
    referenceDate: new Date("2026-04-15T15:00:00Z"),
  });

  assert.ok(dashed);
  assert.ok(spaced);
  assert.equal(dashed?.date, "2026-04-21");
  assert.equal(dashed?.time, "10:00");
  assert.equal(spaced?.date, "2026-04-21");
  assert.equal(spaced?.time, "10:30");
});

test("parseSchedulingRequest respects an explicit bound date when the request text only provides time", () => {
  const parsed = calendarSchedulingTestHelpers.parseSchedulingRequest({
    request: "10:30 works for us",
    explicitDate: "2026-04-21",
    timeZone: "America/New_York",
    slotDurationMinutes: 30,
    referenceDate: new Date("2026-04-15T15:00:00Z"),
  });

  assert.ok(parsed);
  assert.equal(parsed?.date, "2026-04-21");
  assert.equal(parsed?.time, "10:30");
});

test("parseSchedulingRequest treats an explicit bound date as authoritative over relative request text", () => {
  const parsed = calendarSchedulingTestHelpers.parseSchedulingRequest({
    request: "tomorrow at 10:30 works for us",
    explicitDate: "2026-04-21",
    timeZone: "America/New_York",
    slotDurationMinutes: 30,
    referenceDate: new Date("2026-04-15T15:00:00Z"),
  });

  assert.ok(parsed);
  assert.equal(parsed?.date, "2026-04-21");
  assert.equal(parsed?.time, "10:30");
});

test("parseSchedulingRequest prefers structured timeText over the raw request when provided", () => {
  const parsed = calendarSchedulingTestHelpers.parseSchedulingRequest({
    request: "Can you check availability for me?",
    timeText: "April 21 at 10:30",
    timeZone: "America/New_York",
    slotDurationMinutes: 30,
    referenceDate: new Date("2026-04-15T15:00:00Z"),
  });

  assert.ok(parsed);
  assert.equal(parsed?.date, "2026-04-21");
  assert.equal(parsed?.time, "10:30");
});

test("executeGoogleCalendarStep rejects an invalid fixed availability date before runtime fallback", async () => {
  const result = await executeGoogleCalendarStep({
    tenantId: "tenant-1",
    action: "check_calendar",
    request: "can you check tomorrow",
    params: {
      calendarId: "primary",
      availabilityDateSource: "literal",
      availabilityDateValue: "tomorrow",
    },
  });

  assert.equal(result.status, "misconfigured");
  assert.match(String(result.summary), /fixed availability date/i);
});

test("executeGoogleCalendarStep rejects an invalid fixed booking time before runtime fallback", async () => {
  const result = await executeGoogleCalendarStep({
    tenantId: "tenant-1",
    action: "book_call",
    request: "please book it",
    params: {
      calendarId: "primary",
      bookingDateSource: "literal",
      bookingDateValue: "2026-04-21",
      bookingTimeSource: "literal",
      bookingTimeValue: "after lunch sometime",
    },
  });

  assert.equal(result.status, "misconfigured");
  assert.match(String(result.summary), /fixed booking time/i);
});

test("executeGoogleCalendarStep rejects an empty fixed invite email before runtime fallback", async () => {
  const result = await executeGoogleCalendarStep({
    tenantId: "tenant-1",
    action: "book_call",
    request: "please book it",
    params: {
      calendarId: "primary",
      bookingDateSource: "literal",
      bookingDateValue: "2026-04-21",
      bookingTimeSource: "literal",
      bookingTimeValue: "10:30",
      inviteEmailSource: "literal",
      inviteEmailValue: "",
    },
  });

  assert.equal(result.status, "misconfigured");
  assert.match(String(result.summary), /fixed invite email/i);
});

test("executeGoogleCalendarStep rejects an invalid timezone before runtime formatting", async () => {
  const result = await executeGoogleCalendarStep({
    tenantId: "tenant-1",
    action: "check_calendar",
    request: "can you check tomorrow",
    params: {
      calendarId: "primary",
      timeZone: "Mars/Base",
    },
  });

  assert.equal(result.status, "misconfigured");
  assert.match(String(result.summary), /valid IANA timezone/i);
});

test("executeGoogleCalendarStep falls back to date-level availability lookup when only a date is available", async () => {
  const result = await executeGoogleCalendarStep({
    tenantId: "tenant-1",
    action: "check_calendar",
    request: "can you check April 21 for me",
    date: "2026-04-21",
    params: {
      calendarId: "primary",
    },
  });

  assert.equal(result.status, "missing_credentials");
  assert.match(String(result.summary), /oauth credentials/i);
});

test("executeGoogleCalendarStep date-only fallback still respects configured business days", async () => {
  const result = await executeGoogleCalendarStep({
    tenantId: "tenant-1",
    action: "check_calendar",
    request: "can you check April 25 for me",
    date: "2026-04-25",
    credentialsEnc: "fake-creds",
    params: {
      calendarId: "primary",
      businessDays: [1, 2, 3, 4, 5],
    },
  });

  assert.equal(result.status, "outside_business_days");
  assert.match(String(result.summary), /Monday through Friday|Monday, Tuesday, Wednesday, Thursday, and Friday/i);
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

test("validateSchedulingWindow uses configured business days and timezone in user-facing summaries", () => {
  const weekend = calendarSchedulingTestHelpers.validateSchedulingWindow(
    {
      date: "2026-04-10",
      time: "10:00",
      startTime: "2026-04-10T10:00:00+03:00",
      endTime: "2026-04-10T10:30:00+03:00",
    },
    {
      calendarId: "primary",
      timeZone: "Europe/Moscow",
      slotDurationMinutes: 30,
      businessWindowStartHour: 10,
      businessWindowEndHour: 18,
      businessDays: [2, 4],
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
  const early = calendarSchedulingTestHelpers.validateSchedulingWindow(
    {
      date: "2026-04-09",
      time: "09:00",
      startTime: "2026-04-09T09:00:00+03:00",
      endTime: "2026-04-09T09:30:00+03:00",
    },
    {
      calendarId: "primary",
      timeZone: "Europe/Moscow",
      slotDurationMinutes: 30,
      businessWindowStartHour: 10,
      businessWindowEndHour: 18,
      businessDays: [2, 4],
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
  assert.match(String(weekend.summary), /Tuesday and Thursday/i);
  assert.equal(early.ok, false);
  assert.match(String(early.summary), /Europe\/Moscow/);
});

test("buildCalendarInsertPayload respects booking toggles and preserves template spacing", () => {
  const payload = calendarSchedulingTestHelpers.buildCalendarInsertPayload({
    tenantId: "tenant-1",
    parsed: {
      date: "2026-04-10",
      time: "10:30",
      startTime: "2026-04-10T10:30:00-04:00",
      endTime: "2026-04-10T11:30:00-04:00",
    },
    email: "client@example.com",
    coupleName: "Alex and Sam",
    weddingDate: "2026-07-20",
    location: "Brooklyn",
    channel: "telegram",
    config: {
      calendarId: "primary",
      timeZone: "America/New_York",
      slotDurationMinutes: 60,
      businessWindowStartHour: 9,
      businessWindowEndHour: 18,
      businessDays: [1, 2, 3, 4, 5],
      checkConflictsBeforeBooking: true,
      inviteCustomerByEmail: false,
      createMeetLink: false,
      reminderEnabled: true,
      reminderMinutesBefore: 45,
      eventSummaryTemplate: "Consultation with {{coupleName}}",
      eventDescriptionTemplate: "Line one\n\nLine two {{location}}",
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
      syncLeadToSheets: false,
    },
  });

  assert.equal(payload.conferenceDataVersion, 0);
  assert.deepEqual(payload.requestBody.attendees, []);
  assert.equal(payload.requestBody.summary, "Consultation with Alex and Sam");
  assert.equal(payload.requestBody.description, "Line one\n\nLine two Brooklyn");
  assert.deepEqual(payload.requestBody.reminders, {
    useDefault: false,
    overrides: [{ method: "email", minutes: 45 }],
  });
  assert.ok(!("conferenceData" in payload.requestBody));
});
