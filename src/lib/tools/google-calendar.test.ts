import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { google } from "googleapis";

import { telegramAdapter } from "@/lib/channels/telegram";
import { encrypt } from "@/lib/crypto";
import { db } from "@/lib/db";
import {
  calendarSchedulingTestHelpers,
  executeGoogleCalendarStep,
} from "@/lib/tools/google-calendar";

type SchedulingConfigFixture = Parameters<
  typeof calendarSchedulingTestHelpers.validateSchedulingWindow
>[1];

function schedulingConfig(
  overrides: Partial<SchedulingConfigFixture> = {},
): SchedulingConfigFixture {
  return {
    calendarId: "primary",
    timeZone: "America/New_York",
    availabilityDateSource: "request_date",
    availabilityDateValue: "",
    bookingDateSource: "request_date",
    bookingDateValue: "",
    bookingTimeSource: "time_text",
    bookingTimeValue: "",
    inviteEmailSource: "customer_email",
    inviteEmailValue: "",
    slotDurationMinutes: 30,
    businessWindowStartHour: 9,
    businessWindowEndHour: 14,
    businessDays: [1, 2, 3, 4, 5],
    checkConflictsBeforeBooking: true,
    inviteCustomerByEmail: true,
    createMeetLink: true,
    reminderEnabled: false,
    reminderMinutesBefore: 30,
    eventSummaryTemplate: "Consultation call with {{coupleName}}",
    eventDescriptionTemplate:
      "Wedding date: {{weddingDate}}\nLocation: {{location}}\nChannel: {{channel}}",
    syncLeadToSheets: false,
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
    ...overrides,
  };
}

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

test("parseSchedulingRequest lets window validation reject tomorrow on a non-business day", () => {
  const parsed = calendarSchedulingTestHelpers.parseSchedulingRequest({
    request: "Can we call tomorrow at 11am?",
    timeZone: "America/New_York",
    slotDurationMinutes: 30,
    referenceDate: new Date("2026-06-12T17:00:00Z"),
  });

  assert.ok(parsed);
  assert.equal(parsed?.date, "2026-06-13");
  assert.equal(parsed?.time, "11:00");

  const validation = calendarSchedulingTestHelpers.validateSchedulingWindow(
    parsed,
    schedulingConfig(),
  );

  assert.equal(validation.ok, false);
  assert.equal(validation.reason, "outside_business_days");
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

test("parseSchedulingRequest uses same-day weekday time while future and next week after it passes", () => {
  const beforeSlot = calendarSchedulingTestHelpers.parseSchedulingRequest({
    request: "Friday at 10am works",
    timeZone: "America/New_York",
    slotDurationMinutes: 30,
    referenceDate: new Date("2026-04-10T13:00:00Z"),
  });
  const afterSlot = calendarSchedulingTestHelpers.parseSchedulingRequest({
    request: "Friday at 10am works",
    timeZone: "America/New_York",
    slotDurationMinutes: 30,
    referenceDate: new Date("2026-04-10T15:00:00Z"),
  });

  assert.ok(beforeSlot);
  assert.equal(beforeSlot?.date, "2026-04-10");
  assert.equal(beforeSlot?.time, "10:00");
  assert.ok(afterSlot);
  assert.equal(afterSlot?.date, "2026-04-17");
  assert.equal(afterSlot?.time, "10:00");
});

test("parseSchedulingRequest treats Friday time after business day as next Friday", () => {
  const parsed = calendarSchedulingTestHelpers.parseSchedulingRequest({
    request: "Check consultation calendar for Friday 10am with Bob and Marie",
    timeText: "Friday 10am",
    timeZone: "America/New_York",
    slotDurationMinutes: 30,
    referenceDate: new Date("2026-06-13T00:22:00Z"),
  });

  assert.ok(parsed);
  assert.equal(parsed?.date, "2026-06-19");
  assert.equal(parsed?.time, "10:00");
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

test("parseSchedulingRequest prefers an explicit month-day date over a weekday label", () => {
  const parsed = calendarSchedulingTestHelpers.parseSchedulingRequest({
    request: "Wednesday June 24 at 12:30 works",
    timeZone: "America/New_York",
    slotDurationMinutes: 30,
    referenceDate: new Date("2026-06-14T15:00:00Z"),
  });

  assert.ok(parsed);
  assert.equal(parsed?.date, "2026-06-24");
  assert.equal(parsed?.time, "12:30");
});

test("parseSchedulingRequest rejects conflicting weekday and explicit date", () => {
  const parsed = calendarSchedulingTestHelpers.parseSchedulingRequest({
    request: "Tuesday June 24 at 12:30 works",
    timeZone: "America/New_York",
    slotDurationMinutes: 30,
    referenceDate: new Date("2026-06-14T15:00:00Z"),
  });

  assert.ok(parsed);
  assert.equal("status" in parsed ? parsed.status : null, "date_weekday_mismatch");
  assert.equal(parsed.date, "2026-06-24");
  assert.match("summary" in parsed ? parsed.summary : "", /Wednesday, not Tuesday/i);
});

test("executeGoogleCalendarStep does not check or book a mismatched weekday and date", async () => {
  const result = await executeGoogleCalendarStep({
    tenantId: "tenant-1",
    action: "check_calendar",
    request: "Tuesday June 24 at 12:30 works",
    timeText: "Tuesday June 24 at 12:30",
    params: {
      calendarId: "primary",
      businessDays: [1, 2, 3, 4, 5],
      businessWindowStartHour: 9,
      businessWindowEndHour: 14,
      slotDurationMinutes: 30,
    },
    credentialsEnc: encrypt(JSON.stringify({ access_token: "test-token" })),
  });

  assert.equal(result.status, "date_weekday_mismatch");
  assert.equal(result.date, "2026-06-24");
  assert.match(String(result.summary), /Wednesday, not Tuesday/i);
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
    schedulingConfig({
      calendarId: "primary",
      timeZone: "America/New_York",
      slotDurationMinutes: 30,
      businessWindowStartHour: 9,
      businessWindowEndHour: 14,
      businessDays: [1, 2, 3, 4, 5],
    }),
  );
  const late = calendarSchedulingTestHelpers.validateSchedulingWindow(
    {
      date: "2026-04-10",
      time: "14:00",
      startTime: "2026-04-10T14:00:00-04:00",
      endTime: "2026-04-10T14:30:00-04:00",
    },
    schedulingConfig({
      calendarId: "primary",
      timeZone: "America/New_York",
      slotDurationMinutes: 30,
      businessWindowStartHour: 9,
      businessWindowEndHour: 14,
      businessDays: [1, 2, 3, 4, 5],
    }),
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
    schedulingConfig({
      calendarId: "primary",
      timeZone: "Europe/Moscow",
      slotDurationMinutes: 30,
      businessWindowStartHour: 10,
      businessWindowEndHour: 18,
      businessDays: [2, 4],
    }),
  );
  const early = calendarSchedulingTestHelpers.validateSchedulingWindow(
    {
      date: "2026-04-09",
      time: "09:00",
      startTime: "2026-04-09T09:00:00+03:00",
      endTime: "2026-04-09T09:30:00+03:00",
    },
    schedulingConfig({
      calendarId: "primary",
      timeZone: "Europe/Moscow",
      slotDurationMinutes: 30,
      businessWindowStartHour: 10,
      businessWindowEndHour: 18,
      businessDays: [2, 4],
    }),
  );

  assert.equal(weekend.ok, false);
  assert.match(String(weekend.summary), /Tuesday and Thursday/i);
  assert.equal(early.ok, false);
  assert.match(String(early.summary), /Europe\/Moscow/);
});

test("executeGoogleCalendarStep keeps booking successful when lead logging fails after invite creation", async () => {
  const originalClientId = process.env.GOOGLE_CLIENT_ID;
  const originalClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  process.env.GOOGLE_CLIENT_ID = "test-client";
  process.env.GOOGLE_CLIENT_SECRET = "test-secret";

  const calendarMock = mock.method(google, "calendar", () => ({
    freebusy: {
      query: async () => ({
        data: {
          calendars: {
            primary: {
              busy: [],
            },
          },
        },
      }),
    },
    events: {
      insert: async () => ({
        data: {
          id: "event-1",
          hangoutLink: "https://meet.google.com/test-meet",
        },
      }),
    },
  }));
  const sheetsMock = mock.method(google, "sheets", () => ({
    spreadsheets: {
      values: {
        get: async () => {
          throw new Error("Sheets unavailable");
        },
        append: async () => ({
          data: {},
        }),
      },
    },
  }));

  try {
    const result = await executeGoogleCalendarStep({
      tenantId: "tenant-1",
      action: "book_call",
      request: "Book consultation call for June 15, 2026 at 10:30 with Alex and Sam at alex@example.com",
      timeText: "June 15, 2026 at 10:30",
      coupleName: "Alex and Sam",
      weddingDate: "2026-07-20",
      location: "Charlotte",
      email: "alex@example.com",
      channel: "instagram",
      credentialsEnc: encrypt(JSON.stringify({ access_token: "test-token" })),
      params: {
        calendarId: "primary",
        timeZone: "America/New_York",
        bookingDateSource: "time_text",
        bookingTimeSource: "time_text",
        inviteEmailSource: "customer_email",
        slotDurationMinutes: 30,
        businessWindowStartHour: 9,
        businessWindowEndHour: 14,
        businessDays: [1, 2, 3, 4, 5],
        checkConflictsBeforeBooking: true,
        inviteCustomerByEmail: true,
        createMeetLink: true,
        syncLeadToSheets: true,
        leadSpreadsheetId: "sheet-1",
        leadSheetName: "Leads",
        leadHeaderRow: 1,
      },
    });

    assert.equal(result.status, "booked");
    assert.equal(result.eventId, "event-1");
    assert.equal(result.meetLink, "https://meet.google.com/test-meet");
    assert.equal(result.leadLog.status, "failed");
    assert.match(String(result.leadLog.summary), /Sheets unavailable/);
    assert.equal(result.telegramNotification.status, "skipped");
  } finally {
    calendarMock.mock.restore();
    sheetsMock.mock.restore();

    if (originalClientId === undefined) {
      delete process.env.GOOGLE_CLIENT_ID;
    } else {
      process.env.GOOGLE_CLIENT_ID = originalClientId;
    }

    if (originalClientSecret === undefined) {
      delete process.env.GOOGLE_CLIENT_SECRET;
    } else {
      process.env.GOOGLE_CLIENT_SECRET = originalClientSecret;
    }
  }
});

test("executeGoogleCalendarStep sends booking notifications to the linked tenant owner chat", async () => {
  const originalClientId = process.env.GOOGLE_CLIENT_ID;
  const originalClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const tenantId = `tenant-booking-notify-${Date.now()}`;
  const slug = `tenant-booking-notify-${Date.now()}`;
  let sentTelegram: Parameters<typeof telegramAdapter.sendReply>[0] | null = null;

  process.env.GOOGLE_CLIENT_ID = "test-client";
  process.env.GOOGLE_CLIENT_SECRET = "test-secret";

  await db.tenant.create({
    data: {
      id: tenantId,
      name: "Booking Notification Tenant",
      slug,
      channelConnections: {
        create: {
          type: "TELEGRAM",
          status: "CONNECTED",
          credentialsEnc: encrypt("telegram-token"),
          metadata: {
            ownerHandoff: {
              enabled: true,
              ownerChatId: "linked-owner-chat",
            },
          },
        },
      },
    },
  });

  const calendarMock = mock.method(google, "calendar", () => ({
    freebusy: {
      query: async () => ({
        data: {
          calendars: {
            primary: {
              busy: [],
            },
          },
        },
      }),
    },
    events: {
      insert: async () => ({
        data: {
          id: "event-telegram-1",
          hangoutLink: "https://meet.google.com/test-telegram",
        },
      }),
    },
  }));
  const telegramMock = mock.method(telegramAdapter, "sendReply", async (args) => {
    sentTelegram = args;
    return { ok: true, result: { message_id: 77 } };
  });

  try {
    const result = await executeGoogleCalendarStep({
      tenantId,
      action: "book_call",
      request: "Book consultation call for June 15, 2026 at 10:30 with Alex and Sam at alex@example.com",
      timeText: "June 15, 2026 at 10:30",
      coupleName: "Alex and Sam",
      weddingDate: "2026-07-20",
      location: "Charlotte",
      email: "alex@example.com",
      channel: "instagram",
      credentialsEnc: encrypt(JSON.stringify({ access_token: "test-token" })),
      params: {
        calendarId: "primary",
        timeZone: "America/New_York",
        bookingDateSource: "time_text",
        bookingTimeSource: "time_text",
        inviteEmailSource: "customer_email",
        slotDurationMinutes: 30,
        businessWindowStartHour: 9,
        businessWindowEndHour: 14,
        businessDays: [1, 2, 3, 4, 5],
        checkConflictsBeforeBooking: true,
        inviteCustomerByEmail: true,
        createMeetLink: true,
        ownerTelegramChatId: "stale-copied-chat",
      },
    });

    assert.equal(result.status, "booked");
    assert.equal(result.telegramNotification.status, "sent");
    assert.equal(sentTelegram?.contactId, "linked-owner-chat");
    assert.notEqual(sentTelegram?.contactId, "stale-copied-chat");
  } finally {
    telegramMock.mock.restore();
    calendarMock.mock.restore();
    await db.channelConnection.deleteMany({ where: { tenantId } });
    await db.tenant.deleteMany({ where: { id: tenantId } });

    if (originalClientId === undefined) {
      delete process.env.GOOGLE_CLIENT_ID;
    } else {
      process.env.GOOGLE_CLIENT_ID = originalClientId;
    }

    if (originalClientSecret === undefined) {
      delete process.env.GOOGLE_CLIENT_SECRET;
    } else {
      process.env.GOOGLE_CLIENT_SECRET = originalClientSecret;
    }
  }
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
    config: schedulingConfig({
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
    }),
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
