import assert from "node:assert/strict";
import test from "node:test";

import {
  getGoogleCalendarValidationErrors,
  getGoogleSheetsActionForOperation,
  getGoogleSheetsParams,
  getGoogleSheetsValidationErrors,
} from "@/lib/function-execution";

test("getGoogleCalendarValidationErrors reports invalid literal bindings for booking", () => {
  const errors = getGoogleCalendarValidationErrors({
    action: "book call and send invite",
    params: {
      bookingDateSource: "literal",
      bookingDateValue: "tomorrow",
      bookingTimeSource: "literal",
      bookingTimeValue: "after lunch",
      inviteEmailSource: "literal",
      inviteEmailValue: "not-an-email",
    },
  });

  assert.equal(errors.length, 3);
  assert.match(errors.join("\n"), /fixed booking date/i);
  assert.match(errors.join("\n"), /fixed booking time/i);
  assert.match(errors.join("\n"), /valid fixed invite email/i);
});

test("getGoogleCalendarValidationErrors accepts literal availability lookup with a valid fixed date", () => {
  const errors = getGoogleCalendarValidationErrors({
    action: "check consultation calendar availability",
    params: {
      availabilityDateSource: "literal",
      availabilityDateValue: "2026-04-25",
    },
  });

  assert.deepEqual(errors, []);
});

test("getGoogleCalendarValidationErrors rejects an invalid timezone", () => {
  const errors = getGoogleCalendarValidationErrors({
    action: "check consultation calendar availability",
    params: {
      timeZone: "Mars/Base",
    },
  });

  assert.match(errors.join("\n"), /valid IANA timezone/i);
});

test("getGoogleSheetsParams preserves typed write and update modes", () => {
  const append = getGoogleSheetsParams({
    params: {
      operation: "append_row",
      columnMappings: [{ column: "Name", valueSource: "couple_name", value: "" }],
    },
  });
  const update = getGoogleSheetsParams({
    params: {
      operation: "update_rows",
      filters: [{ column: "Email", operator: "equals", valueSource: "email", value: "" }],
      columnMappings: [{ column: "Status", valueSource: "literal", value: "Booked" }],
    },
  });

  assert.equal(append.operation, "append_row");
  assert.equal(append.columnMappings[0]?.valueSource, "couple_name");
  assert.equal(update.operation, "update_rows");
  assert.equal(update.filters[0]?.valueSource, "email");
  assert.equal(update.columnMappings[0]?.column, "Status");
});

test("getGoogleSheetsValidationErrors rejects incomplete executable sheet config", () => {
  const errors = getGoogleSheetsValidationErrors({
    params: {
      operation: "update_rows",
      spreadsheetId: "",
      sheetName: "",
      filters: [{ column: "", operator: "equals", valueSource: "literal", value: "" }],
      columnMappings: [{ column: "", valueSource: "literal", value: "" }],
    },
  });

  assert.match(errors.join("\n"), /selected spreadsheet/i);
  assert.match(errors.join("\n"), /selected sheet tab/i);
  assert.match(errors.join("\n"), /condition 1 needs a column/i);
  assert.match(errors.join("\n"), /condition 1 needs a fixed value/i);
  assert.match(errors.join("\n"), /mapping 1 needs a column/i);
  assert.match(errors.join("\n"), /mapping 1 needs a fixed value/i);
});

test("getGoogleSheetsValidationErrors accepts complete lookup and append configs", () => {
  assert.deepEqual(
    getGoogleSheetsValidationErrors({
      params: {
        operation: "get_rows",
        spreadsheetId: "sheet-id",
        sheetName: "Leads",
        filters: [{ column: "Email", operator: "equals", valueSource: "email", value: "" }],
      },
    }),
    [],
  );

  assert.deepEqual(
    getGoogleSheetsValidationErrors({
      params: {
        operation: "append_row",
        spreadsheetId: "sheet-id",
        sheetName: "Leads",
        columnMappings: [{ column: "Name", valueSource: "couple_name", value: "" }],
      },
    }),
    [],
  );
});

test("getGoogleSheetsActionForOperation returns human action copy for each mode", () => {
  assert.equal(getGoogleSheetsActionForOperation("get_rows"), "lookup rows in sheet");
  assert.equal(getGoogleSheetsActionForOperation("append_row"), "append row to sheet");
  assert.equal(
    getGoogleSheetsActionForOperation("update_rows"),
    "update matching rows in sheet",
  );
});
