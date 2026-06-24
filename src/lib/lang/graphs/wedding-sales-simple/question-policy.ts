import type { SimpleWeddingRequiredQuestion } from "./reply-contract";
import type { SimpleWeddingSalesState } from "./state";

export type SimpleWeddingQuestionPolicy = {
  requiredQuestion?: SimpleWeddingRequiredQuestion;
  mode:
    | "first_ask"
    | "ask_after_context_change"
    | "gentle_reminder"
    | "invalid_answer_retry"
    | "skip_already_asked";
  avoidRepeatingPreviousWording: boolean;
  allowCompliment: boolean;
  complimentSubject?: "venue" | "date" | "couple";
  cta?: {
    type: "quick_consult";
    style: "soft_next_step" | "direct_schedule" | "reminder";
    reason: "availability_confirmed" | "venue_received" | "customer_ready" | "missing_call_time";
  };
};

function wasQuestionAsked(
  state: SimpleWeddingSalesState,
  requiredQuestion: SimpleWeddingRequiredQuestion,
) {
  return Boolean(
    state.replyMemory?.questionMemory?.askedQuestions?.some(
      (question) => question.type === requiredQuestion,
    ) || state.replyMemory?.lastRequiredQuestion === requiredQuestion,
  );
}

function hasContextChangeForRepeatedQuestion(state: SimpleWeddingSalesState) {
  return Boolean(
    state.decisionTrace?.toolCalled === "checkAvailability" ||
      state.lastUnderstanding?.facts.weddingDate ||
      state.lastUnderstanding?.facts.location ||
      state.lastUnderstanding?.facts.venue,
  );
}

export function buildSimpleWeddingQuestionPolicy(args: {
  state: SimpleWeddingSalesState;
  requiredQuestion?: SimpleWeddingRequiredQuestion;
}): SimpleWeddingQuestionPolicy {
  const { state, requiredQuestion } = args;

  if (!requiredQuestion) {
    return {
      mode: "skip_already_asked",
      avoidRepeatingPreviousWording: false,
      allowCompliment: false,
    };
  }

  const alreadyAsked = wasQuestionAsked(state, requiredQuestion);
  const invalidCallTime =
    requiredQuestion === "callTime" &&
    (state.decisionTrace?.replyType === "call_time_out_of_window" ||
      state.decisionTrace?.replyType === "call_time_ambiguous");
  const contextChanged = hasContextChangeForRepeatedQuestion(state);
  const mode = invalidCallTime
    ? "invalid_answer_retry"
    : !alreadyAsked
      ? "first_ask"
      : contextChanged
        ? "ask_after_context_change"
        : "gentle_reminder";
  const venueAlreadyComplimented = Boolean(
    state.venue &&
      state.replyMemory?.questionMemory?.complimentedVenue?.toLowerCase() ===
        state.venue.toLowerCase(),
  );
  const allowVenueCompliment =
    requiredQuestion === "callTime" && Boolean(state.venue) && !venueAlreadyComplimented;
  const allowCoupleCompliment =
    (requiredQuestion === "venue" || requiredQuestion === "coupleNames") && !alreadyAsked;

  return {
    requiredQuestion,
    mode,
    avoidRepeatingPreviousWording: alreadyAsked || invalidCallTime,
    allowCompliment: invalidCallTime ? false : allowVenueCompliment || allowCoupleCompliment,
    complimentSubject: invalidCallTime
      ? undefined
      : allowVenueCompliment
        ? "venue"
        : allowCoupleCompliment
          ? "couple"
          : undefined,
    cta:
      requiredQuestion === "callTime"
        ? {
            type: "quick_consult",
            style:
              mode === "ask_after_context_change" || mode === "invalid_answer_retry"
                ? "reminder"
                : mode === "first_ask"
                  ? "soft_next_step"
                  : "direct_schedule",
            reason:
              state.decisionTrace?.toolCalled === "checkAvailability"
                ? "availability_confirmed"
                : state.lastUnderstanding?.facts.venue
                  ? "venue_received"
                  : "missing_call_time",
          }
        : undefined,
  };
}
