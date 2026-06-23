import assert from "node:assert/strict";
import test from "node:test";

import { groundedWeddingRolloutTestHelpers } from "./rollout";

test("grounded rollout allowlists accept comma and whitespace separated agent ids", () => {
  assert.deepEqual(
    [
      ...groundedWeddingRolloutTestHelpers.parseAgentIds(
        "agent-a, agent-b\nagent-c",
      ),
    ],
    ["agent-a", "agent-b", "agent-c"],
  );
});
