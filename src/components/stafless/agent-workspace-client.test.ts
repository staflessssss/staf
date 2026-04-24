import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const workspaceClientPath = resolve(
  process.cwd(),
  "src/components/stafless/agent-workspace-client.tsx",
);

test("agent workspace blocks saving when Functions still contain invalid configuration", () => {
  const source = readFileSync(workspaceClientPath, "utf8");

  assert.match(source, /Fix invalid Functions configuration before saving this agent\./);
  assert.match(source, /getGoogleCalendarValidationErrors/);
  assert.match(source, /params: step\.params,/);
});
