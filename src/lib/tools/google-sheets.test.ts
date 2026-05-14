import test from "node:test";
import assert from "node:assert/strict";

import {
  executeGoogleSheetsStep,
  googleSheetsTestHelpers,
  normalizeSheetDateValue,
} from "@/lib/tools/google-sheets";

test("normalizeSheetDateValue handles iso and dotted formats", () => {
  assert.equal(normalizeSheetDateValue("2026-07-14"), "2026-07-14");
  assert.equal(normalizeSheetDateValue("14.07.2026"), "2026-07-14");
  assert.equal(normalizeSheetDateValue("14/07/2026"), "2026-07-14");
});

test("normalizeSheetDateValue handles english month names", () => {
  assert.equal(normalizeSheetDateValue("14 July 2026"), "2026-07-14");
});

test("normalizeSheetDateValue converts sheet serial numbers", () => {
  assert.equal(normalizeSheetDateValue(46182), "2026-06-09");
});

test("capacity availability region matching uses configured aliases", () => {
  assert.equal(googleSheetsTestHelpers.matchesAlias("Wedding in Florida", ["FL", "Florida"]), true);
  assert.equal(googleSheetsTestHelpers.matchesAlias("conflict with schedule", ["FL"]), false);
  assert.equal(googleSheetsTestHelpers.matchesAlias("Wedding in FL", ["FL"]), true);
  assert.equal(googleSheetsTestHelpers.matchesAlias("Tampa", ["NC", "SC", "GA"]), false);

  const rule = googleSheetsTestHelpers.inferRequestedCapacityRule({
    request: "Our wedding will be in Charlotte",
    location: "",
    capacityRules: [
      { region: "FL", aliases: ["FL", "Florida"], capacity: 1 },
      {
        region: "NC/SC/GA",
        aliases: ["NC/SC/GA", "NC, SC", "North Carolina", "South Carolina", "Georgia", "Charlotte"],
        capacity: 2,
      },
    ],
  });

  assert.equal(rule?.region, "NC/SC/GA");
  assert.equal(rule?.capacity, 2);
});

test("capacity availability runtime does not silently default explicit empty rules", async () => {
  const result = await executeGoogleSheetsStep({
    action: "check capacity availability in sheet",
    request: "Check 2026-07-14 in Florida",
    params: {
      operation: "capacity_availability",
      spreadsheetId: "sheet-id",
      sheetName: "Bookings",
      dateColumn: "date",
      statusColumn: "status",
      regionColumn: "region",
      bookedStatusValue: "Booked",
      capacityRules: [],
    },
  });

  assert.equal(typeof result, "object");
  assert.equal(Array.isArray(result), false);
  assert.equal((result as { status?: string }).status, "missing_capacity_rules");
});
