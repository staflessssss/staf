import {
  defaultWeddingSalesConfig,
  selectWeddingSalesPricing,
  type WeddingSalesConfig,
} from "../wedding-sales/config";
import { getCoupleName, type SimpleWeddingSalesState } from "./state";

export function formatSimpleWeddingDate(date: string | undefined) {
  if (!date) {
    return undefined;
  }

  const parsed = new Date(`${date}T00:00:00Z`);

  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

function joinLines(lines: Array<string | undefined>) {
  return lines.filter(Boolean).join("\n\n");
}

function pricingLine(config: WeddingSalesConfig, state: SimpleWeddingSalesState) {
  if (!state.questionsAskedByCustomer.includes("pricing")) {
    return undefined;
  }

  const pricing = selectWeddingSalesPricing(config, state);
  const coverage = pricing.coverageHours ? `${pricing.coverageHours}-hour ` : "";

  return `Our ${coverage}collections start at ${pricing.startPrice}.`;
}

function availabilityLine(state: SimpleWeddingSalesState) {
  if (!state.availability || !state.weddingDate) {
    return undefined;
  }

  const date = formatSimpleWeddingDate(state.weddingDate);
  const place = state.location ? ` for ${state.location}` : "";

  if (state.availability === "available") {
    return `Yes - ${date} is open${place}.`;
  }

  const alternatives = state.suggestedWeddingDates?.map(formatSimpleWeddingDate).filter(Boolean).join(" or ");

  return alternatives
    ? `${date} is not open${place}, but ${alternatives} may work.`
    : `${date} is not open${place}.`;
}

function missingInfoQuestion(state: SimpleWeddingSalesState) {
  if (state.missingField === "names") {
    return "What are both of your names?";
  }

  if (state.missingField === "weddingDate") {
    return "What date are you looking at?";
  }

  if (state.missingField === "location") {
    return "What city or area is the wedding in?";
  }

  return undefined;
}

function nextQuestion(state: SimpleWeddingSalesState) {
  if (state.nextStep === "ask_missing_info") {
    return missingInfoQuestion(state);
  }

  if (state.nextStep === "ask_venue") {
    return "Do you already have a venue picked out?";
  }

  if (state.nextStep === "ask_call_time") {
    return "What is a good time for a quick call?";
  }

  if (state.nextStep === "ask_email") {
    return "What email should I send the calendar invite to?";
  }

  return undefined;
}

function calendarLine(state: SimpleWeddingSalesState) {
  if (state.calendarStatus === "available" && state.checkedCallTime) {
    return `${state.checkedCallTime} works for a call.`;
  }

  if (state.calendarStatus === "busy") {
    const suggestions = state.suggestedCallTimes?.join(", ");

    return suggestions
      ? `That time is not open, but ${suggestions} could work.`
      : "That time is not open.";
  }

  return undefined;
}

function bookingLine(state: SimpleWeddingSalesState) {
  if (!state.bookingConfirmed) {
    return undefined;
  }

  const coupleName = getCoupleName(state);

  return coupleName
    ? `Done - I booked the call for ${coupleName}.`
    : "Done - I booked the call.";
}

function recapLine(state: SimpleWeddingSalesState) {
  const details = [
    state.weddingDate ? `date: ${formatSimpleWeddingDate(state.weddingDate)}` : undefined,
    state.location ? `location: ${state.location}` : undefined,
    state.venue ? `venue: ${state.venue}` : undefined,
  ].filter(Boolean);

  if (details.length === 0) {
    return undefined;
  }

  return `I have ${details.join(", ")}.`;
}

function fallbackQuestion(state: SimpleWeddingSalesState) {
  if (!state.weddingDate) {
    return "What date are you looking at?";
  }

  if (!state.location) {
    return "What city or area is the wedding in?";
  }

  if (!getCoupleName(state)) {
    return "What are both of your names?";
  }

  return "Got it. I can help with that.";
}

export function writeHumanReply(args: {
  state: SimpleWeddingSalesState;
  config?: Partial<WeddingSalesConfig>;
}): string {
  const config = {
    ...defaultWeddingSalesConfig,
    ...args.config,
    pricing: {
      ...defaultWeddingSalesConfig.pricing,
      ...args.config?.pricing,
    },
    pricingByRegion: {
      ...defaultWeddingSalesConfig.pricingByRegion,
      ...args.config?.pricingByRegion,
    },
  };
  const { state } = args;

  if (state.nextStep === "handoff") {
    return "I want to make sure I answer this correctly, so I will have someone take a look.";
  }

  const body = joinLines([
    state.channel === "gmail" ? recapLine(state) : undefined,
    availabilityLine(state),
    pricingLine(config, state),
    calendarLine(state),
    bookingLine(state),
    nextQuestion(state),
  ]);

  if (body) {
    return body;
  }

  return fallbackQuestion(state);
}

export const simpleWeddingSalesReplyTestHelpers = {
  formatDate: formatSimpleWeddingDate,
  availabilityLine,
  pricingLine,
};
