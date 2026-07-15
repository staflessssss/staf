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

test("guide voice editor runs only after a ready attachment result", () => {
  assert.equal(
    aiRuntimeTestHelpers.hasReadyCollectionsGuideExecution([
      {
        toolName: "send_collections_guide",
        toolResult: { status: "ready_to_attach" },
      },
    ]),
    true,
  );
  assert.equal(
    aiRuntimeTestHelpers.hasReadyCollectionsGuideExecution([
      {
        toolName: "send_collections_guide",
        toolResult: { status: "blocked_precondition" },
      },
    ]),
    false,
  );
});

test("guide voice editor keeps location separate from the customer-facing guide name", () => {
  const system = aiRuntimeTestHelpers.buildCollectionsGuideVoiceEditorSystem();

  assert.match(system, /Preserve every concrete fact and action/);
  assert.match(system, /attachment name and pricing phrase must stay neutral/);
  assert.match(system, /do not repeat it in the guide or pricing clause/);
  assert.match(system, /On "first_reply"/);
  assert.match(system, /On "ongoing"/);
  assert.match(system, /Remove unsolicited offers to compare packages/);
  assert.match(system, /Return only the edited customer-facing reply/);
});
