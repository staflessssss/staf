import test, { afterEach } from "node:test";
import assert from "node:assert/strict";

import { telegramAdapter } from "@/lib/channels/telegram";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
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
