import assert from "node:assert/strict";
import test from "node:test";

import { aiRuntimeTestHelpers } from "@/lib/ai-runtime";

test("normalizes accidental line-ending escapes in configured model ids", () => {
  assert.equal(
    aiRuntimeTestHelpers.normalizeConfiguredModelId("gpt-5.4-mini\\r\\n"),
    "gpt-5.4-mini",
  );
  assert.equal(
    aiRuntimeTestHelpers.normalizeConfiguredModelId(" gpt-4.1-mini\r\n"),
    "gpt-4.1-mini",
  );
});
