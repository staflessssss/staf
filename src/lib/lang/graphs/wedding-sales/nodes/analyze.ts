import type { WeddingSalesState } from "../state";

const monthNamePattern =
  "\\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|sept|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\s+\\d{1,2}(?:st|nd|rd|th)?\\b";

function hasYear(text: string) {
  return /\b(?:19|20)\d{2}\b/.test(text);
}

function hasWeddingDate(text: string) {
  return new RegExp(monthNamePattern, "i").test(text) || /\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/.test(text);
}

function hasNames(text: string) {
  return /\b(?:we are|we're|this is|my name is|i am|i'm)\b/i.test(text);
}

function hasLocation(text: string) {
  return /\b(?:in|at|near)\s+[A-Z][A-Za-z .'-]{2,}/.test(text) || /\b(?:NC|SC|GA|Charlotte|Atlanta|Savannah)\b/i.test(text);
}

function isCoordinatorOrCoi(text: string) {
  return /\b(?:coordinator|planner|vendor|coi|certificate of insurance)\b/i.test(text);
}

function asksForCall(text: string) {
  return /\b(?:consultation|call|chat|zoom|meet)\b/i.test(text) && /\b(?:am|pm|morning|afternoon|evening|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(text);
}

function confirmsBooking(text: string) {
  return /\b(?:yes|yep|perfect|sounds good|please book|book it|confirm)\b/i.test(text);
}

export async function analyzeWeddingSalesMessage(state: WeddingSalesState): Promise<Partial<WeddingSalesState>> {
  const message = state.latestCustomerMessage ?? "";

  if (isCoordinatorOrCoi(message)) {
    return { leadStage: "ignored" };
  }

  if (state.calendarStatus === "available" && confirmsBooking(message)) {
    return { leadStage: "ready_to_book", bookingConfirmed: true };
  }

  if (asksForCall(message)) {
    return { leadStage: "checking_calendar", proposedCallTime: message };
  }

  const dateKnown = Boolean(state.weddingDate) || hasWeddingDate(message);
  const yearKnown = state.weddingYearKnown || hasYear(message);
  const namesKnown = Boolean(state.names) || hasNames(message);
  const locationKnown = Boolean(state.location) || hasLocation(message);

  if (dateKnown && !yearKnown) {
    return {
      leadStage: "waiting_wedding_year",
      weddingYearKnown: false,
    };
  }

  if (!namesKnown || !dateKnown) {
    return {
      leadStage: "missing_names_or_date",
      weddingYearKnown: yearKnown,
    };
  }

  if (dateKnown && yearKnown && locationKnown) {
    return {
      leadStage: "ready_for_availability",
      weddingYearKnown: true,
    };
  }

  return {
    leadStage: "missing_names_or_date",
    weddingYearKnown: yearKnown,
  };
}
