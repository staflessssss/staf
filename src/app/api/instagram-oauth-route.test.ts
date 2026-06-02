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
  assert.match(callbackSource, /verifyInstagramState/);
  assert.match(callbackSource, /exchangeInstagramCode/);
  assert.match(callbackSource, /fetchInstagramPages/);
  assert.match(callbackSource, /upsertChannelConnection/);
  assert.match(callbackSource, /type: ChannelType\.INSTAGRAM/);
  assert.match(callbackSource, /subscribeInstagramPageToWebhooks\(page\)\.catch\(\(\) => null\)/);
  assert.match(callbackSource, /error: "instagram-subscription"/);
});

test("Instagram OAuth library requests Meta-supported Instagram messaging scopes", () => {
  const source = readFileSync(oauthLibPath, "utf8");

  for (const scope of [
    "pages_show_list",
    "pages_read_engagement",
    "business_management",
    "instagram_basic",
    "instagram_manage_messages",
  ]) {
    assert.match(source, new RegExp(scope));
  }

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

test("Instagram webhook supports global OAuth app routing by Page ID", () => {
  const source = readFileSync(webhookRoutePath, "utf8");

  assert.match(source, /getInstagramWebhookVerifyToken/);
  assert.match(source, /extractInstagramRecipientPageId/);
  assert.match(source, /findInstagramAgentByPageId/);
  assert.match(source, /parseInstagramCredentials/);
  assert.match(source, /credentials\.pageId === pageId/);
  assert.match(source, /credentials\.igBusinessAccountId === pageId/);
});

test("Instagram launch check accepts the shared Meta app secret", () => {
  const source = readFileSync(launchCheckPath, "utf8");

  assert.match(source, /INSTAGRAM_APP_SECRET/);
  assert.match(source, /META_APP_SECRET/);
  assert.match(source, /Set INSTAGRAM_APP_SECRET or META_APP_SECRET/);
});
