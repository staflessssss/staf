import assert from "node:assert/strict";
import test from "node:test";

import { leadQualificationTestHelpers } from "@/lib/lead-qualification";

test("qualified lead requires a booked booking-style tool result", () => {
  assert.equal(
    leadQualificationTestHelpers.isQualifiedLeadToolMessage({
      toolName: "Book consultation call",
      toolResult: {
        status: "booked",
        eventId: "evt_123",
      },
    }),
    true,
  );

  assert.equal(
    leadQualificationTestHelpers.isQualifiedLeadToolMessage({
      toolName: "Check consultation calendar",
      toolResult: {
        status: "available",
      },
    }),
    false,
  );
});
