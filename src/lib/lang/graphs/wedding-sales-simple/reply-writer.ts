import { formatSimpleWeddingDate } from "./reply";
import type { SimpleWeddingKnowledgeContext } from "./knowledge";
import type { ReplyActionContract } from "./reply-contract";
import { validateGeneratedReply } from "./reply-guards";
import { getCoupleName, type SimpleWeddingSalesState } from "./state";

function joinLines(lines: Array<string | undefined>) {
  return lines.filter(Boolean).join("\n\n");
}

function greetingLine(state: SimpleWeddingSalesState) {
  return state.isFirstTurn ? "Hey! Taras here - thanks for reaching out." : undefined;
}

function shouldMentionAvailability(state: SimpleWeddingSalesState) {
  return Boolean(
    state.decisionTrace?.toolCalled === "checkAvailability" ||
      state.questionsAskedByCustomer.includes("availability"),
  );
}

function availabilityLine(state: SimpleWeddingSalesState) {
  if (!state.availability || !state.weddingDate) {
    return undefined;
  }

  const date = formatSimpleWeddingDate(state.weddingDate);
  const place = state.location ? ` in ${state.location}` : "";

  if (state.availability === "available") {
    return `Yes, ${date}${place} is open for us right now.`;
  }

  const alternatives = state.suggestedWeddingDates
    ?.map(formatSimpleWeddingDate)
    .filter(Boolean)
    .join(" or ");

  return alternatives
    ? `${date}${place} is not open, but ${alternatives} may work.`
    : `${date}${place} is not open for us.`;
}

function pricingLine(args: {
  contract: ReplyActionContract;
  knowledge: SimpleWeddingKnowledgeContext;
}) {
  if (!args.contract.mustMentionPricing && !args.contract.mayMentionPricing) {
    return undefined;
  }

  const region = args.knowledge.pricing.region === "FL"
    ? "Florida"
    : args.knowledge.pricing.region === "NC_SC_GA"
      ? "NC/SC/GA"
      : undefined;
  const regionText = region ? ` for ${region}` : "";
  const coverage = args.knowledge.pricing.coverageHours
    ? `${args.knowledge.pricing.coverageHours}-hour `
    : "";

  return `Our ${coverage}wedding films start at ${args.knowledge.pricing.startPrice}${regionText}.`;
}

function guideLine(args: {
  contract: ReplyActionContract;
  knowledge: SimpleWeddingKnowledgeContext;
}) {
  if (!args.contract.mustMentionGuide && !args.contract.mayMentionGuide) {
    return undefined;
  }

  if (args.knowledge.channel === "instagram" && args.knowledge.guide.imageUrl) {
    return "I'm sending the collections guide image here too.";
  }

  if (args.knowledge.guide.link) {
    return `I'm sending the collections guide here too: ${args.knowledge.guide.link}`;
  }

  if (args.knowledge.guide.imageUrl) {
    return "I'm sending the collections guide image here too.";
  }

  return undefined;
}

function portfolioLine(knowledge: SimpleWeddingKnowledgeContext) {
  const links = knowledge.guide.portfolioLinks.slice(0, 2);

  if (links.length === 0) {
    return undefined;
  }

  return `A couple recent films if you want to get a feel for the style: ${links
    .map((link) => `${link.label}: ${link.url}`)
    .join(" ")}`;
}

function questionLine(args: {
  contract: ReplyActionContract;
  state: SimpleWeddingSalesState;
  knowledge: SimpleWeddingKnowledgeContext;
}) {
  switch (args.contract.requiredQuestion) {
    case "coupleNames":
      return "What are the couple's names? I’ll keep everything organized on my side.";
    case "names":
      return "What are both of your names? I’ll keep everything organized on my side.";
    case "weddingDate":
      return "What date are you looking at?";
    case "location":
      return "What city or area is the wedding in?";
    case "venue":
      return "Do you already have a venue picked out?";
    case "callTime":
      return `What time works best for a quick call? I do consults ${args.knowledge.scheduling.callWindow}.`;
    case "email":
      return "What’s the best email for the calendar invite?";
    default:
      return undefined;
  }
}

function calendarLine(state: SimpleWeddingSalesState) {
  if (state.calendarStatus === "available" && state.checkedCallTime) {
    return `${state.checkedCallTime} works for a call.`;
  }

  if (state.calendarStatus === "busy") {
    const suggestions = state.suggestedCallTimes?.join(", ");

    return suggestions
      ? `That time is already taken, but ${suggestions} could work.`
      : "That time is already taken.";
  }

  return undefined;
}

function bookingLine(state: SimpleWeddingSalesState) {
  if (!state.bookingConfirmed) {
    return undefined;
  }

  const coupleName = getCoupleName(state);

  return coupleName
    ? `You’re all set. I booked the call for ${coupleName}.`
    : "You’re all set. I booked the call.";
}

function handoffLine() {
  return "I want to make sure I answer this correctly, so I’ll have someone take a look.";
}

function renderSafeTemplate(args: {
  state: SimpleWeddingSalesState;
  contract: ReplyActionContract;
  knowledge: SimpleWeddingKnowledgeContext;
}) {
  if (args.state.nextStep === "handoff") {
    return handoffLine();
  }

  return joinLines([
    greetingLine(args.state),
    shouldMentionAvailability(args.state) ? availabilityLine(args.state) : undefined,
    pricingLine(args),
    guideLine(args),
    calendarLine(args.state),
    bookingLine(args.state),
    questionLine(args),
  ]) || questionLine(args) || "Got it. I can help with that.";
}

export function writeConstrainedWeddingReply(args: {
  state: SimpleWeddingSalesState;
  contract: ReplyActionContract;
  knowledge: SimpleWeddingKnowledgeContext;
}): {
  text: string;
  guardResult: ReturnType<typeof validateGeneratedReply>;
} {
  const { state, contract, knowledge } = args;
  const shouldSharePortfolio =
    state.questionsAskedByCustomer.includes("portfolio") ||
    (contract.mustMentionGuide && knowledge.channel === "instagram");
  const draft =
    state.nextStep === "handoff"
      ? handoffLine()
      : joinLines([
          greetingLine(state),
          shouldMentionAvailability(state) ? availabilityLine(state) : undefined,
          pricingLine({ contract, knowledge }),
          guideLine({ contract, knowledge }),
          shouldSharePortfolio ? portfolioLine(knowledge) : undefined,
          calendarLine(state),
          bookingLine(state),
          questionLine({ contract, state, knowledge }),
        ]) || renderSafeTemplate(args);
  const guard = validateGeneratedReply({
    reply: draft,
    contract,
    knowledge,
    state,
  });

  if (guard.ok) {
    return {
      text: draft,
      guardResult: guard,
    };
  }

  return {
    text: renderSafeTemplate(args),
    guardResult: guard,
  };
}

export const simpleWeddingReplyWriterTestHelpers = {
  renderSafeTemplate,
  pricingLine,
  guideLine,
};
