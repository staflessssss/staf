import assert from "node:assert/strict";
import test from "node:test";

import { assertPubSubWebhookSecret, gmailWatchTestHelpers } from "@/lib/gmail-watch";

const now = new Date("2026-06-06T00:00:00.000Z");

test("Gmail watch renewal is due when the watch already expired", () => {
  assert.equal(
    gmailWatchTestHelpers.shouldRenewGmailWatch(
      {
        gmailWatch: {
          expiration: String(Date.parse("2026-06-05T23:00:00.000Z")),
        },
      },
      now,
    ),
    true,
  );
});

test("Gmail watch renewal is skipped while the watch is still fresh", () => {
  assert.equal(
    gmailWatchTestHelpers.shouldRenewGmailWatch(
      {
        gmailWatch: {
          expiration: String(Date.parse("2026-06-08T00:00:00.000Z")),
        },
      },
      now,
    ),
    false,
  );
});

test("Gmail watch renewal backs off after a recent attempt", () => {
  assert.equal(
    gmailWatchTestHelpers.shouldRenewGmailWatch(
      {
        gmailWatch: {
          expiration: String(Date.parse("2026-06-05T23:00:00.000Z")),
          lastRenewalAttemptAt: "2026-06-05T23:30:00.000Z",
        },
      },
      now,
    ),
    false,
  );
});

test("Gmail Pub/Sub webhook secret fails closed when not configured", () => {
  const originalSecret = process.env.GMAIL_PUBSUB_WEBHOOK_SECRET;

  try {
    delete process.env.GMAIL_PUBSUB_WEBHOOK_SECRET;

    assert.equal(assertPubSubWebhookSecret("attacker-token"), false);
    assert.equal(assertPubSubWebhookSecret(null), false);
  } finally {
    if (originalSecret === undefined) {
      delete process.env.GMAIL_PUBSUB_WEBHOOK_SECRET;
    } else {
      process.env.GMAIL_PUBSUB_WEBHOOK_SECRET = originalSecret;
    }
  }
});

test("Gmail Pub/Sub webhook secret accepts only the configured token", () => {
  const originalSecret = process.env.GMAIL_PUBSUB_WEBHOOK_SECRET;

  try {
    process.env.GMAIL_PUBSUB_WEBHOOK_SECRET = "expected-secret";

    assert.equal(assertPubSubWebhookSecret("expected-secret"), true);
    assert.equal(assertPubSubWebhookSecret("wrong-secret"), false);
  } finally {
    if (originalSecret === undefined) {
      delete process.env.GMAIL_PUBSUB_WEBHOOK_SECRET;
    } else {
      process.env.GMAIL_PUBSUB_WEBHOOK_SECRET = originalSecret;
    }
  }
});
