import assert from "node:assert/strict";
import test from "node:test";

import { defaultWeddingSalesConfig } from "./config";
import { composeWeddingSalesResponse } from "./response-composer";
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
