import {
  selectWeddingSalesActionPlan,
  selectWeddingSalesFollowUpActionPlan,
} from "../action-plan/selector";
import { analyzeWeddingSalesSemanticsV2 } from "../semantic-v2/analyzer";
import type { WeddingSalesState } from "../state";
import {
  applySemanticV2StateMutation,
  buildSemanticV2MutationFailureUpdate,
} from "../state-v2/mutator";

export async function analyzeWeddingSalesMessageWithSemanticV2(
  state: WeddingSalesState,
): Promise<Partial<WeddingSalesState>> {
  if (state.runtimeEvent === "follow_up") {
    return {
      lastActionPlan: selectWeddingSalesFollowUpActionPlan(state),
    };
  }

  try {
    const semanticV2 = await analyzeWeddingSalesSemanticsV2(state);
    const mutation = applySemanticV2StateMutation({
      state,
      analysis: semanticV2,
    });
    const nextState = {
      ...state,
      ...mutation,
    };

    return {
      ...mutation,
      lastActionPlan: selectWeddingSalesActionPlan({
        state: nextState,
        analysis: semanticV2,
      }),
    };
  } catch (error) {
    const failureReason =
      error instanceof Error ? error.message : "semantic_v2_execution_failed";

    return {
      ...buildSemanticV2MutationFailureUpdate(state, failureReason),
      leadStage: "answering_question",
      lastActionPlan: {
        schemaVersion: 1,
        responseGoal: "clarify",
        actions: [
          {
            type: "request_clarification",
            field: null,
            topicId: null,
            reason: failureReason,
          },
        ],
        guardrailTrace: [],
      },
    };
  }
}
