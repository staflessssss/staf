import type {
  SimpleWeddingSalesDecisionTrace,
  SimpleWeddingSalesState,
} from "./state";
import type { SimpleWeddingKnowledgeContext } from "./knowledge";
import {
  buildSimpleWeddingMentionPolicy,
  type SimpleWeddingMentionPolicy,
} from "./mention-policy";
import {
  buildSimpleWeddingQuestionPolicy,
  type SimpleWeddingQuestionPolicy,
} from "./question-policy";

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
  mentionPolicy: SimpleWeddingMentionPolicy;
  questionPolicy: SimpleWeddingQuestionPolicy;
  mayAskQuestion: boolean;
  requiredToolResult?: "available" | "unavailable" | "busy" | "booked" | "failed" | "out_of_window";
  bookingConfirmed: boolean;
};

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
  const requiredQuestion = requiredQuestionForState(state);
  const mentionPolicy = buildSimpleWeddingMentionPolicy(args);
  const questionPolicy = buildSimpleWeddingQuestionPolicy({
    state,
    requiredQuestion,
  });
  const currentTurnProposedCallTime = state.lastUnderstanding?.facts.proposedCallTime;
  const mustMentionWeddingAvailability = Boolean(
    mentionPolicy.availability.mode !== "skip",
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
    mayMentionPricing: mentionPolicy.pricing.mode !== "skip",
    mustMentionPricing:
      mentionPolicy.pricing.mode === "full" ||
      mentionPolicy.pricing.mode === "same_as_before",
    mayMentionGuide: mentionPolicy.guide.mode !== "skip",
    mustMentionGuide: mentionPolicy.guide.mode !== "skip",
    mentionPolicy,
    questionPolicy,
    mayAskQuestion: Boolean(requiredQuestion),
    requiredToolResult:
      state.decisionTrace?.replyType === "call_time_out_of_window"
        ? "out_of_window"
        : mustMentionBookingConfirmation
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
