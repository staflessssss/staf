import type {
  SimpleWeddingSalesDecisionTrace,
  SimpleWeddingSalesResponseKey,
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
  responseKey?: SimpleWeddingSalesResponseKey;
  requiredQuestion?: SimpleWeddingRequiredQuestion;
  mustGreet: boolean;
  mustMentionWeddingAvailability: boolean;
  mustMentionCalendarAvailability: boolean;
  mustMentionBookingConfirmation: boolean;
  mayMentionPricing: boolean;
  mustMentionPricing: boolean;
  mayMentionGuide: boolean;
  mustMentionGuide: boolean;
  mustAnswerTeam: boolean;
  mustAnswerIdentity: boolean;
  mustAnswerTravel: boolean;
  mustAnswerQuestions: SimpleWeddingSalesState["replyObligations"];
  forbiddenPhrases: string[];
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

  if (
    state.nextStep === "reply_only" &&
    (state.isFirstTurn || !state.replyMemory?.turnIndex) &&
    state.questionsAskedByCustomer.some((question) => question !== "other")
  ) {
    if (!state.weddingDate) {
      return "weddingDate";
    }

    if (!state.location) {
      return "location";
    }
  }

  if (
    state.nextStep === "reply_only" &&
    (state.replyObligations?.length || state.decisionTrace?.replyType === "acknowledgement_only")
  ) {
    const lastQuestion =
      state.replyMemory?.lastRequiredQuestion ??
      state.replyMemory?.questionMemory?.lastRequiredQuestion;

    if (lastQuestion === "names" && !(state.customerName && state.partnerName)) {
      return state.senderRole === "mother" || state.senderRole === "planner"
        ? "coupleNames"
        : "names";
    }

    if (lastQuestion === "venue" && !state.venue) {
      return "venue";
    }

    if (lastQuestion === "callTime" && !state.proposedCallTime) {
      return "callTime";
    }

    if (lastQuestion === "email" && !state.customerEmail) {
      return "email";
    }

    if (lastQuestion === "weddingDate" && !state.weddingDate) {
      return "weddingDate";
    }

    if (lastQuestion === "location" && !state.location) {
      return "location";
    }
  }

  return undefined;
}

function responseKeyForContract(args: {
  state: SimpleWeddingSalesState;
  requiredQuestion?: SimpleWeddingRequiredQuestion;
  replyObligations: SimpleWeddingSalesState["replyObligations"];
  mustMentionWeddingAvailability: boolean;
  mustMentionBookingConfirmation: boolean;
  mentionPolicy: SimpleWeddingMentionPolicy;
}): SimpleWeddingSalesResponseKey | undefined {
  const { state, requiredQuestion, replyObligations } = args;

  if (state.decisionTrace?.replyType === "post_booking_faq") {
    return "utter_answer_faq_after_booking";
  }

  if (state.decisionTrace?.replyType === "answer_booking_details") {
    return "utter_answer_booking_details";
  }

  if (replyObligations?.includes("raw_footage")) {
    return "utter_answer_raw_footage";
  }

  if (replyObligations?.includes("travel")) {
    return requiredQuestion === "callTime"
      ? "utter_answer_travel_resume_call_time"
      : "utter_answer_travel";
  }

  if (state.decisionTrace?.replyType === "acknowledgement_only") {
    return "utter_acknowledgement";
  }

  if (state.nextStep === "handoff" || state.decisionTrace?.replyType === "handoff") {
    return "utter_handoff_ack";
  }

  if (args.mustMentionBookingConfirmation) {
    return "utter_booking_confirmed";
  }

  if (args.mentionPolicy.consultation.mode === "ask_booking_confirmation") {
    return "utter_ask_booking_confirmation";
  }

  if (state.decisionTrace?.replyType === "call_time_out_of_window") {
    return "utter_call_time_out_of_window";
  }

  if (
    requiredQuestion === "names" &&
    args.mustMentionWeddingAvailability &&
    state.availability === "available" &&
    (args.mentionPolicy.pricing.mode === "full" ||
      args.mentionPolicy.pricing.mode === "same_as_before") &&
    args.mentionPolicy.guide.mode !== "skip"
  ) {
    return "utter_availability_available_ask_names";
  }

  if (
    requiredQuestion === "names" &&
    args.mentionPolicy.pricing.mode === "same_as_before" &&
    args.mentionPolicy.guide.mode !== "skip"
  ) {
    return "utter_pricing_repeat_send_guide_ask_names";
  }

  if (args.mustMentionWeddingAvailability) {
    return undefined;
  }

  if (requiredQuestion === "email" || args.mentionPolicy.consultation.mode === "first_available") {
    return args.mentionPolicy.consultation.mode === "first_available"
      ? "utter_calendar_available_ask_email"
      : "utter_ask_email";
  }

  if (requiredQuestion === "callTime") {
    return state.venue && state.decisionTrace?.replyType === "ask_call_time"
      ? "utter_venue_collected_ask_call_time"
      : "utter_ask_call_time";
  }

  if (requiredQuestion === "venue") {
    return "utter_ask_venue";
  }

  if (requiredQuestion === "coupleNames") {
    return "utter_ask_names";
  }

  if (requiredQuestion === "names") {
    if (state.weddingDate && state.location) {
      return "utter_ask_names_after_details";
    }

    return "utter_ask_names";
  }

  if (requiredQuestion === "location") {
    return state.weddingDate ? "utter_ask_location_only" : "utter_ask_wedding_details";
  }

  if (requiredQuestion === "weddingDate") {
    return state.location ? "utter_ask_wedding_date_only" : "utter_ask_wedding_details";
  }

  if (args.mustMentionWeddingAvailability && args.mentionPolicy.pricing.mode !== "skip") {
    return "utter_available_with_pricing_guide";
  }

  return state.decisionTrace?.responseKey;
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
  const mustMentionWeddingAvailability = Boolean(
    mentionPolicy.availability.mode !== "skip",
  );
  const mustMentionCalendarAvailability = Boolean(
    mentionPolicy.consultation.mode === "first_available" ||
      mentionPolicy.consultation.mode === "busy",
  );
  const mustMentionBookingConfirmation = Boolean(
    state.bookingConfirmed && state.decisionTrace?.toolCalled === "bookCall",
  );
  const replyObligations =
    state.replyObligations?.length
      ? state.replyObligations
      : state.decisionTrace?.replyObligations ?? [];

  return {
    nextStep: state.nextStep,
    replyType: state.decisionTrace?.replyType,
    responseKey: responseKeyForContract({
      state,
      requiredQuestion,
      replyObligations,
      mustMentionWeddingAvailability,
      mustMentionBookingConfirmation,
      mentionPolicy,
    }),
    requiredQuestion,
    mustGreet: Boolean(state.isFirstTurn && state.nextStep !== "handoff"),
    mustMentionWeddingAvailability,
    mustMentionCalendarAvailability,
    mustMentionBookingConfirmation,
    mayMentionPricing: mentionPolicy.pricing.mode !== "skip",
    mustMentionPricing:
      mentionPolicy.pricing.mode === "full" ||
      mentionPolicy.pricing.mode === "same_as_before",
    mayMentionGuide: mentionPolicy.guide.mode !== "skip",
    mustMentionGuide: mentionPolicy.guide.mode !== "skip",
    mustAnswerTeam: replyObligations.includes("team") || state.decisionTrace?.replyType === "team_answer",
    mustAnswerIdentity:
      replyObligations.includes("identity") || state.decisionTrace?.replyType === "identity_answer",
    mustAnswerTravel: replyObligations.includes("travel"),
    mustAnswerQuestions: replyObligations,
    forbiddenPhrases: [
      "I don't want to guess here",
      "Could you send that one more time?",
      "someone from the team",
      "I booked the call for",
    ],
    mentionPolicy,
    questionPolicy,
    mayAskQuestion: Boolean(requiredQuestion),
    requiredToolResult:
      state.decisionTrace?.replyType === "call_time_out_of_window"
        ? "out_of_window"
        : mustMentionBookingConfirmation
        ? "booked"
        : mentionPolicy.consultation.mode === "busy"
          ? "busy"
          : mentionPolicy.consultation.mode === "first_available"
            ? "available"
            : mustMentionWeddingAvailability && state.availability === "unavailable"
              ? "unavailable"
              : mustMentionWeddingAvailability && state.availability === "available"
                ? "available"
                : undefined,
    bookingConfirmed: state.bookingConfirmed,
  };
}
