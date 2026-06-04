import assert from "node:assert/strict";
import test from "node:test";

import { encrypt } from "@/lib/crypto";

import { invokeWeddingSalesGraph } from "./graph";
import { weddingSalesAnalyzeTestHelpers } from "./nodes/analyze";

test("wedding sales graph asks for year before checking availability", async () => {
  const result = await invokeWeddingSalesGraph({
    channel: "gmail",
    message: "We are Anna and Mark. Our wedding is June 14 in Charlotte.",
  });

  assert.equal(result.leadStage, "waiting_wedding_year");
  assert.equal(result.weddingDateText, "June 14");
  assert.match(result.responseDraft ?? "", /year/i);
});

test("wedding sales graph combines a previously mentioned month-day with a later year", async () => {
  const result = await invokeWeddingSalesGraph({
    channel: "gmail",
    message: "2027. The venue is in Charlotte, NC.",
    previousState: {
      names: "Anna and Mark",
      weddingDateText: "June 14",
      weddingYearKnown: false,
      location: "Charlotte",
      bookingConfirmed: false,
      leadStage: "waiting_wedding_year",
    },
  });

  assert.equal(result.leadStage, "ready_for_availability");
  assert.equal(result.weddingDate, "2027-06-14");
  assert.equal(result.weddingYear, "2027");
  assert.doesNotMatch(result.responseDraft ?? "", /exact date/i);
});

test("wedding sales graph ignores Gmail quote dates when analyzing replies", async () => {
  const result = await invokeWeddingSalesGraph({
    channel: "gmail",
    message: [
      "Could you send pricing again? Also do you travel?",
      "",
      "On Wed, May 20, 2026 at 5:05 AM Taras <contact@myndfulfilms.com> wrote:",
      "> June 14, 2027, in Charlotte is wide open on my calendar.",
      "> Our collections start at $2,750.",
    ].join("\n"),
    previousState: {
      names: "Anna and Mark",
      weddingDate: "2027-06-14",
      weddingDateText: "June 14",
      weddingYear: "2027",
      weddingYearKnown: true,
      location: "Charlotte",
      availability: "available",
      guideSent: true,
      callProposed: true,
      bookingConfirmed: false,
      leadStage: "availability_checked",
    },
  });

  assert.equal(result.weddingDate, "2027-06-14");
  assert.equal(result.weddingYear, "2027");
  assert.notEqual(result.weddingDate, "2026-05-20");
});

test("wedding sales graph answers pricing and travel questions without rechecking availability", async () => {
  const result = await invokeWeddingSalesGraph({
    channel: "gmail",
    message: "Could you send pricing again? Also do you travel?",
    previousState: {
      names: "Anna and Mark",
      weddingDate: "2027-06-14",
      weddingDateText: "June 14",
      weddingYear: "2027",
      weddingYearKnown: true,
      location: "Charlotte",
      availability: "available",
      guideSent: true,
      callProposed: true,
      bookingConfirmed: false,
      leadStage: "availability_checked",
    },
  });

  assert.equal(result.leadStage, "answering_question");
  assert.equal(result.weddingDate, "2027-06-14");
  assert.equal(result.toolObservations.length, 0);
  assert.match(result.responseDraft ?? "", /\$2,750/);
  assert.match(result.responseDraft ?? "", /travel/i);
  assert.match(result.conversationSummary ?? "", /Latest customer message: Could you send pricing again\? Also do you travel\?/);
  assert.match(result.conversationSummary ?? "", /Last assistant intent: answer_question/);
});

test("wedding sales graph routes complete wedding info to availability check", async () => {
  const result = await invokeWeddingSalesGraph({
    channel: "gmail",
    message: "We are Anna and Mark. Our wedding is June 14, 2027 in Charlotte, NC.",
  });

  assert.equal(result.leadStage, "ready_for_availability");
  assert.match(result.responseDraft ?? "", /availability/i);
});

test("wedding sales graph ignores coordinator and COI messages", async () => {
  const result = await invokeWeddingSalesGraph({
    channel: "gmail",
    message: "Hi, I am the wedding coordinator sending the COI and vendor details.",
  });

  assert.equal(result.leadStage, "ignored");
  assert.equal(result.responseDraft, "");
});

test("wedding sales analyze node extracts normalized wedding details", () => {
  assert.deepEqual(
    weddingSalesAnalyzeTestHelpers.extractWeddingDate(
      "We are Anna and Mark. Our wedding is June 14, 2027 in Charlotte, NC.",
    ),
    {
      display: "June 14, 2027",
      iso: "2027-06-14",
      yearKnown: true,
    },
  );
  assert.equal(
    weddingSalesAnalyzeTestHelpers.extractNames(
      "We are Anna and Mark. Our wedding is June 14, 2027 in Charlotte, NC.",
    ),
    "Anna and Mark",
  );
  assert.equal(
    weddingSalesAnalyzeTestHelpers.extractLocation(
      "We are Anna and Mark. Our wedding is June 14, 2027 in Charlotte, NC.",
    ),
    "Charlotte",
  );
});

test("wedding sales graph records availability tool observations", async () => {
  const result = await invokeWeddingSalesGraph({
    channel: "gmail",
    message: "We are Anna and Mark. Our wedding is June 14, 2027 in Charlotte, NC.",
    toolContext: {
      tenantId: "tenant-1",
      testMode: true,
      weddingAvailability: {
        action: "capacity availability",
        params: {
          operation: "capacity_availability",
          spreadsheetId: "sheet-1",
          sheetName: "Bookings",
          headerRow: 1,
          dateColumn: "Wedding Date",
          statusColumn: "Status",
          regionColumn: "Region",
          bookedStatusValue: "Booked",
          capacityRules: [{ region: "NC", aliases: ["NC", "Charlotte"], capacity: 2 }],
          suggestionSearchDays: 14,
        },
      },
      consultationCalendar: {
        action: "check calendar",
        params: {},
      },
      bookConsultation: {
        action: "book call",
        params: {
          businessDays: [1, 2, 3, 4, 5],
          businessWindowStartHour: 9,
          businessWindowEndHour: 14,
          slotDurationMinutes: 30,
          inviteEmailSource: "customer_email",
          bookingDateSource: "time_text",
          bookingTimeSource: "time_text",
          checkConflictsBeforeBooking: false,
        },
        credentialsEnc: encrypt(JSON.stringify({ access_token: "test-token" })),
      },
    },
  });

  assert.equal(result.availability, "available");
  assert.equal(result.toolObservations[0]?.toolName, "check_wedding_availability");
  assert.equal(result.turnToolObservations[0]?.toolName, "check_wedding_availability");
  assert.match(result.responseDraft ?? "", /collections start/i);
  assert.match(result.conversationSummary ?? "", /Wedding date: 2027-06-14/);
  assert.match(result.conversationSummary ?? "", /Wedding availability: available/);
  assert.match(result.conversationSummary ?? "", /Consultation call has been proposed/);
});

test("wedding sales graph does not book a previously busy consultation slot", async () => {
  const result = await invokeWeddingSalesGraph({
    channel: "gmail",
    message: "Yes, please book it.",
    previousState: {
      names: "Anna and Mark",
      weddingDate: "2027-06-14",
      weddingYearKnown: true,
      location: "Charlotte",
      availability: "available",
      guideSent: true,
      callProposed: true,
      proposedCallTime: "Monday at 10 AM Eastern",
      calendarStatus: "busy",
      bookingConfirmed: false,
      leadStage: "checking_calendar",
    },
  });

  assert.equal(result.bookingConfirmed, false);
  assert.equal(result.toolObservations.length, 0);
  assert.equal(result.turnToolObservations.length, 0);
  assert.match(result.responseDraft ?? "", /another time/i);
});

test("wedding sales graph treats day and time replies as consultation time after call proposal", async () => {
  const result = await invokeWeddingSalesGraph({
    channel: "gmail",
    message: "Could we do Sunday at 4 PM Eastern?",
    previousState: {
      names: "Anna and Mark",
      weddingDate: "2027-06-14",
      weddingYearKnown: true,
      location: "Charlotte",
      availability: "available",
      guideSent: true,
      callProposed: true,
      bookingConfirmed: false,
      leadStage: "availability_checked",
    },
  });

  assert.equal(result.leadStage, "checking_calendar");
  assert.equal(result.proposedCallTime, "Could we do Sunday at 4 PM Eastern?");
  assert.doesNotMatch(result.responseDraft ?? "", /June 14, 2027.*available/i);
});

test("wedding sales analyzer recognizes bare weekday time proposals in call context", () => {
  assert.equal(weddingSalesAnalyzeTestHelpers.proposesCallTime("What about Monday at 10 AM Eastern?"), true);
  assert.equal(weddingSalesAnalyzeTestHelpers.proposesCallTime("Could we do Sunday at 4 PM Eastern?"), true);
  assert.equal(weddingSalesAnalyzeTestHelpers.proposesCallTime("Sunday works for us."), false);
});

test("wedding sales graph treats time-only replies after busy calendar alternatives as consultation time", async () => {
  const result = await invokeWeddingSalesGraph({
    channel: "gmail",
    message: "10:30 works for me.",
    previousState: {
      names: "Anna and Mark",
      weddingDate: "2027-06-14",
      weddingYearKnown: true,
      location: "Charlotte",
      availability: "available",
      guideSent: true,
      callProposed: true,
      proposedCallTime: "Monday at 10 AM Eastern",
      calendarStatus: "busy",
      bookingConfirmed: false,
      leadStage: "checking_calendar",
      lastAssistantIntent: "calendar_busy",
    },
  });

  assert.equal(result.leadStage, "checking_calendar");
  assert.equal(result.proposedCallTime, "Monday at 10:30 AM Eastern");
  assert.doesNotMatch(result.responseDraft ?? "", /June 14, 2027.*available/i);
  assert.doesNotMatch(result.responseDraft ?? "", /\$2,750/);
});

test("wedding sales analyzer binds bare time selection to previous weekday and timezone", () => {
  assert.equal(
    weddingSalesAnalyzeTestHelpers.normalizeBareTimeSelection("10:30 works for me.", "Monday at 10 AM Eastern"),
    "Monday at 10:30 AM Eastern",
  );
});

test("instagram wedding sales first reply asks for fiance name and wedding date without email formatting", async () => {
  const result = await invokeWeddingSalesGraph({
    channel: "instagram",
    message: "Hi there! My name is Rachel and I need film my wedding in Charlotte",
  });

  assert.equal(result.leadStage, "missing_names_or_date");
  assert.equal(result.names, "Rachel");
  assert.equal(result.location, "Charlotte");
  assert.match(result.responseDraft ?? "", /Taras from Myndful Films/i);
  assert.match(result.responseDraft ?? "", /fianc/i);
  assert.match(result.responseDraft ?? "", /date of your wedding/i);
  assert.doesNotMatch(result.responseDraft ?? "", /Founder|MYNDFUL FILMS/);
});

test("wedding sales graph asks only for location after names and date are known", async () => {
  const result = await invokeWeddingSalesGraph({
    channel: "instagram",
    message: "His name is Mike and wedding date 11 of November 2026",
    previousState: {
      names: "Rachel",
      weddingYearKnown: false,
      bookingConfirmed: false,
      leadStage: "missing_names_or_date",
      askedForNames: true,
    },
  });

  assert.equal(result.leadStage, "missing_location_or_venue");
  assert.equal(result.names, "Rachel and Mike");
  assert.equal(result.weddingDate, "2026-11-11");
  assert.match(result.responseDraft ?? "", /city|venue|location/i);
  assert.doesNotMatch(result.responseDraft ?? "", /fianc/i);
  assert.doesNotMatch(result.responseDraft ?? "", /date of your wedding/i);
});

test("instagram wedding sales asks for call time after venue answer", async () => {
  const result = await invokeWeddingSalesGraph({
    channel: "instagram",
    message: "Evergreen Park",
    previousState: {
      names: "Rachel and Mike",
      weddingDate: "2026-11-11",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Charlotte",
      availability: "available",
      guideSent: true,
      callProposed: false,
      bookingConfirmed: false,
      leadStage: "availability_checked",
      askedForVenue: true,
      lastAssistantIntent: "availability_available",
    },
  });

  assert.equal(result.leadStage, "asking_call_time");
  assert.equal(result.venue, "Evergreen Park");
  assert.equal(result.callProposed, true);
  assert.match(result.responseDraft ?? "", /Evergreen Park sounds lovely/i);
  assert.match(result.responseDraft ?? "", /Mon-Fri, 9 AM to 2 PM Eastern/i);
});

test("instagram wedding sales does not treat filler replies as a venue", async () => {
  const result = await invokeWeddingSalesGraph({
    channel: "instagram",
    message: "Sure",
    previousState: {
      names: "Rachel and Mike",
      weddingDate: "2026-11-11",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Charlotte",
      availability: "available",
      guideSent: true,
      callProposed: false,
      bookingConfirmed: false,
      leadStage: "availability_checked",
      askedForVenue: true,
      lastAssistantIntent: "availability_available",
    },
  });

  assert.equal(result.venue, undefined);
  assert.equal(result.leadStage, "missing_location_or_venue");
  assert.match(result.responseDraft ?? "", /venue/i);
  assert.doesNotMatch(result.responseDraft ?? "", /Sure sounds lovely/i);
});

test("instagram wedding sales asks for email before booking an available call time", async () => {
  const result = await invokeWeddingSalesGraph({
    channel: "instagram",
    message: "Yes please",
    previousState: {
      names: "Rachel and Mike",
      weddingDate: "2026-11-11",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Charlotte",
      venue: "Evergreen Park",
      availability: "available",
      guideSent: true,
      callProposed: true,
      proposedCallTime: "Tomorrow at 11am",
      calendarStatus: "available",
      bookingConfirmed: false,
      leadStage: "call_proposed",
      askedForCallTime: true,
    },
  });

  assert.equal(result.leadStage, "waiting_customer_email");
  assert.equal(result.bookingConfirmed, false);
  assert.equal(result.toolObservations.length, 0);
  assert.match(result.responseDraft ?? "", /best email/i);
  assert.doesNotMatch(result.responseDraft ?? "", /sent a calendar invite/i);
});

test("instagram wedding sales answers questions while waiting for email without repeating only the email prompt", async () => {
  const result = await invokeWeddingSalesGraph({
    channel: "instagram",
    message: "Does that include travel?",
    previousState: {
      names: "Rachel and Mike",
      weddingDate: "2026-11-11",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Charlotte",
      venue: "Evergreen Park",
      availability: "available",
      guideSent: true,
      callProposed: true,
      proposedCallTime: "Tomorrow at 11am",
      calendarStatus: "available",
      bookingConfirmed: false,
      leadStage: "waiting_customer_email",
      askedForEmail: true,
    },
  });

  assert.equal(result.leadStage, "answering_question");
  assert.match(result.responseDraft ?? "", /travel/i);
  assert.match(result.responseDraft ?? "", /email/i);
  assert.doesNotMatch(result.responseDraft ?? "", /^Perfect, tomorrow at 11 AM Eastern works great!/i);
});

test("instagram wedding sales routes a collected email to booking after an available call time", async () => {
  const result = await invokeWeddingSalesGraph({
    channel: "instagram",
    message: "rachel@example.com",
    previousState: {
      names: "Rachel and Mike",
      weddingDate: "2026-11-11",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Charlotte",
      venue: "Evergreen Park",
      availability: "available",
      guideSent: true,
      callProposed: true,
      proposedCallTime: "Tomorrow at 11am",
      calendarStatus: "available",
      bookingConfirmed: false,
      leadStage: "waiting_customer_email",
      askedForEmail: true,
    },
  });

  assert.equal(result.customerEmail, "rachel@example.com");
  assert.equal(result.leadStage, "ready_to_book");
  assert.equal(result.bookingConfirmed, false);
  assert.match(result.responseDraft ?? "", /booking tool/i);
});

test("wedding sales graph uses known Gmail customer email instead of asking again", async () => {
  const result = await invokeWeddingSalesGraph({
    channel: "gmail",
    message: "Yes, please book it.",
    customerEmail: "anna@example.com",
    previousState: {
      names: "Anna and Mark",
      weddingDate: "2027-06-14",
      weddingYear: "2027",
      weddingYearKnown: true,
      location: "Charlotte",
      availability: "available",
      guideSent: true,
      callProposed: true,
      proposedCallTime: "Monday at 11 AM Eastern",
      calendarStatus: "available",
      bookingConfirmed: false,
      leadStage: "call_proposed",
      askedForCallTime: true,
    },
  });

  assert.equal(result.customerEmail, "anna@example.com");
  assert.equal(result.leadStage, "ready_to_book");
  assert.equal(result.bookingConfirmed, false);
  assert.doesNotMatch(result.responseDraft ?? "", /best email/i);
});

test("instagram wedding sales confirms booking only after the booking tool succeeds", async () => {
  const result = await invokeWeddingSalesGraph({
    channel: "instagram",
    message: "rachel@example.com",
    previousState: {
      names: "Rachel and Mike",
      weddingDate: "2026-11-11",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Charlotte",
      venue: "Evergreen Park",
      availability: "available",
      guideSent: true,
      callProposed: true,
      proposedCallTime: "Monday at 11am",
      calendarStatus: "available",
      bookingConfirmed: false,
      leadStage: "waiting_customer_email",
      askedForEmail: true,
    },
    toolContext: {
      tenantId: "tenant-1",
      testMode: true,
      weddingAvailability: {
        action: "capacity availability",
        params: {},
      },
      consultationCalendar: {
        action: "check calendar",
        params: {},
      },
      bookConsultation: {
        action: "book call",
        params: {
          businessDays: [1, 2, 3, 4, 5],
          businessWindowStartHour: 9,
          businessWindowEndHour: 14,
          slotDurationMinutes: 30,
          inviteEmailSource: "customer_email",
          bookingDateSource: "time_text",
          bookingTimeSource: "time_text",
          checkConflictsBeforeBooking: false,
        },
        credentialsEnc: encrypt(JSON.stringify({ access_token: "test-token" })),
      },
    },
  });

  assert.equal(result.customerEmail, "rachel@example.com");
  assert.equal(result.leadStage, "booked");
  assert.equal(result.bookingConfirmed, true);
  assert.equal(result.turnToolObservations.at(-1)?.toolName, "book_consultation");
  assert.match(result.responseDraft ?? "", /sent a calendar invite to rachel@example.com/i);
});
