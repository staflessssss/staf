import type { WeddingSalesState } from "../state";

const monthNamePattern =
  "\\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|sept|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\s+\\d{1,2}(?:st|nd|rd|th)?\\b";
const monthIndexByName: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

function hasYear(text: string) {
  return /\b(?:19|20)\d{2}\b/.test(text);
}

function extractYear(text: string) {
  return text.match(/\b((?:19|20)\d{2})\b/)?.[1];
}

function stripQuotedEmailText(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();

      if (!trimmed) {
        return true;
      }

      if (trimmed.startsWith(">")) {
        return false;
      }

      if (/^on .+ wrote:?\s*$/i.test(trimmed)) {
        return false;
      }

      if (/^from:\s+/i.test(trimmed) || /^sent:\s+/i.test(trimmed) || /^subject:\s+/i.test(trimmed)) {
        return false;
      }

      return true;
    })
    .join("\n")
    .trim();
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

function proposesCallTime(text: string) {
  const hasDayOrRelativeDate =
    /\b(?:today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(text);
  const hasTime = /\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i.test(text);

  return hasDayOrRelativeDate && hasTime;
}

function hasBareTimeSelection(text: string) {
  return /\b\d{1,2}:\d{2}\b/.test(text) || /\b\d{1,2}\s*(?:am|pm)\b/i.test(text);
}

function isSchedulingContinuationContext(state: WeddingSalesState) {
  return (
    state.leadStage === "checking_calendar" ||
    state.leadStage === "call_proposed" ||
    state.lastAssistantIntent === "calendar_busy" ||
    state.lastAssistantIntent === "calendar_available" ||
    state.lastAssistantIntent === "calendar_outside_window"
  );
}

function extractWeekday(text?: string) {
  return text?.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i)?.[1];
}

function extractMeridiem(text?: string) {
  return text?.match(/\b(am|pm)\b/i)?.[1]?.toUpperCase();
}

function extractTimezoneText(text?: string) {
  return text?.match(/\b(?:Eastern|ET|EST|EDT)\b/i)?.[0];
}

function normalizeBareTimeSelection(text: string, previousTime?: string) {
  const timeMatch = text.match(/\b(\d{1,2}(?::\d{2})?)\s*(am|pm)?\b/i);
  if (!timeMatch) {
    return text;
  }

  const weekday = extractWeekday(text) ?? extractWeekday(previousTime);
  const meridiem = timeMatch[2]?.toUpperCase() ?? extractMeridiem(previousTime);
  const timezone = extractTimezoneText(text) ?? extractTimezoneText(previousTime);
  const time = [timeMatch[1], meridiem].filter(Boolean).join(" ");

  return [weekday, "at", time, timezone].filter(Boolean).join(" ");
}

function confirmsBooking(text: string) {
  return /\b(?:yes|yep|perfect|sounds good|please book|book it|confirm)\b/i.test(text);
}

function asksGeneralQuestion(text: string) {
  return /\?/.test(text) || /\b(?:pricing|price|cost|travel|fee|venue|coi|insurance|style|included|include|timeline|delivery|music|photographer)\b/i.test(text);
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function extractWeddingDate(text: string) {
  const monthNameDate = text.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|sept|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+((?:19|20)\d{2}))?\b/i,
  );

  if (monthNameDate) {
    const month = monthIndexByName[monthNameDate[1].toLowerCase()];
    const day = Number(monthNameDate[2]);
    const year = monthNameDate[3];

    return {
      display: monthNameDate[0],
      iso: year && month && day >= 1 && day <= 31 ? `${year}-${pad2(month)}-${pad2(day)}` : undefined,
      yearKnown: Boolean(year),
    };
  }

  const numericDate = text.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-]((?:19|20)?\d{2}))?\b/);
  if (!numericDate) {
    return null;
  }

  const month = Number(numericDate[1]);
  const day = Number(numericDate[2]);
  const rawYear = numericDate[3];
  const year = rawYear?.length === 2 ? `20${rawYear}` : rawYear;

  return {
    display: numericDate[0],
    iso: year && month >= 1 && month <= 12 && day >= 1 && day <= 31 ? `${year}-${pad2(month)}-${pad2(day)}` : undefined,
    yearKnown: Boolean(year),
  };
}

function combineWeddingDateTextWithYear(dateText: string | undefined, year: string | undefined) {
  if (!dateText || !year) {
    return undefined;
  }

  return extractWeddingDate(`${dateText}, ${year}`)?.iso;
}

function extractNames(text: string) {
  const match = text.match(/\b(?:we are|we're|this is)\s+([A-Z][A-Za-z .'-]+?)(?:\.|,|\s+and\s+our|\s+our|\s+wedding|\s+from|\s+in\b|$)/i);
  return match?.[1]?.trim();
}

function extractLocation(text: string) {
  const match = text.match(/\b(?:in|near|at)\s+([A-Z][A-Za-z .'-]+?)(?:\.|,|\s+(?:on|for|and|with)\b|$)/);
  return match?.[1]?.trim();
}

export async function analyzeWeddingSalesMessage(state: WeddingSalesState): Promise<Partial<WeddingSalesState>> {
  const message = stripQuotedEmailText(state.latestCustomerMessage ?? "");
  const extractedDate = extractWeddingDate(message);
  const extractedYear = extractYear(message);
  const extractedNames = extractNames(message);
  const extractedLocation = extractLocation(message);
  const combinedWeddingDate =
    extractedDate?.iso ??
    combineWeddingDateTextWithYear(extractedDate?.display, state.weddingYear) ??
    combineWeddingDateTextWithYear(state.weddingDateText, extractedYear);
  const baseUpdate: Partial<WeddingSalesState> = {
    ...(extractedNames ? { names: extractedNames } : {}),
    ...(combinedWeddingDate ? { weddingDate: combinedWeddingDate } : {}),
    ...(extractedDate?.display && !combinedWeddingDate ? { weddingDateText: extractedDate.display } : {}),
    ...(extractedYear ? { weddingYear: extractedYear } : {}),
    ...(extractedLocation ? { location: extractedLocation } : {}),
  };

  if (isCoordinatorOrCoi(message)) {
    return { ...baseUpdate, leadStage: "ignored" };
  }

  if (state.calendarStatus === "available" && confirmsBooking(message)) {
    return { ...baseUpdate, leadStage: "ready_to_book", bookingConfirmed: true };
  }

  if (state.calendarStatus === "busy" && confirmsBooking(message)) {
    return { ...baseUpdate, leadStage: "checking_calendar", proposedCallTime: undefined };
  }

  if (isSchedulingContinuationContext(state) && hasBareTimeSelection(message)) {
    return {
      ...baseUpdate,
      leadStage: "checking_calendar",
      proposedCallTime: normalizeBareTimeSelection(message, state.proposedCallTime),
    };
  }

  if (asksForCall(message) || ((state.callProposed || state.availability === "available") && proposesCallTime(message))) {
    return { ...baseUpdate, leadStage: "checking_calendar", proposedCallTime: message };
  }

  if (
    state.availability === "available" &&
    asksGeneralQuestion(message) &&
    !hasWeddingDate(message) &&
    !hasYear(message)
  ) {
    return { ...baseUpdate, leadStage: "answering_question" };
  }

  const dateKnown = Boolean(state.weddingDate) || Boolean(combinedWeddingDate) || Boolean(state.weddingDateText) || hasWeddingDate(message);
  const yearKnown = state.weddingYearKnown || hasYear(message) || Boolean(extractedDate?.yearKnown) || Boolean(state.weddingYear);
  const namesKnown = Boolean(state.names) || hasNames(message);
  const locationKnown = Boolean(state.location) || hasLocation(message);

  if (dateKnown && !yearKnown) {
    return {
      ...baseUpdate,
      leadStage: "waiting_wedding_year",
      weddingYearKnown: false,
    };
  }

  if (!namesKnown || !dateKnown) {
    return {
      ...baseUpdate,
      leadStage: "missing_names_or_date",
      weddingYearKnown: yearKnown,
    };
  }

  if (dateKnown && yearKnown && locationKnown) {
    return {
      ...baseUpdate,
      leadStage: "ready_for_availability",
      weddingYearKnown: true,
    };
  }

  return {
    ...baseUpdate,
    leadStage: "missing_names_or_date",
    weddingYearKnown: yearKnown,
  };
}

export const weddingSalesAnalyzeTestHelpers = {
  extractLocation,
  extractNames,
  extractWeddingDate,
  normalizeBareTimeSelection,
  proposesCallTime,
};
