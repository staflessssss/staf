import type { WeddingSalesState } from "../state";
import {
  analyzeWeddingSalesSemantics,
  type WeddingSalesSemanticAnalysis,
} from "../semantic-analyzer";
import { isInstagramCtaStarter } from "../starter-intents";

const monthPattern =
  "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|sept|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const monthNamePattern = `\\b${monthPattern}\\s+\\d{1,2}(?:st|nd|rd|th)?\\b`;
const dayMonthPattern = `\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:of\\s+)?${monthPattern}\\b`;
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
  return (
    new RegExp(monthNamePattern, "i").test(text) ||
    new RegExp(dayMonthPattern, "i").test(text) ||
    /\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/.test(text)
  );
}

function hasNames(text: string) {
  if (
    /\b(?:our names?(?: are)?)\b/i.test(text) ||
    /\b[A-Z][A-Za-z'-]+\s+(?:and|&)\s+[A-Z][A-Za-z'-]+\b/.test(text)
  ) {
    return true;
  }
  return /\b(?:we are|we're|this is|my name is|i am|i'm|his name is|her name is|fianc[eé]'?s name is|fiance'?s name is)\b/i.test(text);
}

function hasLocation(text: string) {
  return /\b(?:in|at|near)\s+[A-Z][A-Za-z .'-]{2,}/.test(text) || /\b(?:NC|SC|GA|FL|Florida|Charlotte|Raleigh|Charleston|Atlanta|Savannah|Tampa|Miami|Orlando)\b/i.test(text);
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

function proposesCallDayWithoutTime(text: string) {
  const hasDayOrRelativeDate =
    /\b(?:today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(text);
  const hasCallIntent = /\b(?:call|chat|talk|meet|consultation)\b/i.test(text);

  return hasDayOrRelativeDate && hasCallIntent && !hasBareTimeSelection(text);
}

function hasBareTimeSelection(text: string) {
  return /\b\d{1,2}:\d{2}\b/.test(text) || /\b\d{1,2}\s*(?:am|pm)\b/i.test(text);
}

function isSchedulingContinuationContext(state: WeddingSalesState) {
  return (
    state.leadStage === "asking_call_time" ||
    state.leadStage === "checking_calendar" ||
    state.leadStage === "call_proposed" ||
    state.lastAssistantIntent === "calendar_busy" ||
    state.lastAssistantIntent === "calendar_available" ||
    state.lastAssistantIntent === "calendar_outside_window"
  );
}

function extractWeekday(text?: string) {
  return text?.match(/\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i)?.[1];
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

function confirmsPendingChange(text: string) {
  return /^(?:yes|yep|yeah|correct|right|exactly|that'?s right|yes please|please do|confirm)$/i.test(text.trim());
}

function rejectsPendingChange(text: string) {
  return /^(?:no|nope|not|not really|wrong|that's not it|that is not it)$/i.test(text.trim());
}

function explicitlyChangesWeddingDate(text: string) {
  return /\b(?:actually|correction|correcting|changed|change|updated|new|different|instead|sorry|i mean|i meant|moved|switched|rescheduled|my date is|wedding date is|date is)\b/i.test(text);
}

function explicitlyChangesLocation(text: string) {
  return /\b(?:actually|correction|correcting|changed|change|updated|new|different|instead|sorry|i mean|i meant|moved|switched|relocated|location is|city is|wedding is in|it is in|it's in|its in)\b/i.test(text);
}

function clearPendingChange() {
  return {
    pendingChangeField: undefined,
    pendingChangeValue: undefined,
    pendingChangeDisplay: undefined,
    changeConfirmationRejected: undefined,
  } satisfies Partial<WeddingSalesState>;
}

function hasSemanticConfidence(semantic: WeddingSalesSemanticAnalysis | null) {
  return Boolean(semantic && semantic.confidence >= 0.6);
}

function preferMoreCompleteNames(primary: string | undefined, fallback: string | undefined) {
  if (!primary) {
    return fallback;
  }

  if (!fallback) {
    return primary;
  }

  if (hasCoupleNames(fallback) && !hasCoupleNames(primary)) {
    return fallback;
  }

  return primary;
}

function asksGeneralQuestion(text: string) {
  return /\?/.test(text) || /\b(?:pricing|price|cost|travel|fee|venue|coi|insurance|style|included|include|timeline|delivery|music|photographer)\b/i.test(text);
}

function asksWeddingAvailabilityQuestion(text: string) {
  return /\b(?:available|availability|open|free)\b/i.test(text) &&
    /\b(?:date|day|wedding|you|team|videographer|filmmaker)\b/i.test(text);
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

  const dayMonthDate = text.match(
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|sept|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:,?\s+(?:of\s+)?((?:19|20)\d{2}))?\b/i,
  );

  if (dayMonthDate) {
    const day = Number(dayMonthDate[1]);
    const month = monthIndexByName[dayMonthDate[2].toLowerCase()];
    const year = dayMonthDate[3];

    return {
      display: dayMonthDate[0],
      iso: year && month && day >= 1 && day <= 31 ? `${year}-${pad2(month)}-${pad2(day)}` : undefined,
      yearKnown: Boolean(year),
    };
  }

  const numericDate = text.match(/\b(\d{1,2})([./-])(\d{1,2})(?:\2((?:19|20)?\d{2}))?\b/);
  if (!numericDate) {
    return null;
  }

  const firstPart = Number(numericDate[1]);
  const separator = numericDate[2];
  const secondPart = Number(numericDate[3]);
  const rawYear = numericDate[4];
  const usesDayFirst = separator === "." || (firstPart > 12 && secondPart <= 12);
  const month = usesDayFirst ? secondPart : firstPart;
  const day = usesDayFirst ? firstPart : secondPart;
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

function extractFirstName(value?: string) {
  return value?.trim().split(/\s+/)[0]?.replace(/[^A-Za-z'-]/g, "");
}

function isLikelyPersonName(value?: string) {
  const name = extractFirstName(value);

  if (!name) {
    return false;
  }

  return !Object.hasOwn(monthIndexByName, name.toLowerCase());
}

function mergeNames(currentNames: string | undefined, newName: string | undefined) {
  const normalizedName = extractFirstName(newName);

  if (!normalizedName || !isLikelyPersonName(normalizedName)) {
    return currentNames;
  }

  if (!currentNames) {
    return normalizedName;
  }

  const existingNames = currentNames
    .split(/\s+(?:and|&)\s+/i)
    .map(extractFirstName)
    .filter(Boolean)
    .map((name) => name?.toLowerCase());

  if (existingNames.includes(normalizedName.toLowerCase())) {
    return currentNames;
  }

  return `${currentNames} and ${normalizedName}`;
}

function hasCoupleNames(value?: string) {
  return Boolean(value && /\s+(?:and|&)\s+/i.test(value));
}

function extractNames(text: string, currentNames?: string) {
  const matchingText = text.replace(new RegExp(`\\b${monthPattern}\\b`, "gi"), (match) => match.toLowerCase());
  const nameTokenPattern = `(?!${monthPattern}\\b)[A-Z][A-Za-z'-]+`;
  const namePhrasePattern = `${nameTokenPattern}(?:\\s+${nameTokenPattern})?`;
  const standaloneCoupleMatch = matchingText.match(
    new RegExp(`^\\s*(${namePhrasePattern})\\s+(?:and|And|AND|&)\\s+(${namePhrasePattern})\\s*[.!]?\\s*$`),
  );

  if (standaloneCoupleMatch?.[1] && standaloneCoupleMatch[2]) {
    return `${standaloneCoupleMatch[1]} and ${standaloneCoupleMatch[2]}`;
  }

  const directCoupleMatch = matchingText.match(
    new RegExp(
      `\\b(${namePhrasePattern})\\s+(?:and|And|AND|&)\\s+(${namePhrasePattern})(?:[\\s\\n]+(?:and\\s+)?(?:date|wedding|venue|location|in|at|on)\\b|[\\s\\n]+${monthNamePattern}\\b|[\\s\\n]+\\d{1,2}\\b|[.,!]|$)`,
    ),
  );

  if (directCoupleMatch?.[1] && directCoupleMatch[2]) {
    return `${directCoupleMatch[1]} and ${directCoupleMatch[2]}`;
  }

  const brideMatch = matchingText.match(new RegExp(`\\bbride\\s*(?:name\\s*)?(?:is|:)\\s+(${nameTokenPattern}(?:\\s+${nameTokenPattern})?)`, "i"));
  const groomMatch = matchingText.match(new RegExp(`\\bgroom\\s*(?:name\\s*)?(?:is|:)\\s+(${nameTokenPattern}(?:\\s+${nameTokenPattern})?)`, "i"));

  if (brideMatch?.[1] && groomMatch?.[1]) {
    return `${brideMatch[1]} and ${groomMatch[1]}`;
  }

  const namedCoupleMatch = text.match(
    /\b(?:our names?(?: are)?)\s+([A-Z][A-Za-z .'-]+?)(?:\.|,|\s+and\s+(?:date|our|wedding|venue|location)\b|\s+our\b|\s+wedding\b|\s+from\b|\s+in\b|$)/i,
  );

  if (namedCoupleMatch?.[1]) {
    return namedCoupleMatch[1].trim();
  }

  const coupleMatch = text.match(/\b(?:we are|we're|this is)\s+([A-Z][A-Za-z .'-]+?)(?:\.|,|\s+and\s+our|\s+our|\s+wedding|\s+from|\s+in\b|$)/i);

  if (coupleMatch?.[1]) {
    return coupleMatch[1].trim();
  }

  const selfMatch = text.match(/\b(?:my name is|i am|i'm|im)\s+([A-Z][A-Za-z'-]+)/i);
  const partnerMatch = text.match(/\b(?:(?:his|her|their)\s+name|(?:my\s+)?(?:fianc[eé]|fiance|groom|bride|partner)(?:'?s)?(?:\s+name)?|groom|bride)\s*(?:is|:)\s+([A-Z][A-Za-z'-]+)/i);
  const reversePartnerMatch = text.match(/\b([A-Z][A-Za-z'-]+)\s+is\s+(?:my\s+)?(?:fianc\S*|fiance\S*)\s+name\b/i);
  const withSelf = mergeNames(currentNames, selfMatch?.[1]);

  const withExplicitPartner = mergeNames(withSelf, partnerMatch?.[1] ?? reversePartnerMatch?.[1]);

  if (withExplicitPartner && hasCoupleNames(withExplicitPartner)) {
    return withExplicitPartner;
  }

  if (currentNames && !hasCoupleNames(currentNames)) {
    const shortPartnerReply = text.match(/^\s*([A-Z][A-Za-z'-]+)\s*(?:,|\.|\s+(?:and\s+)?(?:date|wedding|our|venue|location)\b|$)/);

    if (shortPartnerReply?.[1] && isLikelyPersonName(shortPartnerReply[1])) {
      return mergeNames(withExplicitPartner, shortPartnerReply[1]);
    }
  }

  return withExplicitPartner;
}

function extractLocation(text: string) {
  const match = text.match(/\b(?:in|near|at)\s+([A-Z][A-Za-z .'-]+?)(?:\.|,|\s+(?:on|for|and|with)\b|$)/);
  if (match?.[1]) {
    return match[1].trim();
  }

  const knownCity = text.match(/\b(Charlotte|Raleigh|Charleston|Atlanta|Savannah|Tampa|Miami|Orlando)\b/i)?.[1];
  return knownCity ? knownCity.charAt(0).toUpperCase() + knownCity.slice(1).toLowerCase() : undefined;
}

function extractEmail(text: string) {
  return text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)?.[0]?.toLowerCase();
}

function isLikelyVenueAnswer(text: string, state: WeddingSalesState) {
  const trimmed = text.trim();

  if (!trimmed || trimmed.length > 80 || /[?@]/.test(trimmed)) {
    return false;
  }

  if (/^(?:yes|yeah|yep|sure|ok|okay|perfect|great|sounds good|that works|works for me|cool|awesome|thanks|thank you)$/i.test(trimmed)) {
    return false;
  }

  if (!state.askedForVenue && state.lastAssistantIntent !== "availability_available") {
    return false;
  }

  const streetAddressPattern =
    /\b\d{1,6}\s+[A-Za-z0-9 .'-]+?\s+(?:street|st\.?|road|rd\.?|avenue|ave\.?|lane|ln\.?|drive|dr\.?|boulevard|blvd\.?|way|court|ct\.?|place|pl\.?|highway|hwy\.?)\b/i;

  return streetAddressPattern.test(trimmed) ||
    /\b(?:park|estate|farm|barn|venue|club|hotel|garden|hall|chapel|church|resort|manor|house|vineyard|winery|center|centre|museum|mansion|lodge|inn|plaza|ballroom)\b/i.test(trimmed) ||
    /^[A-Z][A-Za-z0-9 .'-]+\s+[A-Z]?[A-Za-z0-9 .'-]+[.!]?$/.test(trimmed);
}

function extractVenue(text: string, state: WeddingSalesState) {
  const explicitVenue = text.match(/\b(?:venue is|venue:|at|it(?:'|’)?s|its|it is|it(?:'|’)?s at|its at)\s+([A-Z][A-Za-z0-9 .'-]+?)(?:[.!]|,|\s+(?:on|for|and|with)\b|$)/i)?.[1];

  if (explicitVenue) {
    return explicitVenue.trim();
  }

  return isLikelyVenueAnswer(text, state) ? text.trim() : undefined;
}

export function analyzeWeddingSalesMessageWithSemantics(
  state: WeddingSalesState,
  semantic: WeddingSalesSemanticAnalysis | null,
): Partial<WeddingSalesState> {
  const message = stripQuotedEmailText(state.latestCustomerMessage ?? "");
  const useSemantic = hasSemanticConfidence(semantic);
  const deterministicDate = extractWeddingDate(message);
  const semanticCanSupplyIsoDate = hasYear(message) || Boolean(state.weddingYear);
  const semanticDate = useSemantic && semantic?.weddingDate && semanticCanSupplyIsoDate
    ? {
        display: semantic.weddingDateText ?? semantic.weddingDate,
        iso: semantic.weddingDate,
        yearKnown: true,
      }
    : useSemantic && semantic?.weddingDateText
      ? extractWeddingDate(semantic.weddingDateText)
      : null;
  const extractedDate = deterministicDate ?? semanticDate;
  const extractedYear =
    extractYear(message) ??
    (useSemantic && semantic?.answersRequestedField === "wedding_year"
      ? semantic.weddingYear ?? undefined
      : undefined);
  const extractedNames = preferMoreCompleteNames(
    useSemantic ? semantic?.names ?? undefined : undefined,
    extractNames(message, state.names),
  );
  const extractedLocation = extractLocation(message) ?? (useSemantic ? semantic?.location ?? undefined : undefined);
  const extractedVenue = extractVenue(message, state) ?? (useSemantic ? semantic?.venue ?? undefined : undefined);
  const extractedEmail = extractEmail(message) ?? (useSemantic ? semantic?.email ?? undefined : undefined);
  const combinedWeddingDate =
    extractedDate?.iso ??
    combineWeddingDateTextWithYear(extractedDate?.display, state.weddingYear) ??
    combineWeddingDateTextWithYear(state.weddingDateText, extractedYear) ??
    combineWeddingDateTextWithYear(state.weddingDateText, state.weddingYear);
  const baseUpdate: Partial<WeddingSalesState> = {
    ...(extractedNames ? { names: extractedNames } : {}),
    ...(combinedWeddingDate ? { weddingDate: combinedWeddingDate } : {}),
    ...(extractedDate?.display && !combinedWeddingDate ? { weddingDateText: extractedDate.display } : {}),
    ...(extractedYear ? { weddingYear: extractedYear } : {}),
    ...(extractedLocation ? { location: extractedLocation } : {}),
    ...(extractedVenue ? { venue: extractedVenue } : {}),
    ...(extractedEmail ? { customerEmail: extractedEmail } : {}),
  };
  const weddingDateChanged = Boolean(combinedWeddingDate && state.weddingDate && combinedWeddingDate !== state.weddingDate);
  const locationChanged = Boolean(
    extractedLocation &&
      state.location &&
      extractedLocation.toLowerCase() !== state.location.toLowerCase(),
  );
  const semanticConfirmsPendingChange = Boolean(useSemantic && semantic?.confirmsPendingChange);
  const semanticRejectsPendingChange = Boolean(useSemantic && semantic?.rejectsPendingChange);
  const semanticExplicitDateChange = Boolean(
    useSemantic &&
      semantic?.messageKind === "correction" &&
      semantic.weddingDateChange === "explicit" &&
      semantic.confidence >= 0.9,
  );
  const semanticAmbiguousDateChange = Boolean(useSemantic && semantic?.weddingDateChange === "ambiguous");
  const semanticExplicitLocationChange = Boolean(
    useSemantic &&
      semantic?.messageKind === "correction" &&
      semantic.locationChange === "explicit" &&
      semantic.confidence >= 0.9,
  );
  const semanticAmbiguousLocationChange = Boolean(useSemantic && semantic?.locationChange === "ambiguous");
  const semanticBusinessQuestion = Boolean(useSemantic && semantic?.asksBusinessQuestion);
  const semanticProposedCallTime = useSemantic ? semantic?.proposedCallTime ?? undefined : undefined;
  const semanticScheduling = Boolean(
    useSemantic &&
      semanticProposedCallTime &&
      (semantic?.messageKind === "scheduling" || semantic?.answersRequestedField === "call_time"),
  );

  if (isCoordinatorOrCoi(message)) {
    return { ...baseUpdate, leadStage: "ignored" };
  }

  const customerEmailKnown = Boolean(state.customerEmail || extractedEmail);
  const proposedCallTimeKnown = Boolean(state.proposedCallTime);
  const dateKnown = Boolean(state.weddingDate) || Boolean(combinedWeddingDate) || Boolean(state.weddingDateText) || hasWeddingDate(message);
  const yearKnown = state.weddingYearKnown || hasYear(message) || Boolean(extractedDate?.yearKnown) || Boolean(state.weddingYear);
  const nextNames = extractedNames ?? state.names;
  const namesKnown =
    state.channel === "instagram"
      ? hasCoupleNames(nextNames)
      : Boolean(nextNames) || hasNames(message);
  const locationKnown = Boolean(state.location || extractedLocation) || hasLocation(message);

  if (state.channel === "instagram" && isInstagramCtaStarter(message) && (!namesKnown || !dateKnown)) {
    return {
      ...baseUpdate,
      leadStage: "missing_names_or_date",
      weddingYearKnown: yearKnown,
    };
  }

  if (
    state.channel === "instagram" &&
    !dateKnown &&
    !hasYear(message) &&
    !asksWeddingAvailabilityQuestion(message) &&
    (semanticBusinessQuestion || asksGeneralQuestion(message))
  ) {
    return { ...baseUpdate, leadStage: "answering_question" };
  }

  if (state.pendingChangeField && state.pendingChangeValue) {
    if (semanticConfirmsPendingChange || confirmsPendingChange(message)) {
      if (state.pendingChangeField === "weddingDate") {
        return {
          ...clearPendingChange(),
          weddingDate: state.pendingChangeValue,
          weddingYear: state.pendingChangeValue.slice(0, 4),
          weddingYearKnown: true,
          availability: undefined,
          calendarStatus: undefined,
          proposedCallTime: undefined,
          callProposed: false,
          bookingConfirmed: false,
          bookedEventId: undefined,
          leadStage: state.location ? "ready_for_availability" : "missing_location_or_venue",
        };
      }

      return {
        ...clearPendingChange(),
        location: state.pendingChangeValue,
        venue: undefined,
        availability: undefined,
        calendarStatus: undefined,
        proposedCallTime: undefined,
        callProposed: false,
        bookingConfirmed: false,
        bookedEventId: undefined,
        leadStage: state.weddingDate && state.weddingYearKnown ? "ready_for_availability" : "missing_names_or_date",
      };
    }

    if (semanticRejectsPendingChange || rejectsPendingChange(message)) {
      return {
        ...clearPendingChange(),
        changeConfirmationRejected: true,
        leadStage: "confirming_change",
      };
    }

    return {
      leadStage: "confirming_change",
    };
  }

  if (weddingDateChanged && yearKnown) {
    if (semanticAmbiguousDateChange || (!semanticExplicitDateChange && !explicitlyChangesWeddingDate(message))) {
      const safeBaseUpdate = { ...baseUpdate };
      delete safeBaseUpdate.weddingDate;

      return {
        ...safeBaseUpdate,
        pendingChangeField: "weddingDate",
        pendingChangeValue: combinedWeddingDate,
        pendingChangeDisplay: extractedDate?.display ?? combinedWeddingDate,
        changeConfirmationRejected: undefined,
        leadStage: "confirming_change",
      };
    }

    return {
      ...baseUpdate,
      ...clearPendingChange(),
      availability: undefined,
      calendarStatus: undefined,
      proposedCallTime: undefined,
      callProposed: false,
      bookingConfirmed: false,
      bookedEventId: undefined,
      leadStage: locationKnown ? "ready_for_availability" : "missing_location_or_venue",
      weddingYearKnown: true,
    };
  }

  if (locationChanged) {
    if (semanticAmbiguousLocationChange || (!semanticExplicitLocationChange && !explicitlyChangesLocation(message))) {
      const safeBaseUpdate = { ...baseUpdate };
      delete safeBaseUpdate.location;

      return {
        ...safeBaseUpdate,
        pendingChangeField: "location",
        pendingChangeValue: extractedLocation,
        pendingChangeDisplay: extractedLocation,
        changeConfirmationRejected: undefined,
        leadStage: "confirming_change",
      };
    }

    return {
      ...baseUpdate,
      ...clearPendingChange(),
      venue: undefined,
      availability: undefined,
      calendarStatus: undefined,
      proposedCallTime: undefined,
      callProposed: false,
      bookingConfirmed: false,
      bookedEventId: undefined,
      leadStage: state.weddingDate && yearKnown ? "ready_for_availability" : "missing_names_or_date",
      weddingYearKnown: yearKnown,
    };
  }

  if (state.calendarStatus === "available" && customerEmailKnown && (confirmsBooking(message) || extractedEmail)) {
    return { ...baseUpdate, leadStage: "ready_to_book", bookingConfirmed: false };
  }

  if (state.calendarStatus === "available" && confirmsBooking(message)) {
    return { ...baseUpdate, leadStage: "waiting_customer_email" };
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

  if ((state.callProposed || state.availability === "available") && proposesCallDayWithoutTime(message)) {
    return {
      ...baseUpdate,
      leadStage: "asking_call_time",
      proposedCallTime: message,
    };
  }

  if (
    semanticScheduling ||
    asksForCall(message) ||
    ((state.callProposed || state.availability === "available") && proposesCallTime(message))
  ) {
    return {
      ...baseUpdate,
      leadStage: "checking_calendar",
      proposedCallTime: proposesCallTime(message) || asksForCall(message)
        ? message
        : semanticProposedCallTime
          ? normalizeBareTimeSelection(semanticProposedCallTime, state.proposedCallTime)
          : message,
    };
  }

  if (state.availability === "available" && !state.callProposed && (extractedVenue || state.venue)) {
    return {
      ...baseUpdate,
      leadStage: "asking_call_time",
      callProposed: true,
    };
  }

  if (
    state.availability === "available" &&
    (semanticBusinessQuestion || asksGeneralQuestion(message)) &&
    !hasWeddingDate(message) &&
    !hasYear(message)
  ) {
    return { ...baseUpdate, leadStage: "answering_question" };
  }

  if (state.availability === "unavailable" && !hasWeddingDate(message) && !hasYear(message)) {
    return { ...baseUpdate, leadStage: "answering_question" };
  }

  if (
    semanticBusinessQuestion &&
    !asksWeddingAvailabilityQuestion(message) &&
    !semanticScheduling
  ) {
    return { ...baseUpdate, leadStage: "answering_question" };
  }

  if (state.availability === "available" && state.askedForVenue && !state.venue && !extractedVenue) {
    return { ...baseUpdate, leadStage: "missing_location_or_venue" };
  }

  if (state.calendarStatus === "available" && proposedCallTimeKnown && !customerEmailKnown) {
    return { ...baseUpdate, leadStage: "waiting_customer_email" };
  }

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

  if (!locationKnown) {
    return {
      ...baseUpdate,
      leadStage: "missing_location_or_venue",
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

export async function analyzeWeddingSalesMessage(
  state: WeddingSalesState,
): Promise<Partial<WeddingSalesState>> {
  const semantic = await analyzeWeddingSalesSemantics(state);
  return analyzeWeddingSalesMessageWithSemantics(state, semantic);
}

export const weddingSalesAnalyzeTestHelpers = {
  extractLocation,
  extractNames,
  extractWeddingDate,
  normalizeBareTimeSelection,
  proposesCallDayWithoutTime,
  proposesCallTime,
  analyzeWeddingSalesMessageWithSemantics,
};
