import assert from "node:assert/strict";
import test from "node:test";

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
        },
        credentialsEnc: "test-credentials",
      },
    },
  });

  assert.equal(result.availability, "available");
  assert.equal(result.toolObservations[0]?.toolName, "check_wedding_availability");
  assert.match(result.responseDraft ?? "", /collections start/i);
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
