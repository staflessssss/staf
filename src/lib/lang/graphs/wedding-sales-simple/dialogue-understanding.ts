import type {
  SimpleWeddingSalesQuestion,
  SimpleWeddingSalesDialogueCommand,
  SimpleWeddingSalesState,
  TurnUnderstanding,
} from "./state";
import { isGenericWeddingLeadInquiry } from "./lead-inquiry";

export type DialogueUnderstanding = {
  messageAct:
    | "acknowledgement_only"
    | "answer_pending_question"
    | "new_business_question"
    | "generic_lead_inquiry"
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
  commands?: SimpleWeddingSalesDialogueCommand[];
  confidence: number;
};

function isBareAffirmative(text: string) {
  const normalized = text
    .trim()
    .toLowerCase()
    .replace(/[.!?]+/g, " ")
    .replace(/[,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const withoutFiller = normalized
    .replace(/\b(?:sorry|apologies|please|thanks|thank you)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const affirmativePattern =
    /^(?:yes|yeah|yep|yup|sure|ok|okay|sounds good|that works|works for me|perfect|go ahead|lock it in|that sounds good)$/i;

  return (
    affirmativePattern.test(normalized) ||
    affirmativePattern.test(withoutFiller) ||
    /^(?:yes|yeah|yep|yup)\b[\s\S]{0,40}\b(?:that works|works|sounds good|go ahead|lock it in)?$/i.test(withoutFiller)
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

function isAcknowledgementOnly(text: string) {
  const normalized = text
    .trim()
    .replace(/[.!?]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return /^(?:(?:thank you|thanks|great thanks|okay thank you|ok thank you|got it(?:,?\s*)?(?:thank you|thanks)?|appreciate it|of course)(?:,?\s*)?(?:see you(?: later| then)?|talk soon|sounds good)?|see you(?: later| then)?|talk soon)$/i.test(
    normalized,
  );
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

  const pendingUserAction =
    args.state.pendingUserAction ??
    (args.state.bookingConfirmed
      ? null
      : args.state.replyMemory?.pendingBookingConfirmation
        ? {
            type: "booking_confirmation" as const,
            slot: args.state.replyMemory.pendingBookingConfirmation.proposedCallTime,
            email: args.state.replyMemory.pendingBookingConfirmation.email,
          }
        : null);

  if (pendingUserAction?.type === "booking_confirmation") {
    return { type, appliesTo: "booking_confirmation" };
  }

  if (pendingUserAction?.type === "call_time_choice") {
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
  const isGenericLead = isGenericWeddingLeadInquiry(args.state.latestCustomerMessage);
  const messageAct: DialogueUnderstanding["messageAct"] =
    isGenericLead
      ? "generic_lead_inquiry"
      : pendingAnswer.type === "none" && explicitQuestions.length === 0 && isAcknowledgementOnly(args.state.latestCustomerMessage)
      ? "acknowledgement_only"
      : explicitQuestions.length > 0 && conversationalFiller.length > 0
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
