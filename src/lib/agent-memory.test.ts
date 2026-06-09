import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("runtime conversation history excludes internal Instagram delivery markers", () => {
  const source = readFileSync("src/lib/agent-memory.ts", "utf8");

  assert.match(source, /INSTAGRAM_OUTBOUND_DELIVERY_TOOL_NAME/);
  assert.match(source, /message\.toolName !== INSTAGRAM_OUTBOUND_DELIVERY_TOOL_NAME/);
});
