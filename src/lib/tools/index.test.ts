import assert from "node:assert/strict";
import test from "node:test";

import { toolResolutionTestHelpers } from "@/lib/tools";

test("extractCanonicalToolFields prefers canonical calendar date and time from tool steps", () => {
  const canonical = toolResolutionTestHelpers.extractCanonicalToolFields([
    {
      result: {
        status: "available",
        date: "2026-04-20",
        time: "11:30",
      },
    },
  ]);

  assert.deepEqual(canonical, {
    canonicalDate: "2026-04-20",
    canonicalTime: "11:30",
  });
});

test("hasMonthDayWithoutYear ignores years from localized Gmail quote headers", () => {
  assert.equal(
    toolResolutionTestHelpers.hasMonthDayWithoutYear(`Sure, we are Anna and Mark. Our wedding is June 14 in Charlotte.

вс, 17 мая 2026 г. в 16:54, Fhdh Fhdh <fhdhf2211@gmail.com>:`),
    true,
  );
});

test("hasMonthDayWithoutYear allows explicit wedding years", () => {
  assert.equal(
    toolResolutionTestHelpers.hasMonthDayWithoutYear(
      "Sure, we are Anna and Mark. Our wedding is June 14, 2027 in Charlotte.",
    ),
    false,
  );
});

test("hasMonthYearWithoutDay catches month-year wedding dates", () => {
  assert.equal(toolResolutionTestHelpers.hasMonthYearWithoutDay("It will be in October 2026"), true);
  assert.equal(toolResolutionTestHelpers.hasMonthYearWithoutDay("Their wedding is 2026 October"), true);
});

test("hasMonthYearWithoutDay allows exact wedding dates", () => {
  assert.equal(toolResolutionTestHelpers.hasMonthYearWithoutDay("October 17 2026 in Orlando"), false);
  assert.equal(toolResolutionTestHelpers.hasMonthYearWithoutDay("2026-10-17 in Orlando"), false);
});

test("hasExactWeddingDate separates location-only text from exact wedding dates", () => {
  assert.equal(toolResolutionTestHelpers.hasExactWeddingDate("Orlando"), false);
  assert.equal(toolResolutionTestHelpers.hasExactWeddingDate("October 2026 in Orlando"), false);
  assert.equal(toolResolutionTestHelpers.hasExactWeddingDate("October 17 2026 in Orlando"), true);
  assert.equal(toolResolutionTestHelpers.hasExactWeddingDate("2026-10-17 in Orlando"), true);
});

test("hasExplicitCallTime does not treat names as a proposed call time", () => {
  assert.equal(toolResolutionTestHelpers.hasExplicitCallTime("Our names are Jack and Lili"), false);
});

test("hasExplicitCallTime accepts customer-proposed call times", () => {
  assert.equal(toolResolutionTestHelpers.hasExplicitCallTime("Tomorrow at 10am ET works"), true);
  assert.equal(toolResolutionTestHelpers.hasExplicitCallTime("Friday 13:30 should be fine"), true);
  assert.equal(toolResolutionTestHelpers.hasExplicitCallTime("Noon works for us"), true);
});

test("isBookConsultationFeature detects booking tools separately from calendar checks", () => {
  assert.equal(
    toolResolutionTestHelpers.isBookConsultationFeature({
      name: "Book consultation call",
      description: "",
      steps: [],
    } as never),
    true,
  );
  assert.equal(
    toolResolutionTestHelpers.isBookConsultationFeature({
      name: "Check consultation calendar",
      description: "",
      steps: [],
    } as never),
    false,
  );
});

test("isInternalBusinessEmail rejects business emails as customer invite emails", () => {
  assert.equal(toolResolutionTestHelpers.isInternalBusinessEmail("taras@myndfulfilms.com"), true);
  assert.equal(toolResolutionTestHelpers.isInternalBusinessEmail("contact@myndfulfilms.com"), true);
  assert.equal(toolResolutionTestHelpers.isInternalBusinessEmail("bride@example.com"), false);
});
