import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

import { traceLangRuntime } from "@/lib/lang/langsmith";

import { buildWeddingSalesResponseContext } from "./action-plan/response-context";
import { resolveWeddingSalesRegion, selectWeddingSalesPricing, type WeddingSalesConfig } from "./config";
import { buildWeddingSalesDialogPolicy, type WeddingSalesDialogPolicy } from "./policy";
import type { WeddingSalesField } from "./semantic-v2/schema";
import type { WeddingSalesState } from "./state";

export type WeddingSalesResponseIntent =
  | "ask_missing_info"
  | "ask_location_or_venue"
  | "ask_wedding_year"
  | "availability_tool_missing"
  | "availability_available"
  | "availability_unavailable"
  | "answer_question"
  | "ask_call_time"
  | "ask_email"
  | "calendar_time_missing"
  | "calendar_date_mismatch"
  | "calendar_available"
  | "calendar_busy"
  | "calendar_outside_window"
  | "booking_tool_missing"
  | "booking_confirmed"
  | "booking_failed";

type ComposeWeddingSalesResponseArgs = {
  intent: WeddingSalesResponseIntent;
  config: WeddingSalesConfig;
  state: WeddingSalesState;
  summary?: string;
  testMode?: boolean;
  policy?: WeddingSalesDialogPolicy;
};

type WeddingSalesReflectionReview = {
  status: "pass" | "rewrite";
  revisedText: string;
  issues: string[];
};

const DEFAULT_RESPONSE_MODEL = "gpt-4.1-mini";
const DEFAULT_REFLECTION_MODEL = "gpt-4.1-mini";
const INSTAGRAM_FIRST_CONTACT_OPENING = [
  "Hey there! Thank you so much for reaching out 🤍✨",
  "",
  "I’m Taras, the founder of Myndful Films. Huge congratulations on your engagement, such an exciting season of life.",
].join("\n");
const INSTAGRAM_ROBOTIC_PHRASES = [
  "to help us get started",
  "this will allow me",
  "provide the best information",
  "tailored to your special day",
  "perfectly personalized",
  "help me assist you",
  "plan accordingly",
  "capture your story perfectly",
  "tailor everything just right",
  "that way",
  "could you please",
  "please provide",
  "when you get a chance",
  "whenever you're ready",
  "to get a better sense",
  "that'll help",
  "that will help",
  "next steps",
  "get everything lined up",
] as const;
const BRAND_EMOJIS = ["🤍", "✨", "🎥"] as const;
const BRAND_EMOJI_BY_INTENT: Partial<Record<WeddingSalesResponseIntent, (typeof BRAND_EMOJIS)[number]>> = {
  ask_missing_info: "🤍",
  availability_available: "🤍",
  availability_unavailable: "🤍",
  booking_confirmed: "✨",
};

function appendSignatureOnce(text: string, signature: string) {
  const body = text.trim();
  const trimmedSignature = signature.trim();

  if (!trimmedSignature || body.endsWith(trimmedSignature)) {
    return body;
  }

  return `${body}\n\n${trimmedSignature}`;
}

function hasBrandEmoji(text: string) {
  return BRAND_EMOJIS.some((emoji) => text.includes(emoji));
}

function insertEmojiAfterFirstSentence(text: string, emoji: string) {
  const trimmed = text.trim();
  const firstSentence = trimmed.match(/^([\s\S]*?[.!?])(\s|$)/);

  if (!firstSentence) {
    return `${trimmed} ${emoji}`;
  }

  return `${firstSentence[1]} ${emoji}${trimmed.slice(firstSentence[1].length)}`;
}

function applyBrandEmojiCadence(args: ComposeWeddingSalesResponseArgs & { text: string }) {
  const emoji = BRAND_EMOJI_BY_INTENT[args.intent];

  if (!emoji || hasBrandEmoji(args.text)) {
    return args.text.trim();
  }

  return insertEmojiAfterFirstSentence(args.text, emoji);
}

function getChannelFormatting(config: WeddingSalesConfig, state: WeddingSalesState) {
  return config.channelFormatting[state.channel] ?? config.channelFormatting.gmail;
}

function formatLink(args: {
  label: string;
  url?: string;
  config: WeddingSalesConfig;
  state: WeddingSalesState;
}) {
  if (!args.url) {
    return args.label;
  }

  return getChannelFormatting(args.config, args.state).richLinks
    ? `<a href="${args.url}">${args.label}</a>`
    : `${args.label}: ${args.url}`;
}

function formatPortfolioLinks(config: WeddingSalesConfig, state: WeddingSalesState) {
  return config.portfolio
    .map((item) => formatLink({ label: item.label, url: item.url, config, state }))
    .filter(Boolean)
    .join("\n");
}

function formatGuideText(config: WeddingSalesConfig, state: WeddingSalesState) {
  if (config.guide.link) {
    return `You can review the collections guide here: ${formatLink({
      label: config.guide.fileName || "Collections Guide",
      url: config.guide.link,
      config,
      state,
    })}`;
  }

  if (getChannelFormatting(config, state).allowAttachments) {
    return "I am attaching the collections guide so you can review the full details.";
  }

  return "I can send over the collections guide with the full details.";
}

function formatStartPrice(config: WeddingSalesConfig, state: Pick<WeddingSalesState, "location" | "venue">) {
  return selectWeddingSalesPricing(config, state).startPrice;
}

function formatStartingPriceLine(config: WeddingSalesConfig, state: Pick<WeddingSalesState, "location" | "venue">) {
  const pricing = selectWeddingSalesPricing(config, state);
  const coverageHours = pricing.coverageHours ?? 8;

  return `Our ${coverageHours}-hour collections start at ${pricing.startPrice}.`;
}

function formatRegionalPricingLine(config: WeddingSalesConfig) {
  const florida = config.pricingByRegion?.FL;
  const carolinas = config.pricingByRegion?.NC_SC_GA;

  if (!florida || !carolinas) {
    return formatStartingPriceLine(config, {});
  }

  const coverageHours = florida.coverageHours ?? carolinas.coverageHours ?? config.pricing.coverageHours ?? 8;

  return `Our ${coverageHours}-hour collections start at ${florida.startPrice} in Florida and ${carolinas.startPrice} for NC, SC, and GA.`;
}

function canShareRegionalPricing(state: Pick<WeddingSalesState, "availability" | "location" | "venue">) {
  return Boolean(state.availability && resolveWeddingSalesRegion(state));
}

function formatWeddingDateForReply(value?: string) {
  if (!value) {
    return "your date";
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return value;
  }

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatLocationSuffix(location?: string) {
  return location ? ` in ${location}` : "";
}

function isInstagram(state: WeddingSalesState) {
  return state.channel === "instagram";
}

function getPrimaryCustomerName(names?: string) {
  return names
    ?.split(/\s+(?:and|&)\s+/i)[0]
    ?.split(/\s+/)[0]
    ?.replace(/[^A-Za-z'-]/g, "")
    .trim();
}

function getCustomerNameForState(state: WeddingSalesState) {
  return state.customerName?.trim() || getPrimaryCustomerName(state.names);
}

function getPartnerName(names?: string) {
  return names
    ?.split(/\s+(?:and|&)\s+/i)[1]
    ?.split(/\s+/)[0]
    ?.replace(/[^A-Za-z'-]/g, "")
    .trim();
}

function getPartnerNameForState(state: WeddingSalesState) {
  return state.partnerName?.trim() || getPartnerName(state.names);
}

function hasCoupleNames(names?: string) {
  return Boolean(names && /\s+(?:and|&)\s+/i.test(names));
}

function hasCoupleNamesForState(state: WeddingSalesState) {
  return Boolean(getCustomerNameForState(state) && getPartnerNameForState(state)) || hasCoupleNames(state.names);
}

function checkedWeddingAvailabilityThisTurn(state: WeddingSalesState) {
  return state.turnToolObservations.some(
    (observation) => observation.toolName === "check_wedding_availability",
  );
}

function formatInstagramAvailabilityLine(state: WeddingSalesState) {
  const customerName = getCustomerNameForState(state);
  const weddingDate = formatWeddingDateForReply(state.weddingDate);
  const location = state.location ? ` for your ${state.location} wedding` : " for your wedding";

  if (customerName) {
    return `Awesome ${customerName}! We have ${weddingDate} available${location} 🎥`;
  }

  return `Awesome, we have ${weddingDate} available${location} 🎥`;
}

function isFullVenueAddress(value?: string | null) {
  if (!value) {
    return false;
  }

  return (
    /\b\d{1,6}\s+[A-Za-z0-9 .'-]+?\s+(?:street|st\.?|road|rd\.?|avenue|ave\.?|lane|ln\.?|drive|dr\.?|boulevard|blvd\.?|way|court|ct\.?|place|pl\.?|highway|hwy\.?)\b/i.test(value) ||
    value.split(",").length >= 3
  );
}

function formatVenueAcknowledgement(state: WeddingSalesState) {
  if (!state.venue || isFullVenueAddress(state.venue)) {
    return "That sounds lovely 🤍";
  }

  return `${state.venue} sounds lovely 🤍`;
}

function formatCallTimeForReply(timeText?: string) {
  const normalized = (timeText || "that time")
    .trim()
    .replace(/\?+$/, "")
    .replace(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/gi, (_match, hour: string, minutes: string | undefined, meridiem: string) => {
      const minuteText = minutes ? `:${minutes}` : "";
      return `${hour}${minuteText} ${meridiem.toUpperCase()}`;
    })
    .replace(/\s+/g, " ");
  const withTimezone = /\b(?:Eastern|ET|EST|EDT)\b/i.test(normalized)
    ? normalized
    : `${normalized} Eastern`;

  return withTimezone.replace(/^Tomorrow\b/, "tomorrow").replace(/^Today\b/, "today");
}

function asksAboutKnownWeddingAvailability(message?: string) {
  if (!message) {
    return false;
  }

  return /\b(?:available|availability|still open|still available|our date|the date|wedding date)\b/i.test(message);
}

function declinesSuggestedWeddingDates(state: WeddingSalesState) {
  const message = state.latestCustomerMessage ?? "";

  return Boolean(
    state.availability === "unavailable" &&
      state.suggestedWeddingDates?.length &&
      /\b(?:none|neither|no|not|doesn'?t|do not|don'?t|won'?t)\b/i.test(message) &&
      /\b(?:work|works|fit|fits|available|date|dates|those|either)\b/i.test(message),
  );
}

function isBookedConversation(state: WeddingSalesState) {
  return Boolean(state.bookingConfirmed || state.leadStage === "booked");
}

function plannedAskField(state: WeddingSalesState): WeddingSalesField | null {
  return buildWeddingSalesResponseContext(state).plannedQuestionField;
}

function shouldUseActionPlanQuestionAuthority(state: WeddingSalesState) {
  return buildWeddingSalesResponseContext(state).hasActionPlanAuthority;
}

function hasActionPlanQuestionAuthorityWithoutPlannedQuestion(state: WeddingSalesState) {
  const responseContext = buildWeddingSalesResponseContext(state);

  return responseContext.hasActionPlanAuthority && responseContext.plannedQuestionField === null;
}

function followUpQuestionForPlannedField(state: WeddingSalesState, field: WeddingSalesField | null) {
  if (state.runtimeEvent !== "follow_up") return null;

  switch (field) {
    case "customerName":
      if (!hasCoupleNamesForState(state) && !state.weddingDate && !state.weddingDateText) {
        return "Whenever you get a chance, send over both of your names and your wedding date, and I'll check everything for you.";
      }

      return "Whenever you get a chance, send over both of your names and I'll keep everything organized for you.";
    case "partnerName":
      return "Whenever you get a chance, send over your fiance's name and I'll keep everything personalized for you.";
    case "names":
      return getCustomerNameForState(state)
        ? "Whenever you get a chance, send over your fiance's name and I'll keep everything personalized for you."
        : "Whenever you get a chance, send over both of your names and I'll keep everything organized for you.";
    case "weddingDate":
      return "Whenever you get a chance, send over your wedding date and I'll check availability for you.";
    case "weddingYear":
      return `Whenever you get a chance, what year is ${state.weddingDateText || "the wedding date"}?`;
    case "location":
      return "Whenever you get a chance, send over the city or venue and I'll check the details for you.";
    case "venue":
      return state.location
        ? `Whenever you get a chance, send over the venue in ${state.location} and I'll check the details for you.`
        : "Whenever you get a chance, send over the venue and I'll check the details for you.";
    case "callTime":
      return "Whenever you get a chance, send over a time that works for a quick call. I'm free Mon-Fri, 9 AM to 2 PM Eastern.";
    case "email":
      return "Whenever you get a chance, send over the best email for the calendar invite.";
    default:
      return null;
  }
}

function questionForPlannedField(state: WeddingSalesState, field: WeddingSalesField | null) {
  const followUpQuestion = followUpQuestionForPlannedField(state, field);
  if (followUpQuestion) return followUpQuestion;

  switch (field) {
    case "customerName":
      if (!hasCoupleNamesForState(state) && !state.weddingDate && !state.weddingDateText) {
        return "What are both of your names, and what's your wedding date?";
      }

      return "What are both of your names?";
    case "partnerName":
      return "What’s your fiancé’s name?";
    case "names":
      return getCustomerNameForState(state)
        ? "What’s your fiancé’s name?"
        : "What are both of your names?";
    case "weddingDate":
      return "What’s your wedding date?";
    case "weddingYear":
      return `What year is ${state.weddingDateText || "the wedding date"}?`;
    case "location":
      return "What city or venue is the wedding in?";
    case "venue":
      return state.location ? `What’s the exact venue in ${state.location}?` : "What’s the exact venue?";
    case "callTime":
      return "What time works best for the quick call? I’m free Mon-Fri, 9 AM to 2 PM Eastern.";
    case "email":
      return "What’s the best email for the calendar invite?";
    default:
      return "";
  }
}

function nextStepAfterFaq(state: WeddingSalesState) {
  if (shouldUseActionPlanQuestionAuthority(state)) {
    const plannedQuestion = questionForPlannedField(state, plannedAskField(state));

    if (plannedQuestion) {
      return plannedQuestion;
    }

    if (isInstagram(state) && state.callProposed && !isBookedConversation(state)) {
      return "What time works best for the quick call? I'm free Mon-Fri, 9 AM to 2 PM Eastern.";
    }

    return "";
  }

  if (!isInstagram(state)) {
    if (isBookedConversation(state)) {
      return "You are all set for the consultation. Send me anything else you want to go over before the call.";
    }

    if (state.calendarStatus === "available" && !state.customerEmail) {
      return "Send me the best email for the calendar invite when you are ready.";
    }

    if (state.callProposed || state.availability === "available") {
      return "The next step is the quick consultation, so I can walk you through everything live.";
    }

    return "Once I have your date and location, I can check availability and point you in the right direction.";
  }

  if (isBookedConversation(state)) {
    return "You’re all set for the call. Anything else you’d like to know before we chat?";
  }

  if (state.calendarStatus === "available" && !state.customerEmail) {
    return "What’s the best email for the calendar invite?";
  }

  if (!hasCoupleNamesForState(state) && !state.weddingDate && !state.weddingDateText) {
    return getCustomerNameForState(state)
      ? "What’s your fiancé’s name and wedding date?"
      : "What are both of your names, and what’s your wedding date?";
  }

  if (!hasCoupleNamesForState(state)) {
    return getCustomerNameForState(state)
      ? "What’s your fiancé’s name?"
      : "What are both of your names?";
  }

  if (!state.weddingDate && !state.weddingDateText) {
    return "What’s your wedding date?";
  }

  if (!state.location) {
    return "What city or venue is the wedding in?";
  }

  if (state.callProposed) {
    return "What time works best for the quick call? I’m free Mon-Fri, 9 AM to 2 PM Eastern.";
  }

  if (state.availability === "available") {
    return "Would you like to find a time for a quick call?";
  }

  return "What city or venue is the wedding in?";
}

function formatTravelAnswer(state: WeddingSalesState) {
  const callHandOff = state.callProposed
    ? "We can go over the exact travel details on the call."
    : "Once we set up the call, we can go over the exact travel details together.";

  return [
    "Our collections include roundtrip travel coverage 🤍",
    "Classic Collection → 100 miles\nPremium Collection → 125 miles\nExclusive Collection → 175 miles",
    "If your wedding location is farther than the included travel distance, we simply add a small travel fee to help cover gas for the additional round trip mileage.",
    callHandOff,
  ].join("\n\n");
}

function previousAssistantAskedForVenue(state: WeddingSalesState) {
  return /\b(?:exact venue|wedding venue|share (?:your|the) venue|could you share .*venue)\b/i.test(
    state.responseDraft ?? "",
  );
}

function withoutRepeatedVenueQuestion(state: WeddingSalesState, nextStep: string) {
  if (previousAssistantAskedForVenue(state) && /\bvenue\b/i.test(nextStep)) {
    return "";
  }

  return nextStep;
}

function asksIfTarasWillShoot(message: string) {
  return (
    /\b(?:are|will)\s+you\b[\s\S]{0,80}\b(?:shoot|shooter|film|filming)\b/i.test(message) ||
    /\b(?:shoot|shooter|film|filming)\b[\s\S]{0,80}\b(?:you|taras)\b/i.test(message)
  );
}

function formatFaqAnswer(args: {
  config: WeddingSalesConfig;
  state: WeddingSalesState;
}) {
  const message = args.state.latestCustomerMessage ?? "";
  const responseContext = buildWeddingSalesResponseContext(args.state);
  const nextStep = nextStepAfterFaq(args.state);
  const hasTopic = (topicId: string) => responseContext.answerTopicIds.includes(topicId);
  const asksPricing = responseContext.hasActionPlanAuthority
    ? hasTopic("pricing")
    : /\b(?:pricing|price|cost|package|packages|collection|collections)\b/i.test(message);
  const asksTravel = responseContext.hasActionPlanAuthority
    ? hasTopic("travel_fees")
    : /\b(?:travel|travel fee|distance|mileage|venue fee)\b/i.test(message);
  const asksPackageInclusions = responseContext.hasActionPlanAuthority
    ? hasTopic("package_inclusions")
    : /\b(?:include|included|what comes with|what's included|whats included|raw footage)\b/i.test(message);
  const topicIs = (topicId: string, pattern: RegExp) =>
    responseContext.hasActionPlanAuthority ? hasTopic(topicId) : pattern.test(message);
  const asksTeamQuestion = /\b(?:filmmaker|team|who|shoot|shooter)\b/i.test(message);
  const region = resolveWeddingSalesRegion(args.state);
  const shouldAnswerFloridaTeam = responseContext.hasActionPlanAuthority
    ? hasTopic("team_florida")
    : asksTeamQuestion && region === "FL";
  const shouldAnswerNcScGaTeam = responseContext.hasActionPlanAuthority
    ? hasTopic("team_nc_sc_ga")
    : asksTeamQuestion && region === "NC_SC_GA";
  const pricingTravelPackageAnswers = [
    asksPricing && canShareRegionalPricing(args.state)
      ? formatStartingPriceLine(args.config, args.state)
      : asksPricing
        ? formatRegionalPricingLine(args.config)
        : "",
    asksPackageInclusions
      ? "All collections include the full ceremony and speeches, a cinematic clip, a wedding film, drone footage, raw footage, and digital delivery."
      : "",
    asksTravel ? formatTravelAnswer(args.state) : "",
  ].filter(Boolean);
  const withPricingTravelPackageAnswers = (items: Array<string | undefined | null>) =>
    [...pricingTravelPackageAnswers, ...items].filter(Boolean).join("\n\n");

  if (
    pricingTravelPackageAnswers.length > 0 &&
    !shouldAnswerFloridaTeam &&
    !shouldAnswerNcScGaTeam
  ) {
    return withPricingTravelPackageAnswers([nextStep]);
  }

  if (topicIs("venue_travel_details", /\b(?:venue|location|travel details)\b/i)) {
    const venueLine = args.state.venue
      ? isFullVenueAddress(args.state.venue)
        ? "I have the venue details noted."
        : `I have ${args.state.venue}${args.state.location ? ` in ${args.state.location}` : ""} as the venue.`
      : "The venue helps us double-check travel details and make sure we are looking at the right coverage for your day.";

    return [
      venueLine,
      nextStep,
    ].filter(Boolean).join("\n\n");
  }

  if (topicIs("availability", /\b(?:available|availability|open|free|our date|wedding date)\b/i)) {
    if (args.state.availability === "available") {
      return [`${formatWeddingDateForReply(args.state.weddingDate)}${formatLocationSuffix(args.state.location)} is still available.`, nextStep]
        .filter(Boolean)
        .join("\n\n");
    }

    if (args.state.availability === "unavailable") {
      return [`${formatWeddingDateForReply(args.state.weddingDate)}${formatLocationSuffix(args.state.location)} is still unavailable.`, nextStep]
        .filter(Boolean)
        .join("\n\n");
    }

    return ["I can check availability once I have the wedding date and location.", nextStep]
      .filter(Boolean)
      .join("\n\n");
  }

  if (topicIs("booking", /\b(?:next step|book|booking|call|schedule|are we booking)\b/i)) {
    if (isBookedConversation(args.state)) {
      return "Yes, you’re all set for the consultation. If anything changes, just send it here and I’ll update it.";
    }

    if (args.state.calendarStatus === "busy") {
      return "That time is already taken, so I can’t book that slot yet. What other time works for you Mon-Fri, 9 AM to 2 PM Eastern?";
    }

    if (args.state.calendarStatus === "available" && !args.state.customerEmail) {
      return "That time is available. What’s the best email for the calendar invite? ✨";
    }

    if (args.state.calendarStatus === "available") {
      return "Yes, the next step is booking the consultation call.";
    }

    if (args.state.proposedCallTime) {
      return "I’ll check that time first, then I can send the calendar invite once it’s open.";
    }

    return nextStep || "The next step is a quick consultation call. What time works for you Mon-Fri, 9 AM to 2 PM Eastern?";
  }

  if (topicIs("style", /\b(?:style|approach|cinematic|documentary|pose|posed)\b/i)) {
    return [
      "Our style is cinematic documentary: natural backstage moments, real emotion, and no cheesy posing.",
      ["We work alongside the photographer without getting in the way.", nextStep]
        .filter(Boolean)
        .join(" "),
    ].filter(Boolean).join("\n\n");
  }

  if (
    topicIs("package_inclusions", /\b(?:include|included|what comes with|what's included|whats included)\b/i) &&
    !shouldAnswerFloridaTeam &&
    !shouldAnswerNcScGaTeam
  ) {
    return [
      "All collections include the full ceremony and speeches, a cinematic clip, a wedding film, drone footage, raw footage, and digital delivery.",
      nextStep,
    ].filter(Boolean).join("\n\n");
  }

  if (topicIs("film_length", /\b(?:film length|how long.*film|how long.*video|duration|minutes|min)\b/i)) {
    return [
      "The final wedding film length depends on the collection and the flow of the day. Classic is usually 10-25 minutes, Premium 15-30 minutes, and Exclusive 20-45 minutes.",
      nextStep,
    ].filter(Boolean).join("\n\n");
  }

  if (topicIs("final_film_delivery", /\b(?:timeline|delivery time|deliver|edit|editing|sneak peek)\b/i)) {
    return [
      "Thank you so much for checking in! 🤍",
      "Our average delivery time for the final films is around 4 months, but it may be sooner.",
      "I’ll keep you updated and will send everything over as soon as it’s ready!",
      "Thank you so much for your patience 🙏✨",
    ].join("\n\n");
  }

  if (topicIs("music", /\b(?:music|song|songs)\b/i)) {
    return [
      "Yes, couples can choose music for their films.",
      nextStep,
    ].filter(Boolean).join("\n\n");
  }

  if (topicIs("hidden_fees", /\b(?:hidden fee|hidden fees|tax|taxes)\b/i)) {
    return [
      "There are no taxes or hidden fees. The only possible extra cost is travel if the venue is beyond the included mileage.",
      nextStep,
    ].filter(Boolean).join("\n\n");
  }

  if (topicIs("insurance", /\b(?:insurance|certificate of insurance|coi)\b/i)) {
    return [
      "Yes, we carry insurance and can provide a COI to the venue or planner when needed.",
      nextStep,
    ].filter(Boolean).join("\n\n");
  }

  if (topicIs("reviews", /\b(?:review|reviews|testimonial|testimonials)\b/i)) {
    const reviews = args.config.reviews.url && args.state.channel !== "instagram"
      ? formatLink({
          label: args.config.reviews.label || "Google Reviews",
          url: args.config.reviews.url,
          config: args.config,
          state: args.state,
        })
      : "I can point you to recent reviews from our couples.";

    return [reviews, nextStep].filter(Boolean).join("\n\n");
  }

  if (topicIs("portfolio", /\b(?:film|films|portfolio|gallery|galleries|example|examples|work)\b/i)) {
    const portfolio = args.state.channel !== "instagram"
      ? formatPortfolioLinks(args.config, args.state)
      : "";

    return [
      portfolio ? `Here are a few recent wedding films:\n${portfolio}` : "I can share a few recent wedding films so you can get a feel for the work.",
      nextStep,
    ].filter(Boolean).join("\n\n");
  }

  if (topicIs("photographers", /\b(?:photographer|photographers)\b/i)) {
    return [
      "Yes, we always work collaboratively with photographers and never interfere with their flow.",
      nextStep,
    ].filter(Boolean).join("\n\n");
  }

  if (topicIs("business_location", /\bwhere\b.*\b(?:located|based|from)\b|\b(?:located|based)\b.*\bwhere\b/i)) {
    return [
      "We're based in Tampa, FL, with our Florida lead filmmaker there, and our NC/SC/GA team is based in Charlotte.",
      withoutRepeatedVenueQuestion(args.state, nextStep),
    ].filter(Boolean).join("\n\n");
  }

  if (shouldAnswerFloridaTeam) {
    const teamAnswer = asksIfTarasWillShoot(message)
      ? "I’m not usually the lead shooter for Florida weddings. Jay is our lead filmmaker in Tampa, and he shoots in the same Myndful style."
      : "For Florida weddings, Jay is our lead filmmaker in Tampa. I’ll confirm the exact team details with you on the call.";

    return withPricingTravelPackageAnswers([
      teamAnswer,
      withoutRepeatedVenueQuestion(args.state, nextStep),
    ]);
  }

  if (shouldAnswerNcScGaTeam) {
    const teamAnswer = asksIfTarasWillShoot(message)
      ? "I personally won’t be the lead shooter for NC, SC, or GA weddings. Dima and Marie are our lead filmmakers there, and they shoot in the same Myndful style."
      : "For NC, SC, and GA, our lead filmmakers are Dima and Marie, a husband-wife team based in Charlotte.";

    return withPricingTravelPackageAnswers([
      teamAnswer,
      withoutRepeatedVenueQuestion(args.state, nextStep),
    ]);
  }

  return null;
}

function regionLabelForReply(state: WeddingSalesState) {
  const region = resolveWeddingSalesRegion(state);

  if (region === "FL") return "Florida";
  if (region === "NC_SC_GA") return "NC, SC, and GA";
  return null;
}

function formatGroundedAvailabilityPriceGuide(args: ComposeWeddingSalesResponseArgs) {
  const { config, state } = args;

  if (state.availability !== "available" || !checkedWeddingAvailabilityThisTurn(state)) {
    return [];
  }

  const date = formatWeddingDateForReply(state.weddingDate);
  const location = formatLocationSuffix(state.location);
  const pricing = selectWeddingSalesPricing(config, state);
  const coverageHours = pricing.coverageHours ?? 8;
  const regionLabel = regionLabelForReply(state);
  const priceLine = regionLabel
    ? `For ${regionLabel}, our ${coverageHours}-hour collections start at ${pricing.startPrice}.`
    : `Our ${coverageHours}-hour collections start at ${pricing.startPrice}.`;

  return [
    `I checked ${date}${location}, and we're open for your wedding 🤍`,
    `${priceLine} I'll send the guide so you can see what's included.`,
  ];
}

function composeGroundedInstagramFallback(args: ComposeWeddingSalesResponseArgs, fallback: string) {
  if (!shouldUseGroundedInstagramVoice(args)) {
    return fallback;
  }

  const responseContext = buildWeddingSalesResponseContext(args.state);
  const paragraphs = [
    ...formatGroundedAvailabilityPriceGuide(args),
  ];
  const faqAnswer = responseContext.answerTopicIds.length
    ? formatFaqAnswer({ config: args.config, state: args.state })
    : null;

  if (faqAnswer) {
    paragraphs.push(faqAnswer);
  } else {
    const plannedQuestion = questionForPlannedField(args.state, responseContext.plannedQuestionField);

    if (plannedQuestion) {
      paragraphs.push(plannedQuestion);
    }
  }

  const text = paragraphs
    .filter(Boolean)
    .join("\n\n")
    .trim();

  return text
    ? ensureInstagramFirstContactOpening(args, normalizeCustomerFacingPunctuation(text))
    : fallback;
}

function formatUnavailableWeddingReply(args: {
  state: WeddingSalesState;
  summary?: string;
  weddingDate: string;
  location: string;
}) {
  const suggestedDates =
    args.summary
      ?.match(/\b\d{4}-\d{2}-\d{2}\b/g)
      ?.filter((date) => date !== args.state.weddingDate)
      .slice(0, 3) ?? [];
  const formattedSuggestions = suggestedDates.map((date) => formatWeddingDateForReply(date));
  const requestedDate = `${args.weddingDate}${args.location}`;
  const softDecline = `I checked ${requestedDate}, and it looks like that date is already booked on our end.`;

  if (isInstagram(args.state)) {
    return formattedSuggestions.length > 0
      ? [
          `${requestedDate} is already booked.`,
          `The closest open dates are ${formattedSuggestions.join(" or ")}. Would one of those work?`,
        ].join("\n\n")
      : `${requestedDate} is already booked. Do you have flexibility for a nearby date?`;
  }

  if (formattedSuggestions.length > 0) {
    return [
      softDecline,
      `The closest dates I can suggest around then are ${formattedSuggestions.join(" or ")}. If one of those could work for you, send it over and I can check the details from there ✨`,
    ].join("\n\n");
  }

  return [
    softDecline,
    "If you have any flexibility around the date, send me another option and I can check it right away ✨",
  ].join("\n\n");
}

export function composeWeddingSalesResponse(args: ComposeWeddingSalesResponseArgs) {
  const { intent, config, state, summary } = args;
  const policy = args.policy ?? buildWeddingSalesDialogPolicy(args);
  const weddingDate = formatWeddingDateForReply(state.weddingDate);
  const location = formatLocationSuffix(state.location);

  const response = (() => {
    switch (intent) {
      case "ask_missing_info":
        if (isInstagram(state)) {
          if (shouldUseActionPlanQuestionAuthority(state)) {
            const plannedQuestion = questionForPlannedField(state, plannedAskField(state));

            if (plannedQuestion) {
              return [
                policy.allowGreeting ? INSTAGRAM_FIRST_CONTACT_OPENING : "",
                `${plannedQuestion}${policy.allowGreeting ? "" : " ✨"}`,
              ]
                .filter(Boolean)
                .join("\n\n");
            }

            return policy.allowGreeting ? INSTAGRAM_FIRST_CONTACT_OPENING : "";
          }

          const missingDate = !state.weddingDate && !state.weddingDateText;
          const missingNames = !hasCoupleNamesForState(state);
          const hasAnyName = Boolean(getCustomerNameForState(state) || getPartnerNameForState(state));
          const questionEmoji = policy.allowGreeting ? "" : " ✨";
          const missingInfoQuestion = missingNames && missingDate
            ? hasAnyName
              ? "What’s your fiancé’s name and wedding date?"
              : "What are both of your names, and what’s your wedding date?"
            : missingNames
              ? hasAnyName
                ? "What’s your fiancé’s name?"
                : "What are both of your names?"
              : "What’s your wedding date?";

          if (missingNames && state.askedForNames && !missingDate) {
            return hasAnyName
              ? "I may have missed it — what’s your fiancé’s first name?"
              : "I may have missed it — what are both of your first names?";
          }

          return [
            policy.allowGreeting ? INSTAGRAM_FIRST_CONTACT_OPENING : "",
            `${missingInfoQuestion}${questionEmoji}`,
          ]
            .filter(Boolean)
            .join("\n\n");
        }

        return [
          "Thank you so much for reaching out. I would love to hear more.",
          "Could you share both of your names and the date you are planning to get married? Once I have that, I can check availability and send the most helpful details.",
        ].join("\n\n");
      case "ask_location_or_venue":
        if (shouldUseActionPlanQuestionAuthority(state)) {
          const plannedQuestion = questionForPlannedField(state, plannedAskField(state));

          return plannedQuestion || "";
        }

        if (isInstagram(state)) {
          return state.location
            ? `What’s the exact venue in ${state.location}?`
            : "What city or venue is the wedding in? ✨";
        }

        return state.location
          ? `Could you share the venue in ${state.location}? I want to double-check the travel details before we move forward.`
          : "Could you share the city, venue, or location for the wedding? I can check availability once I have that.";
      case "ask_wedding_year":
        if (shouldUseActionPlanQuestionAuthority(state)) {
          const plannedQuestion = questionForPlannedField(state, plannedAskField(state));

          return plannedQuestion || "";
        }

        if (isInstagram(state)) {
          return state.askedForWeddingYear && state.names
            ? `Got it — ${state.names}. What year is ${state.weddingDateText || "the wedding date"}?`
            : `What year is ${state.weddingDateText || "the wedding date"}?`;
        }

        return "Thank you so much. Just so I check the right date, could you share the wedding year?";
      case "availability_tool_missing":
        return isInstagram(state)
          ? "I’m having trouble checking that date right now. Let me look into it."
          : "I have enough details to check the wedding date, but the availability tool is not configured yet.";
      case "availability_unavailable":
        return formatUnavailableWeddingReply({ state, summary, weddingDate, location });
      case "availability_available": {
        if (isInstagram(state)) {
          if (isBookedConversation(state)) {
            return [
              formatInstagramAvailabilityLine(state),
              "I have the updated wedding date noted, and we'll keep the consultation call you already booked.",
            ].join("\n\n");
          }

          const lines = [
            formatInstagramAvailabilityLine(state),
            `${formatStartingPriceLine(config, state).replace(/\.$/, "")} — let me send you the guide so you can see everything ✨`,
          ];

          if (!state.venue) {
            lines.push(
              state.location
                ? `What’s the exact venue in ${state.location}?`
                : "What’s the exact venue?",
            );
          } else {
            lines.push(
              "When would be a good time for a quick call to go over everything? I’m free Mon-Fri, 9 AM to 2 PM Eastern ✨",
            );
          }

          return lines.join("\n\n");
        }
        const intro = `Amazing, thank you so much${state.names ? `, ${state.names}` : ""}. ${weddingDate}${location} is available for Myndful, so you reached out at a great time 🤍`;

        if (isBookedConversation(state)) {
          return [
            intro,
            "I have the updated wedding date noted, and we'll keep the consultation call you already booked.",
          ].join("\n\n");
        }

        if (state.guideSent) {
          return [
            intro,
            "The next step is a quick consultation where I can hear more about your story and answer any questions.",
            "Would you be open to a 30-minute call Monday through Friday between 9 AM and 2 PM Eastern?",
          ].join("\n\n");
        }

        const links = formatPortfolioLinks(config, state);
        const reviews = config.reviews.url
          ? formatLink({
              label: config.reviews.label || "Google Reviews",
              url: config.reviews.url,
              config,
              state,
            })
          : config.reviews.label;

        return [
          intro,
          `${formatStartingPriceLine(config, state)} ${formatGuideText(config, state)}`,
          links ? `Here are a few recent wedding films:\n${links}` : "",
          reviews ? `And here are reviews from couples: ${reviews}` : "",
          "Would you be open to a 30-minute consultation Monday through Friday between 9 AM and 2 PM Eastern?",
        ]
          .filter(Boolean)
          .join("\n\n");
      }
      case "answer_question": {
        const faqAnswer = formatFaqAnswer({ config, state });
        const answerTopicIds = buildWeddingSalesResponseContext(state).answerTopicIds;
        const asksAvailabilityOrBooking = answerTopicIds.some(
          (topicId) => topicId === "availability" || topicId === "booking",
        );

        if (state.availability === "unavailable" && faqAnswer && !asksAvailabilityOrBooking) {
          return faqAnswer;
        }

        if (
          isInstagram(state) &&
          state.availability === "available" &&
          checkedWeddingAvailabilityThisTurn(state)
        ) {
          return [
            formatInstagramAvailabilityLine(state),
            `${formatStartingPriceLine(config, state).replace(/\.$/, "")} — let me send you the guide so you can see everything ✨`,
            faqAnswer,
          ].filter(Boolean).join("\n\n");
        }

        if (state.availability === "unavailable") {
          if (declinesSuggestedWeddingDates(state)) {
            return isInstagram(state)
              ? "I'm so sorry those dates don't work out 🤍 If anything changes, please let me know. Wishing you both such a beautiful wedding day."
              : "I'm so sorry those dates don't work out. If anything changes, please let me know. Wishing you both such a beautiful wedding day.";
          }

          const asksPricingOrTravel = /\b(?:pricing|price|cost|package|packages|collection|collections|travel)\b/i.test(
            state.latestCustomerMessage ?? "",
          );
          if (isInstagram(state)) {
            const message = state.latestCustomerMessage ?? "";
            const answers = [
              `${weddingDate}${location} is still unavailable.`,
              /\b(?:pricing|price|cost|package|packages|collection|collections)\b/i.test(message)
                ? formatStartingPriceLine(config, state)
                : "",
              /\btravel\b/i.test(message)
                ? "Our collections include roundtrip travel coverage."
                : "",
            ].filter(Boolean);

            return [
              answers.join(" "),
              "Do you have another date in mind?",
            ].join("\n\n");
          }
          const followUp = asksPricingOrTravel
            ? `If you are flexible, send me another date and I can check it right away. ${formatStartingPriceLine(config, state)} We can go over travel details on the call.`
            : "If you are flexible, send me another date and I can check it right away.";

          return [`${weddingDate}${location} is still showing unavailable on my end.`, followUp].join("\n\n");
        }

        if (faqAnswer) {
          return faqAnswer;
        }

        if (isInstagram(state) && isBookedConversation(state)) {
          return "Yes, you’re all set for the consultation. If anything changes, just send it here and I’ll update it.";
        }

        if (isInstagram(state) && state.leadStage === "answering_question" && state.calendarStatus === "available" && !state.customerEmail) {
          return [
            formatStartingPriceLine(config, state),
            "What’s the best email for the calendar invite? ✨",
          ].join("\n\n");
        }

        if (state.availability === "available" && !isBookedConversation(state) && asksAboutKnownWeddingAvailability(state.latestCustomerMessage)) {
          if (isInstagram(state)) {
            return [
              `${weddingDate}${location} is still available.`,
              state.callProposed ? "Would you like to find a time for a quick call?" : "Would you like to set up a quick call?",
            ].join("\n\n");
          }

          return [
            `${weddingDate}${location} is still showing available on my end.`,
            state.callProposed
              ? "The next step is still the quick consultation, so I can hear more about your day and answer anything you are weighing."
              : "The next step would be a quick consultation, so I can hear more about your day and answer anything you are weighing.",
          ].join("\n\n");
        }

        if (isInstagram(state) && state.venue && /\bvenue\b/i.test(state.latestCustomerMessage ?? "")) {
          const venueContext = state.location ? `${state.venue} in ${state.location}` : state.venue;

          return [
            isFullVenueAddress(state.venue)
              ? "Got it, I have the venue details noted."
              : `Got it, I have ${venueContext} as the venue.`,
            nextStepAfterFaq(state),
          ].join("\n\n");
        }

        if (isInstagram(state)) {
          return nextStepAfterFaq(state);
        }

        return [
          `${formatStartingPriceLine(config, state)} Yes, we do travel for weddings.`,
          "Our collections include roundtrip travel coverage. If the venue is beyond the included mileage, we can go over the exact travel details on the call.",
        ].join("\n\n");
      }
      case "ask_call_time":
        if (shouldUseActionPlanQuestionAuthority(state)) {
          const plannedQuestion = questionForPlannedField(state, plannedAskField(state));

          if (!plannedQuestion) {
            return "";
          }

          if (isInstagram(state)) {
            return [
              formatVenueAcknowledgement(state),
              plannedQuestion,
            ].filter(Boolean).join("\n\n");
          }

          return plannedQuestion;
        }

        if (isInstagram(state)) {
          return [
            formatVenueAcknowledgement(state),
            "When would be a good time for a quick call to go over everything? I’m free Mon-Fri, 9 AM to 2 PM Eastern ✨",
          ].join("\n\n");
        }

        return [
          state.venue
            ? `${state.venue} sounds great. I can double-check the exact travel details for your date and venue.`
            : "That sounds great. I can double-check the exact travel details for your date and venue.",
          "Would you be open to a 30-minute consultation Monday through Friday between 9 AM and 2 PM Eastern?",
        ].join("\n\n");
      case "ask_email": {
        const callTime = formatCallTimeForReply(state.proposedCallTime);

        if (shouldUseActionPlanQuestionAuthority(state)) {
          const plannedQuestion = questionForPlannedField(state, plannedAskField(state));

          if (!plannedQuestion) {
            return "";
          }

          if (isInstagram(state)) {
            return [
              `Perfect, ${callTime} works great!`,
              plannedQuestion,
            ].join("\n\n");
          }

          return [
            `That time works great: ${callTime}.`,
            plannedQuestion,
          ].join("\n\n");
        }

        if (isInstagram(state)) {
          return [
            `Perfect, ${callTime} works great!`,
            "What’s the best email to send you the calendar invite for our call? ✨",
          ].join("\n\n");
        }

        return [
          `That time works great: ${callTime}.`,
          "What is the best email address for the calendar invite?",
        ].join("\n\n");
      }
      case "calendar_time_missing":
        if (state.calendarContextDate) {
          return `What time on ${formatWeddingDateForReply(state.calendarContextDate)} works for you?`;
        }
        if (isInstagram(state)) {
          return state.calendarStatus === "busy"
            ? "That time isn’t available. What other time works for you?"
            : "What time works for you?";
        }

        return state.calendarStatus === "busy"
          ? "That time was not available, so I cannot book it yet. Could you send another time Monday through Friday between 9 AM and 2 PM Eastern?"
          : "I can check that consultation time once I have the requested time.";
      case "calendar_date_mismatch":
        return isInstagram(state)
          ? `${summary || "I want to make sure I book the right day."} Could you confirm the exact date you mean?`
          : `${summary || "The weekday and date do not seem to match."} Could you confirm the exact date before I check or book the call?`;
      case "calendar_available":
        return isInstagram(state)
          ? "That time is available. Would you like me to book it?"
          : "That time looks available on the calendar. Would you like me to go ahead and book it for you?";
      case "calendar_busy":
        if (state.calendarContextDate && state.suggestedCallTimes?.length) {
          return `That time on ${formatWeddingDateForReply(state.calendarContextDate)} is already taken. Would ${state.suggestedCallTimes.join(", ")} work instead?`;
        }
        return isInstagram(state)
          ? "That time is already taken. What other time works for you?"
          : "That time is already taken on the calendar, so I do not want to book the wrong slot. Could you send another time Monday through Friday between 9 AM and 2 PM Eastern?";
      case "calendar_outside_window":
        return isInstagram(state)
          ? "Calls are available Mon-Fri, 9 AM to 2 PM Eastern. What time in that window works for you?"
          : `${summary || "Consultation calls are only available Monday through Friday between 9 AM and 2 PM Eastern."} Could you send another time in that window?`;
      case "booking_tool_missing":
        return isInstagram(state)
          ? "I’m having trouble with the booking tool right now. Let me look into it."
          : "I can book the consultation once I have the confirmed time and booking tool configured.";
      case "booking_confirmed":
        if (args.testMode || (summary && /\btest mode\b/i.test(summary))) {
          const callTime = formatCallTimeForReply(state.proposedCallTime);
          const email = state.customerEmail ? ` to ${state.customerEmail}` : "";

          return isInstagram(state)
            ? [
                `Test mode: this would send a calendar invite${email} for ${callTime}.`,
                "Anything else you’d like to test before we chat?",
              ].join("\n\n")
            : [
                `Test mode: this would create the calendar invite${email} for ${callTime}.`,
                "No live invite or lead log was sent.",
              ].join("\n\n");
        }

        if (isInstagram(state)) {
          const callTime = formatCallTimeForReply(state.proposedCallTime);
          const email = state.customerEmail ? ` to ${state.customerEmail}` : "";

          return [
            `You’re all set! I’ve sent a calendar invite${email} — really looking forward to meeting you both ${callTime} 🤍`,
            "Anything else you’d like to know before we chat?",
          ].join("\n\n");
        }

        return [
          "Perfect, you are all set. I just created the calendar invite for our consultation.",
          "I am really looking forward to hearing more about your day and answering any questions you both have 🤍",
        ].join("\n\n");
      case "booking_failed":
        return isInstagram(state)
          ? "I couldn’t confirm that time. What other time works for you?"
          : "I am sorry, I could not get the calendar invite fully confirmed on my end. Could you send one more time option Monday through Friday between 9 AM and 2 PM Eastern?";
    }
  })();

  const finalText = policy.includeSignature
    ? appendSignatureOnce(response, config.signature)
    : response.trim();

  return normalizeCustomerFacingPunctuation(finalText);
}

function shouldUseLlmComposer() {
  const explicitlyEnabled = process.env.WEDDING_SALES_LLM_COMPOSER === "true";
  const productionRuntime = process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";

  return Boolean(process.env.OPENAI_API_KEY) && process.env.WEDDING_SALES_LLM_COMPOSER !== "false" && (explicitlyEnabled || productionRuntime);
}

function shouldUseReflection() {
  return shouldUseLlmComposer() && process.env.WEDDING_SALES_REFLECTION !== "false";
}

function safeJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function buildComposerFacts(args: ComposeWeddingSalesResponseArgs) {
  const { config, state, intent, summary } = args;
  const policy = args.policy ?? buildWeddingSalesDialogPolicy(args);
  const responseContext = buildWeddingSalesResponseContext(state);

  return {
    intent,
    testMode: Boolean(args.testMode),
    customerMessage: state.latestCustomerMessage,
    previousAssistantResponse: state.responseDraft,
    conversationSummary: state.conversationSummary,
    leadState: {
      leadStage: state.leadStage,
      names: state.names,
      customerName: state.customerName,
      partnerName: state.partnerName,
      coupleDisplayName: state.coupleDisplayName,
      nameCollectionStatus: state.nameCollectionStatus,
      weddingDate: state.weddingDate,
      weddingDateText: state.weddingDateText,
      weddingYear: state.weddingYear,
      weddingYearKnown: state.weddingYearKnown,
      location: state.location,
      venue: state.venue,
      customerEmail: state.customerEmail,
      availability: state.availability,
      guideSent: state.guideSent,
      callProposed: state.callProposed,
      proposedCallTime: state.proposedCallTime,
      calendarStatus: state.calendarStatus,
      bookingConfirmed: state.bookingConfirmed,
    },
    responseContext,
    actionPlan: state.lastActionPlan,
    behavioralMemory: {
      assistantReplyCount: state.assistantReplyCount,
      hasGreeted: state.hasGreeted,
      signatureSent: state.signatureSent,
      portfolioSent: state.portfolioSent,
      reviewsSent: state.reviewsSent,
      guideOffered: state.guideOffered,
      askedForNames: state.askedForNames,
      askedForWeddingYear: state.askedForWeddingYear,
      askedForVenue: state.askedForVenue,
      askedForCallTime: state.askedForCallTime,
      askedForEmail: state.askedForEmail,
      lastAssistantIntent: state.lastAssistantIntent,
    },
    toolSummary: summary,
    toolObservations: state.toolObservations
      .slice(-3)
      .map((observation) => ({
        toolName: observation.toolName,
        result: observation.result.slice(0, 1200),
      })),
    businessConfig: {
      startPrice: canShareRegionalPricing(state) ? formatStartPrice(config, state) : undefined,
      coverageHours: canShareRegionalPricing(state)
        ? selectWeddingSalesPricing(config, state).coverageHours ?? 8
        : undefined,
      guideAvailable: Boolean(config.guide.fileName || config.guide.link),
      portfolio: config.portfolio,
      reviews: config.reviews,
      bookingWindow: config.callBookingWindow,
      channel: state.channel,
      richLinks: getChannelFormatting(config, state).richLinks,
      allowAttachments: getChannelFormatting(config, state).allowAttachments,
      faq: {
        style: "Cinematic documentary, natural backstage filming, real moments, no cheesy poses.",
        included:
          "All collections include full ceremony and speeches, cinematic clip, wedding film, drone footage, raw footage, and digital delivery.",
        editingTimeline:
          "Sneak Peek is usually delivered about 2 weeks after the wedding. Wedding Film and Cinematic Clip are usually around 4 months.",
        music: "Couples can choose music for their films.",
        hiddenFees:
          "No taxes and no hidden fees. Only possible additional cost is a small travel fee if venue is beyond included mileage.",
        travel:
          "Collections include roundtrip travel coverage: Classic 100 miles, Premium 125 miles, Exclusive 175 miles. If beyond included mileage, do not calculate in chat; say we can go over exact travel details on the call.",
        insurance:
          "Myndful carries insurance and can provide a Certificate of Insurance to the venue or planner when needed.",
        photographers:
          "Myndful works collaboratively with photographers and does not interfere with their workflow.",
        teams:
          "NC/SC/GA lead filmmakers are Dima and Marie in Charlotte. Florida lead filmmaker is Jay in Tampa.",
        currentTeams:
          "NC/SC/GA lead filmmakers are Dima and Marie in Charlotte. Florida lead filmmaker is Jay in Tampa.",
      },
    },
    dialogPolicy: policy,
  };
}

function buildTraceMetadata(args: ComposeWeddingSalesResponseArgs, extra: Record<string, unknown> = {}) {
  const policy = args.policy ?? buildWeddingSalesDialogPolicy(args);

  return {
    runtimeType: "langgraph_wedding_sales" as const,
    channel: args.state.channel,
    intent: args.intent,
    leadStage: args.state.leadStage,
    replyMode: policy.replyMode,
    allowGreeting: policy.allowGreeting,
    includeSignature: policy.includeSignature,
    assistantReplyCount: args.state.assistantReplyCount,
    hasGreeted: args.state.hasGreeted,
    signatureSent: args.state.signatureSent,
    guideOffered: args.state.guideOffered,
    lastAssistantIntent: args.state.lastAssistantIntent,
    ...extra,
  };
}

function buildComposerSystemPrompt(args: ComposeWeddingSalesResponseArgs) {
  const policy = args.policy ?? buildWeddingSalesDialogPolicy(args);
  const responseContext = buildWeddingSalesResponseContext(args.state);
  const signatureInstruction = policy.includeSignature
    ? `End with this exact signature once:\n${args.config.signature || "(no signature configured)"}`
    : "Do not include an email signature or sign-off.";
  const greetingInstruction = policy.allowGreeting
    ? args.state.channel === "instagram"
      ? responseContext.hasActionPlanAuthority && responseContext.plannedQuestionField === null
        ? `Start with this exact introduction, verbatim, then answer only the allowed topic IDs. Do not add a qualification question:\n${INSTAGRAM_FIRST_CONTACT_OPENING}`
        : `Start with this exact introduction, verbatim, and then ask only the next missing question:\n${INSTAGRAM_FIRST_CONTACT_OPENING}`
      : "A short natural greeting is allowed."
    : "Do not start with a greeting like Hi, Hello, Hey, or Hi Anna and Mark. Continue the existing thread naturally.";
  const modeInstruction = policy.replyMode === "scheduling_reply"
    ? "For scheduling and booking replies, answer directly in 1-2 short paragraphs. No greeting, no sign-off, no signature."
    : "Do not over-email-format mid-thread replies.";

  return [
    "You write final customer-facing replies for Myndful Films wedding leads.",
    "Sound like Taras, the warm founder of a premium wedding videography company. Be human, specific, and natural.",
    args.state.channel === "instagram"
      ? "This is a real ongoing Instagram DM thread. Write only the next short DM reply, not a generic bot status update."
      : "This is a real ongoing email thread. Write only the next reply, not a generic bot status update.",
    "Never repeat the previous assistant response. Never restate the same availability intro, same guide pitch, or same call proposal unless the current customer message asks for it.",
    "For availability replies, say 'We have [date] available...' rather than '[couple] have [date] available'.",
    "Move the conversation forward from the customer's latest message. Answer their current question before adding the next step.",
    "If the customer just supplied one useful missing fact but another fact is still missing, acknowledge the supplied fact briefly, then ask only for the remaining fact.",
    "Never ask again for a detail that is already present in leadState.",
    responseContext.hasActionPlanAuthority
      ? `Action-plan authority is active. Answer only these FAQ topic IDs: ${responseContext.answerTopicIds.join(", ") || "(none)"}. Ask only this missing field: ${responseContext.plannedQuestionField ?? "(none)"}. Do not add any other customer-facing question.`
      : "",
    greetingInstruction,
    `Reply mode: ${policy.replyMode}. Maximum paragraphs: ${policy.maxParagraphs}. Link style: ${policy.linkStyle}.`,
    modeInstruction,
    policy.mustInclude.length ? `Must include:\n- ${policy.mustInclude.join("\n- ")}` : "",
    policy.mustNotRepeat.length ? `Strictly must not repeat:\n- ${policy.mustNotRepeat.join("\n- ")}` : "",
    policy.forbiddenPhrases.length ? `Forbidden phrases or concepts. Do not use these even if they seem natural:\n- ${policy.forbiddenPhrases.join("\n- ")}` : "",
    "Use the provided facts only. Do not invent availability, calendar status, prices, links, event IDs, or bookings.",
    "Never confirm that the wedding itself is booked, reserved, contracted, or retained. Only confirm consultation calls.",
    responseContext.hasActionPlanAuthority
      ? "For FAQ questions, answer only the topic IDs listed in responseContext. Do not infer extra topics from the raw customer text."
      : "For FAQ questions, answer from businessConfig.faq and then move to one clear next step. Do not over-answer with collection details unless the customer specifically asks.",
    "For travel fees, never calculate distance or claim there is no travel fee. Say roundtrip travel coverage is included by collection and exact travel details can be covered on the call.",
    args.testMode
      ? "TEST MODE IS ACTIVE: do not claim a real invite was sent or created. Say this is test mode and that the system would send/create the calendar invite."
      : "",
    responseContext.hasActionPlanAuthority
      ? "If information is missing, ask only the field allowed by responseContext.plannedQuestionField. If it is null, do not ask for missing information."
      : "If information is missing, ask a focused question. If a tool failed, apologize simply and ask for the next actionable option.",
    "Gmail can use HTML links. Instagram and Telegram must use plain URLs.",
    args.state.channel === "instagram"
      ? "Instagram style: 1-3 short message bubbles separated by blank lines. No signature. No HTML. Warm, direct, founder-like, and concise. Ask only the next missing question."
      : "",
    args.state.channel === "instagram"
      ? "Instagram brevity rule: after the required first-contact introduction, use no more than 35 words. Usually write one short answer and one short question. Do not explain why you need routine details."
      : "",
    args.state.channel === "instagram"
      ? `Never use formal marketing filler such as: ${INSTAGRAM_ROBOTIC_PHRASES.join("; ")}.`
      : "",
    args.state.channel === "instagram"
      ? "Answer only what the customer asked. For a pricing question, give the starting price and the single next missing question; do not add travel information unless travel was asked about."
      : "",
    args.state.channel === "instagram"
      ? "For Instagram, do not paste URLs or long collection details. Mention that you can send examples or the guide naturally instead."
      : "",
    args.state.channel === "instagram"
      ? "If the customer gives a full street address or long venue address, acknowledge naturally like 'That sounds lovely' or 'I have the venue details noted.' Do not repeat the full address back."
      : "",
    args.state.channel === "instagram"
      ? "Instagram sales sequence: ask fiance name/date, confirm availability and starting price, ask exact venue, ask call time, ask email, then confirm the calendar invite only after booking succeeds."
      : "",
    args.intent === "availability_unavailable"
      ? "Unavailable wedding date rule: do not soften this into 'too early to confirm' or 'check later'. Say the requested date looks booked/unavailable now, then offer nearby replacement dates if provided."
      : "",
    args.state.channel === "instagram"
      ? "If you need the wedding year after the customer gave a fiance name, do not repeat the prior year question verbatim. Acknowledge the fiance name naturally and ask for the year in a fresh short line."
      : "",
    "Brand voice: warm, reassuring, lightly excited, and founder-like. Use natural contractions when they fit.",
    policy.allowGreeting && args.state.channel === "instagram"
      ? "Keep the two emojis in the required first-contact introduction. Do not add any other emoji to this reply."
      : "Allowed emojis only: 🤍 ✨ 🎥. Use exactly one brand emoji in warm first replies, availability replies, and booking confirmations. For routine scheduling/error replies, usually use no emoji. Never use more than one emoji unless the customer is very enthusiastic.",
    "Avoid filler openings like 'Thanks for sharing' on every turn. Vary phrasing naturally.",
    args.state.channel === "instagram"
      ? "Write compact DM bubbles, usually 1-3 short paragraphs. Scheduling replies should not ask for permission to book if email is still missing; ask for email instead."
      : "Write concise email paragraphs, usually 2-4 short paragraphs. Scheduling replies should usually be 1 paragraph.",
    signatureInstruction,
  ].filter(Boolean).join("\n");
}

function buildReflectionSystemPrompt(args: ComposeWeddingSalesResponseArgs) {
  const policy = args.policy ?? buildWeddingSalesDialogPolicy(args);
  const responseContext = buildWeddingSalesResponseContext(args.state);

  return [
    "You are the final quality reviewer for a Myndful Films sales email.",
    "Your job is to enforce dialog policy, remove robotic repetition, and keep the response warm and human.",
    "Return only valid JSON with this shape:",
    '{"status":"pass"|"rewrite","issues":["short issue"],"revisedText":"final reply if rewrite, otherwise empty string"}',
    "Rewrite only when needed. If rewriting, preserve all required facts and do not invent any new facts.",
    "Fail and rewrite if the draft repeats the previous assistant response, greets mid-thread, includes a forbidden signature, sounds like a bot status message, ignores the customer's latest question, or exceeds the paragraph limit.",
    responseContext.hasActionPlanAuthority
      ? `Action-plan authority is active. The final reply may answer only these FAQ topic IDs: ${responseContext.answerTopicIds.join(", ") || "(none)"}. It may ask only this missing field: ${responseContext.plannedQuestionField ?? "(none)"}. If the draft asks any other customer-facing question, fail and rewrite.`
      : "",
    args.state.semanticStateVersion === 3 && responseContext.answerTopicIds.length > 0
      ? `The final reply must answer every requested topic in this turn: ${responseContext.answerTopicIds.join(", ")}. If any topic is omitted, fail and rewrite.`
      : "",
    responseContext.hasActionPlanAuthority && responseContext.plannedQuestionField === null
      ? "Fail and rewrite if the draft asks for names, fiance name, wedding date, wedding year, location, venue, call time, email, or any other qualification detail."
      : "",
    responseContext.hasActionPlanAuthority &&
    !["names", "customerName", "partnerName"].includes(responseContext.plannedQuestionField ?? "")
      ? "Fail and rewrite if the draft asks for names, both names, full names, or fiance name."
      : "",
    args.testMode
      ? "Fail and rewrite if the draft says a real calendar invite was sent, created, booked, or confirmed. In test mode it must say the invite would be sent/created."
      : "",
    args.state.channel === "instagram"
      ? "For Instagram, fail and rewrite if the draft sounds like an email, repeats the intro, repeats the call-time question, asks for permission to book before asking for email, or says an invite was sent before booking is confirmed."
      : "",
    args.state.channel === "instagram"
      ? "For Instagram, fail and rewrite if an availability reply says the couple 'have' the date available instead of 'we have' the date available, or if it repeats a full street address back to the customer."
      : "",
    args.state.channel === "instagram"
      ? `For Instagram, fail and rewrite if the text after the required first-contact introduction exceeds 35 words, explains why routine information is needed, answers an unasked topic, or uses any of these phrases: ${INSTAGRAM_ROBOTIC_PHRASES.join("; ")}.`
      : "",
    args.state.channel === "instagram"
      ? "For Instagram, fail and rewrite if a customer supplied a useful fact and the draft does not acknowledge it before asking for the next missing fact."
      : "",
    args.intent === "availability_unavailable"
      ? "For unavailable wedding dates, fail and rewrite if the draft says the date is too far away, cannot be confirmed yet, or should be checked closer to the date."
      : "",
    "Keep the voice friendly and premium. Allowed emojis only: 🤍 ✨ 🎥. Warm first replies, availability replies, and booking confirmations should contain one brand emoji; routine scheduling replies usually should not.",
    policy.mustInclude.length ? `The final reply must include:\n- ${policy.mustInclude.join("\n- ")}` : "",
    policy.mustNotRepeat.length ? `The final reply must not repeat:\n- ${policy.mustNotRepeat.join("\n- ")}` : "",
    policy.forbiddenPhrases.length ? `Forbidden phrases/concepts:\n- ${policy.forbiddenPhrases.join("\n- ")}` : "",
  ].filter(Boolean).join("\n");
}

function stripSignatureLikeBlock(text: string) {
  const lines = text.trim().split(/\r?\n/);
  const signatureStartIndex = lines.findIndex((line, index) => {
    const trimmed = line.trim();
    const nextLines = lines
      .slice(index + 1, index + 5)
      .map((nextLine) => nextLine.trim())
      .join("\n");

    if (/^Taras Mynd\b/i.test(trimmed)) {
      return true;
    }

    if (/^(warmly|best|thanks|thank you|looking forward),?\s*$/i.test(trimmed) && /Taras\b/i.test(nextLines)) {
      return true;
    }

    return /^(warmly|best|thanks|thank you|looking forward),?\s*Taras\b/i.test(trimmed);
  });

  return (signatureStartIndex === -1 ? text : lines.slice(0, signatureStartIndex).join("\n")).trim();
}

function stripGreetingLikeOpening(text: string) {
  return text
    .replace(/^\s*(hi|hello|hey)\s+[^,\n]+(?:\s+and\s+[^,\n]+)?[,]?\s*\n+/i, "")
    .replace(/^\s*(hi|hello|hey)\s+there[,]?\s*\n+/i, "")
    .trim();
}

function normalizeMarkdownLinksForRichEmail(text: string) {
  return text.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>');
}

function normalizeCustomerFacingPunctuation(text: string) {
  return text
    .replace(/\s*[—–]\s*/g, " - ")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function stripDuplicateInstagramFirstContactIntro(text: string) {
  let remainder = text.trim();
  const duplicateIntroPatterns = [
    /^Thank you so much for reaching out(?:\s*[🤍✨🎥]+)?[.!]?\s*/i,
    /^Congratulations on your engagement[.!]?\s*/i,
    /^Huge congratulations on your engagement(?:,\s*such an exciting season of life)?[.!]?\s*/i,
    /^I[’']?m Taras(?:,\s*the founder of Myndful Films| from Myndful Films)?[.!]?\s*/i,
  ];

  let changed = true;
  while (remainder && changed) {
    changed = false;

    for (const pattern of duplicateIntroPatterns) {
      const cleaned = remainder.replace(pattern, "").trim();
      if (cleaned !== remainder) {
        remainder = cleaned;
        changed = true;
      }
    }
  }

  return remainder;
}

function ensureInstagramFirstContactOpening(args: ComposeWeddingSalesResponseArgs, text: string) {
  const policy = args.policy ?? buildWeddingSalesDialogPolicy(args);

  if (args.state.channel !== "instagram" || !policy.allowGreeting) {
    return text.trim();
  }

  const trimmed = text.trim();

  if (trimmed.startsWith(INSTAGRAM_FIRST_CONTACT_OPENING)) {
    const remainder = stripDuplicateInstagramFirstContactIntro(
      trimmed.slice(INSTAGRAM_FIRST_CONTACT_OPENING.length),
    );

    return [INSTAGRAM_FIRST_CONTACT_OPENING, remainder].filter(Boolean).join("\n\n");
  }

  const paragraphs = trimmed.split(/\n\s*\n/);
  while (
    paragraphs.length > 0 &&
    !paragraphs[0].includes("?") &&
    /^(?:hi|hello|hey)\b|reaching out|i[’']?m Taras|founder|congratulations|engagement/i.test(paragraphs[0])
  ) {
    paragraphs.shift();
  }

  const remainder = stripDuplicateInstagramFirstContactIntro(paragraphs.join("\n\n"));

  return [INSTAGRAM_FIRST_CONTACT_OPENING, remainder].filter(Boolean).join("\n\n");
}

function enforceInstagramResponseStyle(args: ComposeWeddingSalesResponseArgs, text: string, fallback: string) {
  if (args.state.channel !== "instagram") {
    return text.trim();
  }

  const policy = args.policy ?? buildWeddingSalesDialogPolicy(args);
  const responseContext = buildWeddingSalesResponseContext(args.state);
  const body = policy.allowGreeting && text.startsWith(INSTAGRAM_FIRST_CONTACT_OPENING)
    ? text.slice(INSTAGRAM_FIRST_CONTACT_OPENING.length).trim()
    : text.trim();
  const normalizedBody = body
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"');
  const wordCount = body.split(/\s+/).filter(Boolean).length;
  const paragraphCount = body.split(/\n\s*\n/).filter(Boolean).length;
  const questionCount = body.split("?").length - 1;
  const plannedAnswerCount = responseContext.answerTopicIds.length;
  const maxWordCount = plannedAnswerCount > 1 ? 80 : 35;
  const maxParagraphCount = plannedAnswerCount > 1 ? 6 : 3;
  const asksQuestionWithoutPlan = responseContext.hasActionPlanAuthority
    && responseContext.plannedQuestionField === null
    && questionCount > 0;
  const asksUnplannedNameQuestion = responseContext.hasActionPlanAuthority
    && !["names", "customerName", "partnerName"].includes(responseContext.plannedQuestionField ?? "")
    && /\b(?:names?|fiance|fiancee|full names?)\b/i.test(normalizedBody);
  const hasRoboticPhrase = INSTAGRAM_ROBOTIC_PHRASES.some((phrase) => normalizedBody.includes(phrase));
  const latestCustomerMessage = (args.state.latestCustomerMessage ?? "").toLowerCase();
  const addsUnaskedTravelAnswer = args.intent === "answer_question"
    && normalizedBody.includes("travel")
    && !latestCustomerMessage.includes("travel")
    && !latestCustomerMessage.includes("mileage")
    && !latestCustomerMessage.includes("distance");
  const addsUnaskedPricingAnswer = args.intent === "answer_question"
    && (normalizedBody.includes("$") || normalizedBody.includes("pricing") || normalizedBody.includes("start at"))
    && !latestCustomerMessage.includes("price")
    && !latestCustomerMessage.includes("pricing")
    && !latestCustomerMessage.includes("cost")
    && !latestCustomerMessage.includes("package")
    && !latestCustomerMessage.includes("collection");
  const missesAvailabilityNextQuestion = args.intent === "availability_available"
    && (
      (!args.state.venue && !/\b(?:venue|where|location|place)\b/i.test(normalizedBody)) ||
      (Boolean(args.state.venue) && !/\b(?:call|time|mon|fri|eastern|schedule)\b/i.test(normalizedBody))
    );
  const missesEmailQuestion = args.intent === "ask_email"
    && !/\b(?:email|e-mail|mail)\b/i.test(normalizedBody);
  const missesRequiredNextQuestion = args.intent === "answer_question"
    && (responseContext.hasActionPlanAuthority
      ? Boolean(responseContext.plannedQuestionField && !normalizedBody.includes("?"))
      : (
        (args.state.calendarStatus === "available" && !args.state.customerEmail && !normalizedBody.includes("email"))
        || (!args.state.weddingDate && !args.state.weddingDateText && !normalizedBody.includes("date"))
        || (Boolean(args.state.weddingDate || args.state.weddingDateText)
          && !args.state.location
          && !normalizedBody.includes("location")
          && !normalizedBody.includes("venue")
          && !normalizedBody.includes("city"))
      ));

  return wordCount > maxWordCount
    || paragraphCount > maxParagraphCount
    || questionCount > 1
    || asksQuestionWithoutPlan
    || asksUnplannedNameQuestion
    || hasRoboticPhrase
    || addsUnaskedTravelAnswer
    || addsUnaskedPricingAnswer
    || missesAvailabilityNextQuestion
    || missesEmailQuestion
    || missesRequiredNextQuestion
    ? fallback.trim()
    : text.trim();
}

function sanitizeActionPlanFallback(args: ComposeWeddingSalesResponseArgs, fallback: string) {
  if (!hasActionPlanQuestionAuthorityWithoutPlannedQuestion(args.state)) {
    return fallback.trim();
  }

  if (isSchedulingQuestionIntent(args.intent)) {
    return fallback.trim();
  }

  if (args.intent === "answer_question" && args.state.callProposed && !isBookedConversation(args.state)) {
    return fallback.trim();
  }

  return fallback
    .split(/\n\s*\n/)
    .filter((paragraph) => !paragraph.includes("?"))
    .join("\n\n")
    .trim();
}

function isSchedulingQuestionIntent(intent: WeddingSalesResponseIntent) {
  return (
    intent === "calendar_time_missing" ||
    intent === "calendar_date_mismatch" ||
    intent === "calendar_available" ||
    intent === "calendar_busy" ||
    intent === "calendar_outside_window" ||
    intent === "booking_failed"
  );
}

function shouldUseGroundedInstagramVoice(args: ComposeWeddingSalesResponseArgs) {
  if (args.state.channel !== "instagram" || args.state.semanticStateVersion !== 3) {
    return false;
  }

  if (
    args.state.lastActionPlan?.actions.some(
      (action) =>
        action.type !== "recommend_owner_handoff" &&
        action.type !== "suppress_reply",
    )
  ) {
    return true;
  }

  if (args.intent === "availability_available" || args.intent === "ask_call_time") {
    return true;
  }

  if (
    args.intent === "answer_question" &&
    (checkedWeddingAvailabilityThisTurn(args.state) || Boolean(buildWeddingSalesResponseContext(args.state).answerTopicIds.length))
  ) {
    return true;
  }

  return isSchedulingQuestionIntent(args.intent) || args.intent === "ask_email";
}

function hasCalendarAvailabilityToolThisTurn(state: WeddingSalesState) {
  return state.turnToolObservations.some(
    (observation) => observation.toolName === "check_consultation_calendar",
  );
}

function claimsUncheckedCalendarAvailability(args: ComposeWeddingSalesResponseArgs, text: string) {
  if (args.state.channel !== "instagram") {
    return false;
  }

  if (args.state.calendarStatus === "available" || hasCalendarAvailabilityToolThisTurn(args.state)) {
    return false;
  }

  if (!/\b(?:works?|available|perfect|great|confirmed|booked)\b/i.test(text)) {
    return false;
  }

  return /\b(?:\d{1,2}(?::\d{2})?\s*(?:am|pm)|monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today)\b/i.test(text);
}

async function generateGroundedInstagramVoiceDraft(args: ComposeWeddingSalesResponseArgs & { fallback: string }) {
  return traceLangRuntime(
    "wedding_sales.response.grounded_instagram_voice",
    buildTraceMetadata(args, {
      composerModel: process.env.WEDDING_SALES_RESPONSE_MODEL || DEFAULT_RESPONSE_MODEL,
      groundedVoice: true,
    }),
    async () => {
      const responseContext = buildWeddingSalesResponseContext(args.state);
      const { text } = await generateText({
        model: openai(process.env.WEDDING_SALES_RESPONSE_MODEL || DEFAULT_RESPONSE_MODEL),
        system: [
          "You write the next Instagram DM for Myndful Films.",
          "Code has already chosen the action plan and tools. You only phrase the customer-facing reply.",
          "Sound like Taras: warm, brief, human, and specific. Do not sound like a form or bot.",
          "Do not repeat the same opening pattern from the previous assistant response.",
          "Do not use 'Awesome [name]! We have...' or '[venue] sounds lovely' as a stock line.",
          "Answer every FAQ topic listed by responseContext.answerTopicIds.",
          "Ask only responseContext.plannedQuestionField if it is not null. Ask no other qualification question.",
          "Never ask for a field already present in leadState.",
          "Only mention wedding availability if toolObservations show check_wedding_availability or leadState.availability is available.",
          "Only say a call time works, is available, or is confirmed if leadState.calendarStatus is available or toolObservations show check_consultation_calendar.",
          "If a call time was offered but calendar availability is not checked, ask to confirm/check it rather than saying it works.",
          "If availability was just checked and is available, mention the date is available, the correct starting price, and the guide naturally.",
          "If venue is known and the next step is callTime, ask for a call time without generic venue praise.",
          "Keep it to 1-3 short DM bubbles separated by blank lines.",
        ].join("\n"),
        prompt: [
          "Write the reply from these grounded facts.",
          "Fallback draft is provided only as safety context; do not copy its wording if it sounds templated.",
          "Facts:",
          safeJson({
            ...buildComposerFacts(args),
            responseContext,
            fallbackDraft: args.fallback,
          }),
        ].join("\n\n"),
        temperature: 0.8,
      });

      return { text, textLength: text.length };
    },
  );
}

export function finalizeLlmWeddingSalesResponse(args: ComposeWeddingSalesResponseArgs & { text: string }) {
  const formatting = getChannelFormatting(args.config, args.state);
  const policy = args.policy ?? buildWeddingSalesDialogPolicy(args);
  const withoutModelSignature = stripSignatureLikeBlock(args.text);
  const withoutThreadGreeting = !policy.allowGreeting
    ? stripGreetingLikeOpening(withoutModelSignature)
    : withoutModelSignature;
  const normalizedLinks = formatting.richLinks
    ? normalizeMarkdownLinksForRichEmail(withoutThreadGreeting)
    : withoutThreadGreeting;
  const withFirstContactOpening = ensureInstagramFirstContactOpening(args, normalizedLinks);

  const withBrandEmoji = applyBrandEmojiCadence({ ...args, text: withFirstContactOpening });

  const finalText = policy.includeSignature
    ? appendSignatureOnce(withBrandEmoji, args.config.signature)
    : withBrandEmoji.trim();

  return normalizeCustomerFacingPunctuation(finalText);
}

export function parseWeddingSalesReflectionJson(text: string) {
  const trimmed = text.trim();
  const jsonText = trimmed.match(/\{[\s\S]*\}/)?.[0] ?? trimmed;

  try {
    const parsed = JSON.parse(jsonText) as {
      status?: unknown;
      revisedText?: unknown;
      issues?: unknown;
    };

    return {
      status: parsed.status === "rewrite" ? "rewrite" : "pass",
      revisedText: typeof parsed.revisedText === "string" ? parsed.revisedText.trim() : "",
      issues: Array.isArray(parsed.issues) ? parsed.issues.filter((issue): issue is string => typeof issue === "string") : [],
    } satisfies WeddingSalesReflectionReview;
  } catch {
    return {
      status: "pass" as const,
      revisedText: "",
      issues: [],
    } satisfies WeddingSalesReflectionReview;
  }
}

async function generateWeddingSalesComposerDraft(args: ComposeWeddingSalesResponseArgs) {
  return traceLangRuntime(
    "wedding_sales.response.composer",
    buildTraceMetadata(args, {
      composerModel: process.env.WEDDING_SALES_RESPONSE_MODEL || DEFAULT_RESPONSE_MODEL,
    }),
    async () => {
      const { text } = await generateText({
        model: openai(process.env.WEDDING_SALES_RESPONSE_MODEL || DEFAULT_RESPONSE_MODEL),
        system: buildComposerSystemPrompt(args),
        prompt: [
          "Create the next reply from these facts.",
          "If previousAssistantResponse is similar to what you are about to write, change the wording and move the conversation forward.",
          "Do not treat this as a fresh conversation unless assistantReplyCount is 0.",
          "Facts:",
          safeJson(buildComposerFacts(args)),
        ].join("\n\n"),
        temperature: 0.7,
      });

      return {
        text,
        textLength: text.length,
      };
    },
  );
}

async function reviewWeddingSalesComposerDraft(args: ComposeWeddingSalesResponseArgs & { draft: string }) {
  return traceLangRuntime(
    "wedding_sales.response.reflection",
    buildTraceMetadata(args, {
      reflectionModel: process.env.WEDDING_SALES_REFLECTION_MODEL || DEFAULT_REFLECTION_MODEL,
      draftLength: args.draft.length,
    }),
    async () => {
      const { text } = await generateText({
        model: openai(process.env.WEDDING_SALES_REFLECTION_MODEL || DEFAULT_REFLECTION_MODEL),
        system: buildReflectionSystemPrompt(args),
        prompt: [
          "Review this draft and either pass it or rewrite it.",
          "Facts and policy:",
          safeJson(buildComposerFacts(args)),
          "Draft:",
          args.draft,
        ].join("\n\n"),
        temperature: 0.2,
      });
      const review = parseWeddingSalesReflectionJson(text);

      return {
        ...review,
        rawReviewLength: text.length,
        revisedTextLength: review.revisedText.length,
      };
    },
  );
}

async function reflectWeddingSalesResponse(args: ComposeWeddingSalesResponseArgs & { draft: string }) {
  if (!shouldUseReflection()) {
    return args.draft;
  }

  try {
    const review = await reviewWeddingSalesComposerDraft(args);

    if (review.status !== "rewrite" || !review.revisedText) {
      return args.draft;
    }

    return finalizeLlmWeddingSalesResponse({ ...args, text: review.revisedText });
  } catch (error) {
    console.warn("[wedding-sales] LLM response reflection failed; using composer draft.", error);
    return args.draft;
  }
}

export async function composeHumanWeddingSalesResponse(args: ComposeWeddingSalesResponseArgs) {
  const deterministicFallback = normalizeCustomerFacingPunctuation(
    sanitizeActionPlanFallback(
      args,
      ensureInstagramFirstContactOpening(args, composeWeddingSalesResponse(args)),
    ),
  );
  const fallback = normalizeCustomerFacingPunctuation(
    composeGroundedInstagramFallback(args, deterministicFallback),
  );

  if (args.testMode && args.intent === "booking_confirmed") {
    return fallback;
  }

  if (!shouldUseLlmComposer()) {
    return fallback;
  }

  try {
    const { text } = shouldUseGroundedInstagramVoice(args)
      ? await generateGroundedInstagramVoiceDraft({ ...args, fallback })
      : await generateWeddingSalesComposerDraft(args);

    const trimmed = text.trim();

    if (!trimmed) {
      return fallback;
    }

    const draft = finalizeLlmWeddingSalesResponse({ ...args, text: trimmed });

    const reflected = await reflectWeddingSalesResponse({ ...args, draft });

    if (claimsUncheckedCalendarAvailability(args, reflected)) {
      return fallback;
    }

    return normalizeCustomerFacingPunctuation(enforceInstagramResponseStyle(args, reflected, fallback));
  } catch (error) {
    console.warn("[wedding-sales] LLM response composer failed; using fallback.", error);
    return fallback;
  }
}

export const weddingSalesResponseComposerTestHelpers = {
  enforceInstagramResponseStyle,
  claimsUncheckedCalendarAvailability,
  shouldUseGroundedInstagramVoice,
};
