import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

import { POST } from "@/app/api/webhooks/gmail/route";
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

test("gmail POST rejects requests without the agent webhook secret", async () => {
  const restore = withMockedAgentFindFirst(async () => ({
    id: "agent-1",
    webhookSecret: "expected-secret",
  }) as never);

  try {
    const request = new NextRequest("https://example.com/api/webhooks/gmail?agentId=agent-1", {
      method: "POST",
      body: JSON.stringify({ message: "hello" }),
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

test("gmail POST accepts the relay auth header and continues to payload validation", async () => {
  const restore = withMockedAgentFindFirst(async () => ({
    id: "agent-1",
    webhookSecret: "expected-secret",
  }) as never);

  try {
    const request = new NextRequest("https://example.com/api/webhooks/gmail?agentId=agent-1", {
      method: "POST",
      body: "not-json",
      headers: {
        "content-type": "application/json",
        "x-stafless-webhook-secret": "expected-secret",
      },
    });
    const response = await POST(request);

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "Invalid Gmail relay payload." });
  } finally {
    restore();
  }
});
