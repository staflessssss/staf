import assert from "node:assert/strict";
import test from "node:test";

import { defaultWeddingSalesConfig } from "./config";
import { buildWeddingSalesDialogPolicy, getWeddingSalesBehavioralStateUpdate } from "./policy";
import type { WeddingSalesState } from "./state";

const baseState: WeddingSalesState = {
  channel: "gmail",
  leadStage: "availability_checked",
  names: "Anna and Mark",
  weddingDate: "2027-06-14",
  weddingDateText: "June 14",
  weddingYear: "2027",
  weddingYearKnown: true,
  location: "Charlotte",
  availability: "available",
  guideSent: true,
  callProposed: true,
  bookingConfirmed: false,
  toolObservations: [],
  assistantReplyCount: 1,
  hasGreeted: true,
  signatureSent: true,
  portfolioSent: true,
  reviewsSent: true,
  guideOffered: true,
  askedForNames: false,
  askedForWeddingYear: false,
  askedForCallTime: true,
  responseDraft: "Would you be open to a 30-minute consultation Monday through Friday between 9 AM and 2 PM Eastern?",
};

test("wedding sales policy treats calendar replies as continuation without greeting or signature", () => {
  const policy = buildWeddingSalesDialogPolicy({
    intent: "calendar_busy",
    config: defaultWeddingSalesConfig,
    state: baseState,
    summary: "Consultation slot 10:00 is busy. Nearby openings: 09:00, 09:30, 10:30.",
  });

  assert.equal(policy.replyMode, "scheduling_reply");
  assert.equal(policy.allowGreeting, false);
  assert.equal(policy.includeSignature, false);
  assert.equal(policy.maxParagraphs, 2);
  assert.ok(policy.mustNotRepeat.some((item) => /portfolio/i.test(item)));
  assert.ok(policy.forbiddenPhrases.includes("Hi Anna and Mark"));
});

test("wedding sales policy allows greeting and signature only on first full email", () => {
  const policy = buildWeddingSalesDialogPolicy({
    intent: "ask_missing_info",
    config: defaultWeddingSalesConfig,
    state: {
      ...baseState,
      leadStage: "new",
      assistantReplyCount: 0,
      hasGreeted: false,
      signatureSent: false,
      portfolioSent: false,
      reviewsSent: false,
      guideOffered: false,
      askedForCallTime: false,
      responseDraft: undefined,
    },
  });

  assert.equal(policy.replyMode, "full_email");
  assert.equal(policy.allowGreeting, true);
  assert.equal(policy.includeSignature, true);
});

test("wedding sales behavioral memory records sent assets and asked questions", () => {
  const policy = buildWeddingSalesDialogPolicy({
    intent: "availability_available",
    config: defaultWeddingSalesConfig,
    state: baseState,
  });
  const update = getWeddingSalesBehavioralStateUpdate({
    intent: "availability_available",
    policy,
    state: baseState,
  });

  assert.equal(update.assistantReplyCount, 2);
  assert.equal(update.portfolioSent, true);
  assert.equal(update.reviewsSent, true);
  assert.equal(update.guideOffered, true);
  assert.equal(update.askedForCallTime, true);
  assert.equal(update.lastAssistantIntent, "availability_available");
});
