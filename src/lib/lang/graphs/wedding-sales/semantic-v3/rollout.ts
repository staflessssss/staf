function parseAgentIds(value: string | undefined) {
  return new Set(
    (value ?? "")
      .split(/[,\s]+/)
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

export function isGroundedWeddingShadowEnabled(agentId?: string) {
  return Boolean(
    agentId &&
    process.env.OPENAI_API_KEY &&
    parseAgentIds(process.env.WEDDING_SALES_GROUNDED_V3_SHADOW_AGENT_IDS).has(
      agentId,
    ),
  );
}

export function isGroundedWeddingExecutionEnabled(agentId?: string) {
  return Boolean(
    agentId &&
    process.env.OPENAI_API_KEY &&
    parseAgentIds(
      process.env.WEDDING_SALES_GROUNDED_V3_EXECUTION_AGENT_IDS,
    ).has(agentId),
  );
}

export const groundedWeddingRolloutTestHelpers = { parseAgentIds };
