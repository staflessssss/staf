import type { WeddingSalesResponseIntent } from "./response-composer";
import type { WeddingSalesState } from "./state";

function compact(value?: string, maxLength = 180) {
  const normalized = value?.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return "";
  }

  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}...` : normalized;
}

export function buildWeddingSalesConversationSummary(args: {
  state: WeddingSalesState;
  intent: WeddingSalesResponseIntent;
}) {
  const { state, intent } = args;
  const lines = [
    state.names ? `Couple: ${state.names}.` : "",
    state.weddingDate ? `Wedding date: ${state.weddingDate}${state.weddingYearKnown ? "" : " (year not confirmed)"}.` : "",
    state.location ? `Location: ${state.location}.` : "",
    state.venue ? `Venue: ${state.venue}.` : "",
    state.customerEmail ? `Customer email: ${state.customerEmail}.` : "",
    state.availability ? `Wedding availability: ${state.availability}.` : "",
    state.guideSent || state.guideOffered ? "Collections guide has been sent or offered." : "",
    state.portfolioSent ? "Portfolio links have been shared." : "",
    state.reviewsSent ? "Reviews link has been shared." : "",
    state.callProposed ? "Consultation call has been proposed." : "",
    state.proposedCallTime ? `Latest proposed consultation time: ${compact(state.proposedCallTime, 120)}.` : "",
    state.calendarStatus ? `Latest calendar check: ${state.calendarStatus}.` : "",
    state.calendarContextDate ? `Consultation date currently being discussed: ${state.calendarContextDate}.` : "",
    state.bookingConfirmed ? "Consultation booking is confirmed." : "",
    state.bookedEventId ? `Booked calendar event id: ${state.bookedEventId}.` : "",
    state.askedForNames ? "Agent has already asked for names." : "",
    state.askedForWeddingYear ? "Agent has already asked for wedding year." : "",
    state.askedForVenue ? "Agent has already asked for venue or location." : "",
    state.askedForCallTime ? "Agent has already asked for consultation timing." : "",
    state.askedForEmail ? "Agent has already asked for customer email." : "",
    `Last assistant intent: ${intent}.`,
    state.latestCustomerMessage ? `Latest customer message: ${compact(state.latestCustomerMessage, 220)}.` : "",
    state.conversationContext
      ? `Recent conversation transcript: ${compact(state.conversationContext, 900)}.`
      : "",
    state.responseDraft ? `Latest assistant reply: ${compact(state.responseDraft, 260)}.` : "",
  ].filter(Boolean);

  return lines.join("\n").slice(0, 2000);
}
