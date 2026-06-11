import { traceLangRuntime } from "@/lib/lang/langsmith";

import type { WeddingSalesState } from "../state";
import { analyzeWeddingSalesSemanticsV2 } from "./analyzer";
import { calculateEffectiveEntityConfidence } from "./effective-confidence";

function parseAgentAllowlist(value: string | undefined) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
}

export function isSemanticV2ShadowEnabled(agentId?: string) {
  if (!agentId) {
    return false;
  }

  const allowedAgentIds = parseAgentAllowlist(
    process.env.WEDDING_SALES_SEMANTIC_V2_SHADOW_AGENT_IDS,
  );

  return (
    process.env.WEDDING_SALES_SEMANTIC_V2_SHADOW?.trim() === "true" &&
    Boolean(process.env.OPENAI_API_KEY) &&
    Boolean(process.env.LANGSMITH_API_KEY) &&
    allowedAgentIds.has(agentId)
  );
}

function buildShadowComparison(args: {
  legacyResult: Partial<WeddingSalesState>;
  effectiveConfidence: ReturnType<typeof calculateEffectiveEntityConfidence>;
}) {
  return {
    legacyLeadStage: args.legacyResult.leadStage,
    legacyWouldCheckWeddingAvailability:
      args.legacyResult.leadStage === "ready_for_availability",
    legacyWouldCheckCalendar: args.legacyResult.leadStage === "checking_calendar",
    legacyWouldBook: args.legacyResult.leadStage === "ready_to_book",
    highConfidenceFields: args.effectiveConfidence
      .filter((entry) => entry.effectiveConfidence >= 0.75)
      .map((entry) => entry.field),
    suppressedFields: args.effectiveConfidence
      .filter((entry) => entry.effectiveConfidence < 0.5)
      .map((entry) => entry.field),
  };
}

export async function runWeddingSalesSemanticV2Shadow(args: {
  state: WeddingSalesState;
  legacyResult: Partial<WeddingSalesState>;
}) {
  if (!isSemanticV2ShadowEnabled(args.state.agentId)) {
    return;
  }

  try {
    await traceLangRuntime(
      "wedding_sales.semantic_v2.shadow",
      {
        channel: args.state.channel,
        tenantId: args.state.tenantId,
        agentId: args.state.agentId,
        contactId: args.state.contactId,
        runtimeType: "langgraph_wedding_sales",
        semanticSchemaVersion: 2,
        shadowMode: true,
      },
      async () => {
        const analysis = await analyzeWeddingSalesSemanticsV2(args.state);
        const effectiveConfidence = calculateEffectiveEntityConfidence({
          analysis,
          state: args.state,
        });
        const comparison = buildShadowComparison({
          legacyResult: args.legacyResult,
          effectiveConfidence,
        });

        return {
          analysis,
          effectiveConfidence,
          comparison,
        };
      },
    );
  } catch (error) {
    console.warn("[wedding-sales] Semantic v2 shadow failed without affecting runtime.", error);
  }
}
