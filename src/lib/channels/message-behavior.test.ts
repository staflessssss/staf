import test from "node:test";
import assert from "node:assert/strict";

import { messageBehaviorTestHelpers } from "@/lib/channels/message-behavior";

test("splitOutgoingMessage keeps a single message by default", () => {
  const result = messageBehaviorTestHelpers.splitOutgoingMessage("Hello\n\nWorld", {});

  assert.equal(result, "Hello\n\nWorld");
});

test("splitOutgoingMessage splits paragraph-delimited chat replies when configured", () => {
  const result = messageBehaviorTestHelpers.splitOutgoingMessage(
    "Hello there\n\nHere is the second part\n\nAnd a third part",
    {
      channelBehavior: {
        messageFormat: "split_into_2_3_messages",
        bufferDelaySeconds: 0,
        followUpEnabled: false,
        followUpRules: [],
      },
    },
  );

  assert.deepEqual(result, ["Hello there", "Here is the second part", "And a third part"]);
});

test("splitOutgoingMessage preserves all content by merging overflow into the final chunk", () => {
  const result = messageBehaviorTestHelpers.splitOutgoingMessage(
    "One\n\nTwo\n\nThree\n\nFour",
    {
      channelBehavior: {
        messageFormat: "split_into_2_3_messages",
        bufferDelaySeconds: 0,
        followUpEnabled: false,
        followUpRules: [],
      },
    },
  );

  assert.deepEqual(result, ["One", "Two", "Three\n\nFour"]);
});

test("readMessageBehaviorConfig reads attachment permission from channel behavior", () => {
  const result = messageBehaviorTestHelpers.readMessageBehaviorConfig({
    channelBehavior: {
      allowAttachments: true,
      messageFormat: "single_message",
      bufferDelaySeconds: 3,
      followUpEnabled: true,
      followUpRules: [
        {
          delayDays: 0,
          delayHours: 4,
          delayMinutes: 0,
          sendLimit: "once_per_dialog",
          outOfHoursBehavior: "send_immediately_ignore_schedule",
          instruction: "Still happy to help if you want to continue.",
        },
      ],
    },
  });

  assert.equal(result.allowAttachments, true);
  assert.equal(result.messageFormat, "single_message");
  assert.equal(result.bufferDelaySeconds, 3);
  assert.equal(result.followUpEnabled, true);
  assert.equal(result.followUpRules.length, 1);
});
