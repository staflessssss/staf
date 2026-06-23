import assert from "node:assert/strict";
import test from "node:test";

import {
  groundedWeddingRolloutTestHelpers,
  isGroundedWeddingExecutionEnabled,
} from "./rollout";

const ENV_KEYS = [
  "OPENAI_API_KEY",
  "WEDDING_SALES_GROUNDED_V3_DISABLED_AGENT_IDS",
  "WEDDING_SALES_GROUNDED_V3_EXECUTION_AGENT_IDS",
] as const;

function withEnv(
  env: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>,
  run: () => void,
) {
  const original = new Map<string, string | undefined>(
    ENV_KEYS.map((key) => [key, process.env[key]]),
  );

  try {
    for (const key of ENV_KEYS) {
      const value = env[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }

    run();
  } finally {
    for (const [key, value] of original) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

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

test("grounded v3 is enabled by unified runtime mode without per-agent allowlist", () => {
  withEnv({ OPENAI_API_KEY: "test-key" }, () => {
    assert.equal(
      isGroundedWeddingExecutionEnabled("agent-1", "unified_v2"),
      true,
    );
  });
});

test("grounded v3 unified runtime keeps a per-agent kill switch", () => {
  withEnv(
    {
      OPENAI_API_KEY: "test-key",
      WEDDING_SALES_GROUNDED_V3_DISABLED_AGENT_IDS: "agent-1, agent-2",
    },
    () => {
      assert.equal(
        isGroundedWeddingExecutionEnabled("agent-1", "unified_v2"),
        false,
      );
      assert.equal(
        isGroundedWeddingExecutionEnabled("agent-3", "unified_v2"),
        true,
      );
    },
  );
});

test("grounded v3 keeps legacy allowlist behavior outside unified runtime", () => {
  withEnv(
    {
      OPENAI_API_KEY: "test-key",
      WEDDING_SALES_GROUNDED_V3_EXECUTION_AGENT_IDS: "agent-1 agent-2",
    },
    () => {
      assert.equal(isGroundedWeddingExecutionEnabled("agent-1"), true);
      assert.equal(isGroundedWeddingExecutionEnabled("agent-3"), false);
    },
  );
});

test("grounded v3 stays disabled without OpenAI credentials", () => {
  withEnv({ OPENAI_API_KEY: undefined }, () => {
    assert.equal(
      isGroundedWeddingExecutionEnabled("agent-1", "unified_v2"),
      false,
    );
  });
});
