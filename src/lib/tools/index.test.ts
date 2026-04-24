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
