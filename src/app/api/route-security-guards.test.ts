import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { normalizeGoogleRedirectTo } from "@/lib/google-oauth";

const localBypassRoutes = [
  "src/app/api/webhooks/gmail/route.ts",
  "src/app/api/webhooks/telegram/route.ts",
  "src/app/api/webhooks/instagram/route.ts",
  "src/app/api/webhooks/telegram/handoff/route.ts",
  "src/app/api/cron/message-deliveries/route.ts",
];

test("local route auth bypasses are disabled in production", () => {
  for (const routePath of localBypassRoutes) {
    const source = readFileSync(resolve(process.cwd(), routePath), "utf8");

    assert.match(source, /process\.env\.NODE_ENV !== "production"/, routePath);
  }
});

test("Telegram owner handoff rejects unlinked chats and requires exact start tokens", () => {
  const route = readFileSync(
    resolve("src/app/api/webhooks/telegram/handoff/route.ts"),
    "utf8",
  );

  assert.match(route, /callback\.chatId !== linkedOwnerChatId/);
  assert.match(route, /message\.chatId !== linkedOwnerChatId/);
  assert.match(route, /!expectedStartToken/);
  assert.match(route, /linkedOwnerChatId && linkedOwnerChatId !== message\.chatId/);
});

test("Google OAuth redirects stay internal to the client app", () => {
  assert.equal(
    normalizeGoogleRedirectTo("/client/connections/gmail?connected=1"),
    "/client/connections/gmail?connected=1",
  );
  assert.equal(normalizeGoogleRedirectTo("https://attacker.example"), "/client/connections/gmail");
  assert.equal(normalizeGoogleRedirectTo("//attacker.example"), "/client/connections/gmail");
  assert.equal(normalizeGoogleRedirectTo("/\\attacker.example"), "/client/connections/gmail");
});

test("public and expensive API entry points use distributed rate limiting", () => {
  for (const routePath of [
    "src/app/api/auth/invite/accept/route.ts",
    "src/app/api/agent/invoke/route.ts",
    "src/app/api/client/agents/[agentId]/test-chat/route.ts",
    "src/app/api/webhooks/gmail/route.ts",
    "src/app/api/webhooks/gmail/pubsub/route.ts",
    "src/app/api/webhooks/instagram/route.ts",
    "src/app/api/webhooks/telegram/route.ts",
    "src/app/api/webhooks/telegram/handoff/route.ts",
  ]) {
    const source = readFileSync(resolve(routePath), "utf8");
    assert.match(source, /checkRateLimit\(/, routePath);
    assert.match(source, /rateLimitResponse\(/, routePath);
  }

  assert.match(
    readFileSync(resolve("src/lib/auth.ts"), "utf8"),
    /scope: "login"/,
  );
});
