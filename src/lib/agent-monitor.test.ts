import assert from "node:assert/strict";
import test from "node:test";

import { alertOnUnansweredMonitorThreadsWithDb } from "@/lib/agent-monitor";

const NOW = new Date("2026-07-10T12:05:00.000Z");

function createMonitorDatabase(args?: { assistantReply?: boolean }) {
  const updateCalls: unknown[] = [];
  const thread = {
    id: "thread-1",
    conversationId: "conversation-1",
    telegramChatId: "monitor-chat",
    latestInboundMessageId: "9001",
    latestInboundSourceMessageId: "inbound-1",
    latestInboundAt: new Date("2026-07-10T12:00:00.000Z"),
    responseAlertedAt: null,
    conversation: {
      id: "conversation-1",
      status: "ACTIVE",
      agent: { status: "ACTIVE" },
    },
  };

  const database = {
    agentMonitorThread: {
      findMany: async () => [thread],
      findUnique: async () => ({
        conversationId: "conversation-1",
        telegramChatId: "monitor-chat",
        latestInboundMessageId: "9001",
      }),
      updateMany: async (input: unknown) => {
        updateCalls.push(input);
        return { count: 1 };
      },
    },
    conversation: {
      findUnique: async () => ({
        id: "conversation-1",
        channel: "INSTAGRAM",
        contactId: "customer-1",
        contactUsername: "customer",
        contactDisplayName: "Customer",
        agent: {
          id: "agent-1",
          name: "Myndful Instagram Agent",
          tenant: { id: "tenant-1", name: "MYNDFUL Films" },
        },
      }),
    },
    message: {
      findFirst: async () => (args?.assistantReply ? { id: "assistant-1" } : null),
    },
    delayedDelivery: {
      findFirst: async () => null,
    },
  };

  return { database, updateCalls };
}

async function withMonitorEnvironment(run: (payloads: unknown[]) => Promise<void>) {
  const originalFetch = globalThis.fetch;
  const originalToken = process.env.AGENT_MONITOR_TELEGRAM_BOT_TOKEN;
  const originalChatId = process.env.AGENT_MONITOR_TELEGRAM_CHAT_ID;
  const payloads: unknown[] = [];
  process.env.AGENT_MONITOR_TELEGRAM_BOT_TOKEN = "test-token";
  process.env.AGENT_MONITOR_TELEGRAM_CHAT_ID = "monitor-chat";
  globalThis.fetch = (async (_input, init) => {
    payloads.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify({ ok: true, result: { message_id: 9002 } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    await run(payloads);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.AGENT_MONITOR_TELEGRAM_BOT_TOKEN;
    else process.env.AGENT_MONITOR_TELEGRAM_BOT_TOKEN = originalToken;
    if (originalChatId === undefined) delete process.env.AGENT_MONITOR_TELEGRAM_CHAT_ID;
    else process.env.AGENT_MONITOR_TELEGRAM_CHAT_ID = originalChatId;
  }
}

test("alerts once when a monitored inbound has no reply after the response window", async () => {
  const { database, updateCalls } = createMonitorDatabase();

  await withMonitorEnvironment(async (payloads) => {
    const result = await alertOnUnansweredMonitorThreadsWithDb({
      database: database as never,
      now: NOW,
    });

    assert.deepEqual(result, { scanned: 1, alerted: 1 });
    assert.equal(payloads.length, 1);
    assert.match(JSON.stringify(payloads[0]), /Needs attention: no reply/);
    assert.equal(updateCalls.length, 1);
  });
});

test("does not alert when the monitored inbound already has an assistant reply", async () => {
  const { database, updateCalls } = createMonitorDatabase({ assistantReply: true });

  await withMonitorEnvironment(async (payloads) => {
    const result = await alertOnUnansweredMonitorThreadsWithDb({
      database: database as never,
      now: NOW,
    });

    assert.deepEqual(result, { scanned: 1, alerted: 0 });
    assert.equal(payloads.length, 0);
    assert.equal(updateCalls.length, 0);
  });
});
