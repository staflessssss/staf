import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

import { POST } from "@/app/api/webhooks/telegram/route";
import { db } from "@/lib/db";

type AgentFindFirst = typeof db.agent.findFirst;

function withMockedAgentFindFirst(mock: () => Promise<unknown>) {
  const delegate = db.agent as unknown as { findFirst: AgentFindFirst };
  const original = delegate.findFirst;
  delegate.findFirst = mock as unknown as AgentFindFirst;

  return () => {
    delegate.findFirst = original;
  };
}

test("telegram POST fails closed when an active agent is missing a webhook secret", async () => {
  const restore = withMockedAgentFindFirst(async () => ({
    id: "agent-1",
    webhookSecret: null,
  }) as never);

  try {
    const request = new NextRequest("https://example.com/api/webhooks/telegram?agentId=agent-1", {
      method: "POST",
      body: JSON.stringify({ message: { text: "hello" } }),
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

test("telegram POST rejects a mismatched webhook secret", async () => {
  const restore = withMockedAgentFindFirst(async () => ({
    id: "agent-1",
    webhookSecret: "expected-secret",
  }) as never);

  try {
    const request = new NextRequest("https://example.com/api/webhooks/telegram?agentId=agent-1", {
      method: "POST",
      body: JSON.stringify({ message: { text: "hello" } }),
      headers: {
        "content-type": "application/json",
        "x-telegram-bot-api-secret-token": "wrong-secret",
      },
    });
    const response = await POST(request);

    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: "Forbidden" });
  } finally {
    restore();
  }
});
