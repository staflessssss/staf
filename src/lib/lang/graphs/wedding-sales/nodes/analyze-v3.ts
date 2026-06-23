import { traceLangRuntime } from "@/lib/lang/langsmith";

import {
  selectWeddingSalesActionPlan,
  selectWeddingSalesFollowUpActionPlan,
} from "../action-plan/selector";
import { analyzeGroundedWeddingTurn } from "../semantic-v3/analyzer";
import { adaptGroundedWeddingUnderstanding } from "../semantic-v3/grounding";
import type { WeddingSalesState } from "../state";
import {
  applySemanticV2StateMutation,
  buildSemanticV2MutationFailureUpdate,
} from "../state-v2/mutator";

async function resolveGroundedWeddingTurn(state: WeddingSalesState) {
  const understanding = await analyzeGroundedWeddingTurn(state);
  const adaptation = adaptGroundedWeddingUnderstanding({
    state,
    understanding,
  });
  const mutation: Partial<WeddingSalesState> = {
    ...applySemanticV2StateMutation({
      state,
      analysis: adaptation.analysis,
    }),
    semanticStateVersion: 3,
  };
  const nextState = { ...state, ...mutation };
  const actionPlan = selectWeddingSalesActionPlan({
    state: nextState,
    analysis: adaptation.analysis,
  });
  return { understanding, adaptation, mutation, actionPlan };
}

export async function analyzeWeddingSalesMessageWithGroundedV3(
  state: WeddingSalesState,
): Promise<Partial<WeddingSalesState>> {
  if (state.runtimeEvent === "follow_up") {
    return { lastActionPlan: selectWeddingSalesFollowUpActionPlan(state) };
  }

  try {
    const result = await traceLangRuntime(
      "wedding_sales.grounded_v3.execute",
      {
        channel: state.channel,
        tenantId: state.tenantId,
        agentId: state.agentId,
        contactId: state.contactId,
        runtimeType: "langgraph_wedding_sales",
        semanticSchemaVersion: 3,
      },
      () => resolveGroundedWeddingTurn(state),
    );

    return { ...result.mutation, lastActionPlan: result.actionPlan };
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "grounded_v3_execution_failed";
    return {
      ...buildSemanticV2MutationFailureUpdate(state, reason),
      semanticStateVersion: 3,
      leadStage: "answering_question",
      lastActionPlan: {
        schemaVersion: 1,
        responseGoal: "handoff",
        actions: [
          {
            type: "recommend_owner_handoff",
            field: null,
            topicId: null,
            reason: `grounded_understanding_failed:${reason}`,
          },
        ],
        guardrailTrace: [],
      },
    };
  }
}

export async function runGroundedWeddingV3Shadow(
  state: WeddingSalesState,
  semanticV2Result: Partial<WeddingSalesState>,
) {
  try {
    await traceLangRuntime(
      "wedding_sales.grounded_v3.shadow",
      {
        channel: state.channel,
        tenantId: state.tenantId,
        agentId: state.agentId,
        contactId: state.contactId,
        runtimeType: "langgraph_wedding_sales",
        semanticSchemaVersion: 3,
        shadowMode: true,
      },
      async () => {
        const groundedV3 = await resolveGroundedWeddingTurn(state);
        return {
          baseline: {
            leadStage: semanticV2Result.leadStage,
            customerName: semanticV2Result.customerName,
            partnerName: semanticV2Result.partnerName,
            weddingDate: semanticV2Result.weddingDate,
            location: semanticV2Result.location,
            venue: semanticV2Result.venue,
            actionPlan: semanticV2Result.lastActionPlan,
          },
          groundedV3: {
            understanding: groundedV3.understanding,
            acceptedFacts: groundedV3.adaptation.acceptedFacts,
            rejectedFacts: groundedV3.adaptation.rejectedFacts,
            mutation: groundedV3.mutation,
            actionPlan: groundedV3.actionPlan,
          },
        };
      },
    );
  } catch (error) {
    console.warn(
      "[wedding-sales] Grounded v3 shadow failed without affecting runtime.",
      error,
    );
  }
}
