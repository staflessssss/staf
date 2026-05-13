import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("functions section is exported as a neutral shared section component", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/components/stafless/workspace-sections/functions-section.tsx"),
    "utf8",
  );

  assert.match(source, /export function FunctionsSection\(/);
  assert.doesNotMatch(source, /export function WorkspaceFunctionsSection\(/);
});

test("functions section exposes a typed Google Calendar execution surface", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/components/stafless/workspace-sections/functions-section.tsx"),
    "utf8",
  );

  assert.match(source, /Google Calendar/);
  assert.match(source, /Calendar booking flow|Availability lookup flow/);
  assert.match(source, /Get free time/);
  assert.match(source, /Create event/);
  assert.match(source, /Pick the calendar target/);
  assert.match(source, /Bind the live inputs/);
  assert.match(source, /Define the scheduling window/);
  assert.match(source, /Business days/);
  assert.match(source, /Availability date source/);
  assert.match(source, /Booking date source/);
  assert.match(source, /Invite email source/);
  assert.match(source, /Saving stays blocked until this fixed date is valid/);
  assert.match(source, /Fixed invite email cannot stay empty/);
  assert.match(source, /Saving stays blocked until this invite email is valid/);
  assert.match(source, /Event title template/);
  assert.match(source, /Create Google Meet link automatically/);
  assert.match(source, /Add Google Calendar email reminder/);
  assert.match(source, /Lead column mapping/);
});

test("functions section exposes a staged Google Sheets lookup flow", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/components/stafless/workspace-sections/functions-section.tsx"),
    "utf8",
  );

  assert.match(source, /Google Sheets/);
  assert.match(source, /Sheet lookup flow/);
  assert.match(source, /Connect the spreadsheet file/);
  assert.match(source, /Load files/);
  assert.match(source, /Load sheet schema/);
  assert.match(source, /Selected file/);
  assert.match(source, /Sheet tab/);
  assert.match(source, /Build the row conditions/);
  assert.match(source, /Lookup conditions/);
  assert.match(source, /Matching rule/);
  assert.match(source, /Resolved value preview/);
  assert.match(source, /Review the loaded columns/);
  assert.match(source, /Add row/);
  assert.match(source, /Update rows/);
  assert.match(source, /Map the row values|Define the row changes/);
  assert.match(source, /Column mapping/);
});

test("functions workspace keeps operators out of legacy and unavailable execution paths", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/components/stafless/workspace-sections/functions-section.tsx"),
    "utf8",
  );

  assert.match(source, /Needs backend/);
  assert.match(source, /Choose Google Calendar or Google Sheets and bind a connected account/);
  assert.match(source, /Advanced compatibility/);
  assert.match(source, /New workspace actions should use Result delivery above/);
  assert.match(source, /Custom API is not available in this workspace slice/);
  assert.match(source, /Turn on Google Calendar in Integrations first/);
  assert.match(source, /Turn on Google Sheets in Integrations first/);
  assert.match(source, /!isWorkspaceMode/);
  assert.match(source, /disabled=\{isWorkspaceMode \|\| isReadOnlyMode\}/);
  assert.match(source, /primaryBinding\.kind !== "api_request"/);
});
