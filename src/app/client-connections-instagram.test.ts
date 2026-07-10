import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const connectionDetailPath = resolve(
  process.cwd(),
  "src/app/client/connections/[connectionKey]/page.tsx",
);
const connectionActionsPath = resolve(process.cwd(), "src/lib/connection-actions.ts");

test("client Instagram connection detail uses OAuth, not a fake preset connect", () => {
  const source = readFileSync(connectionDetailPath, "utf8");

  assert.match(source, /isInstagram/);
  assert.match(source, /\/api\/instagram\/connect/);
  assert.match(source, /Connect Instagram/);
  assert.match(source, /\) : isInstagram \? \(/);
});

test("preset channel action blocks Instagram placeholder credentials", () => {
  const source = readFileSync(connectionActionsPath, "utf8");

  assert.match(source, /type === ChannelType\.INSTAGRAM/);
  assert.match(source, /instagram-operator-managed/);
  assert.match(source, /getInstagramCredentialsValidationError/);
});

test("client connection actions delegate credential persistence to vault helpers", () => {
  const source = readFileSync(connectionActionsPath, "utf8");

  assert.match(source, /requireClientSession\(\)/);
  assert.match(source, /const tenantId = session\.user\.tenantId/);
  assert.match(source, /upsertChannelConnection/);
  assert.match(source, /upsertIntegrationConnection/);
  assert.match(source, /revokeChannelConnection/);
  assert.match(source, /buildPresetChannelConnection/);
  assert.match(source, /buildGmailWorkspacePresetIntegrations/);
  assert.doesNotMatch(source, /db\.channelConnection\.upsert/);
  assert.doesNotMatch(source, /db\.integrationConnection\.upsert/);
  assert.doesNotMatch(source, /encrypt\("revoked"\)/);
});
