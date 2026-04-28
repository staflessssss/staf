import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

import { GET, POST } from "@/app/api/webhooks/instagram/route";
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
