import test from "node:test";
import assert from "node:assert/strict";

import { getDefaultControlConfig } from "@/lib/agent-config";
import {
  containsOperatorExceptionPhrase,
  getAutoResumeDueAt,
  getLatestCustomerReplyContext,
  shouldPauseAfterOperatorMessage,
} from "@/lib/operator-handoff";

test("operator handoff pauses only when enabled and not ignored", () => {
  const control = {
    ...getDefaultControlConfig(),
    pauseOnOperatorIntervention: true,
    ignoreFirstOperatorMessage: true,
    operatorExceptionPhrases: ["FYI"],
  };

  assert.equal(
    shouldPauseAfterOperatorMessage({
      control,
      message: "Hello, I will help here.",
      priorOperatorMessageCount: 0,
    }),
    false,
  );
  assert.equal(
    shouldPauseAfterOperatorMessage({
      control,
      message: "Hello again.",
      priorOperatorMessageCount: 1,
    }),
    true,
  );
  assert.equal(
    shouldPauseAfterOperatorMessage({
      control,
      message: "FYI: adding context only.",
      priorOperatorMessageCount: 1,
    }),
    false,
  );
});

test("operator handoff exception phrases are matched case-insensitively", () => {
  assert.equal(containsOperatorExceptionPhrase("Internal NOTE only", ["note only"]), true);
  assert.equal(containsOperatorExceptionPhrase("Taking over now", ["note only"]), false);
});

test("operator auto-resume due date follows configured unit", () => {
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

test("operator reply context uses the latest customer message metadata", () => {
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
          toolName: "operator_message",
          content: "operator reply",
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
