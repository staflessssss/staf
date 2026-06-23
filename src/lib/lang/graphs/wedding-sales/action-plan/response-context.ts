import type { WeddingSalesField } from "../semantic-v2/schema";
import type { WeddingSalesState } from "../state";

export type WeddingSalesReplyAction =
  | "askMissingInfo"
  | "askLocationOrVenue"
  | "askWeddingYear"
  | "confirmChange"
  | "answerQuestion"
  | "askCallTime"
  | "askEmail"
  | "ignored";

export function replyActionForMissingField(
  field: WeddingSalesField | null | undefined,
): WeddingSalesReplyAction {
  switch (field) {
    case "weddingYear":
      return "askWeddingYear";
    case "location":
    case "venue":
      return "askLocationOrVenue";
    case "callTime":
      return "askCallTime";
    case "email":
      return "askEmail";
    case "customerName":
    case "partnerName":
    case "names":
    case "weddingDate":
    default:
      return "askMissingInfo";
  }
}

export type WeddingSalesResponseContext = {
  hasActionPlanAuthority: boolean;
  answerTopicIds: string[];
  plannedQuestionField: WeddingSalesField | null;
};

export function buildWeddingSalesResponseContext(
  state: Pick<WeddingSalesState, "semanticStateVersion" | "lastActionPlan">,
): WeddingSalesResponseContext {
  const hasActionPlanAuthority =
    (state.semanticStateVersion === 2 || state.semanticStateVersion === 3) &&
    Boolean(state.lastActionPlan);
  const answerTopicIds =
    state.lastActionPlan?.actions
      .filter((action) => action.type === "answer_question" && action.topicId)
      .map((action) => action.topicId as string) ?? [];
  const plannedQuestionField =
    state.lastActionPlan?.actions.find((action) => action.type === "ask_missing_field")?.field ??
    null;

  return {
    hasActionPlanAuthority,
    answerTopicIds,
    plannedQuestionField,
  };
}
