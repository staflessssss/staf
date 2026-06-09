import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(process.cwd(), "src/app/client/dialogs/page.tsx"), "utf8");

test("client dialogs show manual business messages without exposing manual reply controls", () => {
  assert.doesNotMatch(source, /ClientDialogActivationButton/);
  assert.doesNotMatch(source, /api\/client\/conversations\/.*activate/);
  assert.match(source, /isBusinessManualMessage\(message\)/);
  assert.match(source, /Business owner/);
  assert.match(source, /INSTAGRAM_OUTBOUND_DELIVERY_TOOL_NAME/);
  assert.match(source, /isInternalInstagramDelivery/);
  assert.doesNotMatch(source, /Send className/);
  assert.doesNotMatch(source, /Paperclip className/);
  assert.doesNotMatch(source, /Notes/);
});

test("client dialogs show agent tool calls in the conversation timeline", () => {
  assert.match(source, /MessageRole\.TOOL/);
  assert.match(source, /Agent called/);
  assert.match(source, /buildToolCallView/);
});

test("client dialogs load previews separately from the selected conversation history", () => {
  assert.match(source, /toolName: "business_manual_message"/);
  assert.match(source, /take: 1/);
  assert.match(source, /conversationId: selectedConversation\.id/);
  assert.match(source, /conversation: \{ agent: \{ tenantId \} \}/);
});
