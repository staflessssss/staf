import assert from "node:assert/strict";
import test from "node:test";

import { defaultWeddingSalesConfig } from "./config";
import { composeWeddingSalesResponse, finalizeLlmWeddingSalesResponse } from "./response-composer";
import type { WeddingSalesState } from "./state";

const baseState: WeddingSalesState = {
  channel: "gmail",
  leadStage: "availability_checked",
  names: "Anna and Mark",
  weddingDate: "2027-06-14",
  weddingYearKnown: true,
  location: "Charlotte",
  availability: "available",
  guideSent: false,
  callProposed: false,
  bookingConfirmed: false,
  toolObservations: [],
  assistantReplyCount: 0,
  hasGreeted: false,
  signatureSent: false,
  portfolioSent: false,
  reviewsSent: false,
  guideOffered: false,
  askedForNames: false,
  askedForWeddingYear: false,
  askedForCallTime: false,
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
  assert.match(response, /Callista and Kevin: https:\/\/example.com\/film/);
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
