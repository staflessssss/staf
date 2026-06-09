import assert from "node:assert/strict";
import test from "node:test";

import { extractInstagramDeliveryMessageIds } from "@/lib/instagram-outbound";

test("extractInstagramDeliveryMessageIds reads every split Instagram delivery id", () => {
  assert.deepEqual(
    extractInstagramDeliveryMessageIds([
      { recipient_id: "customer-1", message_id: "mid-1" },
      { recipient_id: "customer-1", message_id: "mid-2" },
      { recipient_id: "customer-1", message_id: "mid-2" },
    ]),
    ["mid-1", "mid-2"],
  );
});

test("extractInstagramDeliveryMessageIds preserves successful partial delivery ids", () => {
  assert.deepEqual(
    extractInstagramDeliveryMessageIds({
      ok: false,
      mode: "meta_partial_delivery",
      deliveries: [{ message_id: "mid-1" }],
    }),
    ["mid-1"],
  );
});

test("extractInstagramDeliveryMessageIds ignores unrelated delivery payloads", () => {
  assert.deepEqual(extractInstagramDeliveryMessageIds({ ok: true }), []);
});
