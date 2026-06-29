import { formatSimpleWeddingDate } from "./reply";
import { getPostBookingFaqAnswer, type SimpleWeddingKnowledgeContext } from "./knowledge";
import type { ReplyActionContract } from "./reply-contract";
import { validateGeneratedReply } from "./reply-guards";
import {
  missingResponseVariationSlots,
  renderResponseVariation,
  selectResponseVariationCandidates,
} from "./responses";
import type {
  SimpleWeddingSalesResponseKey,
  SimpleWeddingSalesState,
  SimpleWeddingSalesWriterCatalogTrace,
} from "./state";

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

function promotionLine(args: {
  contract: ReplyActionContract;
  knowledge: SimpleWeddingKnowledgeContext;
}) {
  if (
    !args.knowledge.pricing.promotionText ||
    (!args.contract.mustMentionPricing && args.contract.mentionPolicy.guide.mode === "skip")
  ) {
    return undefined;
  }

  return args.knowledge.pricing.promotionText;
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
    return "I’ll include the collections guide here so you can look through the options 🎥";
  }

  if (args.knowledge.guide.link) {
    return `I’ll include the collections guide here so you can look through the options 🎥 ${args.knowledge.guide.link}`;
  }

  if (args.knowledge.guide.imageUrl) {
    return "I’ll include the collections guide here so you can look through the options 🎥";
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

function coverageRegionLabel(knowledge: SimpleWeddingKnowledgeContext) {
  if (knowledge.pricing.region === "FL") {
    return "Florida";
  }

  if (knowledge.pricing.region === "NC_SC_GA") {
    return "NC/SC/GA";
  }

  return knowledge.pricing.region;
}

function formatCallWindow(knowledge: SimpleWeddingKnowledgeContext) {
  return knowledge.scheduling.callWindow.replace("America/New_York", "Eastern");
}

function buildResponseCatalogSlots(
  state: SimpleWeddingSalesState,
  knowledge?: SimpleWeddingKnowledgeContext,
  contract?: ReplyActionContract,
) {
  const location = state.location;
  const customerFirstName = state.customerName?.trim().split(/\s+/)[0] || "there";
  const knownLeadParts = [
    state.venue && location
      ? `${state.venue} in ${location}`
      : state.venue ?? location,
    !state.weddingDate && state.weddingDateText ? state.weddingDateText : undefined,
  ].filter(Boolean);
  const knownLeadContext = knownLeadParts.length > 0
    ? `I have ${knownLeadParts.join(" and ")}.`
    : undefined;
  const weddingDateQuestion =
    !state.weddingDate && state.weddingDateText
      ? "Just to confirm - what year is the wedding?"
      : "What date are you looking at?";
  const pricingGuideBlock =
    knowledge && contract && (contract.mustMentionPricing || contract.mustMentionGuide)
      ? [
          contract.mustMentionPricing ? pricingLine({ contract, knowledge }) : undefined,
          promotionLine({ contract, knowledge }),
          contract.mentionPolicy.guide.mode !== "skip"
            ? "I'll send the collections guide here so you can look through the options 🎥"
            : undefined,
        ].filter(Boolean).join("\n")
      : undefined;
  const greetingIntroduction = knowledge
    ? renderCopy(knowledge.persona.replyStyle.greetingIntroduction, {
        name: knowledge.persona.name,
        company: knowledge.persona.company,
      })
    : undefined;
  const greetingCelebration =
    state.senderRole === "mother" || state.senderRole === "planner"
      ? ""
      : knowledge?.persona.replyStyle.greetingCelebration;

  return {
    greetingOpening: knowledge?.persona.replyStyle.greetingOpening,
    greetingIntroduction,
    greetingCelebration,
    customerFirstName,
    knownLeadContext,
    weddingDateQuestion,
    pricingGuideBlock,
    callTimeDisplay: displayCheckedCallTime(state),
    email: state.customerEmail,
    weddingDateDisplay: state.weddingDateDisplay ?? (
      state.weddingDate ? formatSimpleWeddingDate(state.weddingDate) : undefined
    ),
    location,
    locationDisplay: location,
    venue: state.venue,
    startPrice: knowledge?.pricing.startPrice,
    coverageHours: knowledge?.pricing.coverageHours
      ? String(knowledge.pricing.coverageHours)
      : undefined,
    coverageRegion: knowledge ? coverageRegionLabel(knowledge) : undefined,
    promotionText: knowledge?.pricing.promotionText ?? "",
    callWindow: knowledge ? formatCallWindow(knowledge) : undefined,
  };
}

function compatibleResponseKeys(contract: ReplyActionContract): SimpleWeddingSalesResponseKey[] {
  if (contract.mustMentionBookingConfirmation) {
    return ["utter_booking_confirmed"];
  }

  if (contract.mentionPolicy.consultation.mode === "ask_booking_confirmation") {
    return ["utter_ask_booking_confirmation"];
  }

  if (contract.mentionPolicy.consultation.mode === "first_available") {
    return ["utter_calendar_available_ask_email", "utter_ask_email"];
  }

  if (contract.mustAnswerQuestions?.includes("raw_footage")) {
    return ["utter_answer_raw_footage"];
  }

  if (contract.mustAnswerTravel && contract.requiredQuestion === "callTime") {
    return ["utter_answer_travel_resume_call_time"];
  }

  if (contract.replyType === "acknowledgement_only") {
    return ["utter_acknowledgement"];
  }

  if (contract.requiredQuestion === "callTime") {
    return ["utter_venue_collected_ask_call_time", "utter_ask_call_time"];
  }

  if (contract.requiredQuestion === "venue") {
    return ["utter_ask_venue"];
  }

  if (
    contract.requiredQuestion === "names" &&
    contract.mustMentionWeddingAvailability &&
    contract.mustMentionPricing &&
    contract.mentionPolicy.guide.mode !== "skip"
  ) {
    return ["utter_availability_available_ask_names", "utter_ask_names_after_details"];
  }

  if (
    contract.requiredQuestion === "names" &&
    contract.mustMentionPricing &&
    contract.mentionPolicy.pricing.mode === "same_as_before"
  ) {
    return ["utter_pricing_repeat_send_guide_ask_names"];
  }

  return contract.responseKey ? [contract.responseKey] : [];
}

function responseKeyCompatibility(contract: ReplyActionContract) {
  const expectedResponseKeys = compatibleResponseKeys(contract);
  const ok = Boolean(
    !contract.responseKey ||
      expectedResponseKeys.length === 0 ||
      expectedResponseKeys.includes(contract.responseKey),
  );

  return {
    ok,
    replyType: contract.replyType,
    responseKey: contract.responseKey,
    expectedResponseKeys,
  };
}

function catalogResponseKeyForContract(
  contract: ReplyActionContract,
): SimpleWeddingSalesResponseKey | undefined {
  return contract.responseKey ?? compatibleResponseKeys(contract)[0];
}

function normalizeCatalogTextForContract(args: {
  text: string;
  responseKey: SimpleWeddingSalesResponseKey;
  contract: ReplyActionContract;
  state: SimpleWeddingSalesState;
  knowledge?: SimpleWeddingKnowledgeContext;
}) {
  let text = args.text;

  if (
    args.knowledge &&
    args.responseKey === "utter_availability_available_ask_names" &&
    args.contract.mustGreet
  ) {
    const greeting = greetingLine({
      contract: args.contract,
      state: args.state,
      knowledge: args.knowledge,
    })?.replace(/\n{2,}/g, " ");
    text = joinLines([greeting, text]);
  }

  if (
    args.responseKey !== "utter_availability_available_ask_names" ||
    args.contract.mentionPolicy.guide.mode !== "skip"
  ) {
    return text;
  }

  return text
    .replace(/\n?I(?:'|’)?ll send the collections guide here so you can look through the options 🎥/i, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const SAFE_OBLIGATION_CATALOG_KEYS = new Set<SimpleWeddingSalesResponseKey>([
  "utter_availability_available_ask_names",
  "utter_pricing_repeat_send_guide_ask_names",
  "utter_ask_wedding_date_only",
  "utter_venue_collected_ask_call_time",
  "utter_answer_travel_resume_call_time",
  "utter_calendar_available_ask_email",
]);

function catalogExclusionReason(
  contract: ReplyActionContract,
  responseKey = catalogResponseKeyForContract(contract),
) {
  const allowsWeddingAvailability =
    responseKey === "utter_availability_available_ask_names" && contract.mustMentionPricing;
  const allowsPricing =
    responseKey === "utter_availability_available_ask_names" ||
    responseKey === "utter_pricing_repeat_send_guide_ask_names" ||
    responseKey === "utter_ask_wedding_date_only";
  const allowsCalendarAvailability = responseKey === "utter_calendar_available_ask_email";
  const allowsTravel = responseKey === "utter_answer_travel_resume_call_time";
  const allowsSafeObligations = Boolean(responseKey && SAFE_OBLIGATION_CATALOG_KEYS.has(responseKey));

  if (
    (!allowsSafeObligations &&
      contract.mustGreet &&
      responseKey !== "utter_ask_wedding_details") ||
    (contract.mustMentionWeddingAvailability && !allowsWeddingAvailability) ||
    (contract.mustMentionCalendarAvailability && !allowsCalendarAvailability) ||
    ((contract.mustMentionPricing || contract.mustMentionGuide) && !allowsPricing) ||
    (contract.mustAnswerTravel && !allowsTravel) ||
    contract.mustAnswerTeam ||
    contract.mustAnswerIdentity ||
    contract.mustAnswerQuestions?.includes("portfolio")
  ) {
    return "responseKey_excluded" as const;
  }

  if (
    contract.requiredQuestion === "callTime" &&
    responseKey !== "utter_venue_collected_ask_call_time" &&
    responseKey !== "utter_answer_travel_resume_call_time" &&
    (contract.questionPolicy.mode !== "first_ask" ||
      contract.questionPolicy.allowCompliment)
  ) {
    return "responseKey_excluded" as const;
  }

  return undefined;
}

function previousVariationIdsForResponseKey(args: {
  state: SimpleWeddingSalesState;
  responseKey: SimpleWeddingSalesResponseKey;
}) {
  return (
    args.state.replyMemory?.responseVariations
      ?.filter((variation) => variation.responseKey === args.responseKey)
      .map((variation) => variation.variationId)
      .slice(-1) ?? []
  );
}

function tryBuildResponseFromCatalog(args: {
  state: SimpleWeddingSalesState;
  contract: ReplyActionContract;
  knowledge?: SimpleWeddingKnowledgeContext;
}): {
  text: string;
  responseKey: SimpleWeddingSalesResponseKey;
  variationId: string;
  variationSeed: string;
  trace: SimpleWeddingSalesWriterCatalogTrace;
} | null {
  const catalogResponseKey = catalogResponseKeyForContract(args.contract);
  const compatibility = responseKeyCompatibility(args.contract);

  if (!catalogResponseKey) {
    return null;
  }

  const exclusionReason = catalogExclusionReason(args.contract, catalogResponseKey);

  if (exclusionReason) {
    return null;
  }

  const turnIndex = args.state.replyMemory?.turnIndex ?? 0;
  const variationSeed = `${args.state.contactId ?? ""}:${turnIndex}:${catalogResponseKey}`;
  const variations = selectResponseVariationCandidates({
    responseKey: catalogResponseKey,
    contactId: args.state.contactId,
    turnIndex,
    lastVariationIds: previousVariationIdsForResponseKey({
      state: args.state,
      responseKey: catalogResponseKey,
    }),
  });

  if (variations.length === 0) {
    return null;
  }

  const slots = buildResponseCatalogSlots(args.state, args.knowledge, args.contract);
  const variation = variations[0]!;
  const missingTemplateSlots = missingResponseVariationSlots(variation, slots);

  if (missingTemplateSlots.length > 0) {
    return {
      text: "",
      responseKey: catalogResponseKey,
      variationId: variation.id,
      variationSeed,
      trace: {
        eligible: true,
        reason: "missing_template_slot",
        responseKey: catalogResponseKey,
        attemptedVariationId: variation.id,
        guardOk: false,
        fallbackReason: "missing_template_slot",
        missingTemplateSlots,
        responseKeyCompatibility: compatibility,
      },
    };
  }

  return {
    text: normalizeCatalogTextForContract({
      text: renderResponseVariation(variation, slots),
      responseKey: catalogResponseKey,
      contract: args.contract,
      state: args.state,
      knowledge: args.knowledge,
    }),
    responseKey: catalogResponseKey,
    variationId: variation.id,
    variationSeed,
    trace: {
      eligible: true,
      responseKey: catalogResponseKey,
      selectedVariationId: variation.id,
      responseKeyCompatibility: compatibility,
    },
  };
}

function buildCatalogTraceForSkippedContract(
  contract: ReplyActionContract,
): SimpleWeddingSalesWriterCatalogTrace {
  const compatibility = responseKeyCompatibility(contract);
  const responseKey = catalogResponseKeyForContract(contract);

  if (!responseKey) {
    return {
      eligible: false,
      reason: "responseKey_missing",
      fallbackReason: "responseKey_missing",
      responseKeyCompatibility: compatibility,
    };
  }

  const exclusionReason = catalogExclusionReason(contract, responseKey);

  if (exclusionReason) {
    return {
      eligible: false,
      reason: exclusionReason,
      responseKey,
      fallbackReason: exclusionReason,
      responseKeyCompatibility: compatibility,
    };
  }

  return {
    eligible: false,
    reason: "responseKey_not_in_catalog",
    responseKey,
    fallbackReason: "responseKey_not_in_catalog",
    responseKeyCompatibility: compatibility,
  };
}

function responseCatalogFallbackReason(
  catalogDraft: ReturnType<typeof tryBuildResponseFromCatalog>,
) {
  return catalogDraft?.trace.fallbackReason === "missing_template_slot"
    ? "missing_template_slot"
    : "response_catalog_guard_failed";
}

function tryBuildGuardedResponseFromCatalog(args: {
  state: SimpleWeddingSalesState;
  contract: ReplyActionContract;
  knowledge: SimpleWeddingKnowledgeContext;
}): {
  text: string;
  responseKey: SimpleWeddingSalesResponseKey;
  variationId: string;
  variationSeed: string;
  guardResult: ReturnType<typeof validateGeneratedReply>;
  trace: SimpleWeddingSalesWriterCatalogTrace;
} | null {
  const catalogResponseKey = catalogResponseKeyForContract(args.contract);
  const compatibility = responseKeyCompatibility(args.contract);

  if (!catalogResponseKey) {
    return null;
  }

  const exclusionReason = catalogExclusionReason(args.contract, catalogResponseKey);

  if (exclusionReason) {
    return null;
  }

  const turnIndex = args.state.replyMemory?.turnIndex ?? 0;
  const variationSeed = `${args.state.contactId ?? ""}:${turnIndex}:${catalogResponseKey}`;
  const variations = selectResponseVariationCandidates({
    responseKey: catalogResponseKey,
    contactId: args.state.contactId,
    turnIndex,
    lastVariationIds: previousVariationIdsForResponseKey({
      state: args.state,
      responseKey: catalogResponseKey,
    }),
  });
  const slots = buildResponseCatalogSlots(args.state, args.knowledge, args.contract);
  let firstFailure: SimpleWeddingSalesWriterCatalogTrace | undefined;

  for (const variation of variations) {
    const missingTemplateSlots = missingResponseVariationSlots(variation, slots);

    if (missingTemplateSlots.length > 0) {
      firstFailure ??= {
        eligible: true,
        reason: "missing_template_slot",
        responseKey: catalogResponseKey,
        attemptedVariationId: variation.id,
        guardOk: false,
        fallbackReason: "missing_template_slot",
        missingTemplateSlots,
        responseKeyCompatibility: compatibility,
      };
      continue;
    }

    const text = normalizeCatalogTextForContract({
      text: renderResponseVariation(variation, slots),
      responseKey: catalogResponseKey,
      contract: args.contract,
      state: args.state,
      knowledge: args.knowledge,
    });
    const guardResult = validateGeneratedReply({
      reply: text,
      contract: args.contract,
      knowledge: args.knowledge,
      state: args.state,
    });

    if (guardResult.ok) {
      return {
        text,
        responseKey: catalogResponseKey,
        variationId: variation.id,
        variationSeed,
        guardResult,
        trace: {
          eligible: true,
          reason: "selected",
          responseKey: catalogResponseKey,
          selectedVariationId: variation.id,
          guardOk: true,
          responseKeyCompatibility: compatibility,
        },
      };
    }

    firstFailure ??= {
      eligible: true,
      reason: "guard_failed",
      responseKey: catalogResponseKey,
      attemptedVariationId: variation.id,
      guardOk: false,
      fallbackReason: "response_catalog_guard_failed",
      responseKeyCompatibility: compatibility,
    };
  }

  return firstFailure
    ? {
        text: "",
        responseKey: catalogResponseKey,
        variationId: firstFailure.attemptedVariationId ?? variations[0]?.id ?? "",
        variationSeed,
        guardResult: { ok: false, reasons: [firstFailure.fallbackReason ?? "catalog_failed"] },
        trace: firstFailure,
      }
    : null;
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

function travelLine(knowledge: SimpleWeddingKnowledgeContext) {
  const region = coverageRegionLabel(knowledge);
  const regionText = region ? ` for ${region}` : "";

  return `Yes, we do travel. Our collections include travel coverage${regionText}, and if the venue is beyond the included mileage, we can go over the exact travel details on the call 🤍`;
}

function rawFootageLine(knowledge: SimpleWeddingKnowledgeContext) {
  const configured = knowledge.faq.rawFootage.answer;

  if (configured && !/do not calculate custom fees/i.test(configured)) {
    return configured;
  }

  return "Yes - raw footage can be added depending on the collection and what you're looking for. We can talk through the cleanest option on the call 🤍";
}

function postBookingFaqLine(args: {
  state: SimpleWeddingSalesState;
  knowledge: SimpleWeddingKnowledgeContext;
}) {
  const command = args.state.dialogueCommands?.find(
    (
      item,
    ): item is Extract<
      NonNullable<SimpleWeddingSalesState["dialogueCommands"]>[number],
      { type: "answer_question" }
    > => item.type === "answer_question",
  );

  if (!command) {
    return undefined;
  }

  const result = getPostBookingFaqAnswer({
    question: command.question,
    knowledge: args.knowledge,
  });

  return result.exists ? result.answer : undefined;
}

function bookingDetailsLine(state: SimpleWeddingSalesState) {
  const command = state.dialogueCommands?.find(
    (
      item,
    ): item is Extract<
      NonNullable<SimpleWeddingSalesState["dialogueCommands"]>[number],
      { type: "ask_booking_details" }
    > => item.type === "ask_booking_details",
  );
  const detail = command?.detail;
  const time = displayCheckedCallTime(state);

  if (detail === "time") {
    return time
      ? `It's set for ${time} 🤍`
      : "The exact call time should be in the calendar invite. If anything looks off, I can have Taras double-check it.";
  }

  if (detail === "email") {
    return state.customerEmail
      ? `The invite should come through at ${state.customerEmail}.`
      : "I don't have the email in front of me here, so I'll have Taras double-check the invite details.";
  }

  if (detail === "invite") {
    if (state.customerEmail && time) {
      return `The calendar invite should come through at ${state.customerEmail} for ${time}.`;
    }

    if (state.customerEmail) {
      return `The calendar invite should come through at ${state.customerEmail}.`;
    }

    return "The invite should be in your calendar/email. If you don't see it, I can have Taras double-check it.";
  }

  return undefined;
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

function acknowledgementLine() {
  return "Of course 🤍";
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
    promotionLine(args),
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
    args.contract.mustAnswerTravel ? travelLine(args.knowledge) : undefined,
    mustAnswerRawFootage(args.contract) ? rawFootageLine(args.knowledge) : undefined,
    shouldAnswerTeamQuestion(args.state, args.contract) ? teamLine(args.state) : undefined,
    args.contract.replyType === "acknowledgement_only" ? acknowledgementLine() : undefined,
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
    promotionLine(args),
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
    args.contract.mustAnswerTravel ? travelLine(args.knowledge) : undefined,
    mustAnswerRawFootage(args.contract) ? rawFootageLine(args.knowledge) : undefined,
    shouldAnswerTeamQuestion(args.state, args.contract) ? teamLine(args.state) : undefined,
    args.contract.replyType === "acknowledgement_only" ? acknowledgementLine() : undefined,
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
  writer: NonNullable<SimpleWeddingSalesState["writer"]>;
  writerCatalog: SimpleWeddingSalesWriterCatalogTrace;
  forceHandoff?: true;
} {
  const { state, contract, knowledge } = args;

  if (contract.replyType === "post_booking_faq" || contract.replyType === "answer_booking_details") {
    const directDraft =
      contract.replyType === "post_booking_faq"
        ? postBookingFaqLine({ state, knowledge })
        : bookingDetailsLine(state);

    if (directDraft) {
      const directGuard = validateGeneratedReply({
        reply: directDraft,
        contract,
        knowledge,
        state,
      });

      return {
        text: directDraft,
        guardResult: directGuard,
        writer: {
          mode: "deterministic_fallback",
          responseKey: contract.responseKey,
          fallbackReason: directGuard.ok ? undefined : "response_catalog_guard_failed",
        },
        writerCatalog: buildCatalogTraceForSkippedContract(contract),
      };
    }
  }

  const catalogDraft = tryBuildResponseFromCatalog({ state, contract, knowledge });
  const guardedCatalogDraft = tryBuildGuardedResponseFromCatalog({ state, contract, knowledge });
  const writerCatalog =
    guardedCatalogDraft?.trace ??
    catalogDraft?.trace ??
    buildCatalogTraceForSkippedContract(contract);

  if (guardedCatalogDraft?.text && guardedCatalogDraft.guardResult.ok) {
    return {
      text: guardedCatalogDraft.text,
      guardResult: guardedCatalogDraft.guardResult,
      writer: {
        mode: "response_catalog",
        responseKey: guardedCatalogDraft.responseKey,
        variationId: guardedCatalogDraft.variationId,
        variationSeed: guardedCatalogDraft.variationSeed,
      },
      writerCatalog,
    };
  }

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
          contract.mustAnswerTravel ? travelLine(knowledge) : undefined,
          mustAnswerRawFootage(contract) ? rawFootageLine(knowledge) : undefined,
          shouldAnswerTeamQuestion(state, contract) ? teamLine(state) : undefined,
          contract.replyType === "acknowledgement_only" ? acknowledgementLine() : undefined,
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
      writer: {
        mode: "deterministic_fallback",
        fallbackReason: catalogDraft ? responseCatalogFallbackReason(catalogDraft) : undefined,
        responseKey: catalogDraft?.responseKey,
        attemptedVariationId: catalogDraft?.variationId,
      },
      writerCatalog,
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
      writer: {
        mode: "deterministic_fallback",
        fallbackReason: catalogDraft
          ? responseCatalogFallbackReason(catalogDraft)
          : "primary_reply_guard_failed",
        responseKey: catalogDraft?.responseKey,
        attemptedVariationId: catalogDraft?.variationId,
      },
      writerCatalog,
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
      writer: {
        mode: "deterministic_fallback",
        fallbackReason: "all_reply_guards_failed",
        responseKey: catalogDraft?.responseKey,
        attemptedVariationId: catalogDraft?.variationId,
      },
      writerCatalog,
      forceHandoff: true,
    };
  }

  return {
    text: minimal,
    guardResult: minimalGuard,
    writer: {
      mode: "deterministic_fallback",
      fallbackReason: catalogDraft
        ? responseCatalogFallbackReason(catalogDraft)
        : "compact_reply_guard_failed",
      responseKey: catalogDraft?.responseKey,
      attemptedVariationId: catalogDraft?.variationId,
    },
    writerCatalog,
  };
}

export const simpleWeddingReplyWriterTestHelpers = {
  renderSafeTemplate,
  renderCompactInstagramFallback,
  pricingLine,
  guideLine,
  tryBuildResponseFromCatalog,
};
