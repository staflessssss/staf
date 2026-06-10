import assert from "node:assert/strict";
import test from "node:test";

import { encrypt } from "@/lib/crypto";

import { invokeWeddingSalesGraph } from "./graph";
import { weddingSalesAnalyzeTestHelpers } from "./nodes/analyze";
import type { WeddingSalesSemanticAnalysis } from "./semantic-analyzer";
import { createInitialWeddingSalesState } from "./state";

function semanticAnalysis(
  update: Partial<WeddingSalesSemanticAnalysis>,
): WeddingSalesSemanticAnalysis {
  return {
    messageKind: "details",
    answersRequestedField: "none",
    names: null,
    weddingDate: null,
    weddingDateText: null,
    weddingYear: null,
    location: null,
    venue: null,
    email: null,
    proposedCallTime: null,
    weddingDateChange: "none",
    locationChange: "none",
    confirmsPendingChange: false,
    rejectsPendingChange: false,
    asksBusinessQuestion: false,
    confidence: 0.95,
    ...update,
  };
}

test("wedding sales graph asks for year before checking availability", async () => {
  const result = await invokeWeddingSalesGraph({
    channel: "gmail",
    message: "We are Anna and Mark. Our wedding is June 14 in Charlotte.",
  });

  assert.equal(result.leadStage, "waiting_wedding_year");
  assert.equal(result.weddingDateText, "June 14");
  assert.match(result.responseDraft ?? "", /year/i);
});

test("wedding sales graph keeps the recent manual conversation in context", async () => {
  const result = await invokeWeddingSalesGraph({
    channel: "instagram",
    message: "Thank you",
    conversationContext:
      "customer: Did my parents pay for the additional hour?\nbusiness: Yes, they already paid.",
  });

  assert.match(
    result.conversationSummary ?? "",
    /Recent conversation transcript: customer: Did my parents pay for the additional hour\? business: Yes, they already paid\./,
  );
});

test("instagram wedding sales treats get in touch as a fresh inquiry starter", async () => {
  const result = await invokeWeddingSalesGraph({
    channel: "instagram",
    message: "Get in touch",
  });

  assert.equal(result.leadStage, "missing_names_or_date");
  assert.match(result.responseDraft ?? "", /Hey there!/);
  assert.match(result.responseDraft ?? "", /founder of Myndful Films/);
  assert.match(result.responseDraft ?? "", /What are both of your names/i);
  assert.match(result.responseDraft ?? "", /wedding date/i);
  assert.doesNotMatch(result.responseDraft ?? "", /tell me a little more/i);
});

test("instagram wedding sales greets and qualifies a plain first hello", async () => {
  const result = await invokeWeddingSalesGraph({
    channel: "instagram",
    message: "Hello",
  });

  assert.equal(result.leadStage, "missing_names_or_date");
  assert.match(result.responseDraft ?? "", /Hey there!/);
  assert.match(result.responseDraft ?? "", /founder of Myndful Films/);
  assert.match(result.responseDraft ?? "", /both of your names/i);
  assert.match(result.responseDraft ?? "", /wedding date/i);
});

test("instagram wedding sales answers first-message pricing and continues qualification", async () => {
  const result = await invokeWeddingSalesGraph({
    channel: "instagram",
    message: "What's your price?",
    previousState: {
      leadStage: "new",
      assistantReplyCount: 0,
      hasGreeted: false,
    },
  });

  assert.equal(result.leadStage, "answering_question");
  assert.match(result.responseDraft ?? "", /Hey there!/);
  assert.match(result.responseDraft ?? "", /\$2,950/);
  assert.match(result.responseDraft ?? "", /both of your names/i);
  assert.match(result.responseDraft ?? "", /wedding date/i);
});

test("instagram wedding sales uses Florida start price for known Florida leads", async () => {
  const result = await invokeWeddingSalesGraph({
    channel: "instagram",
    message: "What's your price?",
    previousState: {
      leadStage: "availability_checked",
      names: "Emily and Jake",
      weddingDate: "2026-10-10",
      weddingDateText: "October 10",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Tampa",
      availability: "available",
      guideSent: true,
      callProposed: true,
      assistantReplyCount: 2,
      hasGreeted: true,
    },
  });

  assert.equal(result.leadStage, "answering_question");
  assert.equal(result.location, "Tampa");
  assert.match(result.responseDraft ?? "", /\$3,490/);
  assert.doesNotMatch(result.responseDraft ?? "", /\$2,950/);
});

test("instagram wedding sales greets before processing complete first-message details", async () => {
  const result = await invokeWeddingSalesGraph({
    channel: "instagram",
    message: "We are Bob and Sara. Our wedding is August 8, 2026 in Charlotte NC.",
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
        params: {},
      },
    },
  });

  assert.equal(result.names, "Bob and Sara");
  assert.equal(result.weddingDate, "2026-08-08");
  assert.equal(result.location, "Charlotte NC");
  assert.equal(result.leadStage, "availability_checked");
  assert.match(result.responseDraft ?? "", /Hey there!/);
  assert.match(result.responseDraft ?? "", /August 8, 2026.*available/i);
});

test("instagram wedding sales does not re-greet when cta appears inside an active thread", async () => {
  const result = await invokeWeddingSalesGraph({
    channel: "instagram",
    message: "inquire",
    previousState: {
      assistantReplyCount: 1,
      hasGreeted: true,
      askedForNames: true,
      leadStage: "missing_names_or_date",
    },
  });

  assert.equal(result.leadStage, "missing_names_or_date");
  assert.doesNotMatch(result.responseDraft ?? "", /Hey there!/);
  assert.match(result.responseDraft ?? "", /names/i);
  assert.match(result.responseDraft ?? "", /wedding date/i);
});

test("wedding sales analyzer recognizes Florida locations", () => {
  assert.equal(
    weddingSalesAnalyzeTestHelpers.extractLocation("We are getting married in Tampa, Florida."),
    "Tampa",
  );
  assert.equal(weddingSalesAnalyzeTestHelpers.extractLocation("Miami"), "Miami");
});

test("wedding sales initial state preserves previous assistant response for anti-repeat policy", () => {
  const state = createInitialWeddingSalesState({
    channel: "instagram",
    message: "My fiance is Daniel",
    previousState: {
      responseDraft: "Thank you so much. Just so I check the right date, could you share the wedding year?",
      assistantReplyCount: 1,
    },
  });

  assert.equal(
    state.responseDraft,
    "Thank you so much. Just so I check the right date, could you share the wedding year?",
  );
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

test("wedding sales graph combines stored month-day and year before availability check", async () => {
  const result = await invokeWeddingSalesGraph({
    channel: "gmail",
    message: "Charlotte NC in Evergreen Park",
    customerEmail: "v.bedritsky.dodo@gmail.com",
    previousState: {
      names: "Jason and Kristina",
      weddingDateText: "29 may",
      weddingYear: "2027",
      weddingYearKnown: true,
      bookingConfirmed: false,
      askedForNames: true,
      askedForVenue: true,
      leadStage: "missing_location_or_venue",
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
        params: {},
      },
    },
  });

  assert.equal(result.weddingDate, "2027-05-29");
  assert.equal(result.leadStage, "availability_checked");
  assert.equal(result.turnToolObservations[0]?.toolName, "check_wedding_availability");
  assert.doesNotMatch(result.responseDraft ?? "", /tool is not configured/i);
});

test("wedding sales graph ignores Gmail quote dates when analyzing replies", async () => {
  const result = await invokeWeddingSalesGraph({
    channel: "gmail",
    message: [
      "Could you send pricing again? Also do you travel?",
      "",
      "On Wed, May 20, 2026 at 5:05 AM Taras <contact@myndfulfilms.com> wrote:",
      "> June 14, 2027, in Charlotte is wide open on my calendar.",
      "> Our collections start at $2,950.",
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
  assert.match(result.responseDraft ?? "", /\$2,950/);
  assert.match(result.responseDraft ?? "", /travel/i);
  assert.match(result.conversationSummary ?? "", /Latest customer message: Could you send pricing again\? Also do you travel\?/);
  assert.match(result.conversationSummary ?? "", /Last assistant intent: answer_question/);
});

test("wedding sales graph answers after an unavailable date without rechecking the same date", async () => {
  const result = await invokeWeddingSalesGraph({
    channel: "instagram",
    message: "What do your packages start at and do you travel?",
    previousState: {
      names: "Priya and Arjun",
      weddingDate: "2026-09-19",
      weddingDateText: "September 19",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Atlanta",
      availability: "unavailable",
      bookingConfirmed: false,
      leadStage: "availability_checked",
      lastAssistantIntent: "availability_unavailable",
    },
  });

  assert.equal(result.leadStage, "answering_question");
  assert.equal(result.weddingDate, "2026-09-19");
  assert.equal(result.toolObservations.length, 0);
  assert.match(result.responseDraft ?? "", /\$2,950/);
  assert.match(result.responseDraft ?? "", /unavailable/i);
  assert.match(result.responseDraft ?? "", /travel/i);
});

test("wedding sales graph softly declines a booked wedding date without deferring confirmation", async () => {
  const result = await invokeWeddingSalesGraph({
    channel: "instagram",
    message: "Charlotte, NC in Evergreen Park",
    previousState: {
      names: "Rick and Julie",
      weddingDate: "2026-10-11",
      weddingDateText: "October 11",
      weddingYear: "2026",
      weddingYearKnown: true,
      bookingConfirmed: false,
      leadStage: "missing_location_or_venue",
    },
    config: {
      coverage: {
        regions: ["NC"],
        capacityPerDate: 1,
        unavailableDates: ["2026-10-11"],
      },
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
        params: {},
      },
    },
  });

  assert.equal(result.leadStage, "availability_checked");
  assert.equal(result.availability, "unavailable");
  assert.match(result.responseDraft ?? "", /already booked|unavailable/i);
  assert.doesNotMatch(result.responseDraft ?? "", /still some time away/i);
  assert.doesNotMatch(result.responseDraft ?? "", /closer/i);
  assert.doesNotMatch(result.responseDraft ?? "", /can't confirm|cannot confirm|able to confirm/i);
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
  assert.deepEqual(weddingSalesAnalyzeTestHelpers.extractWeddingDate("wedding date is 29 may of 2027"), {
    display: "29 may of 2027",
    iso: "2027-05-29",
    yearKnown: true,
  });
  assert.deepEqual(weddingSalesAnalyzeTestHelpers.extractWeddingDate("Bob and Sara\n08.02.2028\nCharlotte NC"), {
    display: "08.02.2028",
    iso: "2028-02-08",
    yearKnown: true,
  });
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
  assert.equal(
    weddingSalesAnalyzeTestHelpers.extractLocation("Bob and Sara\n08.02.2028\nCharlotte NC"),
    "Charlotte",
  );
});

test("wedding sales analyzer extracts Instagram-style couple names", () => {
  assert.equal(
    weddingSalesAnalyzeTestHelpers.extractNames("It’s Taras and Valerie\nNovember 5"),
    "Taras and Valerie",
  );
  assert.equal(
    weddingSalesAnalyzeTestHelpers.extractNames("Taras And Valerie"),
    "Taras and Valerie",
  );
  assert.equal(
    weddingSalesAnalyzeTestHelpers.extractNames("Bob and Sara\n08.02.2028\nCharlotte NC"),
    "Bob and Sara",
  );
  assert.equal(
    weddingSalesAnalyzeTestHelpers.extractNames("Bob & Sara 08/02/2028 Charlotte NC"),
    "Bob and Sara",
  );
  assert.equal(
    weddingSalesAnalyzeTestHelpers.extractNames("Taras Kucherenko and Valerie Savchina"),
    "Taras Kucherenko and Valerie Savchina",
  );
  assert.equal(
    weddingSalesAnalyzeTestHelpers.extractNames("Taras Kucherenko and Valerie Savchina\n08.02.2028\nCharlotte NC"),
    "Taras Kucherenko and Valerie Savchina",
  );
  assert.equal(
    weddingSalesAnalyzeTestHelpers.extractNames("Bride: Sara, Groom: Bob, wedding 08.02.2028"),
    "Sara and Bob",
  );
  assert.equal(
    weddingSalesAnalyzeTestHelpers.extractNames("Mark and Julie and date is October 11"),
    "Mark and Julie",
  );
  assert.equal(
    weddingSalesAnalyzeTestHelpers.extractNames("Our names Mark and Julie"),
    "Mark and Julie",
  );
  assert.equal(
    weddingSalesAnalyzeTestHelpers.extractNames("Julie is fiancés name", "Mark"),
    "Mark and Julie",
  );
  assert.equal(
    weddingSalesAnalyzeTestHelpers.extractNames("My fiance is Daniel", "Olivia"),
    "Olivia and Daniel",
  );
  assert.equal(
    weddingSalesAnalyzeTestHelpers.extractNames("Groom is Arjun and the date is September 19 2026", "Priya"),
    "Priya and Arjun",
  );
  assert.equal(
    weddingSalesAnalyzeTestHelpers.extractNames("Mark, Dec 5 2026", "Anna"),
    "Anna and Mark",
  );
  assert.equal(
    weddingSalesAnalyzeTestHelpers.extractNames("hey im Anna, wedding in Charlotte"),
    "Anna",
  );
  assert.equal(weddingSalesAnalyzeTestHelpers.extractNames("Charlotte NC"), undefined);
  assert.equal(weddingSalesAnalyzeTestHelpers.extractNames("May 29, 2026"), undefined);
});

test("instagram wedding sales accepts compact multiline lead details", async () => {
  const first = await invokeWeddingSalesGraph({
    channel: "instagram",
    message: "inquire",
  });
  const result = await invokeWeddingSalesGraph({
    channel: "instagram",
    message: "Bob and Sara\n08.02.2028\nCharlotte NC",
    previousState: first,
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
        params: {},
      },
    },
  });

  assert.equal(result.names, "Bob and Sara");
  assert.equal(result.weddingDate, "2028-02-08");
  assert.equal(result.location, "Charlotte");
  assert.equal(result.leadStage, "availability_checked");
  assert.equal(result.turnToolObservations[0]?.toolName, "check_wedding_availability");
  assert.doesNotMatch(result.responseDraft ?? "", /names/i);
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
  assert.match(result.responseDraft ?? "", /Hey there! Thank you so much for reaching out/);
  assert.match(result.responseDraft ?? "", /I’m Taras, the founder of Myndful Films/);
  assert.match(result.responseDraft ?? "", /fianc/i);
  assert.match(result.responseDraft ?? "", /wedding date/i);
  assert.doesNotMatch(result.responseDraft ?? "", /Founder & Creative Director|MYNDFUL FILMS/);
});

test("instagram wedding sales keeps real DM state and reaches availability tool", async () => {
  let state = await invokeWeddingSalesGraph({
    channel: "instagram",
    message: "Hello there!",
  });

  state = await invokeWeddingSalesGraph({
    channel: "instagram",
    message: "Mark and Julie and date is October 11",
    previousState: state,
  });

  assert.equal(state.names, "Mark and Julie");
  assert.equal(state.weddingDateText, "October 11");
  assert.equal(state.leadStage, "waiting_wedding_year");

  state = await invokeWeddingSalesGraph({
    channel: "instagram",
    message: "2026",
    previousState: state,
  });

  assert.equal(state.names, "Mark and Julie");
  assert.equal(state.weddingDate, "2026-10-11");
  assert.equal(state.leadStage, "missing_location_or_venue");
  assert.doesNotMatch(state.responseDraft ?? "", /fianc/i);

  state = await invokeWeddingSalesGraph({
    channel: "instagram",
    message: "Charlotte",
    previousState: state,
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
        params: {},
        credentialsEnc: encrypt(JSON.stringify({ access_token: "test-token" })),
      },
    },
  });

  assert.equal(state.names, "Mark and Julie");
  assert.equal(state.location, "Charlotte");
  assert.equal(state.availability, "available");
  assert.equal(state.toolObservations.at(-1)?.toolName, "check_wedding_availability");
  assert.match(state.responseDraft ?? "", /collections start/i);
  assert.match(state.responseDraft ?? "", /venue/i);
  assert.doesNotMatch(state.responseDraft ?? "", /fianc/i);
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

test("instagram wedding sales rechecks availability when customer changes the wedding date", async () => {
  const result = await invokeWeddingSalesGraph({
    channel: "instagram",
    message: "Oh actually my date is October 17th 2026",
    previousState: {
      names: "Peter and Marina",
      weddingDate: "2026-10-18",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Raleigh",
      availability: "available",
      guideSent: true,
      callProposed: false,
      bookingConfirmed: false,
      leadStage: "missing_location_or_venue",
      askedForVenue: true,
      lastAssistantIntent: "ask_location_or_venue",
    },
    config: {
      coverage: {
        regions: ["NC/SC/GA"],
        capacityPerDate: 2,
        unavailableDates: ["2026-10-17"],
      },
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
        params: {},
      },
    },
  });

  assert.equal(result.weddingDate, "2026-10-17");
  assert.equal(result.availability, "unavailable");
  assert.equal(result.leadStage, "availability_checked");
  assert.equal(result.turnToolObservations[0]?.toolName, "check_wedding_availability");
  assert.doesNotMatch(result.responseDraft ?? "", /quick consultation call/i);
  assert.match(result.responseDraft ?? "", /alternative|flexibility|nearby|available/i);
});

test("instagram wedding sales asks confirmation for ambiguous changed wedding date", async () => {
  const result = await invokeWeddingSalesGraph({
    channel: "instagram",
    message: "October 17",
    previousState: {
      names: "Peter and Marina",
      weddingDate: "2026-10-18",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Raleigh",
      availability: "available",
      guideSent: true,
      callProposed: false,
      bookingConfirmed: false,
      leadStage: "missing_location_or_venue",
      askedForVenue: true,
      lastAssistantIntent: "ask_location_or_venue",
    },
  });

  assert.equal(result.weddingDate, "2026-10-18");
  assert.equal(result.pendingChangeField, "weddingDate");
  assert.equal(result.pendingChangeValue, "2026-10-17");
  assert.equal(result.leadStage, "confirming_change");
  assert.equal(result.turnToolObservations.length, 0);
  assert.match(result.responseDraft ?? "", /confirm/i);
  assert.match(result.responseDraft ?? "", /October 17/i);
});

test("instagram wedding sales applies confirmed changed wedding date", async () => {
  const result = await invokeWeddingSalesGraph({
    channel: "instagram",
    message: "Yes",
    previousState: {
      names: "Peter and Marina",
      weddingDate: "2026-10-18",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Raleigh",
      availability: "available",
      guideSent: true,
      callProposed: false,
      bookingConfirmed: false,
      leadStage: "confirming_change",
      askedForVenue: true,
      pendingChangeField: "weddingDate",
      pendingChangeValue: "2026-10-17",
      pendingChangeDisplay: "October 17",
      lastAssistantIntent: "confirm_change",
    },
    config: {
      coverage: {
        regions: ["NC/SC/GA"],
        capacityPerDate: 2,
        unavailableDates: ["2026-10-17"],
      },
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
        params: {},
      },
    },
  });

  assert.equal(result.weddingDate, "2026-10-17");
  assert.equal(result.pendingChangeField, undefined);
  assert.equal(result.availability, "unavailable");
  assert.equal(result.turnToolObservations[0]?.toolName, "check_wedding_availability");
  assert.doesNotMatch(result.responseDraft ?? "", /quick consultation call/i);
});

test("instagram wedding sales asks confirmation for ambiguous changed location", async () => {
  const result = await invokeWeddingSalesGraph({
    channel: "instagram",
    message: "Raleigh",
    previousState: {
      names: "Peter and Marina",
      weddingDate: "2026-10-18",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Charlotte",
      availability: "available",
      guideSent: true,
      callProposed: false,
      bookingConfirmed: false,
      leadStage: "missing_location_or_venue",
      askedForVenue: true,
      lastAssistantIntent: "ask_location_or_venue",
    },
  });

  assert.equal(result.location, "Charlotte");
  assert.equal(result.pendingChangeField, "location");
  assert.equal(result.pendingChangeValue, "Raleigh");
  assert.equal(result.leadStage, "confirming_change");
  assert.equal(result.turnToolObservations.length, 0);
  assert.match(result.responseDraft ?? "", /updated wedding location/i);
});

test("instagram wedding sales accepts full street address as venue answer", async () => {
  const result = await invokeWeddingSalesGraph({
    channel: "instagram",
    message: "8033 Hood Rd, Charlotte, NC 28215, United States",
    previousState: {
      names: "Ben and Marie",
      weddingDate: "2026-08-08",
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
  assert.equal(result.venue, "8033 Hood Rd, Charlotte, NC 28215, United States");
  assert.equal(result.callProposed, true);
  assert.match(result.responseDraft ?? "", /9 AM to 2 PM Eastern/i);
  assert.doesNotMatch(result.responseDraft ?? "", /both of your full names/i);
});

test("instagram wedding sales asks for a time when customer only says tomorrow", async () => {
  const result = await invokeWeddingSalesGraph({
    channel: "instagram",
    message: "Ye we can call tomorrow",
    previousState: {
      names: "Rick and Julie",
      weddingDate: "2026-10-11",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Charlotte",
      venue: "Evergreen Park",
      availability: "available",
      guideSent: true,
      callProposed: true,
      bookingConfirmed: false,
      leadStage: "availability_checked",
      lastAssistantIntent: "availability_available",
    },
  });

  assert.equal(result.leadStage, "asking_call_time");
  assert.equal(result.proposedCallTime, "Ye we can call tomorrow");
  assert.equal(result.turnToolObservations.length, 0);
  assert.doesNotMatch(result.responseDraft ?? "", /Tomorrow works perfectly/i);
  assert.doesNotMatch(result.responseDraft ?? "", /October 11, 2026.*available/i);
  assert.match(result.responseDraft ?? "", /9 AM to 2 PM Eastern/i);
});

test("instagram wedding sales checks the consultation calendar for a time-only reply after tomorrow", async () => {
  const result = await invokeWeddingSalesGraph({
    channel: "instagram",
    message: "10 am",
    previousState: {
      names: "Rick and Julie",
      weddingDate: "2026-10-11",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Charlotte",
      venue: "Evergreen Park",
      availability: "available",
      guideSent: true,
      callProposed: true,
      proposedCallTime: "Yes we can call tomorrow",
      bookingConfirmed: false,
      leadStage: "asking_call_time",
      askedForCallTime: true,
      lastAssistantIntent: "ask_call_time",
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
        params: {},
      },
    },
  });

  assert.equal(result.proposedCallTime, "tomorrow at 10 AM");
  assert.equal(result.turnToolObservations[0]?.toolName, "check_consultation_calendar");
  assert.doesNotMatch(result.responseDraft ?? "", /October 11, 2026.*available/i);
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

test("instagram wedding sales answers travel fees using the known venue", async () => {
  const result = await invokeWeddingSalesGraph({
    channel: "instagram",
    message: "Any travel fees?",
    previousState: {
      names: "Rick and Rachel",
      weddingDate: "2026-11-08",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Charlotte",
      venue: "Evergreen Park",
      availability: "available",
      guideSent: true,
      callProposed: true,
      assistantReplyCount: 3,
      hasGreeted: true,
      calendarStatus: undefined,
      bookingConfirmed: false,
      leadStage: "asking_call_time",
      askedForCallTime: true,
    },
  });

  assert.equal(result.leadStage, "answering_question");
  assert.match(result.responseDraft ?? "", /roundtrip travel coverage/i);
  assert.match(result.responseDraft ?? "", /Classic Collection/i);
  assert.match(result.responseDraft ?? "", /Premium Collection/i);
  assert.match(result.responseDraft ?? "", /Exclusive Collection/i);
  assert.match(result.responseDraft ?? "", /exact travel details/i);
  assert.match(result.responseDraft ?? "", /What time works best/i);
  assert.doesNotMatch(result.responseDraft ?? "", /Evergreen Park/i);
  assert.doesNotMatch(result.responseDraft ?? "", /once I know the venue/i);
  assert.doesNotMatch(result.responseDraft ?? "", /Could you tell me a little more/i);
});

test("instagram wedding sales acknowledges a repeated venue instead of falling back", async () => {
  const result = await invokeWeddingSalesGraph({
    channel: "instagram",
    message: "i say venue is Evergreen Park",
    previousState: {
      names: "Rick and Rachel",
      weddingDate: "2026-11-08",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Charlotte",
      venue: "Evergreen Park",
      availability: "available",
      guideSent: true,
      callProposed: true,
      calendarStatus: undefined,
      bookingConfirmed: false,
      leadStage: "asking_call_time",
      askedForCallTime: true,
    },
  });

  assert.equal(result.leadStage, "answering_question");
  assert.match(result.responseDraft ?? "", /I have Evergreen Park in Charlotte as the venue/i);
  assert.match(result.responseDraft ?? "", /What time works best/i);
  assert.doesNotMatch(result.responseDraft ?? "", /Could you tell me a little more/i);
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

test("instagram wedding sales keeps known email after checking a replacement call time", async () => {
  const result = await invokeWeddingSalesGraph({
    channel: "instagram",
    message: "10:30 works for us",
    previousState: {
      names: "Rick and Julie",
      weddingDate: "2026-10-11",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Charlotte",
      venue: "Evergreen Park",
      availability: "available",
      guideSent: true,
      callProposed: true,
      proposedCallTime: "Monday at 10 AM",
      calendarStatus: "busy",
      customerEmail: "bonkopoly@gmail.com",
      bookingConfirmed: false,
      leadStage: "checking_calendar",
      lastAssistantIntent: "calendar_busy",
      askedForCallTime: true,
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
        params: {
          businessDays: [1, 2, 3, 4, 5],
          businessWindowStartHour: 9,
          businessWindowEndHour: 14,
          slotDurationMinutes: 30,
          checkConflictsBeforeBooking: false,
        },
      },
      bookConsultation: {
        action: "book call",
        params: {},
      },
    },
  });

  assert.equal(result.customerEmail, "bonkopoly@gmail.com");
  assert.equal(result.proposedCallTime, "Monday at 10:30 AM");
  assert.doesNotMatch(result.responseDraft ?? "", /best email/i);
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
  assert.match(result.responseDraft ?? "", /test mode/i);
  assert.match(result.responseDraft ?? "", /would send a calendar invite to rachel@example.com/i);
  assert.doesNotMatch(result.responseDraft ?? "", /I've sent/i);
});

test("instagram wedding sales stays in support mode after a consultation is booked", async () => {
  const result = await invokeWeddingSalesGraph({
    channel: "instagram",
    message: "Can u send ma price again?",
    previousState: {
      names: "Valerie and Krisitna",
      weddingDate: "2026-11-05",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Charlotte",
      availability: "available",
      guideOffered: true,
      guideSent: true,
      callProposed: true,
      proposedCallTime: "Monday at 10 AM Eastern",
      calendarStatus: "available",
      customerEmail: "lalala@gmail.com",
      bookingConfirmed: true,
      leadStage: "booked",
      lastAssistantIntent: "booking_confirmed",
    },
  });

  assert.equal(result.leadStage, "answering_question");
  assert.equal(result.turnToolObservations.length, 0);
  assert.match(result.responseDraft ?? "", /\$2,950/);
  assert.match(result.responseDraft ?? "", /all set/i);
  assert.doesNotMatch(result.responseDraft ?? "", /Would you like to find a time|good time for a quick call/i);
});

test("instagram wedding sales does not recheck availability when customer says the call is already booked", async () => {
  const result = await invokeWeddingSalesGraph({
    channel: "instagram",
    message: "we already booked quick call",
    previousState: {
      names: "Valerie and Krisitna",
      weddingDate: "2026-11-05",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Charlotte",
      availability: "available",
      guideOffered: true,
      guideSent: true,
      callProposed: true,
      proposedCallTime: "Monday at 10 AM Eastern",
      calendarStatus: "available",
      customerEmail: "lalala@gmail.com",
      bookingConfirmed: true,
      leadStage: "booked",
      lastAssistantIntent: "booking_confirmed",
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
        params: {},
      },
    },
  });

  assert.equal(result.leadStage, "answering_question");
  assert.equal(result.turnToolObservations.length, 0);
  assert.match(result.responseDraft ?? "", /all set/i);
  assert.doesNotMatch(result.responseDraft ?? "", /November 5, 2026.*available/i);
  assert.doesNotMatch(result.responseDraft ?? "", /quick call to go over everything/i);
});

test("instagram wedding sales can reopen availability when booked lead corrects the wedding date", async () => {
  const result = await invokeWeddingSalesGraph({
    channel: "instagram",
    message: "Sorry, the wedding date is actually October 17, 2026",
    previousState: {
      names: "Valerie and Krisitna",
      weddingDate: "2026-11-05",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Charlotte",
      availability: "available",
      guideOffered: true,
      guideSent: true,
      callProposed: true,
      proposedCallTime: "Monday at 10 AM Eastern",
      calendarStatus: "available",
      customerEmail: "lalala@gmail.com",
      bookingConfirmed: true,
      leadStage: "booked",
      lastAssistantIntent: "booking_confirmed",
    },
  });

  assert.equal(result.weddingDate, "2026-10-17");
  assert.equal(result.bookingConfirmed, false);
  assert.equal(result.leadStage, "ready_for_availability");
});

test("semantic analysis accepts a naturally phrased pair of names without asking again", () => {
  const state = createInitialWeddingSalesState({
    channel: "instagram",
    message: "Those are our names, Taras and Valerie",
    previousState: {
      weddingDate: "2026-11-05",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Saint Augustine",
      leadStage: "missing_names_or_date",
      askedForNames: true,
    },
  });

  const result = weddingSalesAnalyzeTestHelpers.analyzeWeddingSalesMessageWithSemantics(
    state,
    semanticAnalysis({
      names: "Taras and Valerie",
      answersRequestedField: "names",
    }),
  );

  assert.equal(result.names, "Taras and Valerie");
  assert.equal(result.leadStage, "ready_for_availability");
});

test("semantic analysis uses context to recognize an unlabeled venue answer", () => {
  const state = createInitialWeddingSalesState({
    channel: "instagram",
    message: "The Foundry",
    previousState: {
      names: "Peter and Marina",
      weddingDate: "2026-10-18",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Raleigh",
      availability: "available",
      leadStage: "missing_location_or_venue",
      askedForVenue: true,
    },
  });

  const result = weddingSalesAnalyzeTestHelpers.analyzeWeddingSalesMessageWithSemantics(
    state,
    semanticAnalysis({
      venue: "The Foundry",
      answersRequestedField: "venue",
    }),
  );

  assert.equal(result.venue, "The Foundry");
  assert.equal(result.leadStage, "asking_call_time");
});

test("semantic analysis ignores hallucinated date when customer answers with venue address", () => {
  const state = createInitialWeddingSalesState({
    channel: "instagram",
    message: "333 S. Franklin Street, Tampa, FL 33602",
    previousState: {
      names: "Suzie and Rick",
      weddingDate: "2026-10-11",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Tampa",
      availability: "available",
      leadStage: "availability_checked",
      askedForVenue: true,
      lastAssistantIntent: "availability_available",
    },
  });

  const result = weddingSalesAnalyzeTestHelpers.analyzeWeddingSalesMessageWithSemantics(
    state,
    semanticAnalysis({
      answersRequestedField: "venue",
      venue: "333 S. Franklin Street, Tampa, FL 33602",
      weddingDate: "2026-10-10",
      weddingDateText: "October 10, 2026",
    }),
  );

  assert.equal(result.venue, "333 S. Franklin Street, Tampa, FL 33602");
  assert.equal(result.pendingChangeField, undefined);
  assert.equal(result.weddingDate, undefined);
  assert.equal(result.leadStage, "asking_call_time");
});

test("semantic analysis accepts an unknown unlabeled city as the wedding location", () => {
  const state = createInitialWeddingSalesState({
    channel: "instagram",
    message: "Saint Augustine",
    previousState: {
      names: "Taras and Valerie",
      weddingDate: "2026-11-05",
      weddingYear: "2026",
      weddingYearKnown: true,
      leadStage: "missing_location_or_venue",
    },
  });

  const result = weddingSalesAnalyzeTestHelpers.analyzeWeddingSalesMessageWithSemantics(
    state,
    semanticAnalysis({
      location: "Saint Augustine",
      answersRequestedField: "location",
    }),
  );

  assert.equal(result.location, "Saint Augustine");
  assert.equal(result.leadStage, "ready_for_availability");
});

test("semantic analysis confirms a pending date change from a conversational reply", () => {
  const state = createInitialWeddingSalesState({
    channel: "instagram",
    message: "Yes, that's the new date",
    previousState: {
      names: "Peter and Marina",
      weddingDate: "2026-10-18",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Raleigh",
      availability: "available",
      leadStage: "confirming_change",
      pendingChangeField: "weddingDate",
      pendingChangeValue: "2026-10-17",
      pendingChangeDisplay: "October 17, 2026",
    },
  });

  const result = weddingSalesAnalyzeTestHelpers.analyzeWeddingSalesMessageWithSemantics(
    state,
    semanticAnalysis({
      messageKind: "confirmation",
      confirmsPendingChange: true,
    }),
  );

  assert.equal(result.weddingDate, "2026-10-17");
  assert.equal(result.availability, undefined);
  assert.equal(result.leadStage, "ready_for_availability");
});

test("semantic analysis asks before applying a conflicting unlabeled location", () => {
  const state = createInitialWeddingSalesState({
    channel: "instagram",
    message: "Raleigh",
    previousState: {
      names: "Peter and Marina",
      weddingDate: "2026-10-18",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Charlotte",
      availability: "available",
      leadStage: "availability_checked",
    },
  });

  const result = weddingSalesAnalyzeTestHelpers.analyzeWeddingSalesMessageWithSemantics(
    state,
    semanticAnalysis({
      location: "Raleigh",
      locationChange: "ambiguous",
    }),
  );

  assert.equal(result.location, undefined);
  assert.equal(result.pendingChangeField, "location");
  assert.equal(result.pendingChangeValue, "Raleigh");
  assert.equal(result.leadStage, "confirming_change");
});

test("semantic analysis asks before changing a known location prior to availability check", () => {
  const state = createInitialWeddingSalesState({
    channel: "instagram",
    message: "Raleigh",
    previousState: {
      names: "Peter and Marina",
      weddingDate: "2026-10-18",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Charlotte",
      leadStage: "ready_for_availability",
    },
  });

  const result = weddingSalesAnalyzeTestHelpers.analyzeWeddingSalesMessageWithSemantics(
    state,
    semanticAnalysis({
      location: "Raleigh",
      locationChange: "ambiguous",
    }),
  );

  assert.equal(result.pendingChangeField, "location");
  assert.equal(result.pendingChangeValue, "Raleigh");
  assert.equal(result.leadStage, "confirming_change");
});

test("semantic analysis understands conversational call-time proposals", () => {
  const state = createInitialWeddingSalesState({
    channel: "instagram",
    message: "Ten in the morning would be perfect",
    previousState: {
      names: "Peter and Marina",
      weddingDate: "2026-10-18",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Raleigh",
      venue: "The Foundry",
      availability: "available",
      callProposed: true,
      leadStage: "asking_call_time",
      proposedCallTime: "tomorrow",
    },
  });

  const result = weddingSalesAnalyzeTestHelpers.analyzeWeddingSalesMessageWithSemantics(
    state,
    semanticAnalysis({
      messageKind: "scheduling",
      answersRequestedField: "call_time",
      proposedCallTime: "tomorrow at 10 AM Eastern",
    }),
  );

  assert.equal(result.proposedCallTime, "tomorrow at 10 AM Eastern");
  assert.equal(result.leadStage, "checking_calendar");
});

test("semantic analysis answers an early business question before continuing qualification", () => {
  const state = createInitialWeddingSalesState({
    channel: "instagram",
    message: "What do your collections cost?",
  });

  const result = weddingSalesAnalyzeTestHelpers.analyzeWeddingSalesMessageWithSemantics(
    state,
    semanticAnalysis({
      messageKind: "question",
      asksBusinessQuestion: true,
    }),
  );

  assert.equal(result.leadStage, "answering_question");
});
