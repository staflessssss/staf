import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { normalizeInstagramRedirectTo } from "@/lib/instagram-oauth";

const connectRoutePath = resolve(process.cwd(), "src/app/api/instagram/connect/route.ts");
const callbackRoutePath = resolve(process.cwd(), "src/app/api/instagram/callback/route.ts");
const oauthLibPath = resolve(process.cwd(), "src/lib/instagram-oauth.ts");
const webhookRoutePath = resolve(process.cwd(), "src/app/api/webhooks/instagram/route.ts");
const launchCheckPath = resolve(process.cwd(), "scripts/check-instagram-launch.ts");

test("Instagram OAuth routes mirror authenticated client connection flow", () => {
  const connectSource = readFileSync(connectRoutePath, "utf8");
  const callbackSource = readFileSync(callbackRoutePath, "utf8");
  const oauthSource = readFileSync(oauthLibPath, "utf8");

  assert.match(connectSource, /buildInstagramConnectUrl/);
  assert.match(connectSource, /role !== "CLIENT"/);
  assert.match(oauthSource, /\/client\/connections\/instagram/);
  assert.match(oauthSource, /www\.instagram\.com\/oauth\/authorize/);
  assert.match(callbackSource, /verifyInstagramState/);
  assert.match(callbackSource, /exchangeInstagramCode/);
  assert.match(callbackSource, /fetchInstagramProfile/);
  assert.match(callbackSource, /upsertChannelConnection/);
  assert.match(callbackSource, /type: ChannelType\.INSTAGRAM/);
  assert.match(callbackSource, /source: "instagram_login"/);
  assert.match(callbackSource, /igUserId/);
  assert.match(callbackSource, /igScopedUserId/);
  assert.match(callbackSource, /webhookSubscriptionStatus: "dashboard_required"/);
  assert.match(callbackSource, /getInstagramOAuthErrorCode/);
  assert.doesNotMatch(callbackSource, /error: "instagram-subscription"/);
});

test("Instagram OAuth library requests Instagram Login messaging scopes", () => {
  const source = readFileSync(oauthLibPath, "utf8");

  for (const scope of [
    "instagram_business_basic",
    "instagram_business_manage_messages",
  ]) {
    assert.match(source, new RegExp(scope));
  }

  assert.doesNotMatch(source, /pages_show_list/);
  assert.doesNotMatch(source, /pages_read_engagement/);
  assert.doesNotMatch(source, /business_management/);
  assert.doesNotMatch(source, /instagram_basic/);
  assert.doesNotMatch(source, /instagram_manage_messages/);
  assert.doesNotMatch(source, /pages_manage_metadata/);
  assert.doesNotMatch(source, /pages_messaging/);
});

test("Instagram OAuth redirects stay internal to the client app", () => {
  const connectSource = readFileSync(connectRoutePath, "utf8");
  const callbackSource = readFileSync(callbackRoutePath, "utf8");
  const oauthSource = readFileSync(oauthLibPath, "utf8");

  assert.match(oauthSource, /function normalizeInstagramRedirectTo/);
  assert.ok(oauthSource.includes('!redirectTo.startsWith("/")'));
  assert.ok(oauthSource.includes('redirectTo.startsWith("//")'));
  assert.ok(oauthSource.includes('redirectTo.includes("\\\\")'));
  assert.match(connectSource, /normalizeInstagramRedirectTo\(url\.searchParams\.get\("redirectTo"\)\)/);
  assert.match(callbackSource, /new URL\(normalizeInstagramRedirectTo\(redirectTo\), baseUrl\)/);
});

test("Instagram OAuth redirect normalization blocks external backslash variants", () => {
  assert.equal(
    normalizeInstagramRedirectTo("/client/connections/instagram?saved=channel"),
    "/client/connections/instagram?saved=channel",
  );
  assert.equal(normalizeInstagramRedirectTo("https://evil.com"), "/client/connections/instagram");
  assert.equal(normalizeInstagramRedirectTo("//evil.com"), "/client/connections/instagram");
  assert.equal(normalizeInstagramRedirectTo("/\\\\evil.com"), "/client/connections/instagram");
  assert.equal(
    normalizeInstagramRedirectTo(decodeURIComponent("%2F%5C%5Cevil.com")),
    "/client/connections/instagram",
  );
});

test("Instagram webhook supports global OAuth app routing by Instagram recipient ID", () => {
  const source = readFileSync(webhookRoutePath, "utf8");

  assert.match(source, /getInstagramWebhookVerifyToken/);
  assert.match(source, /extractInstagramRecipientId/);
  assert.match(source, /findInstagramAgentByRecipientId/);
  assert.match(source, /parseInstagramCredentials/);
  assert.match(source, /credentials\.igUserId === recipientId/);
  assert.match(source, /credentials\.igScopedUserId === recipientId/);
  assert.match(source, /credentials\.igBusinessAccountId === recipientId/);
  assert.match(source, /credentials\.pageId === recipientId/);
});

test("Instagram launch check accepts the shared Meta app secret", () => {
  const source = readFileSync(launchCheckPath, "utf8");

  assert.match(source, /INSTAGRAM_APP_SECRET/);
  assert.match(source, /META_APP_SECRET/);
  assert.match(source, /Set INSTAGRAM_APP_SECRET or META_APP_SECRET/);
});
