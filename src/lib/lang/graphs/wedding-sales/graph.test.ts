import assert from "node:assert/strict";
import test from "node:test";

import { invokeWeddingSalesGraph } from "./graph";

test("wedding sales graph asks for year before checking availability", async () => {
  const result = await invokeWeddingSalesGraph({
    channel: "gmail",
    message: "We are Anna and Mark. Our wedding is June 14 in Charlotte.",
  });

  assert.equal(result.leadStage, "waiting_wedding_year");
  assert.match(result.responseDraft ?? "", /year/i);
});

test("wedding sales graph routes complete wedding info to availability check", async () => {
  const result = await invokeWeddingSalesGraph({
    channel: "gmail",
    message: "We are Anna and Mark. Our wedding is June 14, 2027 in Charlotte, NC.",
  });

  assert.equal(result.leadStage, "ready_for_availability");
  assert.match(result.responseDraft ?? "", /availability/i);
});

test("wedding sales graph ignores coordinator and COI messages", async () => {
  const result = await invokeWeddingSalesGraph({
    channel: "gmail",
    message: "Hi, I am the wedding coordinator sending the COI and vendor details.",
  });

  assert.equal(result.leadStage, "ignored");
  assert.equal(result.responseDraft, "");
});
