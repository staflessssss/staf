import test from "node:test";
import assert from "node:assert/strict";

import { normalizeSheetDateValue } from "@/lib/tools/google-sheets";

test("normalizeSheetDateValue handles iso and dotted formats", () => {
  assert.equal(normalizeSheetDateValue("2026-07-14"), "2026-07-14");
  assert.equal(normalizeSheetDateValue("14.07.2026"), "2026-07-14");
  assert.equal(normalizeSheetDateValue("14/07/2026"), "2026-07-14");
});

test("normalizeSheetDateValue handles english and russian month names", () => {
  assert.equal(normalizeSheetDateValue("14 July 2026"), "2026-07-14");
  assert.equal(normalizeSheetDateValue("14 июля 2026"), "2026-07-14");
});

test("normalizeSheetDateValue converts sheet serial numbers", () => {
  assert.equal(normalizeSheetDateValue(46182), "2026-06-09");
});
