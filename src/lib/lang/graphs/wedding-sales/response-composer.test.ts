import assert from "node:assert/strict";
import test from "node:test";

import { defaultWeddingSalesConfig } from "./config";
import {
  composeHumanWeddingSalesResponse,
  composeWeddingSalesResponse,
  finalizeLlmWeddingSalesResponse,
  parseWeddingSalesReflectionJson,
} from "./response-composer";
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
  guideSent: false,
  callProposed: false,
  bookingConfirmed: false,
  toolObservations: [],
  turnToolObservations: [],
  assistantReplyCount: 0,
  hasGreeted: false,
  signatureSent: false,
  portfolioSent: false,
  reviewsSent: false,
  guideOffered: false,
  askedForNames: false,
  askedForWeddingYear: false,
  askedForVenue: false,
  askedForCallTime: false,
  askedForEmail: false,
};

const config = {
  ...defaultWeddingSalesConfig,
  guide: {
    fileName: "Collections Guide",
    link: "https://example.com/guide",
  },
  portfolio: [
    {
      label: "Callista and Kevin",
      url: "https://example.com/film",
    },
  ],
  reviews: {
    label: "Google Reviews",
    url: "https://example.com/reviews",
  },
  signature: "Taras Mynd\nMYNDFUL FILMS",
};

test("wedding sales composer formats rich gmail links and one signature", () => {
  const response = composeWeddingSalesResponse({
    intent: "availability_available",
    config,
    state: baseState,
  });

  assert.match(response, /June 14, 2027 in Charlotte/);
  assert.match(response, /<a href="https:\/\/example.com\/film">Callista and Kevin<\/a>/);
  assert.match(response, /<a href="https:\/\/example.com\/reviews">Google Reviews<\/a>/);
  assert.equal(response.match(/Taras Mynd/g)?.length, 1);
});

test("wedding sales composer avoids resending guide assets after guide was sent", () => {
  const response = composeWeddingSalesResponse({
    intent: "availability_available",
    config,
    state: {
      ...baseState,
      guideSent: true,
    },
  });

  assert.doesNotMatch(response, /collections guide/i);
  assert.doesNotMatch(response, /Callista and Kevin/);
  assert.match(response, /quick consultation/i);
});

test("wedding sales composer uses plain links for instagram", () => {
  const response = composeWeddingSalesResponse({
    intent: "availability_available",
    config,
    state: {
      ...baseState,
      channel: "instagram",
    },
  });

  assert.doesNotMatch(response, /<a href=/);
  assert.match(response, /\$2,750/);
  assert.match(response, /venue/i);
  assert.doesNotMatch(response, /Taras Mynd/);
  assert.doesNotMatch(response, /MYNDFUL FILMS/);
});

test("instagram human composer keeps deterministic fallback when the LLM composer is disabled", async () => {
  const originalComposerFlag = process.env.WEDDING_SALES_LLM_COMPOSER;
  process.env.WEDDING_SALES_LLM_COMPOSER = "false";

  try {
    const response = await composeHumanWeddingSalesResponse({
      intent: "ask_missing_info",
      config,
      state: {
        ...baseState,
        channel: "instagram",
        leadStage: "missing_names_or_date",
        names: "Mark and Julie",
        weddingDate: undefined,
        weddingDateText: undefined,
        assistantReplyCount: 1,
        hasGreeted: true,
      },
    });

    assert.equal(response, "Would you mind sharing the date of your wedding? That way I can check our availability for Charlotte and get you all set up ✨");
  } finally {
    if (originalComposerFlag === undefined) {
      delete process.env.WEDDING_SALES_LLM_COMPOSER;
    } else {
      process.env.WEDDING_SALES_LLM_COMPOSER = originalComposerFlag;
    }
  }
});

test("instagram wedding-year fallback acknowledges newly captured names instead of repeating verbatim", () => {
  const response = composeWeddingSalesResponse({
    intent: "ask_wedding_year",
    config,
    state: {
      ...baseState,
      channel: "instagram",
      leadStage: "waiting_wedding_year",
      names: "Olivia and Daniel",
      weddingDate: undefined,
      weddingDateText: "June 14",
      weddingYear: undefined,
      weddingYearKnown: false,
      askedForWeddingYear: true,
      latestCustomerMessage: "My fiance is Daniel",
      assistantReplyCount: 2,
      hasGreeted: true,
    },
  });

  assert.match(response, /Olivia and Daniel/);
  assert.match(response, /What year is June 14/i);
  assert.doesNotMatch(response, /Thank you so much\. Just so I check the right date/i);
});

test("instagram missing-name follow-up avoids repeating the same full prompt", () => {
  const response = composeWeddingSalesResponse({
    intent: "ask_missing_info",
    config,
    state: {
      ...baseState,
      channel: "instagram",
      leadStage: "missing_names_or_date",
      names: "Olivia",
      weddingDate: "2027-06-14",
      weddingDateText: "June 14",
      askedForNames: true,
      assistantReplyCount: 2,
      hasGreeted: true,
    },
  });

  assert.match(response, /missing it/i);
  assert.match(response, /just your fiancé’s first name/i);
  assert.doesNotMatch(response, /That way I can check our availability/i);
});

test("instagram first missing-info reply asks for both names when no name is known", () => {
  const response = composeWeddingSalesResponse({
    intent: "ask_missing_info",
    config,
    state: {
      ...baseState,
      channel: "instagram",
      leadStage: "missing_names_or_date",
      names: undefined,
      weddingDate: undefined,
      weddingDateText: undefined,
      askedForNames: false,
      assistantReplyCount: 0,
      hasGreeted: false,
    },
  });

  assert.match(response, /both of your names/i);
  assert.match(response, /date of your wedding/i);
  assert.doesNotMatch(response, /sharing your fiancé’s name and the date/i);
});

test("instagram first missing-info reply asks only for fiance name when customer name is known", () => {
  const response = composeWeddingSalesResponse({
    intent: "ask_missing_info",
    config,
    state: {
      ...baseState,
      channel: "instagram",
      leadStage: "missing_names_or_date",
      names: "Rachel",
      weddingDate: undefined,
      weddingDateText: undefined,
      askedForNames: false,
      assistantReplyCount: 0,
      hasGreeted: false,
    },
  });

  assert.match(response, /fiancé’s name/i);
  assert.match(response, /date of your wedding/i);
  assert.doesNotMatch(response, /both of your names/i);
});

test("unavailable-date follow-up answers pricing without repeating availability check copy", () => {
  const response = composeWeddingSalesResponse({
    intent: "answer_question",
    config,
    state: {
      ...baseState,
      channel: "instagram",
      leadStage: "answering_question",
      names: "Priya and Arjun",
      weddingDate: "2026-09-19",
      weddingDateText: "September 19",
      weddingYear: "2026",
      weddingYearKnown: true,
      location: "Atlanta",
      availability: "unavailable",
      latestCustomerMessage: "What do your packages start at and do you travel?",
    },
  });

  assert.match(response, /unavailable/i);
  assert.match(response, /\$2,750/);
  assert.match(response, /travel/i);
  assert.doesNotMatch(response, /I checked/i);
});

test("wedding sales composer confirms consultation booking warmly without wedding-booking language", () => {
  const response = composeWeddingSalesResponse({
    intent: "booking_confirmed",
    config,
    state: {
      ...baseState,
      leadStage: "booked",
      bookingConfirmed: true,
    },
  });

  assert.match(response, /calendar invite/i);
  assert.match(response, /consultation/i);
  assert.match(response, /looking forward/i);
  assert.doesNotMatch(response, /wedding.*booked/i);
  assert.doesNotMatch(response, /date.*reserved/i);
  assert.equal(response.match(/Taras Mynd/g)?.length ?? 0, 0);
});

test("wedding sales composer labels test-mode booking without claiming a live invite was sent", () => {
  const response = composeWeddingSalesResponse({
    intent: "booking_confirmed",
    summary: "This consultation slot could be booked without triggering live calendar or lead side effects.",
    testMode: true,
    config,
    state: {
      ...baseState,
      channel: "instagram",
      leadStage: "booked",
      bookingConfirmed: true,
      proposedCallTime: "Monday at 11am",
      customerEmail: "rachel@example.com",
    },
  });

  assert.match(response, /test mode/i);
  assert.match(response, /would send a calendar invite/i);
  assert.doesNotMatch(response, /I've sent/i);
  assert.doesNotMatch(response, /sent a calendar invite/i);
});

test("LLM wedding sales finalizer removes model-added duplicate signatures", () => {
  const response = finalizeLlmWeddingSalesResponse({
    intent: "availability_available",
    config,
    state: baseState,
    text: [
      "Hi Anna and Mark,",
      "",
      "June 14, 2027 is available, and I would love to hear more about your plans.",
      "",
      "Warmly,",
      "Taras Mynd",
      "Founder & Creative Director / MYNDFUL FILMS LLC",
      "www.myndfulfilms.co",
    ].join("\n"),
  });

  assert.equal(response.match(/Taras Mynd/g)?.length, 1);
  assert.match(response, /MYNDFUL FILMS$/);
});

test("LLM wedding sales finalizer strips greetings and signatures from scheduling replies", () => {
  const response = finalizeLlmWeddingSalesResponse({
    intent: "calendar_busy",
    config,
    state: {
      ...baseState,
      responseDraft: "Would you be open to a 30-minute consultation?",
    },
    text: [
      "Hi Anna and Mark,",
      "",
      "Monday at 10 AM Eastern is already booked, but 9 AM, 9:30 AM, or 10:30 AM are open. Would one of those work?",
      "",
      "Warmly,",
      "Taras",
    ].join("\n"),
  });

  assert.doesNotMatch(response, /^Hi\b/i);
  assert.doesNotMatch(response, /Taras/i);
  assert.match(response, /^Monday at 10 AM Eastern/i);
});

test("LLM wedding sales finalizer converts markdown links for rich Gmail replies", () => {
  const response = finalizeLlmWeddingSalesResponse({
    intent: "availability_available",
    config,
    state: baseState,
    text: "Here is a recent film: [Callista and Kevin](https://example.com/film)",
  });

  assert.match(response, /<a href="https:\/\/example.com\/film">Callista and Kevin<\/a>/);
});

test("LLM wedding sales finalizer adds one brand emoji to warm availability replies", () => {
  const response = finalizeLlmWeddingSalesResponse({
    intent: "availability_available",
    config,
    state: baseState,
    text: "June 14, 2027 is available, and I would love to hear more about your plans.",
  });

  assert.match(response, /🤍/);
  assert.equal((response.match(/[🤍✨🎥]/gu) ?? []).length, 1);
});

test("LLM wedding sales finalizer keeps routine scheduling replies emoji-free", () => {
  const response = finalizeLlmWeddingSalesResponse({
    intent: "calendar_busy",
    config,
    state: {
      ...baseState,
      responseDraft: "Would you be open to a 30-minute consultation?",
    },
    text: "Monday at 10 AM Eastern is already taken, but 10:30 AM is open. Would that work?",
  });

  assert.equal((response.match(/[🤍✨🎥]/gu) ?? []).length, 0);
});

test("wedding sales reflection parser accepts JSON wrapped in model prose", () => {
  const review = parseWeddingSalesReflectionJson([
    "Here is the review:",
    '{"status":"rewrite","issues":["repeated greeting"],"revisedText":"Monday at 10 AM works. Want me to book it?"}',
  ].join("\n"));

  assert.equal(review.status, "rewrite");
  assert.deepEqual(review.issues, ["repeated greeting"]);
  assert.equal(review.revisedText, "Monday at 10 AM works. Want me to book it?");
});

test("wedding sales reflection parser fails open on invalid JSON", () => {
  const review = parseWeddingSalesReflectionJson("not json");

  assert.equal(review.status, "pass");
  assert.equal(review.revisedText, "");
  assert.deepEqual(review.issues, []);
});
