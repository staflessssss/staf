import test, { afterEach } from "node:test";
import assert from "node:assert/strict";

import { instagramAdapter, parseInstagramCredentials } from "@/lib/channels/instagram";

const originalFetch = global.fetch;
const originalSetTimeout = global.setTimeout;
const originalDisableSemanticDeliveryPlan = process.env.DISABLE_INSTAGRAM_SEMANTIC_DELIVERY_PLAN;

afterEach(() => {
  global.fetch = originalFetch;
  global.setTimeout = originalSetTimeout;
  if (originalDisableSemanticDeliveryPlan === undefined) {
    delete process.env.DISABLE_INSTAGRAM_SEMANTIC_DELIVERY_PLAN;
  } else {
    process.env.DISABLE_INSTAGRAM_SEMANTIC_DELIVERY_PLAN = originalDisableSemanticDeliveryPlan;
  }
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

test("instagram adapter routes business echoes to the customer conversation as manual replies", () => {
  const parsed = instagramAdapter.parseIncoming({
    contactId: "customer-1",
    fromBusiness: true,
    entry: [
      {
        messaging: [
          {
            sender: { id: "business-1" },
            recipient: { id: "customer-1" },
            message: { text: "The additional hour is already paid.", mid: "mid-owner-1" },
          },
        ],
      },
    ],
  });

  assert.equal(parsed.contactId, "customer-1");
  assert.equal(parsed.isBusinessManualReply, true);
  assert.equal(parsed.message, "The additional hour is already paid.");
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
  assert.deepEqual(result, [
    { recipient_id: "ig-user-1", message_id: "mid-1" },
    { recipient_id: "ig-user-1", message_id: "mid-2" },
  ]);
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

test("instagram adapter executes semantic delivery plan with sender actions and content parts", async () => {
  const requestBodies: unknown[] = [];
  const delays: number[] = [];

  global.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}"));
    requestBodies.push(body);

    return {
      ok: true,
      json: async () =>
        "message" in body
          ? { recipient_id: "ig-user-1", message_id: `mid-${requestBodies.length}` }
          : { recipient_id: "ig-user-1" },
    } as Response;
  }) as typeof fetch;
  global.setTimeout = ((handler: TimerHandler, timeout?: number) => {
    delays.push(Number(timeout ?? 0));

    if (typeof handler === "function") {
      handler();
    }

    return 0 as never;
  }) as unknown as typeof setTimeout;

  const result = await instagramAdapter.sendReply({
    credentials: JSON.stringify({
      instagramUserAccessToken: "ig-token",
      igUserId: "ig-professional-account",
      graphApiVersion: "v25.0",
    }),
    contactId: "ig-user-1",
    message: "Canonical should not send",
    channelDeliveryPlan: {
      channel: "instagram",
      enabled: true,
      mode: "semantic_split",
      textPartCount: 3,
      totalDelayMs: 10_000,
      guardResult: { ok: true },
      parts: [
        {
          kind: "sender_action",
          action: "mark_seen",
          reason: "read_receipt",
          delayMsBefore: 500,
        },
        {
          kind: "text",
          reason: "greeting_availability",
          text: "Greeting and availability",
          delayMsBefore: 0,
          typingMsBefore: 2_000,
        },
        {
          kind: "text",
          reason: "pricing",
          text: "Pricing",
          delayMsBefore: 2_000,
          typingMsBefore: 2_000,
        },
        {
          kind: "attachment",
          reason: "pricing_guide",
          delayMsBefore: 1_000,
          attachment: {
            type: "image",
            url: "https://example.com/guide.png",
            label: "guide.png",
            purpose: "pricing_guide",
          },
        },
        {
          kind: "text",
          reason: "team_qualification_question",
          text: "Team and names question",
          delayMsBefore: 500,
          typingMsBefore: 2_000,
        },
      ],
    },
  });

  assert.deepEqual(
    requestBodies.map((body) =>
      typeof body === "object" && body && "sender_action" in body
        ? (body as { sender_action: string }).sender_action
        : (body as { message?: { text?: string; attachment?: unknown } }).message?.text ?? "attachment",
    ),
    [
      "mark_seen",
      "typing_on",
      "Greeting and availability",
      "typing_on",
      "Pricing",
      "attachment",
      "typing_on",
      "Team and names question",
    ],
  );
  assert.ok(delays.reduce((total, delay) => total + delay, 0) <= 6_000);
  assert.deepEqual(result, {
    ok: true,
    mode: "instagram_semantic_delivery_plan",
    deliveries: [
      { recipient_id: "ig-user-1", message_id: "mid-3" },
      { recipient_id: "ig-user-1", message_id: "mid-5" },
      { recipient_id: "ig-user-1", message_id: "mid-6" },
      { recipient_id: "ig-user-1", message_id: "mid-8" },
    ],
    deliveryExecution: {
      enabled: true,
      executed: true,
      partsAttempted: 5,
      partsSent: 4,
      senderActionsAttempted: 4,
      senderActionsFailed: 0,
      fallbackToCanonical: false,
      plannedTotalDelayMs: 10_000,
      appliedTotalDelayMs: 6_000,
      maxTotalDelayMs: 6_000,
    },
  });
});

test("instagram adapter ignores semantic delivery plan when kill switch is enabled", async () => {
  const requestBodies: unknown[] = [];
  process.env.DISABLE_INSTAGRAM_SEMANTIC_DELIVERY_PLAN = "true";

  global.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    requestBodies.push(JSON.parse(String(init?.body ?? "{}")));

    return {
      ok: true,
      json: async () => ({ recipient_id: "ig-user-1", message_id: "mid-1" }),
    } as Response;
  }) as typeof fetch;

  await instagramAdapter.sendReply({
    credentials: "page-token",
    contactId: "ig-user-1",
    message: "Canonical",
    channelDeliveryPlan: {
      channel: "instagram",
      enabled: true,
      mode: "semantic_split",
      textPartCount: 1,
      totalDelayMs: 0,
      guardResult: { ok: true },
      parts: [
        {
          kind: "text",
          reason: "single_reply",
          text: "Semantic",
          delayMsBefore: 0,
          typingMsBefore: 0,
        },
      ],
    },
  });

  assert.deepEqual(requestBodies, [
    {
      recipient: {
        id: "ig-user-1",
      },
      messaging_type: "RESPONSE",
      message: {
        text: "Canonical",
      },
    },
  ]);
});
