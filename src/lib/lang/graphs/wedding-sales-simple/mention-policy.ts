import type { SimpleWeddingKnowledgeContext } from "./knowledge";
import type { SimpleWeddingSalesState } from "./state";

export type PricingMentionMode = "full" | "same_as_before" | "brief_reference" | "skip";
export type AvailabilityMentionMode = "new_result" | "still_available" | "skip";
export type GuideMentionMode = "send_attachment" | "mention_already_sent" | "skip";

export type SimpleWeddingMentionPolicy = {
  pricing: {
    mode: PricingMentionMode;
    reason: string;
  };
  availability: {
    mode: AvailabilityMentionMode;
    reason: string;
  };
  guide: {
    mode: GuideMentionMode;
    reason: string;
  };
  greeting: {
    mode: "first_turn" | "skip";
    reason: string;
  };
};

function asksForGuide(state: SimpleWeddingSalesState) {
  return /\b(price\s*(?:image|guide)|guide|collections?\s*guide)\b/i.test(
    state.latestCustomerMessage,
  );
}

function currentPriceWasMentioned(args: {
  state: SimpleWeddingSalesState;
  knowledge: SimpleWeddingKnowledgeContext;
}) {
  return (
    args.state.replyMemory?.mentioned?.pricing?.value === args.knowledge.pricing.startPrice ||
    args.state.lastMentionedStartPrice === args.knowledge.pricing.startPrice ||
    Boolean(
      args.state.responseDraft &&
        args.knowledge.pricing.startPrice &&
        args.state.responseDraft.includes(args.knowledge.pricing.startPrice),
    )
  );
}

function guideWasMentioned(args: {
  state: SimpleWeddingSalesState;
  knowledge: SimpleWeddingKnowledgeContext;
}) {
  const previousGuide = args.state.replyMemory?.mentioned?.guide;

  return Boolean(
    previousGuide?.imageUrl ||
      previousGuide?.link ||
      args.state.guideMentioned ||
      /\b(?:collections? guide|guide image|price image)\b/i.test(args.state.responseDraft ?? ""),
  );
}

function availabilityWasMentionedForCurrentCheck(state: SimpleWeddingSalesState) {
  const previous = state.replyMemory?.mentioned?.availability;

  return Boolean(
    previous &&
      previous.date === state.weddingDate &&
      (previous.location ?? "") === (state.location ?? "") &&
      previous.status === (state.availability ?? "unknown"),
  );
}

export function buildSimpleWeddingMentionPolicy(args: {
  state: SimpleWeddingSalesState;
  knowledge: SimpleWeddingKnowledgeContext;
}): SimpleWeddingMentionPolicy {
  const { state, knowledge } = args;
  const askedPricing = state.questionsAskedByCustomer.includes("pricing");
  const askedPackageInclusions = state.questionsAskedByCustomer.includes("package_inclusions");
  const askedGuide = asksForGuide(state);
  const guideExists = Boolean(knowledge.guide.imageUrl || knowledge.guide.link);
  const justCheckedAvailability = Boolean(state.decisionTrace?.toolCalled === "checkAvailability");
  const askedAvailability = Boolean(
    state.questionsAskedByCustomer.includes("availability") &&
      !state.lastUnderstanding?.facts.proposedCallTime,
  );
  const priceWasMentioned = currentPriceWasMentioned(args);
  const guideMentioned = guideWasMentioned(args);
  const availabilityMentionedForCurrentCheck = availabilityWasMentionedForCurrentCheck(state);

  const pricing = (() => {
    if (askedPricing && !priceWasMentioned) {
      return {
        mode: "full" as const,
        reason: "customer asked pricing and current start price has not been mentioned",
      };
    }

    if (askedPricing && priceWasMentioned) {
      return {
        mode: "same_as_before" as const,
        reason: "customer asked pricing again and current start price was already mentioned",
      };
    }

    if (justCheckedAvailability && !priceWasMentioned) {
      return {
        mode: "full" as const,
        reason: "availability was checked and current start price has not been mentioned",
      };
    }

    return {
      mode: "skip" as const,
      reason: "pricing was not newly requested or has already been covered",
    };
  })();

  const availability = (() => {
    if (justCheckedAvailability) {
      return {
        mode: "new_result" as const,
        reason: "availability tool returned a fresh result for the current date/location",
      };
    }

    if (askedAvailability && availabilityMentionedForCurrentCheck) {
      return {
        mode: "still_available" as const,
        reason: "customer asked availability again for a result already mentioned",
      };
    }

    return {
      mode: "skip" as const,
      reason: "availability was not newly checked or explicitly re-asked",
    };
  })();

  const guide = (() => {
    if (!guideExists) {
      return {
        mode: "skip" as const,
        reason: "no guide image or link is configured",
      };
    }

    if ((askedGuide || askedPricing || askedPackageInclusions) && !guideMentioned) {
      return {
        mode: "send_attachment" as const,
        reason: "guide is relevant and has not been mentioned in this conversation",
      };
    }

    if (askedGuide && guideMentioned) {
      return {
        mode: "mention_already_sent" as const,
        reason: "customer asked for the guide again and it was already sent",
      };
    }

    return {
      mode: "skip" as const,
      reason: "guide was not requested or was already covered",
    };
  })();

  return {
    pricing,
    availability,
    guide,
    greeting: {
      mode: state.isFirstTurn && !state.replyMemory?.greeted ? "first_turn" : "skip",
      reason: state.isFirstTurn ? "first turn of the conversation" : "conversation was already greeted",
    },
  };
}
