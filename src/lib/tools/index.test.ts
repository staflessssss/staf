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
