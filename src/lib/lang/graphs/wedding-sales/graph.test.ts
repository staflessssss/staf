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
  assert.match(result.responseDraft ?? "", /year/i);
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
        params: {},
      },
    },
  });

  assert.equal(result.availability, "available");
  assert.equal(result.toolObservations[0]?.toolName, "check_wedding_availability");
  assert.match(result.responseDraft ?? "", /collections start/i);
});
