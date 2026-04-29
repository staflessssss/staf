import test from "node:test";
import assert from "node:assert/strict";

import { getDefaultControlConfig } from "@/lib/agent-config";
import {
  containsBusinessExceptionPhrase,
  getAutoResumeDueAt,
  getLatestCustomerReplyContext,
  shouldPauseAfterBusinessManualMessage,
} from "@/lib/business-handoff";

test("business handoff pauses only when enabled and not ignored", () => {
  const control = {
    ...getDefaultControlConfig(),
    pauseOnBusinessIntervention: true,
    ignoreFirstBusinessMessage: true,
    businessExceptionPhrases: ["FYI"],
  };

  assert.equal(
    shouldPauseAfterBusinessManualMessage({
      control,
      message: "Hello, I will help here.",
      priorBusinessManualMessageCount: 0,
    }),
    false,
  );
  assert.equal(
    shouldPauseAfterBusinessManualMessage({
      control,
      message: "Hello again.",
      priorBusinessManualMessageCount: 1,
    }),
    true,
  );
  assert.equal(
    shouldPauseAfterBusinessManualMessage({
      control,
      message: "FYI: adding context only.",
      priorBusinessManualMessageCount: 1,
    }),
    false,
  );
});

test("business handoff exception phrases are matched case-insensitively", () => {
  assert.equal(containsBusinessExceptionPhrase("Internal NOTE only", ["note only"]), true);
  assert.equal(containsBusinessExceptionPhrase("Taking over now", ["note only"]), false);
});

test("business auto-resume due date follows configured unit", () => {
  const base = new Date("2026-04-20T10:00:00.000Z");

  assert.equal(
    getAutoResumeDueAt(
      {
        ...getDefaultControlConfig(),
        autoResumeAfterValue: 3,
        autoResumeAfterUnit: "hours",
      },
      base,
    ).toISOString(),
    "2026-04-20T13:00:00.000Z",
  );
});

test("business reply context uses the latest customer message metadata", () => {
  assert.deepEqual(
    getLatestCustomerReplyContext(
      [
        {
          role: "USER",
          content: "older",
          toolInput: {
            messageId: "old-message",
            threadId: "old-thread",
            subject: "Old subject",
          },
        },
        {
          role: "TOOL",
          toolName: "business_manual_message",
          content: "manual business reply",
        },
        {
          role: "USER",
          content: "latest",
          toolInput: {
            messageId: "latest-message",
            gmailMessageId: "gmail-latest",
            threadId: "latest-thread",
            subject: "Latest subject",
          },
        },
      ],
      "customer@example.com",
    ),
    {
      contactId: "customer@example.com",
      messageId: "latest-message",
      gmailMessageId: "gmail-latest",
      threadId: "latest-thread",
      subject: "Latest subject",
    },
  );
});
