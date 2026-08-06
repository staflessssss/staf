import assert from "node:assert/strict";
import test from "node:test";

import { isConversationManualOnly } from "@/lib/conversation-control";

test("manual-only conversation control is explicit and defaults off", () => {
  assert.equal(isConversationManualOnly({ manualOnly: true }), true);
  assert.equal(isConversationManualOnly({ manualOnly: false }), false);
  assert.equal(isConversationManualOnly(null), false);
});
