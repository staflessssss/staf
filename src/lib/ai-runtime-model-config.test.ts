import assert from "node:assert/strict";
import test from "node:test";

import { MessageRole } from "@prisma/client";

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
        role: MessageRole.TOOL,
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

test("successful structured calendar history enables booking authorization review", () => {
  assert.equal(
    aiRuntimeTestHelpers.historyHasAvailableConsultationSlot([
      {
        role: MessageRole.TOOL,
        toolName: "Check consultation calendar",
        content: "calendar result",
        toolResult: {
          steps: [{ result: { status: "available" } }],
        },
      },
    ]),
    true,
  );
  assert.equal(
    aiRuntimeTestHelpers.historyHasAvailableConsultationSlot([
      {
        role: "TOOL",
        toolName: "Check consultation calendar",
        content: "calendar result",
        toolResult: {
          steps: [{ result: { status: "busy" } }],
        },
      },
    ]),
    false,
  );
});

test("unexecuted in-progress booking language is blocked by final safety", () => {
  const guarded = aiRuntimeTestHelpers.softenFalseBookingConfirmation({
    text: "Perfect — I'm locking in tomorrow at 10am Eastern now.",
    toolExecutions: [],
  });

  assert.doesNotMatch(guarded, /I'm locking/i);
  assert.match(guarded, /not want to call that booked or confirmed/i);
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

  assert.match(system, /collectionsGuideToolResult is ground truth/);
  assert.match(system, /must include its startPrice and promotionText when present/);
  assert.match(system, /Never expose its serviceRegion/);
  assert.match(system, /attachment name and pricing phrase must stay neutral/);
  assert.match(system, /do not repeat it in the guide or pricing clause/);
  assert.match(system, /On "first_reply"/);
  assert.match(system, /On "ongoing"/);
  assert.match(system, /Remove unsolicited offers to compare packages/);
  assert.match(system, /Return only the edited customer-facing reply/);
});

test("availability execution exposes the grounded guide region", () => {
  assert.equal(
    aiRuntimeTestHelpers.getWeddingAvailabilityExecutionRegion([
      {
        toolName: "Check wedding availability",
        toolResult: {
          steps: [
            {
              result: {
                status: "available",
                requestedRegion: "NC/SC/GA",
              },
            },
          ],
        },
      },
    ]),
    "NC_SC_GA",
  );
});

test("guide policy sends after new availability but not after prior delivery", () => {
  assert.equal(
    aiRuntimeTestHelpers.shouldSendGuideAfterAvailability({
      semanticTurnPlan: null,
      pricingBehavior: "after_availability_or_when_asked",
    }),
    true,
  );

  assert.equal(
    aiRuntimeTestHelpers.shouldSendGuideAfterAvailability({
      semanticTurnPlan: {
        priorRequestedMaterialDelivered: true,
        sendGuideAfterAvailability: true,
      },
      pricingBehavior: "after_availability_or_when_asked",
    }),
    false,
  );
});

test("returning conversation editor preserves status without resending prior material", () => {
  const system = aiRuntimeTestHelpers.buildReturningConversationVoiceEditorSystem();

  assert.match(system, /requested material was already delivered/);
  assert.match(system, /Never soften, reverse, or omit an unavailable result/);
  assert.match(system, /explicitly direct the customer to the information or communication already above/);
  assert.match(system, /Neither meaning may be omitted/);
  assert.match(system, /Do not resend, re-offer, or claim to attach/);
  assert.match(system, /without offering alternate dates/);
  assert.match(system, /Return only the edited customer-facing DM/);
});

test("required question editor preserves voice without supplying a fixed reply", () => {
  const system = aiRuntimeTestHelpers.buildRequiredQuestionVoiceEditorSystem();

  assert.match(system, /smallest natural rewrite/);
  assert.match(system, /Do not use a fixed template/);
  assert.match(system, /final non-whitespace character must be a question mark/);
  assert.match(system, /Do not add a new business fact/);
});
