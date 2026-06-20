import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { NextRequest } from "next/server";

import { GET, POST } from "@/app/api/webhooks/instagram/route";
import { db } from "@/lib/db";
import { splitInstagramMessagingPayloads } from "@/lib/instagram-webhook";

type AgentFindFirst = typeof db.agent.findFirst;
type ChannelConnectionFindMany = typeof db.channelConnection.findMany;

function withMockedAgentFindFirst(mock: () => Promise<unknown>) {
  const delegate = db.agent as unknown as { findFirst: AgentFindFirst };
  const original = delegate.findFirst;
  delegate.findFirst = mock as unknown as AgentFindFirst;

  return () => {
    delegate.findFirst = original;
  };
}

function withMockedChannelConnectionFindMany(mock: () => Promise<unknown>) {
  const delegate = db.channelConnection as unknown as { findMany: ChannelConnectionFindMany };
  const original = delegate.findMany;
  delegate.findMany = mock as unknown as ChannelConnectionFindMany;

  return () => {
    delegate.findMany = original;
  };
}

function signInstagramPayload(body: string, secret: string) {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

test("instagram GET accepts subscription challenge only for the matching agent secret", async () => {
  const restore = withMockedAgentFindFirst(async () => ({
    id: "agent-1",
    webhookSecret: "verify-me",
  }) as never);

  try {
    const request = new NextRequest(
      "https://example.com/api/webhooks/instagram?agentId=agent-1&hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=12345",
    );
    const response = await GET(request);

    assert.equal(response.status, 200);
    assert.equal(await response.text(), "12345");
  } finally {
    restore();
  }
});

test("instagram POST rejects unsigned production requests", async () => {
  const restore = withMockedAgentFindFirst(async () => ({
    id: "agent-1",
    webhookSecret: "verify-me",
  }) as never);

  try {
    const request = new NextRequest("https://example.com/api/webhooks/instagram?agentId=agent-1", {
      method: "POST",
      body: JSON.stringify({ entry: [] }),
      headers: {
        "content-type": "application/json",
      },
    });
    const response = await POST(request);

    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: "Forbidden" });
  } finally {
    restore();
  }
});

test("instagram POST rejects oversized payloads before signature processing", async () => {
  const request = new NextRequest("https://example.com/api/webhooks/instagram", {
    method: "POST",
    body: "{}",
    headers: {
      "content-length": "1000001",
      "content-type": "application/json",
    },
  });
  const response = await POST(request);

  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), { error: "Payload too large." });
});

test("instagram POST does not let agentId override recipient routing", async () => {
  const originalSecret = process.env.INSTAGRAM_APP_SECRET;
  process.env.INSTAGRAM_APP_SECRET = "test-instagram-secret";
  const restoreAgent = withMockedAgentFindFirst(async () => {
    throw new Error("agentId query should not be used for Instagram POST routing");
  });
  const restoreChannels = withMockedChannelConnectionFindMany(async () => []);
  const body = JSON.stringify({
    entry: [
      {
        messaging: [
          {
            sender: { id: "ig-contact-1" },
            recipient: { id: "ig-recipient-1" },
            message: { text: "Hello", mid: "mid-1" },
          },
        ],
      },
    ],
  });

  try {
    const request = new NextRequest(
      "https://example.com/api/webhooks/instagram?agentId=wrong-agent",
      {
        method: "POST",
        body,
        headers: {
          "content-type": "application/json",
          "x-hub-signature-256": signInstagramPayload(body, "test-instagram-secret"),
        },
      },
    );
    const response = await POST(request);

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: "Agent not found." });
  } finally {
    restoreChannels();
    restoreAgent();
    if (originalSecret === undefined) {
      delete process.env.INSTAGRAM_APP_SECRET;
    } else {
      process.env.INSTAGRAM_APP_SECRET = originalSecret;
    }
  }
});

test("instagram webhook splits batched messaging events into single-event payloads", () => {
  const payload = {
    object: "instagram",
    entry: [
      {
        id: "ig-account-1",
        messaging: [
          {
            sender: { id: "contact-1" },
            recipient: { id: "ig-account-1" },
            message: { text: "First", mid: "mid-1" },
          },
          {
            sender: { id: "contact-2" },
            recipient: { id: "ig-account-1" },
            message: { text: "Second", mid: "mid-2" },
          },
        ],
      },
    ],
  };

  const payloads = splitInstagramMessagingPayloads(payload) as Array<{
    entry: Array<{ messaging: Array<{ message: { mid: string } }> }>;
  }>;

  assert.equal(payloads.length, 2);
  assert.equal(payloads[0].entry[0].messaging.length, 1);
  assert.equal(payloads[0].entry[0].messaging[0].message.mid, "mid-1");
  assert.equal(payloads[1].entry[0].messaging.length, 1);
  assert.equal(payloads[1].entry[0].messaging[0].message.mid, "mid-2");
});

test("instagram webhook signature can use the shared Meta app secret", () => {
  const source = readFileSync(
    "src/app/api/webhooks/instagram/route.ts",
    "utf8",
  );

  assert.match(source, /INSTAGRAM_APP_SECRET/);
  assert.match(source, /META_APP_SECRET/);
});

test("instagram webhook marks unknown business message echoes as system echoes", () => {
  const source = readFileSync(
    "src/app/api/webhooks/instagram/route.ts",
    "utf8",
  );

  assert.match(source, /findInstagramChannelByAccountId/);
  assert.match(source, /isKnownInstagramOutboundEcho/);
  assert.match(source, /isOwnInstagramAppEcho/);
  assert.match(source, /waitForKnownInstagramOutboundEcho/);
  assert.match(source, /setTimeout\(resolve, 150\)/);
  assert.match(source, /INSTAGRAM_OUTBOUND_DELIVERY_TOOL_NAME/);
  assert.match(source, /path: \["messageId"\]/);
  assert.match(source, /extractInstagramMessageText/);
  assert.match(source, /isRecentAssistantTextEcho/);
  assert.match(source, /contains: text/);
  assert.match(source, /ignored_known_outbound_echo/);
  assert.match(source, /isBusinessManualReply: true/);
  assert.match(source, /businessReplyKind: "system_echo"/);
  assert.match(source, /fromBusiness: true/);
  assert.doesNotMatch(source, /single active Instagram agent fallback/);
});

test("instagram webhook routes paused-agent messages to runtime for persistence", () => {
  const source = readFileSync(
    "src/app/api/webhooks/instagram/route.ts",
    "utf8",
  );

  assert.match(source, /in: \["ACTIVE", "PAUSED"\]/);
  assert.doesNotMatch(source, /ignored_agent_paused/);
});
