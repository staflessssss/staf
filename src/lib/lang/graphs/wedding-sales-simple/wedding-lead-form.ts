import type { Prisma } from "@prisma/client";

import type {
  SimpleWeddingSalesDialogueCommand,
  SimpleWeddingSalesResponseKey,
  SimpleWeddingSalesState,
  TurnUnderstanding,
} from "./state";
import { WeddingAgentDomain, type WeddingAgentDomainSlot } from "./wedding-agent-domain";

export type WeddingLeadRequiredSlot = Exclude<WeddingAgentDomainSlot, "bookingConfirmation">;

export const WEDDING_LEAD_REQUIRED_SLOTS: WeddingLeadRequiredSlot[] =
  WeddingAgentDomain.slotOrder.filter(
    (slot): slot is WeddingLeadRequiredSlot => slot !== "bookingConfirmation",
  );

export type WeddingLeadFormSlotResolution = Prisma.JsonObject & {
  source: string;
  canonicalSlot: keyof Pick<
    SimpleWeddingSalesState,
    "weddingDate" | "weddingDateText" | "weddingDateDisplay" | "location"
  >;
  rawValue: Prisma.JsonValue;
  resolvedValue: string;
  displayValue?: string;
};

export type WeddingLeadFormSlotFailure = Prisma.JsonObject & {
  source: string;
  canonicalSlot: "weddingDate";
  rawValue: Prisma.JsonValue;
  reason: string;
};

export type WeddingLeadFormSuppressedCommand = Prisma.JsonObject & {
  source: string;
  rawValue?: Prisma.JsonValue;
  reason: string;
};

export type WeddingLeadFormResolution = Prisma.JsonObject & {
  active: boolean;
  requestedSlot?: WeddingLeadRequiredSlot;
  slotPatch: Pick<
    Partial<SimpleWeddingSalesState>,
    "weddingDate" | "weddingDateText" | "weddingDateDisplay" | "location"
  >;
  slotResolution: {
    resolved: WeddingLeadFormSlotResolution[];
    failed: WeddingLeadFormSlotFailure[];
    suppressed: WeddingLeadFormSuppressedCommand[];
  };
  canonicalSlotsBeforeDecision: {
    weddingDate?: string;
    weddingDateText?: string;
    weddingDateDisplay?: string;
    location?: string;
  };
  missingSlotsBeforeDecision: WeddingLeadRequiredSlot[];
  selectedPromptResponseKey?: SimpleWeddingSalesResponseKey;
};

const MONTHS: Record<string, { number: string; display: string }> = {
  jan: { number: "01", display: "January" },
  january: { number: "01", display: "January" },
  feb: { number: "02", display: "February" },
  february: { number: "02", display: "February" },
  mar: { number: "03", display: "March" },
  march: { number: "03", display: "March" },
  apr: { number: "04", display: "April" },
  april: { number: "04", display: "April" },
  may: { number: "05", display: "May" },
  jun: { number: "06", display: "June" },
  june: { number: "06", display: "June" },
  jul: { number: "07", display: "July" },
  july: { number: "07", display: "July" },
  aug: { number: "08", display: "August" },
  august: { number: "08", display: "August" },
  sep: { number: "09", display: "September" },
  sept: { number: "09", display: "September" },
  september: { number: "09", display: "September" },
  oct: { number: "10", display: "October" },
  october: { number: "10", display: "October" },
  nov: { number: "11", display: "November" },
  november: { number: "11", display: "November" },
  dec: { number: "12", display: "December" },
  december: { number: "12", display: "December" },
};

function isValidDay(day: number) {
  return Number.isInteger(day) && day >= 1 && day <= 31;
}

function buildDate(args: {
  year: string;
  monthKey: string;
  day: string;
  rawText: string;
}) {
  const month = MONTHS[args.monthKey.toLowerCase()];
  const dayNumber = Number(args.day);

  if (!month || !isValidDay(dayNumber)) {
    return {
      ok: false as const,
      rawText: args.rawText,
      reason: "invalid_month_or_day",
    };
  }

  const normalizedDay = String(dayNumber).padStart(2, "0");

  return {
    ok: true as const,
    isoDate: `${args.year}-${month.number}-${normalizedDay}`,
    display: `${month.display} ${dayNumber}, ${args.year}`,
    rawText: args.rawText,
  };
}

export function resolveWeddingDate(rawValue: unknown): {
  ok: boolean;
  isoDate?: string;
  display?: string;
  rawText?: string;
  reason?: string;
} {
  if (typeof rawValue !== "string") {
    return { ok: false, reason: "date_value_not_string" };
  }

  const rawText = rawValue.trim();

  if (!rawText) {
    return { ok: false, rawText, reason: "date_value_empty" };
  }

  const iso = /\b(20\d{2})-(\d{2})-(\d{2})\b/.exec(rawText);

  if (iso) {
    const year = iso[1]!;
    const monthNumber = iso[2]!;
    const dayNumber = Number(iso[3]);
    const month = Object.values(MONTHS).find((candidate) => candidate.number === monthNumber);

    if (!month || !isValidDay(dayNumber)) {
      return { ok: false, rawText, reason: "invalid_iso_date" };
    }

    return {
      ok: true,
      isoDate: `${year}-${monthNumber}-${String(dayNumber).padStart(2, "0")}`,
      display: `${month.display} ${dayNumber}, ${year}`,
      rawText,
    };
  }

  const monthFirst =
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,)?\s+(20\d{2})\b/i.exec(rawText);

  if (monthFirst) {
    return buildDate({
      monthKey: monthFirst[1]!,
      day: monthFirst[2]!,
      year: monthFirst[3]!,
      rawText,
    });
  }

  const dayFirst =
    /\b(\d{1,2})(?:st|nd|rd|th)?(?:\s+of)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(20\d{2})\b/i.exec(rawText);

  if (dayFirst) {
    return buildDate({
      day: dayFirst[1]!,
      monthKey: dayFirst[2]!,
      year: dayFirst[3]!,
      rawText,
    });
  }

  const partialMonthFirst =
    /\b(?:on\s+)?(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?\b/i.exec(rawText);

  if (partialMonthFirst) {
    const month = MONTHS[partialMonthFirst[1]!.toLowerCase()];
    const dayNumber = Number(partialMonthFirst[2]);

    if (!month || !isValidDay(dayNumber)) {
      return { ok: false, rawText, reason: "invalid_month_or_day" };
    }

    return {
      ok: false,
      rawText: partialMonthFirst[0]!.replace(/^on\s+/i, ""),
      display: `${month.display} ${dayNumber}`,
      reason: "missing_year",
    };
  }

  if (/\b\d{1,2}[/-]\d{1,2}[/-]20\d{2}\b/.test(rawText)) {
    return { ok: false, rawText, reason: "ambiguous_numeric_date" };
  }

  return { ok: false, rawText, reason: "date_pattern_not_supported" };
}

function commandSource(command: SimpleWeddingSalesDialogueCommand) {
  return command.type === "set_slot" ? `dialogueCommands.set_slot:${command.slot}` : command.type;
}

function requestedSlotForState(state: SimpleWeddingSalesState): WeddingLeadRequiredSlot | undefined {
  const requiredQuestion =
    state.replyMemory?.lastRequiredQuestion ??
    state.replyMemory?.questionMemory?.lastRequiredQuestion;

  if (requiredQuestion === "weddingDate" || requiredQuestion === "location") {
    return requiredQuestion;
  }

  if (requiredQuestion === "names" || requiredQuestion === "coupleNames") {
    return "names";
  }

  if (requiredQuestion === "email" || requiredQuestion === "callTime") {
    return requiredQuestion;
  }

  return undefined;
}

function isExplicitNameIntroduction(text: string) {
  const normalized = text.trim().toLowerCase().replace(/[\u2019]/g, "'");

  return (
    normalized.startsWith("i'm ") ||
    normalized.startsWith("i am ") ||
    normalized.startsWith("my name is ") ||
    normalized.startsWith("we are ") ||
    normalized.startsWith("we're ") ||
    normalized.includes("bride is ") ||
    normalized.includes("groom is ")
  );
}

function isPlainSlotAnswer(text: string) {
  const normalized = text.trim();

  if (!normalized || normalized.length > 80) {
    return false;
  }

  return !/[?]/.test(normalized);
}

function suppressConflictingNameCommands(input: {
  requestedSlot?: WeddingLeadRequiredSlot;
  commands: SimpleWeddingSalesDialogueCommand[];
  latestCustomerMessage: string;
}): {
  commands: SimpleWeddingSalesDialogueCommand[];
  suppressed: WeddingLeadFormSuppressedCommand[];
} {
  const suppressed: WeddingLeadFormSuppressedCommand[] = [];

  if (input.requestedSlot !== "location") {
    return { commands: input.commands, suppressed };
  }

  return {
    commands: input.commands.filter((command) => {
      if (
        command.type === "set_slot" &&
        (command.slot === "customerName" || command.slot === "partnerName") &&
        !isExplicitNameIntroduction(input.latestCustomerMessage)
      ) {
        suppressed.push({
          source: commandSource(command),
          rawValue: command.value,
          reason: "active requestedSlot=location",
        });

        return false;
      }

      return true;
    }),
    suppressed,
  };
}

function missingSlotsForState(
  state: Pick<
    SimpleWeddingSalesState,
    | "weddingDate"
    | "location"
    | "customerName"
    | "partnerName"
    | "venue"
    | "availability"
    | "customerEmail"
    | "proposedCallTime"
  >,
) {
  const missing = new Set<WeddingLeadRequiredSlot>();

  if (!state.weddingDate) {
    missing.add("weddingDate");
  }

  if (!state.location) {
    missing.add("location");
  }

  if (!state.customerName || !state.partnerName) {
    missing.add("names");
  }

  if (state.availability === "available" && !state.venue) {
    missing.add("venue");
  }

  if (!state.customerEmail) {
    missing.add("email");
  }

  if (!state.proposedCallTime) {
    missing.add("callTime");
  }

  return WEDDING_LEAD_REQUIRED_SLOTS.filter((slot) => missing.has(slot));
}

function selectedPromptResponseKey(
  state: Pick<SimpleWeddingSalesState, "weddingDate" | "location" | "customerName" | "partnerName">,
) {
  if (!state.weddingDate && !state.location) {
    return "utter_ask_wedding_details" as const;
  }

  if (state.weddingDate && !state.location) {
    return "utter_ask_location_only" as const;
  }

  if (!state.weddingDate && state.location) {
    return "utter_ask_wedding_date_only" as const;
  }

  if (state.weddingDate && state.location && (!state.customerName || !state.partnerName)) {
    return "utter_ask_names_after_details" as const;
  }

  return undefined;
}

export function getWeddingLeadFormStatus(state: SimpleWeddingSalesState) {
  return {
    hasWeddingDate: Boolean(state.weddingDate),
    hasLocation: Boolean(state.location),
    hasNames: Boolean(state.customerName && state.partnerName),
    hasEmail: Boolean(state.customerEmail),
    hasCallTime: Boolean(state.proposedCallTime),
    missingSlots: missingSlotsForState(state),
  };
}

export function resolveWeddingLeadFormSlots(input: {
  state: SimpleWeddingSalesState;
  commands: SimpleWeddingSalesDialogueCommand[];
  extractedFacts?: TurnUnderstanding["facts"] | Record<string, unknown>;
  latestCustomerMessage: string;
}): WeddingLeadFormResolution {
  const resolved: WeddingLeadFormSlotResolution[] = [];
  const failed: WeddingLeadFormSlotFailure[] = [];
  const requestedSlot = requestedSlotForState(input.state);
  const commandResolution = suppressConflictingNameCommands({
    requestedSlot,
    commands: input.commands,
    latestCustomerMessage: input.latestCustomerMessage,
  });
  const patch: WeddingLeadFormResolution["slotPatch"] = {};
  const dateCommands = commandResolution.commands.filter(
    (command) =>
      command.type === "set_slot" &&
      (command.slot === "weddingDate" || command.slot === "weddingDateText"),
  );

  for (const command of dateCommands) {
    if (command.type !== "set_slot") {
      continue;
    }

    const date = resolveWeddingDate(command.value);

    if (date.ok && date.isoDate) {
      patch.weddingDate = date.isoDate;
      patch.weddingDateText = date.rawText ?? String(command.value);
      patch.weddingDateDisplay = date.display;
      resolved.push({
        source: commandSource(command),
        canonicalSlot: "weddingDate",
        rawValue: command.value,
        resolvedValue: date.isoDate,
        displayValue: date.display,
      });
      continue;
    }

    if (command.slot === "weddingDateText" && typeof command.value === "string") {
      patch.weddingDateText = date.rawText ?? command.value;
    }

    failed.push({
      source: commandSource(command),
      canonicalSlot: "weddingDate",
      rawValue: command.value,
      reason: date.reason ?? "date_resolution_failed",
    });
  }

  const locationCommand = commandResolution.commands.find(
    (command) => command.type === "set_slot" && command.slot === "location",
  );

  if (locationCommand?.type === "set_slot" && typeof locationCommand.value === "string") {
    patch.location = locationCommand.value;
    resolved.push({
      source: commandSource(locationCommand),
      canonicalSlot: "location",
      rawValue: locationCommand.value,
      resolvedValue: locationCommand.value,
    });
  } else if (
    requestedSlot === "location" &&
    isPlainSlotAnswer(input.latestCustomerMessage) &&
    !isExplicitNameIntroduction(input.latestCustomerMessage)
  ) {
    const location = input.latestCustomerMessage.trim();
    patch.location = location;
    resolved.push({
      source: "requestedSlot:location",
      canonicalSlot: "location",
      rawValue: location,
      resolvedValue: location,
    });
  }

  const canonicalSlotsBeforeDecision = {
    weddingDate: patch.weddingDate ?? input.state.weddingDate,
    weddingDateText: patch.weddingDateText ?? input.state.weddingDateText,
    weddingDateDisplay: patch.weddingDateDisplay ?? input.state.weddingDateDisplay,
    location: patch.location ?? input.state.location,
  };
  const formState = {
    ...input.state,
    ...canonicalSlotsBeforeDecision,
  };

  return {
    active: Boolean(
      requestedSlot ||
        input.commands.some((command) => command.type === "start_flow") ||
        dateCommands.length > 0 ||
        locationCommand,
    ),
    requestedSlot,
    slotPatch: patch,
    slotResolution: {
      resolved,
      failed,
      suppressed: commandResolution.suppressed,
    },
    canonicalSlotsBeforeDecision,
    missingSlotsBeforeDecision: missingSlotsForState(formState),
    selectedPromptResponseKey: selectedPromptResponseKey(formState),
  };
}
