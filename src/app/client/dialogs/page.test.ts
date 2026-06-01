import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(process.cwd(), "src/app/client/dialogs/page.tsx"), "utf8");

test("client dialogs do not expose manual business controls or messages", () => {
  assert.doesNotMatch(source, /ClientDialogActivationButton/);
  assert.doesNotMatch(source, /api\/client\/conversations\/.*activate/);
  assert.doesNotMatch(source, /Operator<\/span>/);
  assert.match(source, /!isBusinessManualMessage/);
  assert.doesNotMatch(source, /Send className/);
  assert.doesNotMatch(source, /Paperclip className/);
  assert.doesNotMatch(source, /Notes/);
});

test("client dialogs show agent tool calls in the conversation timeline", () => {
  assert.match(source, /MessageRole\.TOOL/);
  assert.match(source, /Agent called/);
  assert.match(source, /buildToolCallView/);
});
