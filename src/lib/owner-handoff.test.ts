import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  mergeOwnerHandoffMetadata,
  ownerHandoffTestHelpers,
  readOwnerHandoffChatId,
  readOwnerHandoffStartToken,
  shouldRequestOwnerHandoff,
  updateOwnerHandoffChatMetadata,
} from "@/lib/owner-handoff";

describe("owner handoff trigger", () => {
  it("requests owner help for operational questions the agent should not answer", () => {
    const examples = [
      "Did my parents manage to pay the operators for the additional hour?",
      "Can you send the insurance certificate to our planner?",
      "Has the deposit already been paid?",
      "Do you know if the videographer has dietary restrictions?",
    ];

    for (const message of examples) {
      assert.equal(
        shouldRequestOwnerHandoff(message)?.reason,
        "operational_or_existing_client_question",
      );
    }
  });

  it("does not interrupt normal sales qualification", () => {
    const examples = [
      "Hi, I am Olivia. We are getting married June 14 in Charlotte.",
      "My fiance is Daniel and the venue is Evergreen Park.",
      "Tomorrow at 11am works for a call.",
      "What is your editing timeline?",
      "Do you carry insurance?",
      "What films are included?",
    ];

    for (const message of examples) {
      assert.equal(shouldRequestOwnerHandoff(message), null);
    }
  });
});

describe("owner handoff metadata", () => {
  it("fails closed when owner chat or start token is missing", () => {
    assert.equal(readOwnerHandoffChatId(null), "");
    assert.equal(readOwnerHandoffStartToken(null), "");
  });

  it("reads the linked owner chat", () => {
    assert.equal(
      readOwnerHandoffChatId({
        ownerHandoff: {
          ownerChatId: "12345",
        },
      }),
      "12345",
    );
  });

  it("consumes the start token after linking an owner chat", () => {
    const metadata = updateOwnerHandoffChatMetadata({
      metadata: {
        ownerHandoff: {
          startToken: "single-use-token",
        },
      },
      ownerChatId: "12345",
    });

    assert.equal(
      (metadata.ownerHandoff as Record<string, unknown>).startToken,
      null,
    );
  });

  it("preserves an already linked owner chat and start token when reconnecting the bot", () => {
    const metadata = mergeOwnerHandoffMetadata({
      metadata: {
        ownerHandoff: {
          enabled: true,
          ownerChatId: "12345",
          startToken: "existing-token",
        },
      },
      webhookSecret: "new-secret",
      webhookUrl: "https://behalfy.io/api/webhooks/telegram/handoff?tenantId=tenant-1",
      startToken: "new-token",
    });

    assert.deepEqual(
      (metadata.ownerHandoff as Record<string, unknown>).ownerChatId,
      "12345",
    );
    assert.deepEqual(
      (metadata.ownerHandoff as Record<string, unknown>).startToken,
      "existing-token",
    );
    assert.deepEqual(
      (metadata.ownerHandoff as Record<string, unknown>).webhookSecret,
      "new-secret",
    );
  });
});

describe("owner handoff Telegram delivery", () => {
  it("reads the Telegram message id from sendMessage responses", () => {
    assert.equal(
      ownerHandoffTestHelpers.extractTelegramDeliveryMessageId({
        ok: true,
        result: {
          message_id: 12345,
        },
      }),
      "12345",
    );
  });
});
