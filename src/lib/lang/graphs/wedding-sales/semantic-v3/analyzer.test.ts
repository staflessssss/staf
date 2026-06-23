import assert from "node:assert/strict";
import test from "node:test";

import { createInitialWeddingSalesState } from "../state";
import { analyzeGroundedWeddingTurn } from "./analyzer";

test("grounded analyzer validates structured output from the model", async () => {
  const state = createInitialWeddingSalesState({
    channel: "instagram",
    message: "We are Cindy and Paul, October 18 in Safety Harbor.",
  });
  const result = await analyzeGroundedWeddingTurn(state, {
    generate: async () => ({
      schemaVersion: 3,
      summary: "Cindy and Paul supplied their wedding date and location.",
      facts: [
        {
          field: "customerName",
          value: "Cindy",
          normalizedValue: "Cindy",
          evidence: "Cindy and Paul",
          relation: "speaker_self",
          mode: "assert",
          confidence: 0.98,
        },
      ],
      questions: [],
      decisions: [],
      clientType: null,
      unclear: [],
    }),
  });

  assert.equal(result.schemaVersion, 3);
  assert.equal(result.facts[0].field, "customerName");
});

test("grounded analyzer rejects facts without evidence", async () => {
  const state = createInitialWeddingSalesState({
    channel: "instagram",
    message: "Hello",
  });

  await assert.rejects(() =>
    analyzeGroundedWeddingTurn(state, {
      generate: async () => ({
        schemaVersion: 3,
        summary: "Greeting.",
        facts: [
          {
            field: "customerName",
            value: "Cindy",
            normalizedValue: "Cindy",
            evidence: "",
            relation: "speaker_self",
            mode: "assert",
            confidence: 0.99,
          },
        ],
        questions: [],
        decisions: [],
        clientType: null,
        unclear: [],
      }),
    }),
  );
});
