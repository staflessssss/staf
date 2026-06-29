import type { SimpleWeddingKnowledgeContext } from "./knowledge";
import type { ReplyActionContract } from "./reply-contract";
import type {
  SimpleWeddingSalesReplyMemory,
  SimpleWeddingSalesState,
} from "./state";

function turnIdForState(state: SimpleWeddingSalesState) {
  const nextTurnIndex = (state.replyMemory?.turnIndex ?? 0) + 1;

  return {
    turnIndex: nextTurnIndex,
    turnId: `turn-${nextTurnIndex}`,
  };
}

function mentionsGuide(text: string) {
  return /\b(?:collections? guide|guide image|price image)\b/i.test(text);
}

function currentConsultationSlot(state: SimpleWeddingSalesState) {
  if (state.checkedCallDate && state.checkedCallTime) {
    return `${state.checkedCallDate} ${state.checkedCallTime}`;
  }

  return state.checkedCallTime ?? state.consultationCheck?.proposedTime;
}

function currentPendingBookingConfirmation(args: {
  state: SimpleWeddingSalesState;
  previous?: SimpleWeddingSalesReplyMemory["pendingBookingConfirmation"];
  turnId: string;
  now: string;
}): SimpleWeddingSalesReplyMemory["pendingBookingConfirmation"] {
  const { state, previous, turnId, now } = args;
  const isAvailableSlot = Boolean(
    state.proposedCallTime &&
      state.customerEmail &&
      state.checkedCallTime &&
      (state.calendarStatus === "available" ||
        state.consultationCheck?.status === "available" ||
        state.checkedCallStartTime),
  );

  if (!isAvailableSlot || !state.proposedCallTime || !state.customerEmail) {
    return undefined;
  }

  if (
    previous &&
    previous.proposedCallTime === state.proposedCallTime &&
    previous.email === state.customerEmail &&
    (!previous.checkedCallDate || previous.checkedCallDate === state.checkedCallDate) &&
    (!previous.checkedCallTime || previous.checkedCallTime === state.checkedCallTime) &&
    (!previous.checkedCallStartTime || previous.checkedCallStartTime === state.checkedCallStartTime) &&
    (!previous.checkedCallEndTime || previous.checkedCallEndTime === state.checkedCallEndTime)
  ) {
    return previous;
  }

  return {
    proposedCallTime: state.proposedCallTime,
    email: state.customerEmail,
    checkedCallDate: state.checkedCallDate,
    checkedCallTime: state.checkedCallTime,
    checkedCallStartTime: state.checkedCallStartTime,
    checkedCallEndTime: state.checkedCallEndTime,
    askedAtTurnId: turnId,
    askedAt: now,
    source: "ask_booking_confirmation",
  };
}

function extractQuestionText(text: string) {
  const question = text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .find((part) => part.includes("?"));

  return question;
}

export function updateSimpleWeddingReplyMemory(args: {
  state: SimpleWeddingSalesState;
  contract: ReplyActionContract;
  knowledge: SimpleWeddingKnowledgeContext;
  replyText: string;
  writer?: SimpleWeddingSalesState["writer"];
  now?: Date;
}): SimpleWeddingSalesReplyMemory {
  const { state, contract, knowledge, replyText } = args;
  const { turnIndex, turnId } = turnIdForState(state);
  const now = (args.now ?? new Date()).toISOString();
  const previous = state.replyMemory ?? {};
  const previousMentioned = previous.mentioned ?? {};
  const previousQuestionMemory = previous.questionMemory ?? {};
  const questionText = contract.requiredQuestion ? extractQuestionText(replyText) : undefined;
  const askedQuestions = previousQuestionMemory.askedQuestions ?? [];
  const mentionedPrice =
    knowledge.pricing.startPrice && replyText.includes(knowledge.pricing.startPrice);
  const mentionedAvailability =
    contract.mentionPolicy.availability.mode !== "skip" &&
    Boolean(state.availability && state.weddingDate);
  const mentionedGuide = mentionsGuide(replyText);
  const guideMentionReason =
    contract.mentionPolicy.guide.mode === "send_attachment" &&
    contract.responseKey === "utter_availability_available_ask_names"
      ? "availability_available"
      : "explicit_request";
  const guideMentionMode = knowledge.guide.imageUrl ? "image" : "link";
  const consultationSlot = currentConsultationSlot(state);
  const mentionedConsultation =
    Boolean(consultationSlot) &&
    (contract.mentionPolicy.consultation.mode === "first_available" ||
      contract.mentionPolicy.consultation.mode === "busy");
  const pendingBookingConfirmation =
    contract.mentionPolicy.consultation.mode === "ask_booking_confirmation" &&
    !state.customerConfirmedCallSlot &&
    !state.bookingConfirmed
      ? currentPendingBookingConfirmation({
          state,
          previous: previous.pendingBookingConfirmation,
          turnId,
          now,
        })
      : undefined;
  const responseVariations =
    (args.writer?.mode === "response_catalog" || args.writer?.mode === "contextual_rephrase") &&
    args.writer.responseKey &&
    args.writer.variationId
      ? [
          ...(previous.responseVariations ?? []),
          {
            responseKey: args.writer.responseKey,
            variationId: args.writer.variationId,
            turnId,
          },
        ].slice(-20)
      : previous.responseVariations;

  return {
    ...previous,
    greeted: previous.greeted || contract.mentionPolicy.greeting.mode === "first_turn",
    turnIndex,
    responseVariations,
    pendingBookingConfirmation,
    mentioned: {
      ...previousMentioned,
      pricing: mentionedPrice
        ? {
            value: knowledge.pricing.startPrice,
            turnId,
            lastMentionedAt: now,
          }
        : previousMentioned.pricing ??
          (state.lastMentionedStartPrice
            ? {
                value: state.lastMentionedStartPrice,
                lastMentionedAt: now,
              }
            : undefined),
      availability: mentionedAvailability
        ? {
            date: state.weddingDate!,
            location: state.location,
            status: state.availability ?? "unknown",
            turnId,
            lastMentionedAt: now,
          }
        : previousMentioned.availability,
      guide: mentionedGuide
        ? {
            imageUrl: knowledge.guide.imageUrl,
            link: knowledge.guide.link,
            mode: guideMentionMode,
            reason: guideMentionReason,
            turnId,
            lastMentionedAt: now,
          }
        : previousMentioned.guide ??
          (state.guideMentioned
            ? {
                imageUrl: knowledge.guide.imageUrl,
                link: knowledge.guide.link,
                mode: guideMentionMode,
                reason: "explicit_request",
                lastMentionedAt: now,
              }
            : undefined),
      consultation: mentionedConsultation
        ? {
            slot: consultationSlot!,
            status: state.calendarStatus === "busy" ? "busy" : "available",
            turnId,
            lastMentionedAt: now,
          }
        : previousMentioned.consultation,
    },
    questionMemory: {
      ...previousQuestionMemory,
      lastRequiredQuestion: contract.requiredQuestion ?? previousQuestionMemory.lastRequiredQuestion,
      lastQuestionText: questionText ?? previousQuestionMemory.lastQuestionText,
      askedQuestions:
        contract.requiredQuestion && questionText
          ? [
              ...askedQuestions,
              {
                type: contract.requiredQuestion,
                turnId,
                text: questionText,
              },
            ]
          : askedQuestions,
      complimentedVenue:
        contract.questionPolicy.allowCompliment &&
        contract.questionPolicy.complimentSubject === "venue" &&
        state.venue
          ? state.venue
          : previousQuestionMemory.complimentedVenue,
      lastCtaText:
        contract.questionPolicy.cta && questionText
          ? questionText
          : previousQuestionMemory.lastCtaText,
    },
    lastReplyType: contract.replyType,
    lastRequiredQuestion: contract.requiredQuestion,
    lastOutboundText: replyText,
  };
}
