import { formatSimpleWeddingDate } from "./reply";
import type { SimpleWeddingKnowledgeContext } from "./knowledge";
import type { ReplyActionContract } from "./reply-contract";
import { validateGeneratedReply } from "./reply-guards";
import type { SimpleWeddingSalesState } from "./state";

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

function availabilityLine(args: {
  state: SimpleWeddingSalesState;
  contract: ReplyActionContract;
}) {
  const { state, contract } = args;

  if (!state.availability || !state.weddingDate) {
    return undefined;
  }

  const date = formatSimpleWeddingDate(state.weddingDate);
  const place = state.location ? ` in ${state.location}` : "";
  const isFollowUpCheck = Boolean(!state.isFirstTurn && state.responseDraft);
  const updatedDateThisTurn = Boolean(state.lastUnderstanding?.facts.weddingDate);
  const updatedLocationThisTurn = Boolean(
    state.lastUnderstanding?.facts.location && !state.lastUnderstanding?.facts.weddingDate,
  );

  if (state.availability === "available") {
    if (contract.mentionPolicy.availability.mode === "still_available") {
      return state.location
        ? `Yep, that date is still showing open for ${state.location} 🤍`
        : "Yep, that date is still showing open 🤍";
    }

    if (isFollowUpCheck && updatedLocationThisTurn) {
      return `I checked ${state.location} too, and ${date} is still available there 🤍`;
    }

    if (isFollowUpCheck && updatedDateThisTurn) {
      return `I checked ${date}${place} too, and that date is available 🤍`;
    }

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
  if (args.contract.mentionPolicy.pricing.mode === "skip") {
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

  if (args.contract.mentionPolicy.pricing.mode === "same_as_before") {
    return `Yep, pricing is the same as I mentioned - ${args.knowledge.pricing.startPrice} for the ${coverage || ""}collection${regionText}.`;
  }

  if (args.contract.mentionPolicy.pricing.mode === "brief_reference") {
    return `Same starting point: ${args.knowledge.pricing.startPrice}${regionText}.`;
  }

  return `Our ${coverage}wedding films start at ${args.knowledge.pricing.startPrice}${regionText}.`;
}

function guideLine(args: {
  contract: ReplyActionContract;
  knowledge: SimpleWeddingKnowledgeContext;
}) {
  if (args.contract.mentionPolicy.guide.mode === "skip") {
    return undefined;
  }

  if (args.contract.mentionPolicy.guide.mode === "mention_already_sent") {
    return "I already sent the collections guide above, so you can reference that same one 🎥";
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
  const callWindow = args.knowledge.scheduling.callWindow.replace("America/New_York", "Eastern");
  const proposedTime = displayProposedCallTime(
    args.state.proposedCallTime ?? args.state.callTimeContext?.rejected?.value,
  );
  const checkedTime = displayCheckedCallTime(args.state);
  const offeredCallTimes = formatOfferedCallTimeOptions(args.state);

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
      if (
        args.state.calendarStatus === "available" &&
        args.state.customerEmail &&
        !args.state.customerConfirmedCallSlot
      ) {
        return `Perfect, got it. Want me to lock in ${checkedTime ?? "that time"}?`;
      }

      if (args.contract.questionPolicy.mode === "invalid_answer_retry") {
        if (args.contract.replyType === "call_time_ambiguous") {
          return `Either works - I just need one specific time to check the calendar. Would you prefer ${offeredCallTimes}?`;
        }

        return `${proposedTime ?? "That time"} is just outside my consult window - I do calls ${callWindow}. Would ${offeredCallTimes} work?`;
      }

      if (args.contract.questionPolicy.mode === "ask_after_context_change") {
        return `Same next step from here - what time would be best for a quick call? I do consults ${callWindow}.`;
      }

      if (args.contract.questionPolicy.mode === "gentle_reminder") {
        return `What time would be best for a quick call? I do consults ${callWindow}.`;
      }

      if (
        args.contract.questionPolicy.allowCompliment &&
        args.contract.questionPolicy.complimentSubject === "venue"
      ) {
        return `Beautiful - ${args.state.venue} gives us a good starting point.\n\nFrom here, the easiest next step is a quick consult so I can hear more about the day. What time works best? I do consults ${callWindow}.`;
      }

      return `From here, the easiest next step is a quick consult so I can hear more about the day. What time works best? I do consults ${callWindow}.`;
    case "email":
      return "What’s the best email for the calendar invite?";
    default:
      return undefined;
  }
}

function formatOfferedCallTimeOptions(state: SimpleWeddingSalesState) {
  const labels = state.callTimeContext?.options.map((option) => option.label) ?? [];

  if (labels.length === 0) {
    return "1pm or 2pm";
  }

  if (labels.length === 1) {
    return labels[0]!;
  }

  if (labels.length === 2) {
    return `${labels[0]} or ${labels[1]}`;
  }

  return `${labels.slice(0, -1).join(", ")}, or ${labels.at(-1)}`;
}

function displayProposedCallTime(value?: string) {
  if (!value) {
    return undefined;
  }

  const naturalMatch = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i.exec(value);

  if (naturalMatch) {
    return naturalMatch[0].toLowerCase().replace(/\s+/g, "");
  }

  const canonicalMatch = /T(\d{2}):(\d{2})/.exec(value.trim());

  if (!canonicalMatch) {
    return value;
  }

  return formatCallTime(`${canonicalMatch[1]}:${canonicalMatch[2]}`);
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

function displayCheckedCallTime(state: SimpleWeddingSalesState) {
  return state.checkedCallTime
    ? formatCallTime(state.checkedCallTime)
    : displayProposedCallTime(state.proposedCallTime);
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
  contract: ReplyActionContract,
) {
  if (
    contract.mentionPolicy.consultation.mode === "first_available" &&
    state.calendarStatus === "available" &&
    state.checkedCallTime
  ) {
    return `${formatCallTime(state.checkedCallTime)} works on my calendar ✨`;
  }

  if (contract.mentionPolicy.consultation.mode === "busy" && state.calendarStatus === "busy") {
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

  const time = displayCheckedCallTime(state);
  const email = state.customerEmail;
  const firstLine = time
    ? `Perfect - you're all set for ${time} ✨`
    : "Perfect - you're all set ✨";

  return email
    ? `${firstLine}\n\nYou should see the calendar invite come through at ${email}.`
    : `${firstLine}\n\nYou should see the calendar invite come through shortly.`;
}

function callLogisticsLine(state: SimpleWeddingSalesState) {
  if (!state.questionsAskedByCustomer.includes("booking")) {
    return undefined;
  }

  if (!/\b(?:where|how)\b[\s\S]{0,40}\b(?:call|talk|meet|consult)\b/i.test(state.latestCustomerMessage)) {
    return undefined;
  }

  if (state.bookingConfirmed) {
    return "The calendar invite has the call details. If anything looks off, just send me a message here.";
  }

  if (state.calendarStatus === "available") {
    return "Once I have the best email, I’ll send the calendar invite with the call details.";
  }

  return "We’ll use the calendar invite for the call details once we lock in the time.";
}

function identityLine(knowledge: SimpleWeddingKnowledgeContext) {
  return `Absolutely - you're speaking with me here. I'm ${knowledge.persona.name}, and I'm happy to go over anything you'd like before we finish 🤍`;
}

function teamLine(state: SimpleWeddingSalesState) {
  const asksIfTarasWillShoot = /\b(?:you|taras)\b[\s\S]{0,40}\b(?:shoot|shooter|film|filming)\b|\b(?:shoot|shooter|film|filming)\b[\s\S]{0,40}\b(?:you|taras)\b/i.test(
    state.latestCustomerMessage,
  );

  return asksIfTarasWillShoot
    ? "I'll be your point of contact here, and for Florida weddings Jay is our lead filmmaker in Tampa. I'll confirm the exact team details with you on the call."
    : "For Florida weddings, Jay is our lead filmmaker in Tampa. I'll confirm the exact team details with you on the call.";
}

function travelLine() {
  return "Yes, we do travel outside Tampa. Our collections include roundtrip travel coverage, and if the venue is beyond the included mileage, we can go over the exact travel details on the call 🤍";
}

function rawFootageLine(knowledge: SimpleWeddingKnowledgeContext) {
  const configured = knowledge.faq.rawFootage.answer;

  if (configured && !/do not calculate custom fees/i.test(configured)) {
    return configured;
  }

  return "Yes - raw footage can be added depending on the collection and what you're looking for. We can talk through the cleanest option on the call 🤍";
}

function mustAnswerRawFootage(contract: ReplyActionContract) {
  return Boolean(contract.mustAnswerQuestions?.includes("raw_footage"));
}

function shouldAnswerTeamQuestion(state: SimpleWeddingSalesState, contract: ReplyActionContract) {
  return (
    contract.mustAnswerTeam ||
    contract.replyType === "team_answer" ||
    state.questionsAskedByCustomer.includes("team")
  );
}

function clarificationLine() {
  return "I want to make sure I understand you correctly. Could you tell me a little more about what you'd like to know?";
}

function fallbackClarificationLine() {
  return "Sorry - I might be missing what you mean. Can you say that one more way?";
}

function handoffLine() {
  return "Good question — let me double-check that so I don't give you the wrong answer. I'll follow up here shortly 🤍";
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
    args.contract.mustMentionWeddingAvailability
      ? availabilityLine({ state: args.state, contract: args.contract })
      : undefined,
    pricingLine(args),
    guideLine(args),
    args.contract.mustMentionCalendarAvailability
      ? calendarLine(args.state, args.knowledge, args.contract)
      : undefined,
    args.state.questionsAskedByCustomer.includes("portfolio")
      ? portfolioLine(args.knowledge)
      : undefined,
    args.contract.mustMentionBookingConfirmation ? bookingLine(args.state) : undefined,
    callLogisticsLine(args.state),
    args.contract.mustAnswerIdentity ? identityLine(args.knowledge) : undefined,
    args.contract.mustAnswerTravel ? travelLine() : undefined,
    mustAnswerRawFootage(args.contract) ? rawFootageLine(args.knowledge) : undefined,
    shouldAnswerTeamQuestion(args.state, args.contract) ? teamLine(args.state) : undefined,
    args.contract.replyType === "clarification" ? clarificationLine() : undefined,
    questionLine(args),
  ]) || questionLine(args) || fallbackClarificationLine();
}

function renderCompactInstagramFallback(args: {
  state: SimpleWeddingSalesState;
  contract: ReplyActionContract;
  knowledge: SimpleWeddingKnowledgeContext;
}) {
  const greeting = greetingLine(args)?.replace(/\n{2,}/g, " ");
  const factLine = [
    args.contract.mustMentionWeddingAvailability
      ? availabilityLine({ state: args.state, contract: args.contract })
      : undefined,
    pricingLine(args),
    guideLine(args),
    args.contract.mustMentionCalendarAvailability
      ? calendarLine(args.state, args.knowledge, args.contract)
      : undefined,
    args.state.questionsAskedByCustomer.includes("portfolio")
      ? portfolioLine(args.knowledge)
      : undefined,
    args.contract.mustMentionBookingConfirmation ? bookingLine(args.state) : undefined,
    callLogisticsLine(args.state),
    args.contract.mustAnswerIdentity ? identityLine(args.knowledge) : undefined,
    args.contract.mustAnswerTravel ? travelLine() : undefined,
    mustAnswerRawFootage(args.contract) ? rawFootageLine(args.knowledge) : undefined,
    shouldAnswerTeamQuestion(args.state, args.contract) ? teamLine(args.state) : undefined,
    args.contract.replyType === "clarification" ? clarificationLine() : undefined,
  ]
    .filter(Boolean)
    .join(" ");
  const question = questionLine(args);

  return joinLines([greeting, factLine || undefined, question]) || fallbackClarificationLine();
}

export function writeConstrainedWeddingReply(args: {
  state: SimpleWeddingSalesState;
  contract: ReplyActionContract;
  knowledge: SimpleWeddingKnowledgeContext;
}): {
  text: string;
  guardResult: ReturnType<typeof validateGeneratedReply>;
  forceHandoff?: true;
} {
  const { state, contract, knowledge } = args;
  const shouldSharePortfolio = state.questionsAskedByCustomer.includes("portfolio");
  const draft =
    state.nextStep === "handoff"
      ? handoffLine()
      : joinLines([
          greetingLine({ contract, state, knowledge }),
          contract.mustMentionWeddingAvailability
            ? availabilityLine({ state, contract })
            : undefined,
          pricingLine({ contract, knowledge }),
          guideLine({ contract, knowledge }),
          shouldSharePortfolio ? portfolioLine(knowledge) : undefined,
          contract.mustMentionCalendarAvailability ? calendarLine(state, knowledge, contract) : undefined,
          contract.mustMentionBookingConfirmation ? bookingLine(state) : undefined,
          callLogisticsLine(state),
          contract.mustAnswerIdentity ? identityLine(knowledge) : undefined,
          contract.mustAnswerTravel ? travelLine() : undefined,
          mustAnswerRawFootage(contract) ? rawFootageLine(knowledge) : undefined,
          shouldAnswerTeamQuestion(state, contract) ? teamLine(state) : undefined,
          contract.replyType === "clarification" ? clarificationLine() : undefined,
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

  const fallback =
    knowledge.channel === "instagram"
      ? renderCompactInstagramFallback(args)
      : renderSafeTemplate(args);
  const fallbackGuard = validateGeneratedReply({
    reply: fallback,
    contract,
    knowledge,
    state,
  });

  if (fallbackGuard.ok) {
    return {
      text: fallback,
      guardResult: fallbackGuard,
    };
  }

  const minimal = renderSafeTemplate(args);
  const minimalGuard = validateGeneratedReply({
    reply: minimal,
    contract,
    knowledge,
    state,
  });

  if (!minimalGuard.ok) {
    return {
      text: handoffLine(),
      guardResult: minimalGuard,
      forceHandoff: true,
    };
  }

  return {
    text: minimal,
    guardResult: minimalGuard,
  };
}

export const simpleWeddingReplyWriterTestHelpers = {
  renderSafeTemplate,
  renderCompactInstagramFallback,
  pricingLine,
  guideLine,
};
