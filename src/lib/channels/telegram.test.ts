import test, { afterEach } from "node:test";
import assert from "node:assert/strict";

import { registerTelegramWebhook, telegramAdapter } from "@/lib/channels/telegram";

const originalFetch = global.fetch;
const originalSetTimeout = global.setTimeout;

afterEach(() => {
  global.fetch = originalFetch;
  global.setTimeout = originalSetTimeout;
});

test("telegram adapter returns partial-delivery metadata if a later split chunk fails", async () => {
  let callCount = 0;

  global.fetch = (async () => {
    callCount += 1;

    if (callCount === 1) {
      return {
        ok: true,
        json: async () => ({ ok: true, result: { message_id: 1 } }),
      } as Response;
    }

    return {
      ok: false,
      status: 500,
      json: async () => ({ ok: false }),
    } as Response;
  }) as typeof fetch;

  const result = await telegramAdapter.sendReply({
    credentials: "bot-token",
    contactId: "12345",
    message: ["First part", "Second part"],
  });

  assert.deepEqual(result, {
    ok: false,
    mode: "telegram_partial_delivery",
    deliveredCount: 1,
    totalParts: 2,
    deliveries: [{ ok: true, result: { message_id: 1 } }],
    error: "Telegram send failed with 500.",
  });
});

test("telegram adapter still throws if the first delivery attempt fails", async () => {
  global.fetch = (async () =>
    ({
      ok: false,
      status: 500,
      json: async () => ({ ok: false }),
    }) as Response) as typeof fetch;

  await assert.rejects(
    telegramAdapter.sendReply({
      credentials: "bot-token",
      contactId: "12345",
      message: ["First part", "Second part"],
    }),
    /Telegram send failed with 500\./,
  );
});

test("telegram adapter waits between split message parts when configured", async () => {
  const delays: number[] = [];

  global.fetch = (async () =>
    ({
      ok: true,
      json: async () => ({ ok: true, result: { message_id: 1 } }),
    }) as Response) as typeof fetch;
  global.setTimeout = ((handler: TimerHandler, timeout?: number) => {
    delays.push(Number(timeout ?? 0));

    if (typeof handler === "function") {
      handler();
    }

    return 0 as never;
  }) as unknown as typeof setTimeout;

  await telegramAdapter.sendReply({
    credentials: "bot-token",
    contactId: "12345",
    message: ["First part", "Second part", "Third part"],
    channelConfig: {
      channelBehavior: {
        splitMessageDelaySeconds: 2,
      },
    },
  });

  assert.deepEqual(delays, [2000, 2000]);
});

test("telegram adapter sends inline keyboard markup on the last message part", async () => {
  const requestBodies: Array<Record<string, unknown>> = [];

  global.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    requestBodies.push(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>);

    return {
      ok: true,
      json: async () => ({ ok: true, result: { message_id: requestBodies.length } }),
    } as Response;
  }) as typeof fetch;

  await telegramAdapter.sendReply({
    credentials: "bot-token",
    contactId: "12345",
    message: ["First part", "Second part"],
    replyMarkup: {
      inline_keyboard: [[{ text: "Resume agent", callback_data: "oh:resume:conversation-1" }]],
    },
  });

  assert.equal(requestBodies[0]?.reply_markup, undefined);
  assert.deepEqual(requestBodies[1]?.reply_markup, {
    inline_keyboard: [[{ text: "Resume agent", callback_data: "oh:resume:conversation-1" }]],
  });
});

test("telegram webhook registration subscribes to button callbacks", async () => {
  const requestBodies: Array<Record<string, unknown>> = [];

  global.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    requestBodies.push(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>);

    return {
      ok: true,
      json: async () => ({ ok: true, result: true }),
    } as Response;
  }) as typeof fetch;

  await registerTelegramWebhook({
    credentials: "bot-token",
    webhookUrl: "https://behalfy.io/api/webhooks/telegram/handoff?tenantId=tenant-1",
    secretToken: "secret",
  });

  const requestBody = requestBodies[0];

  assert.ok(requestBody);
  assert.deepEqual(requestBody.allowed_updates, ["message", "edited_message", "callback_query"]);
});
