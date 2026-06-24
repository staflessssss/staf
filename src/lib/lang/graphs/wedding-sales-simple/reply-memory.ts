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

export function updateSimpleWeddingReplyMemory(args: {
  state: SimpleWeddingSalesState;
  contract: ReplyActionContract;
  knowledge: SimpleWeddingKnowledgeContext;
  replyText: string;
  now?: Date;
}): SimpleWeddingSalesReplyMemory {
  const { state, contract, knowledge, replyText } = args;
  const { turnIndex, turnId } = turnIdForState(state);
  const now = (args.now ?? new Date()).toISOString();
  const previous = state.replyMemory ?? {};
  const previousMentioned = previous.mentioned ?? {};
  const mentionedPrice =
    knowledge.pricing.startPrice && replyText.includes(knowledge.pricing.startPrice);
  const mentionedAvailability =
    contract.mentionPolicy.availability.mode !== "skip" &&
    Boolean(state.availability && state.weddingDate);
  const mentionedGuide = mentionsGuide(replyText);

  return {
    ...previous,
    greeted: previous.greeted || contract.mentionPolicy.greeting.mode === "first_turn",
    turnIndex,
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
            turnId,
            lastMentionedAt: now,
          }
        : previousMentioned.guide ??
          (state.guideMentioned
            ? {
                imageUrl: knowledge.guide.imageUrl,
                link: knowledge.guide.link,
                lastMentionedAt: now,
              }
            : undefined),
    },
    lastReplyType: contract.replyType,
    lastRequiredQuestion: contract.requiredQuestion,
    lastOutboundText: replyText,
  };
}
