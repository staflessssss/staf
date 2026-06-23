import type { WeddingSalesRuntimeMode } from "../state";

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

function isGroundedWeddingDisabled(agentId?: string) {
  return Boolean(
    agentId &&
      parseAgentIds(process.env.WEDDING_SALES_GROUNDED_V3_DISABLED_AGENT_IDS).has(agentId),
  );
}

export function isGroundedWeddingExecutionEnabled(
  agentId?: string,
  runtimeMode?: WeddingSalesRuntimeMode,
) {
  if (!agentId || !process.env.OPENAI_API_KEY || isGroundedWeddingDisabled(agentId)) {
    return false;
  }

  if (runtimeMode === "unified_v2") {
    return true;
  }

  return parseAgentIds(process.env.WEDDING_SALES_GROUNDED_V3_EXECUTION_AGENT_IDS).has(agentId);
}

export const groundedWeddingRolloutTestHelpers = {
  isGroundedWeddingDisabled,
  parseAgentIds,
};
