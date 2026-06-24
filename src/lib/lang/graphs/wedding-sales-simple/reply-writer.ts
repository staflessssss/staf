import { formatSimpleWeddingDate } from "./reply";
import type { SimpleWeddingKnowledgeContext } from "./knowledge";
import type { ReplyActionContract } from "./reply-contract";
import { validateGeneratedReply } from "./reply-guards";
import { getCoupleName, type SimpleWeddingSalesState } from "./state";

function joinLines(lines: Array<string | undefined>) {
  return lines.filter(Boolean).join("\n\n");
}

function renderCopy(template: string, values: Record<string, string | undefined>) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{{${key}}}`, value ?? ""),
    template,
  ).trim();
}

function greetingLine(args: {
  contract: ReplyActionContract;
  state: SimpleWeddingSalesState;
  knowledge: SimpleWeddingKnowledgeContext;
}) {
  if (!args.contract.mustGreet) {
    return undefined;
  }

  const style = args.knowledge.persona.replyStyle;
  const introduction = renderCopy(style.greetingIntroduction, {
    name: args.knowledge.persona.name,
    company: args.knowledge.persona.company,
  });
  const celebration =
    args.state.senderRole === "mother" || args.state.senderRole === "planner"
      ? undefined
      : style.greetingCelebration;

  return joinLines([
    style.greetingOpening,
    [introduction, celebration].filter(Boolean).join(" "),
  ]);
}

function availabilityLine(state: SimpleWeddingSalesState) {
  if (!state.availability || !state.weddingDate) {
    return undefined;
  }

  const date = formatSimpleWeddingDate(state.weddingDate);
  const place = state.location ? ` in ${state.location}` : "";

  if (state.availability === "available") {
    return `Great news - I checked ${date}${place}, and the date is available 🤍`;
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
    return "I’m sending the collections guide image here too 🎥";
  }

  if (args.knowledge.guide.link) {
    return `I’m sending the collections guide here too 🎥 ${args.knowledge.guide.link}`;
  }

  if (args.knowledge.guide.imageUrl) {
    return "I’m sending the collections guide image here too 🎥";
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
      return "And what are both of your names? I’ll keep everything organized on my side.";
    case "weddingDate":
      return "What date are you looking at?";
    case "location":
      return "What city or area is the wedding in?";
    case "venue":
      return `${args.knowledge.persona.replyStyle.namesAcknowledgement} Do you already have a venue picked out?`;
    case "callTime":
      return `${renderCopy(args.knowledge.persona.replyStyle.venueAcknowledgement, {
        venue: args.state.venue,
      })} What time works best for a quick call? I do consults ${args.knowledge.scheduling.callWindow.replace("America/New_York", "Eastern")}.`;
    case "email":
      return "What’s the best email for the calendar invite?";
    default:
      return undefined;
  }
}

function formatCallTime(value: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());

  if (!match) {
    return value;
  }

  const hour = Number(match[1]);
  const minutes = match[2];
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${suffix}`;
}

function formatTimeList(values: string[]) {
  const labels = values.map(formatCallTime);

  if (labels.length <= 1) {
    return labels[0] ?? "";
  }

  if (labels.length === 2) {
    return `${labels[0]} or ${labels[1]}`;
  }

  return `${labels.slice(0, -1).join(", ")}, or ${labels.at(-1)}`;
}

function calendarLine(
  state: SimpleWeddingSalesState,
  knowledge: SimpleWeddingKnowledgeContext,
) {
  if (state.calendarStatus === "available" && state.checkedCallTime) {
    return `${formatCallTime(state.checkedCallTime)} works perfectly for a call ✨`;
  }

  if (state.calendarStatus === "busy") {
    const suggestions = formatTimeList(state.suggestedCallTimes ?? []);

    return suggestions
      ? `${knowledge.persona.replyStyle.calendarAlternativesIntro} ${suggestions} instead. ${knowledge.persona.replyStyle.calendarAlternativesQuestion}`
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
    greetingLine({ contract: args.contract, state: args.state, knowledge: args.knowledge }),
    args.contract.mustMentionWeddingAvailability ? availabilityLine(args.state) : undefined,
    pricingLine(args),
    guideLine(args),
    args.contract.mustMentionCalendarAvailability
      ? calendarLine(args.state, args.knowledge)
      : undefined,
    args.contract.mustMentionBookingConfirmation ? bookingLine(args.state) : undefined,
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
          greetingLine({ contract, state, knowledge }),
          contract.mustMentionWeddingAvailability ? availabilityLine(state) : undefined,
          pricingLine({ contract, knowledge }),
          guideLine({ contract, knowledge }),
          shouldSharePortfolio ? portfolioLine(knowledge) : undefined,
          contract.mustMentionCalendarAvailability ? calendarLine(state, knowledge) : undefined,
          contract.mustMentionBookingConfirmation ? bookingLine(state) : undefined,
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
