import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(process.cwd(), "src/app/client/dialogs/page.tsx"), "utf8");

test("client dialogs do not expose operator controls or operator messages", () => {
  assert.doesNotMatch(source, /ClientDialogActivationButton/);
  assert.doesNotMatch(source, /api\/client\/conversations\/.*activate/);
  assert.doesNotMatch(source, /Operator<\/span>/);
  assert.match(source, /!isOperatorMessage/);
  assert.match(source, /read-only workspace/);
});
