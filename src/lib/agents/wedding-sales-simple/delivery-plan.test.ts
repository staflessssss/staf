import assert from "node:assert/strict";
import test from "node:test";

import type { ReplyActionContract } from "@/lib/lang/graphs/wedding-sales-simple/reply-contract";

import { buildChannelDeliveryPlan } from "./delivery-plan";

function contract(update: Partial<ReplyActionContract> = {}): ReplyActionContract {
  return {
    nextStep: "ask_missing_info",
    replyType: "missing_info",
    requiredQuestion: "names",
    mustGreet: false,
    mustMentionWeddingAvailability: false,
    mustMentionCalendarAvailability: false,
    mustMentionBookingConfirmation: false,
    mayMentionPricing: false,
    mustMentionPricing: false,
    mayMentionGuide: false,
    mustMentionGuide: false,
    mustAnswerTeam: false,
    mustAnswerIdentity: false,
    mentionPolicy: {
      pricing: { mode: "skip", reason: "test" },
      availability: { mode: "skip", reason: "test" },
      guide: { mode: "skip", reason: "test" },
      consultation: { mode: "skip", reason: "test" },
      greeting: { mode: "skip", reason: "test" },
    },
    questionPolicy: {
      mode: "first_ask",
      requiredQuestion: "names",
      allowCompliment: false,
      avoidRepeatingPreviousWording: false,
      cta: undefined,
    },
    mayAskQuestion: true,
    requiredToolResult: undefined,
    bookingConfirmed: false,
    ...update,
  };
}

const mixedReply = [
  "Great news - I checked June 15, 2027 in Tampa, and the date is available 🤍",
  "Our 8-hour wedding films start at $2,950 for Florida. I’m sending the collections guide image here too 🎥",
  "For Florida weddings, Jay is our lead filmmaker in Tampa. And what are both of your names?",
].join("\n\n");

test("Gmail delivery plan keeps one email body without semantic split", () => {
  const plan = buildChannelDeliveryPlan({
    channel: "gmail",
    outboundText: mixedReply,
    replyContract: contract({
      mustMentionWeddingAvailability: true,
      mustMentionPricing: true,
      mustMentionGuide: true,
      mustAnswerTeam: true,
    }),
    attachments: [
      {
        type: "image",
        url: "https://example.com/guide.png",
        label: "guide.png",
        purpose: "pricing_guide",
      },
    ],
    conversationId: "thread-1",
    turnId: "turn-1",
    channelConfig: {
      enableInstagramSemanticDeliveryPlan: true,
    },
  });

  assert.equal(plan.channel, "gmail");
  assert.equal(plan.mode, "email");
  assert.equal(plan.enabled, false);
  assert.equal(plan.body, mixedReply);
  assert.equal("parts" in plan, false);
});

test("Instagram delivery plan stays single-message when flag is off", () => {
  const plan = buildChannelDeliveryPlan({
    channel: "instagram",
    outboundText: mixedReply,
    replyContract: contract({
      mustMentionWeddingAvailability: true,
      mustMentionPricing: true,
      mustMentionGuide: true,
      mustAnswerTeam: true,
    }),
    conversationId: "conversation-1",
    turnId: "turn-1",
    channelConfig: {
      enableInstagramSemanticDeliveryPlan: false,
    },
  });

  assert.equal(plan.channel, "instagram");
  assert.equal(plan.mode, "single_message");
  assert.equal(plan.enabled, false);
  assert.equal(plan.textPartCount, 1);
});

test("Instagram delivery plan semantically splits mixed replies when flag is on", () => {
  const plan = buildChannelDeliveryPlan({
    channel: "instagram",
    outboundText: mixedReply,
    replyContract: contract({
      mustMentionWeddingAvailability: true,
      mustMentionPricing: true,
      mustMentionGuide: true,
      mustAnswerTeam: true,
    }),
    attachments: [
      {
        type: "image",
        url: "https://example.com/guide.png",
        label: "guide.png",
        purpose: "pricing_guide",
      },
    ],
    conversationId: "conversation-1",
    turnId: "turn-1",
    channelConfig: {
      enableInstagramSemanticDeliveryPlan: true,
    },
  });

  assert.equal(plan.channel, "instagram");
  assert.equal(plan.mode, "semantic_split");
  assert.equal(plan.enabled, true);
  assert.equal(plan.guardResult.ok, true);
  assert.equal(plan.textPartCount, 3);
  assert.ok(plan.totalDelayMs <= 12_000);
  assert.deepEqual(
    plan.parts.map((part) => part.kind),
    ["sender_action", "text", "text", "text", "attachment"],
  );
  assert.ok(
    plan.parts.some((part) => part.kind === "text" && part.reason === "availability"),
  );
  assert.ok(plan.parts.some((part) => part.kind === "text" && part.reason === "pricing"));
  assert.ok(plan.parts.some((part) => part.kind === "text" && /both of your names/i.test(part.text)));
  assert.ok(
    plan.parts.some((part) => part.kind === "attachment" && part.reason === "pricing_guide"),
  );
});

test("Instagram delivery plan keeps booking and handoff as single-message", () => {
  const bookingPlan = buildChannelDeliveryPlan({
    channel: "instagram",
    outboundText:
      "Perfect - you're all set for 2:00 PM ✨\n\nYou should see the calendar invite come through at anna@example.com.",
    replyContract: contract({
      replyType: "booking_confirmed",
      requiredQuestion: undefined,
      mayAskQuestion: false,
      bookingConfirmed: true,
      mustMentionBookingConfirmation: true,
    }),
    conversationId: "conversation-1",
    turnId: "turn-2",
    channelConfig: {
      enableInstagramSemanticDeliveryPlan: true,
    },
  });
  const handoffPlan = buildChannelDeliveryPlan({
    channel: "instagram",
    outboundText: "I want to make sure I answer this correctly, so I’ll have someone take a look.",
    replyContract: contract({
      replyType: "handoff",
      nextStep: "handoff",
      requiredQuestion: undefined,
      mayAskQuestion: false,
    }),
    conversationId: "conversation-1",
    turnId: "turn-3",
    channelConfig: {
      enableInstagramSemanticDeliveryPlan: true,
    },
  });

  assert.equal(bookingPlan.mode, "single_message");
  assert.equal(bookingPlan.textPartCount, 1);
  assert.equal(handoffPlan.mode, "single_message");
  assert.equal(handoffPlan.textPartCount, 1);
});
