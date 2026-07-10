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

test("requires a new availability check when the customer selects an offered alternative date", () => {
  const nudge = aiRuntimeTestHelpers.buildRequiredWeddingAvailabilityActionNudge({
    currentMessage: "Could they do October 16 instead?",
    historyMessages: [
      {
        role: "TOOL",
        toolName: "Check wedding availability",
        content: "availability result",
        toolResult: {
          steps: [
            {
              result: {
                status: "unavailable",
                date: "2026-10-17",
                suggestedDates: ["2026-10-16", "2026-10-18"],
                region: "NC/SC/GA",
              },
            },
          ],
        },
      },
      {
        role: "USER",
        content: "Their wedding is October 17, 2026 in Raleigh.",
      },
    ],
  });

  assert.match(nudge, /Call the wedding availability tool now/);
});

test("requires a calendar check for a relative consultation time", () => {
  const nudge = aiRuntimeTestHelpers.buildRequiredConsultationCalendarActionNudge({
    currentMessage: "Okay, next Tuesday at 11am ET works.",
  });

  assert.match(nudge, /Call the consultation calendar tool/);
});
