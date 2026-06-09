import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("client agents allow sandbox testing while an agent is paused", () => {
  const source = fs.readFileSync(
    new URL("./agents-view.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    source,
    /agent\.status === "ACTIVE" \|\| agent\.status === "PAUSED"/,
  );
  assert.match(source, /<AgentTestChatDrawer/);
});
