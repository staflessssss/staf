import assert from "node:assert/strict";
import test from "node:test";

import { aiRuntimeTestHelpers } from "@/lib/ai-runtime";

test("imports earlier Instagram text and attachment context in chronological order", () => {
  const result = aiRuntimeTestHelpers.classifyInstagramPriorMessages({
    contactId: "customer-1",
    currentMessageId: "current-message",
    eventTimestamp: new Date("2026-07-15T14:33:01.000Z"),
    messages: [
      {
        id: "later-business-reply",
        from: { id: "business-1" },
        created_time: "2026-07-15T14:34:00.000Z",
        message: "A manual reply sent after the inbound.",
      },
      {
        id: "current-message",
        from: { id: "customer-1" },
        created_time: "2026-07-15T14:33:01.000Z",
        message: "Can I get more info on this?",
      },
      {
        id: "guide-image",
        from: { id: "business-1" },
        created_time: "2026-04-04T19:23:33.000Z",
        message: "",
        attachments: { data: [{ image_data: {} }] },
      },
      {
        id: "wedding-details",
        from: { id: "customer-1" },
        created_time: "2026-04-04T19:00:46.000Z",
        message: "The Savannah Country Club 11/14/2026",
      },
      {
        id: "empty-event",
        from: { id: "customer-1" },
        created_time: "2026-04-04T19:00:20.000Z",
        message: "",
      },
    ],
  });

  assert.equal(result.priorMessages.length, 2);
  assert.deepEqual(
    result.priorMessages.map((message) => message.messageId),
    ["wedding-details", "guide-image"],
  );
  assert.equal(result.priorMessages[0]?.role, "USER");
  assert.equal(result.priorMessages[1]?.role, "ASSISTANT");
  assert.equal(result.priorMessages[1]?.attachmentCount, 1);
  assert.match(result.priorMessages[1]?.content ?? "", /already delivered/);
});

test("ignores only Instagram events older than the agent deployment", () => {
  const deployedAt = new Date("2026-07-09T20:29:02.713Z");

  assert.equal(
    aiRuntimeTestHelpers.isInstagramEventBeforeAgentDeployment({
      deployedAt,
      eventTimestamp: new Date("2026-04-04T19:00:21.000Z"),
    }),
    true,
  );
  assert.equal(
    aiRuntimeTestHelpers.isInstagramEventBeforeAgentDeployment({
      deployedAt,
      eventTimestamp: new Date("2026-07-15T14:33:01.000Z"),
    }),
    false,
  );
  assert.equal(
    aiRuntimeTestHelpers.isInstagramEventBeforeAgentDeployment({ deployedAt }),
    false,
  );
});
