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
  mustGreet: boolean;
  mustMentionWeddingAvailability: boolean;
  mustMentionCalendarAvailability: boolean;
  mustMentionBookingConfirmation: boolean;
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

function previousReplyMentionsCurrentPrice(args: {
  state: SimpleWeddingSalesState;
  knowledge: SimpleWeddingKnowledgeContext;
}) {
  return Boolean(
    args.state.lastMentionedStartPrice === args.knowledge.pricing.startPrice ||
      (args.state.responseDraft &&
        args.knowledge.pricing.startPrice &&
        args.state.responseDraft.includes(args.knowledge.pricing.startPrice)),
  );
}

function previousReplyMentionsGuide(state: SimpleWeddingSalesState) {
  return Boolean(
    state.guideMentioned ||
      /\b(?:collections? guide|guide image|price image)\b/i.test(state.responseDraft ?? ""),
  );
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
  const shouldRefreshPricingAfterAvailability =
    justCheckedAvailability && !previousReplyMentionsCurrentPrice(args);
  const shouldRefreshGuideAfterAvailability =
    justCheckedAvailability && !previousReplyMentionsGuide(state);
  const currentTurnProposedCallTime = state.lastUnderstanding?.facts.proposedCallTime;
  const askedWeddingAvailability =
    state.questionsAskedByCustomer.includes("availability") &&
    !currentTurnProposedCallTime;
  const mustMentionWeddingAvailability = Boolean(
    state.decisionTrace?.toolCalled === "checkAvailability" || askedWeddingAvailability,
  );
  const mustMentionCalendarAvailability = Boolean(
    state.decisionTrace?.toolCalled === "checkCalendar" ||
      state.decisionTrace?.replyType === "calendar_busy" ||
      (currentTurnProposedCallTime && state.calendarStatus),
  );
  const mustMentionBookingConfirmation = Boolean(
    state.bookingConfirmed && state.decisionTrace?.toolCalled === "bookCall",
  );

  return {
    nextStep: state.nextStep,
    replyType: state.decisionTrace?.replyType,
    requiredQuestion,
    mustGreet: Boolean(state.isFirstTurn),
    mustMentionWeddingAvailability,
    mustMentionCalendarAvailability,
    mustMentionBookingConfirmation,
    mayMentionPricing: askedPricing || shouldRefreshPricingAfterAvailability,
    mustMentionPricing: askedPricing,
    mayMentionGuide:
      guideExists && (askedPricing || askedGuide || shouldRefreshGuideAfterAvailability),
    mustMentionGuide: guideExists && askedGuide,
    mayAskQuestion: Boolean(requiredQuestion),
    requiredToolResult:
      mustMentionBookingConfirmation
        ? "booked"
        : mustMentionCalendarAvailability && state.calendarStatus === "busy"
          ? "busy"
          : mustMentionCalendarAvailability && state.calendarStatus === "available"
            ? "available"
            : mustMentionWeddingAvailability && state.availability === "unavailable"
              ? "unavailable"
              : mustMentionWeddingAvailability && state.availability === "available"
                ? "available"
                : undefined,
    bookingConfirmed: state.bookingConfirmed,
  };
}
