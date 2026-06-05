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

test("Google Sheets append skips writes in test mode before requiring credentials", async () => {
  const result = await executeGoogleSheetsStep({
    action: "append row to sheet",
    request: "Log a lead",
    testMode: true,
    params: {
      operation: "append_row",
      spreadsheetId: "sheet-id",
      sheetName: "Leads",
      headerRow: 1,
      columnMappings: [{ column: "email", valueSource: "email" }],
    },
    email: "rachel@example.com",
  });

  assert.equal(typeof result, "object");
  assert.equal(Array.isArray(result), false);
  assert.equal((result as { mode?: string }).mode, "test");
  assert.equal((result as { status?: string }).status, "skipped");
});

test("Google Sheets update skips writes in test mode before requiring credentials", async () => {
  const result = await executeGoogleSheetsStep({
    action: "update rows in sheet",
    request: "Mark lead booked",
    testMode: true,
    params: {
      operation: "update_rows",
      spreadsheetId: "sheet-id",
      sheetName: "Leads",
      headerRow: 1,
      combineFilters: "AND",
      filters: [{ column: "email", operator: "equals", valueSource: "email" }],
      columnMappings: [{ column: "status", valueSource: "literal", value: "Booked" }],
    },
    email: "rachel@example.com",
  });

  assert.equal(typeof result, "object");
  assert.equal(Array.isArray(result), false);
  assert.equal((result as { mode?: string }).mode, "test");
  assert.equal((result as { status?: string }).status, "skipped");
});
