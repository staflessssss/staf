import type {
  SimpleWeddingSalesDecisionTrace,
  SimpleWeddingSalesState,
} from "./state";
import type { SimpleWeddingKnowledgeContext } from "./knowledge";

export type SimpleWeddingRequiredQuestion =
  | "names"
  | "coupleNames"
  | "weddingDate"
  | "location"
  | "venue"
  | "callTime"
  | "email";

export type ReplyActionContract = {
  nextStep: SimpleWeddingSalesState["nextStep"];
  replyType?: SimpleWeddingSalesDecisionTrace["replyType"];
  requiredQuestion?: SimpleWeddingRequiredQuestion;
  mayMentionPricing: boolean;
  mustMentionPricing: boolean;
  mayMentionGuide: boolean;
  mustMentionGuide: boolean;
  mayAskQuestion: boolean;
  requiredToolResult?: "available" | "unavailable" | "busy" | "booked" | "failed";
  bookingConfirmed: boolean;
};

function requiresGuide(state: SimpleWeddingSalesState) {
  const message = state.latestCustomerMessage.toLowerCase();

  return /\b(price\s*(?:image|guide)|guide|collections?\s*guide)\b/.test(message);
}

function requiredQuestionForState(
  state: SimpleWeddingSalesState,
): SimpleWeddingRequiredQuestion | undefined {
  if (state.nextStep === "ask_missing_info") {
    if (state.missingField === "names") {
      return state.senderRole === "mother" || state.senderRole === "planner"
        ? "coupleNames"
        : "names";
    }

    return state.missingField;
  }

  if (state.nextStep === "ask_venue") {
    return "venue";
  }

  if (state.nextStep === "ask_call_time") {
    return "callTime";
  }

  if (state.nextStep === "ask_email") {
    return "email";
  }

  return undefined;
}

export function buildReplyActionContract(args: {
  state: SimpleWeddingSalesState;
  knowledge: SimpleWeddingKnowledgeContext;
}): ReplyActionContract {
  const { state } = args;
  const askedPricing = state.questionsAskedByCustomer.includes("pricing");
  const askedGuide = requiresGuide(state);
  const requiredQuestion = requiredQuestionForState(state);
  const guideExists = Boolean(args.knowledge.guide.imageUrl || args.knowledge.guide.link);
  const justCheckedAvailability =
    state.decisionTrace?.toolCalled === "checkAvailability" &&
    state.availability === "available";

  return {
    nextStep: state.nextStep,
    replyType: state.decisionTrace?.replyType,
    requiredQuestion,
    mayMentionPricing: askedPricing || justCheckedAvailability,
    mustMentionPricing: askedPricing,
    mayMentionGuide: guideExists && (askedPricing || askedGuide || justCheckedAvailability),
    mustMentionGuide: guideExists && askedGuide,
    mayAskQuestion: Boolean(requiredQuestion),
    requiredToolResult:
      state.bookingConfirmed
        ? "booked"
        : state.calendarStatus === "busy"
          ? "busy"
          : state.calendarStatus === "available"
            ? "available"
            : state.availability === "unavailable"
              ? "unavailable"
              : state.availability === "available"
                ? "available"
                : undefined,
    bookingConfirmed: state.bookingConfirmed,
  };
}
