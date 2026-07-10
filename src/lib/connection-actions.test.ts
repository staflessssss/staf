import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const source = () => readFileSync(resolve("src/lib/connection-actions.ts"), "utf8");

test("Telegram connection registers the webhook before writing a connected channel", () => {
  const text = source();
  const telegramBranchIndex = text.indexOf("parsed.data.type === ChannelType.TELEGRAM");
  const registerIndex = text.indexOf("await registerTelegramWebhook", telegramBranchIndex);
  const upsertIndex = text.indexOf("await upsertChannelConnection", telegramBranchIndex);

  assert.ok(telegramBranchIndex > 0);
  assert.ok(registerIndex > telegramBranchIndex);
  assert.ok(upsertIndex > registerIndex);
  assert.match(text, /telegram-webhook/);
});

test("connection actions normalize redirect targets before writing preset or revoke changes", () => {
  const text = source();

  for (const actionName of [
    "connectPresetChannelAction",
    "connectPresetIntegrationAction",
    "revokeChannelConnectionAction",
  ]) {
    const actionIndex = text.indexOf(`export async function ${actionName}`);
    const normalizeIndex = text.indexOf("normalizeInternalRedirect", actionIndex);
    const writeIndex = Math.min(
      ...[
        text.indexOf("await upsertChannelConnection", actionIndex),
        text.indexOf("await upsertIntegrationConnection", actionIndex),
        text.indexOf("await revokeChannelConnection", actionIndex),
      ].filter((index) => index > 0),
    );

    assert.ok(actionIndex > 0, actionName);
    assert.ok(normalizeIndex > actionIndex, actionName);
    assert.ok(writeIndex > normalizeIndex, actionName);
  }
});
