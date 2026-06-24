import assert from "node:assert/strict";
import test from "node:test";

import { weddingSalesSimpleUnderstandTestHelpers } from "./understand";

test("LLM understanding requires every fact and allows unknown facts to be null", () => {
  const result = weddingSalesSimpleUnderstandTestHelpers.llmTurnUnderstandingSchema.parse({
      customerMessageType: "availability_question",
      facts: {
        customerName: null,
        partnerName: null,
        weddingDate: "2027-06-14",
        weddingDateText: "June 14 2027",
        location: "Tampa",
        venue: null,
        email: null,
        proposedCallTime: null,
        senderRole: null,
      },
      questionsAskedByCustomer: ["availability", "pricing"],
      confidence: 0.95,
    });

  assert.equal(result.facts.weddingDate, "2027-06-14");
  assert.equal(result.facts.customerName, null);
});

test("LLM understanding rejects a facts object that omits a property", () => {
  assert.throws(() =>
    weddingSalesSimpleUnderstandTestHelpers.llmTurnUnderstandingSchema.parse({
        customerMessageType: "availability_question",
        facts: {
          partnerName: null,
          weddingDate: "2027-06-14",
          weddingDateText: "June 14 2027",
          location: "Tampa",
          venue: null,
          email: null,
          proposedCallTime: null,
          senderRole: null,
        },
        questionsAskedByCustomer: ["availability"],
        confidence: 0.95,
    }),
  );
});
