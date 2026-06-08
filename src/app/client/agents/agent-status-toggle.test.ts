import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  "src/app/client/agents/agent-status-toggle.tsx",
  "utf8",
);

test("agent status toggle pauses and resumes through the client API", () => {
  assert.match(source, /nextStatus = isActive \? "PAUSED" : "ACTIVE"/);
  assert.match(source, /\/api\/client\/agents\/\$\{agentId\}\/status/);
  assert.match(source, /method: "PATCH"/);
  assert.match(source, /router\.refresh\(\)/);
});
