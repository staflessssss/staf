import type {
  SimpleWeddingSalesQuestion,
  SimpleWeddingSalesState,
  TurnUnderstanding,
} from "./state";

export type DialogueUnderstanding = {
  messageAct:
    | "answer_pending_question"
    | "new_business_question"
    | "mixed_ack_and_question"
    | "new_fact"
    | "unclear";
  pendingAnswer: {
    type: "affirmative" | "negative" | "ambiguous" | "none";
    appliesTo:
      | "booking_confirmation"
      | "reschedule_confirmation"
      | "call_time_choice"
      | "send_asset_confirmation"
      | "none";
  };
  explicitQuestions: SimpleWeddingSalesQuestion[];
  conversationalFiller: string[];
  shouldSuppressOldContext: boolean;
  confidence: number;
};

function isBareAffirmative(text: string) {
  return /^\s*(?:yes|yes please|yeah|yep|yup|sure|ok|okay|sounds good|that works|works for me|perfect)\s*[.!]*\s*$/i.test(
    text,
  );
}

function isBareNegative(text: string) {
  return /^\s*(?:no|nope|not yet|not really)\s*[.!]*\s*$/i.test(text);
}

function readConversationalFiller(text: string) {
  const normalized = text.toLowerCase();
  const filler: string[] = [];

  for (const phrase of ["great thank you", "thank you", "thanks", "and yes", "yes and", "perfect"]) {
    if (normalized.includes(phrase)) {
      filler.push(phrase);
    }
  }

  return [...new Set(filler)];
}

function inferPendingAnswer(args: {
  state: SimpleWeddingSalesState;
  text: string;
  explicitQuestions: SimpleWeddingSalesQuestion[];
}): DialogueUnderstanding["pendingAnswer"] {
  if (args.explicitQuestions.length > 0) {
    return { type: "none", appliesTo: "none" };
  }

  const type = isBareAffirmative(args.text)
    ? "affirmative"
    : isBareNegative(args.text)
      ? "negative"
      : "none";

  if (type === "none") {
    return { type: "none", appliesTo: "none" };
  }

  if (args.state.replyMemory?.pendingBookingConfirmation) {
    return { type, appliesTo: "booking_confirmation" };
  }

  if (args.state.callTimeContext?.options.length) {
    return { type, appliesTo: "call_time_choice" };
  }

  return { type, appliesTo: "none" };
}

export function buildDialogueUnderstanding(args: {
  state: SimpleWeddingSalesState;
  understanding: TurnUnderstanding;
}): DialogueUnderstanding {
  const explicitQuestions = args.understanding.questionsAskedByCustomer.filter(
    (question) => question !== "other",
  );
  const conversationalFiller = readConversationalFiller(args.state.latestCustomerMessage);
  const pendingAnswer = inferPendingAnswer({
    state: args.state,
    text: args.state.latestCustomerMessage,
    explicitQuestions,
  });
  const hasFacts = Object.values(args.understanding.facts).some(Boolean);
  const messageAct: DialogueUnderstanding["messageAct"] =
    explicitQuestions.length > 0 && conversationalFiller.length > 0
      ? "mixed_ack_and_question"
      : explicitQuestions.length > 0
        ? "new_business_question"
        : pendingAnswer.type !== "none"
          ? "answer_pending_question"
          : hasFacts
            ? "new_fact"
            : args.understanding.customerMessageType === "unclear"
              ? "unclear"
              : "new_fact";

  return {
    messageAct,
    pendingAnswer,
    explicitQuestions,
    conversationalFiller,
    shouldSuppressOldContext: explicitQuestions.length > 0,
    confidence: args.understanding.confidence,
  };
}
