import test, { afterEach } from "node:test";
import assert from "node:assert/strict";

import { instagramAdapter, parseInstagramCredentials } from "@/lib/channels/instagram";

const originalFetch = global.fetch;
const originalSetTimeout = global.setTimeout;

afterEach(() => {
  global.fetch = originalFetch;
  global.setTimeout = originalSetTimeout;
});

test("parseInstagramCredentials accepts JSON credentials", () => {
  assert.deepEqual(
    parseInstagramCredentials(
      JSON.stringify({
        accessToken: "ig-token",
        instagramUserAccessToken: "ig-token",
        igUserId: "ig-user",
        igScopedUserId: "ig-scoped-user",
        pageId: "page-1",
        igBusinessAccountId: "ig-1",
        graphApiVersion: "v22.0",
      }),
    ),
    {
      pageAccessToken: "ig-token",
      pageId: "page-1",
      igUserId: "ig-user",
      igScopedUserId: "ig-scoped-user",
      igBusinessAccountId: "ig-1",
      graphApiVersion: "v22.0",
    },
  );
});

test("instagram adapter preserves contact profile fields from webhook payload", () => {
  const parsed = instagramAdapter.parseIncoming({
    contactUsername: "smok1ngcrypto",
    contactDisplayName: "Smoking Crypto",
    entry: [
      {
        messaging: [
          {
            sender: { id: "2635163460242818" },
            message: { text: "Hello", mid: "mid-1" },
            timestamp: 1717600000000,
          },
        ],
      },
    ],
  });

  assert.equal(parsed.contactId, "2635163460242818");
  assert.equal(parsed.contactUsername, "smok1ngcrypto");
  assert.equal(parsed.contactDisplayName, "Smoking Crypto");
  assert.equal(parsed.message, "Hello");
});

test("instagram adapter can read contact profile fields from sender metadata", () => {
  const parsed = instagramAdapter.parseIncoming({
    entry: [
      {
        messaging: [
          {
            sender: {
              id: "2635163460242818",
              username: "smok1ngcrypto",
              name: "Smoking Crypto",
            },
            message: { text: "Hello", mid: "mid-1" },
          },
        ],
      },
    ],
  });

  assert.equal(parsed.contactId, "2635163460242818");
  assert.equal(parsed.contactUsername, "smok1ngcrypto");
  assert.equal(parsed.contactDisplayName, "Smoking Crypto");
});

test("instagram adapter sends plain text through Meta Graph API", async () => {
  let requestUrl = "";
  let requestBody: unknown = null;
  let authorization = "";

  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requestUrl = String(input);
    authorization = String((init?.headers as Record<string, string> | undefined)?.Authorization ?? "");
    requestBody = JSON.parse(String(init?.body ?? "{}"));

    return {
      ok: true,
      json: async () => ({ recipient_id: "ig-user-1", message_id: "mid-1" }),
    } as Response;
  }) as typeof fetch;

  const result = await instagramAdapter.sendReply({
    credentials: JSON.stringify({
      instagramUserAccessToken: "ig-token",
      pageId: "page-1",
      igUserId: "ig-user",
      igBusinessAccountId: "ig-1",
      graphApiVersion: "v22.0",
    }),
    contactId: "ig-user-1",
    message: { text: "Here is the pricing link: https://example.com/pricing", html: "<a>ignored</a>" },
  });

  assert.equal(requestUrl, "https://graph.instagram.com/v22.0/ig-user/messages");
  assert.equal(authorization, "Bearer ig-token");
  assert.deepEqual(requestBody, {
    recipient: {
      id: "ig-user-1",
    },
    messaging_type: "RESPONSE",
    message: {
      text: "Here is the pricing link: https://example.com/pricing",
    },
  });
  assert.deepEqual(result, { recipient_id: "ig-user-1", message_id: "mid-1" });
});

test("instagram adapter sends image attachments as separate Meta messages", async () => {
  const requestBodies: unknown[] = [];

  global.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    requestBodies.push(JSON.parse(String(init?.body ?? "{}")));

    return {
      ok: true,
      json: async () => ({ recipient_id: "ig-user-1", message_id: `mid-${requestBodies.length}` }),
    } as Response;
  }) as typeof fetch;

  const result = await instagramAdapter.sendReply({
    credentials: JSON.stringify({
      instagramUserAccessToken: "ig-token",
      igUserId: "ig-professional-account",
      graphApiVersion: "v25.0",
    }),
    contactId: "ig-user-1",
    message: "Here is the guide.",
    attachments: [
      {
        publicUrl: "https://drive.google.com/uc?export=download&id=file-1",
        fileName: "price.png",
        mimeType: "image/png",
      },
    ],
  });

  assert.deepEqual(requestBodies, [
    {
      recipient: {
        id: "ig-user-1",
      },
      messaging_type: "RESPONSE",
      message: {
        text: "Here is the guide.",
      },
    },
    {
      recipient: {
        id: "ig-user-1",
      },
      messaging_type: "RESPONSE",
      message: {
        attachment: {
          type: "image",
          payload: {
            url: "https://drive.google.com/uc?export=download&id=file-1",
          },
        },
      },
    },
  ]);
  assert.deepEqual(result, { recipient_id: "ig-user-1", message_id: "mid-1" });
});

test("instagram adapter uses Instagram Login igUserId as the sender account", async () => {
  let requestUrl = "";

  global.fetch = (async (input: RequestInfo | URL) => {
    requestUrl = String(input);

    return {
      ok: true,
      json: async () => ({ recipient_id: "ig-scoped-customer", message_id: "mid-1" }),
    } as Response;
  }) as typeof fetch;

  await instagramAdapter.sendReply({
    credentials: JSON.stringify({
      instagramUserAccessToken: "ig-token",
      igUserId: "ig-professional-account",
      igScopedUserId: "ig-scoped-app-user",
      graphApiVersion: "v25.0",
    }),
    contactId: "ig-scoped-customer",
    message: "Hello",
  });

  assert.equal(
    requestUrl,
    "https://graph.instagram.com/v25.0/ig-professional-account/messages",
  );
});

test("instagram adapter falls back to Facebook Graph Page messages without an IG account id", async () => {
  let requestUrl = "";

  global.fetch = (async (input: RequestInfo | URL) => {
    requestUrl = String(input);

    return {
      ok: true,
      json: async () => ({ recipient_id: "ig-user-1", message_id: "mid-1" }),
    } as Response;
  }) as typeof fetch;

  await instagramAdapter.sendReply({
    credentials: JSON.stringify({
      pageAccessToken: "page-token",
      pageId: "page-1",
      graphApiVersion: "v22.0",
    }),
    contactId: "ig-user-1",
    message: "Hello",
  });

  assert.equal(requestUrl, "https://graph.facebook.com/v22.0/page-1/messages");
});

test("instagram adapter returns partial-delivery metadata if a later split chunk fails", async () => {
  let callCount = 0;

  global.fetch = (async () => {
    callCount += 1;

    if (callCount === 1) {
      return {
        ok: true,
        json: async () => ({ recipient_id: "ig-user-1", message_id: "mid-1" }),
      } as Response;
    }

    return {
      ok: false,
      status: 500,
      json: async () => ({ error: { message: "Meta unavailable" } }),
    } as Response;
  }) as typeof fetch;

  const result = await instagramAdapter.sendReply({
    credentials: "page-token",
    contactId: "ig-user-1",
    message: ["First part", "Second part"],
  });

  assert.deepEqual(result, {
    ok: false,
    mode: "meta_partial_delivery",
    deliveredCount: 1,
    totalParts: 2,
    deliveries: [{ recipient_id: "ig-user-1", message_id: "mid-1" }],
    error: '{"message":"Meta unavailable"}',
  });
});

test("instagram adapter waits between split message parts when configured", async () => {
  const delays: number[] = [];

  global.fetch = (async () =>
    ({
      ok: true,
      json: async () => ({ recipient_id: "ig-user-1", message_id: "mid-1" }),
    }) as Response) as typeof fetch;
  global.setTimeout = ((handler: TimerHandler, timeout?: number) => {
    delays.push(Number(timeout ?? 0));

    if (typeof handler === "function") {
      handler();
    }

    return 0 as never;
  }) as unknown as typeof setTimeout;

  await instagramAdapter.sendReply({
    credentials: "page-token",
    contactId: "ig-user-1",
    message: ["First part", "Second part", "Third part"],
    channelConfig: {
      channelBehavior: {
        splitMessageDelaySeconds: 2,
      },
    },
  });

  assert.deepEqual(delays, [2000, 2000]);
});
