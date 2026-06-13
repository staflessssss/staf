import { ChannelType, ConnectionStatus, Prisma } from "@prisma/client";
import { google } from "googleapis";

import { telegramAdapter } from "@/lib/channels/telegram";
import { decrypt } from "@/lib/crypto";
import { db } from "@/lib/db";
import { createGoogleOAuthClientFromEncryptedCredentials } from "@/lib/google-api-client";
import { isValidTimezone } from "@/lib/timezones";

type CalendarExecutionArgs = {
  tenantId: string;
  action: string;
  params: Prisma.JsonValue;
  request: string;
  metadata?: Prisma.JsonValue | null;
  credentialsEnc?: string;
  date?: string;
  timeText?: string;
  coupleName?: string;
  weddingDate?: string;
  location?: string;
  email?: string;
  channel?: string;
  testMode?: boolean;
  defaultEmail?: string;
};

type SchedulingIntent = "date_availability" | "check_calendar" | "book_call";

type SchedulingConfig = {
  calendarId: string;
  timeZone: string;
  availabilityDateSource: "request_date" | "time_text" | "literal";
  availabilityDateValue: string;
  bookingDateSource: "request_date" | "time_text" | "literal";
  bookingDateValue: string;
  bookingTimeSource: "time_text" | "literal";
  bookingTimeValue: string;
  inviteEmailSource: "customer_email" | "default_email" | "literal";
  inviteEmailValue: string;
  slotDurationMinutes: number;
  businessWindowStartHour: number;
  businessWindowEndHour: number;
  businessDays: number[];
  checkConflictsBeforeBooking: boolean;
  inviteCustomerByEmail: boolean;
  createMeetLink: boolean;
  reminderEnabled: boolean;
  reminderMinutesBefore: number;
  eventSummaryTemplate: string;
  eventDescriptionTemplate: string;
  ownerTelegramChatId?: string;
  syncLeadToSheets: boolean;
  leadSpreadsheetId?: string;
  leadSpreadsheetTitle?: string;
  leadSheetName?: string;
  leadHeaderRow: number;
  leadColumns: {
    coupleName: string;
    weddingDate: string;
    location: string;
    callDate: string;
    callTime: string;
    email: string;
    channel: string;
  };
};

type ParsedSchedulingRequest = {
  date: string;
  time: string;
  startTime: string;
  endTime: string;
};

type CalendarEventSummary = {
  start: number;
  end: number;
  summary: string;
};

function asObject(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, Prisma.JsonValue>;
}

function asNumber(value: Prisma.JsonValue | null | undefined, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asString(value: Prisma.JsonValue | null | undefined, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeTimeSelectionText(value: string) {
  return normalizeText(value)
    .replace(/\b(\d{1,2})\s*[-.]\s*(\d{2})\b/g, "$1:$2")
    .replace(/\b(\d{1,2})\s+(\d{2})\b/g, "$1:$2");
}

function inferIntent(action: string) {
  const normalized = normalizeText(action);

  if (
    normalized.includes("book_call") ||
    normalized.includes("book call") ||
    normalized.includes("book consultation") ||
    normalized.includes("create consultation") ||
    normalized.includes("schedule consultation")
  ) {
    return "book_call" as SchedulingIntent;
  }

  if (
    normalized.includes("check_calendar") ||
    normalized.includes("check calendar") ||
    normalized.includes("consultation calendar") ||
    normalized.includes("consultation slot") ||
    normalized.includes("call slot") ||
    normalized.includes("call calendar")
  ) {
    return "check_calendar" as SchedulingIntent;
  }

  return "date_availability" as SchedulingIntent;
}

function parseCalendarConfig(params: Prisma.JsonValue, metadata?: Prisma.JsonValue | null): SchedulingConfig {
  const config = asObject(params);
  const integrationMetadata = asObject(metadata);

  return {
    calendarId:
      asString(config?.calendarId) ||
      asString(integrationMetadata?.calendarId) ||
      asString(integrationMetadata?.email) ||
      "primary",
    timeZone: asString(config?.timeZone) || "America/New_York",
    availabilityDateSource:
      config?.availabilityDateSource === "time_text" || config?.availabilityDateSource === "literal"
        ? config.availabilityDateSource
        : "request_date",
    availabilityDateValue: asString(config?.availabilityDateValue),
    bookingDateSource:
      config?.bookingDateSource === "time_text" || config?.bookingDateSource === "literal"
        ? config.bookingDateSource
        : "request_date",
    bookingDateValue: asString(config?.bookingDateValue),
    bookingTimeSource: config?.bookingTimeSource === "literal" ? "literal" : "time_text",
    bookingTimeValue: asString(config?.bookingTimeValue),
    inviteEmailSource:
      config?.inviteEmailSource === "default_email" || config?.inviteEmailSource === "literal"
        ? config.inviteEmailSource
        : "customer_email",
    inviteEmailValue: asString(config?.inviteEmailValue),
    slotDurationMinutes: asNumber(config?.slotDurationMinutes, 30),
    businessWindowStartHour: asNumber(config?.businessWindowStartHour, 9),
    businessWindowEndHour: asNumber(config?.businessWindowEndHour, 14),
    businessDays:
      Array.isArray(config?.businessDays) && config.businessDays.every((value) => typeof value === "number")
        ? (config.businessDays as number[])
        : [1, 2, 3, 4, 5],
    checkConflictsBeforeBooking:
      typeof config?.checkConflictsBeforeBooking === "boolean"
        ? config.checkConflictsBeforeBooking
        : true,
    inviteCustomerByEmail:
      typeof config?.inviteCustomerByEmail === "boolean"
        ? config.inviteCustomerByEmail
        : true,
    createMeetLink:
      typeof config?.createMeetLink === "boolean" ? config.createMeetLink : true,
    reminderEnabled:
      typeof config?.reminderEnabled === "boolean" ? config.reminderEnabled : false,
    reminderMinutesBefore: asNumber(config?.reminderMinutesBefore, 30),
    eventSummaryTemplate:
      asString(config?.eventSummaryTemplate) || "Consultation call with {{coupleName}}",
    eventDescriptionTemplate:
      asString(config?.eventDescriptionTemplate) ||
      "Wedding date: {{weddingDate}}\nLocation: {{location}}\nChannel: {{channel}}",
    ownerTelegramChatId: asString(config?.ownerTelegramChatId) || undefined,
    syncLeadToSheets:
      typeof config?.syncLeadToSheets === "boolean"
        ? config.syncLeadToSheets
        : Boolean(asString(config?.leadSpreadsheetId) || asString(config?.leadSheetName)),
    leadSpreadsheetId: asString(config?.leadSpreadsheetId) || undefined,
    leadSpreadsheetTitle: asString(config?.leadSpreadsheetTitle) || undefined,
    leadSheetName: asString(config?.leadSheetName) || undefined,
    leadHeaderRow: asNumber(config?.leadHeaderRow, 1),
    leadColumns: {
      coupleName: asString(asObject(config?.leadColumns)?.coupleName, "couple_name"),
      weddingDate: asString(asObject(config?.leadColumns)?.weddingDate, "wedding_date"),
      location: asString(asObject(config?.leadColumns)?.location, "location"),
      callDate: asString(asObject(config?.leadColumns)?.callDate, "call_date"),
      callTime: asString(asObject(config?.leadColumns)?.callTime, "call_time"),
      email: asString(asObject(config?.leadColumns)?.email, "email"),
      channel: asString(asObject(config?.leadColumns)?.channel, "channel"),
    },
  };
}

function applyTemplate(
  template: string,
  values: Record<string, string>,
) {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, rawKey: string) => {
    const key = rawKey.trim();
    return values[key] ?? "";
  });
}

function buildCalendarInsertPayload(args: {
  tenantId: string;
  config: SchedulingConfig;
  parsed: ParsedSchedulingRequest;
  email: string;
  coupleName: string;
  weddingDate: string;
  location: string;
  channel: string;
}) {
  const templateValues = {
    coupleName: args.coupleName,
    weddingDate: args.weddingDate,
    location: args.location,
    channel: args.channel,
    email: args.email,
    date: args.parsed.date,
    time: args.parsed.time,
  };
  const summary = applyTemplate(args.config.eventSummaryTemplate, templateValues)
    .replace(/\s+/g, " ")
    .trim();
  const description = applyTemplate(args.config.eventDescriptionTemplate, templateValues)
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();

  return {
    conferenceDataVersion: args.config.createMeetLink ? 1 : 0,
    requestBody: {
      summary,
      description,
      start: {
        dateTime: args.parsed.startTime,
        timeZone: args.config.timeZone,
      },
      end: {
        dateTime: args.parsed.endTime,
        timeZone: args.config.timeZone,
      },
      attendees:
        args.config.inviteCustomerByEmail && args.email ? [{ email: args.email }] : [],
      ...(args.config.createMeetLink
        ? {
            conferenceData: {
              createRequest: {
                requestId: `${args.tenantId}-${Date.now()}`,
                conferenceSolutionKey: {
                  type: "hangoutsMeet",
                },
              },
            },
          }
        : {}),
      reminders: args.config.reminderEnabled
        ? {
            useDefault: false,
            overrides: [
              {
                method: "email",
                minutes: Math.max(0, Math.floor(args.config.reminderMinutesBefore)),
              },
            ],
          }
        : { useDefault: true },
    },
  };
}

function toIsoDate(year: number, month: number, day: number) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getTimeZoneParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const weekdayValue = get("weekday");
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    weekday: weekdayMap[weekdayValue] ?? new Date(Date.UTC(Number(get("year")), Number(get("month")) - 1, Number(get("day")))).getUTCDay(),
  };
}

function addUtcDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

const weekdayMap: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const monthMap: Record<string, number> = {
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

function inferRequestedDate(request: string, explicitDate?: string) {
  if (explicitDate && /^\d{4}-\d{2}-\d{2}$/.test(explicitDate)) {
    return explicitDate;
  }

  const trimmed = normalizeText(request);
  const now = new Date();
  const isoMatch = trimmed.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);

  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const dottedMatch = trimmed.match(/\b(\d{1,2})[./](\d{1,2})(?:[./](\d{4}))?\b/);

  if (dottedMatch) {
    const year = dottedMatch[3] ? Number(dottedMatch[3]) : now.getUTCFullYear();
    const month = Number(dottedMatch[2]);
    const day = Number(dottedMatch[1]);
    let candidate = toIsoDate(year, month, day);

    if (!dottedMatch[3] && candidate < now.toISOString().slice(0, 10)) {
      candidate = toIsoDate(year + 1, month, day);
    }

    return candidate;
  }

  const namedMonthMatch = trimmed.match(
    /\b(\d{1,2})\s+(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|sept|october|oct|november|nov|december|dec)(?:\s+(\d{4}))?\b/u,
  );

  if (namedMonthMatch) {
    const day = Number(namedMonthMatch[1]);
    const month = monthMap[namedMonthMatch[2]];
    const year = namedMonthMatch[3] ? Number(namedMonthMatch[3]) : now.getUTCFullYear();
    let candidate = toIsoDate(year, month, day);

    if (!namedMonthMatch[3] && candidate < now.toISOString().slice(0, 10)) {
      candidate = toIsoDate(year + 1, month, day);
    }

    return candidate;
  }

  return null;
}

function parseTimeFromText(text: string) {
  const normalized = normalizeTimeSelectionText(text);
  const patterns = [
    /\b(\d{1,2}):(\d{2})\s*(am|pm)\b/i,
    /\b(\d{1,2})\s*(am|pm)\b/i,
    /\b(\d{1,2})[:\-.\s](\d{2})\b/i,
    /(?:\bat\b|\bfor\b|\bfrom\b)\s+(\d{1,2}):(\d{2})\b/i,
    /(?:\bat\b|\bfor\b|\bfrom\b)\s+(\d{1,2})\b/i,
  ];

  let hours = 0;
  let minutes = 0;
  let suffix = "";
  let matched = false;

  for (const pattern of patterns) {
    const match = normalized.match(pattern);

    if (!match) {
      continue;
    }

    hours = Number(match[1]);
    minutes = match[2] && /^\d+$/.test(match[2]) ? Number(match[2]) : 0;
    suffix = match[3] && /^(am|pm)$/i.test(match[3]) ? match[3].toLowerCase() : "";
    matched = true;
    break;
  }

  if (!matched) {
    return null;
  }

  if (suffix === "pm" && hours < 12) {
    hours += 12;
  } else if (suffix === "am" && hours === 12) {
    hours = 0;
  } else if (!suffix && hours >= 1 && hours <= 7) {
    hours += 12;
  }

  if (hours > 23 || minutes > 59) {
    return null;
  }

  return {
    hours,
    minutes,
    time: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
  };
}

function getTimeZoneOffsetString(dateIso: string, timeZone: string) {
  const middayUtc = new Date(`${dateIso}T12:00:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(middayUtc);
  const offsetLabel = parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT-00:00";
  const match = offsetLabel.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/i);

  if (!match) {
    return "-05:00";
  }

  const sign = match[1];
  const hours = match[2].padStart(2, "0");
  const minutes = (match[3] ?? "00").padStart(2, "0");
  return `${sign}${hours}:${minutes}`;
}

function parseSchedulingRequest(args: {
  request: string;
  timeText?: string;
  explicitDate?: string;
  timeZone: string;
  slotDurationMinutes: number;
  referenceDate?: Date;
}) {
  const source = normalizeTimeSelectionText(args.timeText || args.request);
  const reference = args.referenceDate ?? new Date();
  const base = getTimeZoneParts(reference, args.timeZone);
  const time = parseTimeFromText(source);
  let matchedWeekdayWithoutExplicitDate = false;

  if (!time) {
    return null;
  }

  const hasExplicitDate = Boolean(args.explicitDate && /^\d{4}-\d{2}-\d{2}$/.test(args.explicitDate));
  let targetDate = hasExplicitDate
    ? new Date(`${args.explicitDate}T00:00:00Z`)
    : new Date(Date.UTC(base.year, base.month - 1, base.day));

  if (!hasExplicitDate) {
    if (source.includes("day after tomorrow")) {
      targetDate = addUtcDays(targetDate, 2);
    } else if (source.includes("tomorrow")) {
      targetDate = addUtcDays(targetDate, 1);
    } else if (source.includes("today")) {
      targetDate = targetDate;
    } else {
      const foundWeekday = Object.entries(weekdayMap).find(([label]) => source.includes(label));

      if (foundWeekday) {
        matchedWeekdayWithoutExplicitDate = true;
        let diff = foundWeekday[1] - targetDate.getUTCDay();
        if (diff < 0) {
          diff += 7;
        }
        targetDate = addUtcDays(targetDate, diff);
      } else {
        const namedMonthMatch = source.match(
          /\b(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|sept|october|oct|november|nov|december|dec)\s+(\d{1,2})(?:,\s*(\d{4}))?\b/u,
        );
        const isoMatch = source.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);

        if (namedMonthMatch) {
          const month = monthMap[namedMonthMatch[1]];
          const day = Number(namedMonthMatch[2]);
          const year = namedMonthMatch[3] ? Number(namedMonthMatch[3]) : base.year;
          targetDate = new Date(Date.UTC(year, month - 1, day));
          if (!namedMonthMatch[3] && targetDate < new Date(Date.UTC(base.year, base.month - 1, base.day))) {
            targetDate = new Date(Date.UTC(year + 1, month - 1, day));
          }
        } else if (isoMatch) {
          targetDate = new Date(Date.UTC(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3])));
        } else {
          return null;
        }
      }
    }
  }

  let dateIso = targetDate.toISOString().slice(0, 10);
  let offset = getTimeZoneOffsetString(dateIso, args.timeZone);
  const endMinutesTotal = time.hours * 60 + time.minutes + args.slotDurationMinutes;
  const endHours = Math.floor(endMinutesTotal / 60);
  const endMinutes = endMinutesTotal % 60;
  let startTime = `${dateIso}T${String(time.hours).padStart(2, "0")}:${String(time.minutes).padStart(2, "0")}:00${offset}`;
  let endTime = `${dateIso}T${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}:00${offset}`;

  if (
    Date.parse(startTime) <= reference.getTime() &&
    matchedWeekdayWithoutExplicitDate &&
    !source.includes("today")
  ) {
    targetDate = addUtcDays(targetDate, 7);
    dateIso = targetDate.toISOString().slice(0, 10);
    offset = getTimeZoneOffsetString(dateIso, args.timeZone);
    startTime = `${dateIso}T${String(time.hours).padStart(2, "0")}:${String(time.minutes).padStart(2, "0")}:00${offset}`;
    endTime = `${dateIso}T${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}:00${offset}`;
  }

  if (Date.parse(startTime) <= reference.getTime()) {
    return null;
  }

  return {
    date: dateIso,
    time: time.time,
    startTime,
    endTime,
  } satisfies ParsedSchedulingRequest;
}

function validateSchedulingWindow(parsed: ParsedSchedulingRequest, config: SchedulingConfig) {
  const [year, month, day] = parsed.date.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay();
  const [hours, minutes] = parsed.time.split(":").map(Number);
  const startMinutes = hours * 60 + minutes;
  const endMinutes = startMinutes + config.slotDurationMinutes;
  const minMinutes = config.businessWindowStartHour * 60;
  const maxMinutes = config.businessWindowEndHour * 60;
  const businessDayLabel = businessDayOptionsForMessage(config.businessDays);

  if (!config.businessDays.includes(weekday)) {
    return {
      ok: false,
      reason: "outside_business_days",
      summary: `Consultation calls are only available on ${businessDayLabel}.`,
    };
  }

  if (startMinutes < minMinutes || endMinutes > maxMinutes) {
    return {
      ok: false,
      reason: "outside_business_hours",
      summary: `Consultation calls are only available between ${String(config.businessWindowStartHour).padStart(2, "0")}:00 and ${String(config.businessWindowEndHour).padStart(2, "0")}:00 (${config.timeZone}).`,
    };
  }

  return { ok: true } as const;
}

function validateBusinessDate(dateIso: string, config: SchedulingConfig) {
  const [year, month, day] = dateIso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay();

  if (!config.businessDays.includes(weekday)) {
    return {
      ok: false,
      reason: "outside_business_days",
      summary: `Consultation calls are only available on ${businessDayOptionsForMessage(config.businessDays)}.`,
    };
  }

  return { ok: true } as const;
}

function businessDayOptionsForMessage(days: number[]) {
  const labels = days
    .map((day) =>
      ({
        0: "Sunday",
        1: "Monday",
        2: "Tuesday",
        3: "Wednesday",
        4: "Thursday",
        5: "Friday",
        6: "Saturday",
      })[day],
    )
    .filter((label): label is string => Boolean(label));

  if (labels.length === 0) {
    return "the configured business days";
  }

  if (labels.length === 1) {
    return labels[0];
  }

  if (labels.length === 2) {
    return `${labels[0]} and ${labels[1]}`;
  }

  return `${labels.slice(0, -1).join(", ")}, and ${labels.at(-1)}`;
}

function formatHumanDate(dateIso: string, timeZone: string) {
  return new Date(`${dateIso}T12:00:00Z`).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone,
  });
}

function createCalendarClient(credentialsEnc: string) {
  const auth = createGoogleOAuthClientFromEncryptedCredentials(credentialsEnc);
  return google.calendar({ version: "v3", auth });
}

function createSheetsClient(credentialsEnc: string) {
  const auth = createGoogleOAuthClientFromEncryptedCredentials(credentialsEnc);
  return google.sheets({ version: "v4", auth });
}

function extractEmail(args: CalendarExecutionArgs) {
  if (args.email) {
    return args.email;
  }

  if (args.defaultEmail) {
    return args.defaultEmail;
  }

  const match = args.request.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);
  return match?.[0] ?? "";
}

function resolveAvailabilityDate(args: CalendarExecutionArgs, config: SchedulingConfig) {
  if (config.availabilityDateSource === "literal" && /^\d{4}-\d{2}-\d{2}$/.test(config.availabilityDateValue)) {
    return config.availabilityDateValue;
  }

  if (config.availabilityDateSource === "time_text") {
    return inferRequestedDate(args.timeText || args.request);
  }

  return args.date || inferRequestedDate(args.request);
}

function resolveBookingDate(args: CalendarExecutionArgs, config: SchedulingConfig) {
  if (config.bookingDateSource === "literal" && /^\d{4}-\d{2}-\d{2}$/.test(config.bookingDateValue)) {
    return config.bookingDateValue;
  }

  if (config.bookingDateSource === "time_text") {
    return inferRequestedDate(args.timeText || args.request);
  }

  return args.date || inferRequestedDate(args.request);
}

function resolveBookingTimeText(args: CalendarExecutionArgs, config: SchedulingConfig) {
  if (config.bookingTimeSource === "literal" && config.bookingTimeValue.trim()) {
    return config.bookingTimeValue.trim();
  }

  return args.timeText || args.request;
}

function resolveInviteEmail(args: CalendarExecutionArgs, config: SchedulingConfig) {
  if (config.inviteEmailSource === "literal") {
    return config.inviteEmailValue.trim();
  }

  if (config.inviteEmailSource === "default_email") {
    return args.defaultEmail ?? "";
  }

  return extractEmail(args);
}

function getCalendarBindingMisconfiguration(args: {
  action: string;
  config: SchedulingConfig;
}) {
  if (!args.config.timeZone.trim() || !isValidTimezone(args.config.timeZone.trim())) {
    return "This Google Calendar function needs a valid IANA timezone.";
  }

  if (
    args.action === "check_calendar" &&
    args.config.availabilityDateSource === "literal" &&
    !/^\d{4}-\d{2}-\d{2}$/.test(args.config.availabilityDateValue)
  ) {
    return "This Google Calendar function needs a fixed availability date in YYYY-MM-DD format.";
  }

  if (args.action === "book_call") {
    if (
      args.config.bookingDateSource === "literal" &&
      !/^\d{4}-\d{2}-\d{2}$/.test(args.config.bookingDateValue)
    ) {
      return "This Google Calendar booking function needs a fixed booking date in YYYY-MM-DD format.";
    }

    if (
      args.config.bookingTimeSource === "literal" &&
      !parseTimeFromText(args.config.bookingTimeValue)
    ) {
      return "This Google Calendar booking function needs a fixed booking time in HH:MM or am/pm format.";
    }

    if (
      args.config.inviteEmailSource === "literal" &&
      !args.config.inviteEmailValue.trim()
    ) {
      return "This Google Calendar booking function needs a fixed invite email address.";
    }

    if (
      args.config.inviteEmailSource === "literal" &&
      !/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(args.config.inviteEmailValue.trim())
    ) {
      return "This Google Calendar booking function needs a valid fixed invite email address.";
    }
  }

  return null;
}

function extractCoupleName(args: CalendarExecutionArgs) {
  if (args.coupleName) {
    return args.coupleName;
  }

  const match = args.request.match(/\b(?:we(?:'re| are)|names?[:\s]+)([^.,\n]+)/i);
  return match?.[1]?.trim() || "Client";
}

function extractWeddingDate(args: CalendarExecutionArgs) {
  if (args.weddingDate) {
    return args.weddingDate;
  }

  return args.date || inferRequestedDate(args.request) || "";
}

function extractLocation(args: CalendarExecutionArgs) {
  if (args.location) {
    return args.location;
  }

  const match = args.request.match(/\b(?:in|at)\s+([^.,\n]+)/i);
  return match?.[1]?.trim() ?? "";
}

async function listEventsForDate(args: {
  calendar: ReturnType<typeof google.calendar>;
  calendarId: string;
  date: string;
  timeZone: string;
}) {
  const offset = getTimeZoneOffsetString(args.date, args.timeZone);
  const response = await args.calendar.events.list({
    calendarId: args.calendarId,
    singleEvents: true,
    orderBy: "startTime",
    timeZone: args.timeZone,
    timeMin: `${args.date}T00:00:00${offset}`,
    timeMax: `${args.date}T23:59:59${offset}`,
    maxResults: 50,
  });

  return response.data.items ?? [];
}

function parseBusySlots(events: Awaited<ReturnType<typeof listEventsForDate>>) {
  return events
    .filter((event) => event.start?.dateTime && event.end?.dateTime)
    .map((event) => {
      const startMatch = event.start?.dateTime?.match(/T(\d{2}):(\d{2})/);
      const endMatch = event.end?.dateTime?.match(/T(\d{2}):(\d{2})/);

      return {
        start: startMatch ? Number(startMatch[1]) * 60 + Number(startMatch[2]) : 0,
        end: endMatch ? Number(endMatch[1]) * 60 + Number(endMatch[2]) : 0,
        summary: event.summary ?? "",
      } satisfies CalendarEventSummary;
    });
}

function findAlternativeTimes(args: {
  requestedMinutes: number;
  busySlots: CalendarEventSummary[];
  config: SchedulingConfig;
}) {
  const suggestions: string[] = [];
  const candidateOffsets = [-60, -30, 30, 60, 90, 120];
  const minMinutes = args.config.businessWindowStartHour * 60;
  const maxMinutes = args.config.businessWindowEndHour * 60;

  for (const offset of candidateOffsets) {
    const slotStart = args.requestedMinutes + offset;
    const slotEnd = slotStart + args.config.slotDurationMinutes;

    if (slotStart < minMinutes || slotEnd > maxMinutes) {
      continue;
    }

    const conflict = args.busySlots.some((slot) => slotStart < slot.end && slotEnd > slot.start);
    if (!conflict) {
      suggestions.push(
        `${String(Math.floor(slotStart / 60)).padStart(2, "0")}:${String(slotStart % 60).padStart(2, "0")}`,
      );
    }

    if (suggestions.length >= 3) {
      break;
    }
  }

  return suggestions;
}

async function runDateAvailabilityLookup(args: CalendarExecutionArgs, config: SchedulingConfig) {
  const requestedDate = inferRequestedDate(args.request, args.date);

  if (!requestedDate || !args.credentialsEnc) {
    return {
      integration: "GOOGLE_CALENDAR",
      mode: "live_unavailable",
      status: "needs_date",
      action: args.action,
      calendarId: config.calendarId,
      summary: "The calendar tool is connected, but the request did not contain a date I could safely check.",
      request: args.request,
      params: args.params,
    };
  }

  const businessDateValidation = validateBusinessDate(requestedDate, config);
  if (!businessDateValidation.ok) {
    return {
      integration: "GOOGLE_CALENDAR",
      mode: "live",
      status: businessDateValidation.reason,
      action: args.action,
      calendarId: config.calendarId,
      date: requestedDate,
      summary: businessDateValidation.summary,
      request: args.request,
      params: args.params,
    };
  }

  const calendar = createCalendarClient(args.credentialsEnc);
  const offset = getTimeZoneOffsetString(requestedDate, config.timeZone);
  const freebusy = await calendar.freebusy.query({
    requestBody: {
      timeMin: `${requestedDate}T00:00:00${offset}`,
      timeMax: `${requestedDate}T23:59:59${offset}`,
      items: [{ id: config.calendarId }],
    },
  });
  const busy =
    freebusy.data.calendars?.[config.calendarId]?.busy?.filter((entry) => entry.start && entry.end) ?? [];

  return {
    integration: "GOOGLE_CALENDAR",
    mode: "live",
    status: busy.length === 0 ? "available" : "busy",
    action: args.action,
    calendarId: config.calendarId,
    date: requestedDate,
    busySlots: busy,
    summary:
      busy.length === 0
        ? `Calendar check completed for ${formatHumanDate(requestedDate, config.timeZone)}. No busy events were found that day.`
        : `Calendar check completed for ${formatHumanDate(requestedDate, config.timeZone)}. Busy events were found that day.`,
    request: args.request,
    params: args.params,
  };
}

async function runCheckCalendar(args: CalendarExecutionArgs, config: SchedulingConfig) {
  const misconfiguration = getCalendarBindingMisconfiguration({
    action: args.action,
    config,
  });

  if (misconfiguration) {
    return {
      integration: "GOOGLE_CALENDAR",
      mode: "live_unavailable",
      status: "misconfigured",
      action: args.action,
      summary: misconfiguration,
      request: args.request,
      params: args.params,
    };
  }

  if (!args.credentialsEnc) {
    return {
      integration: "GOOGLE_CALENDAR",
      mode: "live_unavailable",
      status: "missing_credentials",
      action: args.action,
      summary: "This Google Calendar integration does not have usable OAuth credentials.",
      request: args.request,
      params: args.params,
    };
  }

  const requestedDate = resolveAvailabilityDate(args, config);
  const parsed = parseSchedulingRequest({
    request: args.request,
    timeText: args.timeText,
    explicitDate: requestedDate ?? undefined,
    timeZone: config.timeZone,
    slotDurationMinutes: config.slotDurationMinutes,
  });

  if (!parsed) {
    if (requestedDate) {
      return runDateAvailabilityLookup(
        {
          ...args,
          date: requestedDate,
        },
        config,
      );
    }

    return {
      integration: "GOOGLE_CALENDAR",
      mode: "live",
      status: "needs_time",
      action: args.action,
      summary: "I could not safely parse a consultation date and time from the request.",
      request: args.request,
      params: args.params,
    };
  }

  const windowValidation = validateSchedulingWindow(parsed, config);
  if (!windowValidation.ok) {
    return {
      integration: "GOOGLE_CALENDAR",
      mode: "live",
      status: windowValidation.reason,
      action: args.action,
      date: parsed.date,
      time: parsed.time,
      summary: windowValidation.summary,
      request: args.request,
      params: args.params,
    };
  }

  const calendar = createCalendarClient(args.credentialsEnc);
  const exactSlotBusy = await queryExactSlotBusy({
    calendar,
    calendarId: config.calendarId,
    startTime: parsed.startTime,
    endTime: parsed.endTime,
  });

  if (exactSlotBusy.length === 0) {
    return {
      integration: "GOOGLE_CALENDAR",
      mode: "live",
      status: "available",
      action: args.action,
      date: parsed.date,
      time: parsed.time,
      message: `${parsed.time} on ${parsed.date} is available.`,
      summary: `Consultation slot ${parsed.time} on ${formatHumanDate(parsed.date, config.timeZone)} is available.`,
      request: args.request,
      params: args.params,
    };
  }

  const events = await listEventsForDate({
    calendar,
    calendarId: config.calendarId,
    date: requestedDate ?? parsed.date,
    timeZone: config.timeZone,
  });
  const busySlots = parseBusySlots(events);
  const [hours, minutes] = parsed.time.split(":").map(Number);
  const requestedMinutes = hours * 60 + minutes;
  return buildBusyCalendarResponse({
    action: args.action,
    date: parsed.date,
    requestedTime: parsed.time,
    requestedMinutes,
    busySlots,
    config,
    request: args.request,
    params: args.params,
    mode: "live",
  });
}

async function appendLeadRow(args: {
  credentialsEnc: string;
  config: SchedulingConfig;
  row: Record<string, string>;
}) {
  if (!args.config.syncLeadToSheets) {
    return {
      status: "skipped",
      summary: "Google Sheets sync is turned off for this booking tool.",
    };
  }

  if (!args.config.leadSpreadsheetId || !args.config.leadSheetName) {
    return {
      status: "skipped",
      summary: "Lead logging was not configured for this booking tool.",
    };
  }

  try {
    const sheets = createSheetsClient(args.credentialsEnc);
    const range = `'${args.config.leadSheetName.replace(/'/g, "''")}'`;
    const headersResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: args.config.leadSpreadsheetId,
      range: `${range}!${args.config.leadHeaderRow}:${args.config.leadHeaderRow}`,
    });
    const headers = headersResponse.data.values?.[0] ?? [];

    if (!headers.length) {
      return {
        status: "skipped",
        summary: "Lead logging sheet does not have a readable header row.",
      };
    }

    const values = headers.map((header) => args.row[String(header).trim()] ?? "");
    await sheets.spreadsheets.values.append({
      spreadsheetId: args.config.leadSpreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [values],
      },
    });

    return {
      status: "logged",
      summary: "Lead row appended to Google Sheets.",
    };
  } catch (error) {
    return {
      status: "failed",
      summary: error instanceof Error ? error.message : "Lead logging failed.",
    };
  }
}

async function sendOwnerTelegramNotification(args: {
  tenantId: string;
  chatId?: string;
  message: string;
}) {
  if (!args.chatId) {
    return {
      status: "skipped",
      summary: "Owner Telegram chat is not configured for this booking tool.",
    };
  }

  const telegramChannel = await db.channelConnection.findFirst({
    where: {
      tenantId: args.tenantId,
      type: ChannelType.TELEGRAM,
      status: ConnectionStatus.CONNECTED,
    },
  });

  if (!telegramChannel) {
    return {
      status: "skipped",
      summary: "No connected tenant Telegram channel is available for owner notifications.",
    };
  }

  try {
    await telegramAdapter.sendReply({
      credentials: decrypt(telegramChannel.credentialsEnc),
      contactId: args.chatId,
      message: args.message,
    });
  } catch (error) {
    return {
      status: "failed",
      summary: error instanceof Error
        ? error.message
        : "Owner Telegram notification failed.",
    };
  }

  return {
    status: "sent",
    summary: "Owner Telegram notification sent.",
  };
}

async function runBookCall(args: CalendarExecutionArgs, config: SchedulingConfig) {
  const misconfiguration = getCalendarBindingMisconfiguration({
    action: args.action,
    config,
  });

  if (misconfiguration) {
    return {
      integration: "GOOGLE_CALENDAR",
      mode: "live_unavailable",
      status: "misconfigured",
      action: args.action,
      summary: misconfiguration,
      request: args.request,
      params: args.params,
    };
  }

  if (!args.credentialsEnc) {
    return {
      integration: "GOOGLE_CALENDAR",
      mode: "live_unavailable",
      status: "missing_credentials",
      action: args.action,
      summary: "This Google Calendar integration does not have usable OAuth credentials.",
      request: args.request,
      params: args.params,
    };
  }

  const bookingDate = resolveBookingDate(args, config);
  const parsed = parseSchedulingRequest({
    request: args.request,
    timeText: resolveBookingTimeText(args, config),
    explicitDate: bookingDate ?? undefined,
    timeZone: config.timeZone,
    slotDurationMinutes: config.slotDurationMinutes,
  });

  if (!parsed) {
    return {
      integration: "GOOGLE_CALENDAR",
      mode: "live",
      status: "needs_time",
      action: args.action,
      summary: "I could not safely parse a consultation date and time from the request.",
      request: args.request,
      params: args.params,
    };
  }

  const windowValidation = validateSchedulingWindow(parsed, config);
  if (!windowValidation.ok) {
    return {
      integration: "GOOGLE_CALENDAR",
      mode: "live",
      status: windowValidation.reason,
      action: args.action,
      date: parsed.date,
      time: parsed.time,
      summary: windowValidation.summary,
      request: args.request,
      params: args.params,
    };
  }

  const email = resolveInviteEmail(args, config);
  const coupleName = extractCoupleName(args);
  const weddingDate = extractWeddingDate(args);
  const location = extractLocation(args);
  const channel = args.channel ?? "gmail";

  const calendar = createCalendarClient(args.credentialsEnc);
  const exactSlotBusy = config.checkConflictsBeforeBooking
    ? await queryExactSlotBusy({
        calendar,
        calendarId: config.calendarId,
        startTime: parsed.startTime,
        endTime: parsed.endTime,
      })
    : [];

  if (config.checkConflictsBeforeBooking && exactSlotBusy.length > 0) {
    const events = await listEventsForDate({
      calendar,
      calendarId: config.calendarId,
      date: parsed.date,
      timeZone: config.timeZone,
    });
    const busySlots = parseBusySlots(events);
    const [hours, minutes] = parsed.time.split(":").map(Number);
    const requestedMinutes = hours * 60 + minutes;

    return buildBusyCalendarResponse({
      action: args.action,
      date: parsed.date,
      requestedTime: parsed.time,
      requestedMinutes,
      busySlots,
      config,
      request: args.request,
      params: args.params,
      mode: args.testMode ? "test" : "live",
    });
  }

  if (args.testMode) {
    return {
      integration: "GOOGLE_CALENDAR",
      mode: "test",
      status: "booked",
      action: args.action,
      date: parsed.date,
      time: parsed.time,
      startTime: parsed.startTime,
      endTime: parsed.endTime,
      email,
      coupleName,
      weddingDate,
      location,
      channel,
      eventId: null,
      meetLink: null,
      leadLog: {
        status: "skipped",
        summary: "Test mode skips lead logging.",
      },
      telegramNotification: {
        status: "skipped",
        summary: "Test mode skips owner notifications.",
      },
      summary: `Test mode: this consultation slot could be booked for ${parsed.time} on ${formatHumanDate(parsed.date, config.timeZone)} without triggering live calendar or lead side effects.`,
      request: args.request,
      params: args.params,
    };
  }

  const createdEvent = await calendar.events.insert({
    calendarId: config.calendarId,
    sendUpdates: "all",
    ...buildCalendarInsertPayload({
      tenantId: args.tenantId,
      config,
      parsed,
      email,
      coupleName,
      weddingDate,
      location,
      channel,
    }),
  });

  const leadLog = await appendLeadRow({
    credentialsEnc: args.credentialsEnc,
    config,
    row: {
      [config.leadColumns.coupleName]: coupleName,
      [config.leadColumns.weddingDate]: weddingDate,
      [config.leadColumns.location]: location,
      [config.leadColumns.callDate]: parsed.date,
      [config.leadColumns.callTime]: parsed.time,
      [config.leadColumns.email]: email,
      [config.leadColumns.channel]: channel,
    },
  });

  const telegramNotification = await sendOwnerTelegramNotification({
    tenantId: args.tenantId,
    chatId: config.ownerTelegramChatId,
    message: [
      "New Lead",
      `Names - ${coupleName}`,
      `Wedding Date - ${weddingDate || "Unknown"}`,
      `Location - ${location || "Unknown"}`,
      `Call - ${parsed.date} at ${parsed.time}`,
      `Mail - ${email || "Unknown"}`,
      createdEvent.data.hangoutLink ? `Google Meet - ${createdEvent.data.hangoutLink}` : "",
      `Source - ${channel}`,
    ]
      .filter(Boolean)
      .join("\n"),
  });

  return {
    integration: "GOOGLE_CALENDAR",
    mode: "live",
    status: "booked",
    action: args.action,
    date: parsed.date,
    time: parsed.time,
    startTime: parsed.startTime,
    endTime: parsed.endTime,
    email,
    coupleName,
    weddingDate,
    location,
    channel,
    eventId: createdEvent.data.id ?? null,
    meetLink: createdEvent.data.hangoutLink ?? null,
    leadLog,
    telegramNotification,
    summary: `Consultation call booked for ${parsed.time} on ${formatHumanDate(parsed.date, config.timeZone)}.${createdEvent.data.hangoutLink ? " Google Meet link created." : ""}`,
    request: args.request,
    params: args.params,
  };
}

export async function executeGoogleCalendarStep(args: CalendarExecutionArgs) {
  const config = parseCalendarConfig(args.params, args.metadata);
  const intent = inferIntent(args.action);

  if (intent === "check_calendar") {
    return runCheckCalendar(args, config);
  }

  if (intent === "book_call") {
    return runBookCall(args, config);
  }

  return runDateAvailabilityLookup(args, config);
}

export const calendarSchedulingTestHelpers = {
  parseSchedulingRequest,
  validateSchedulingWindow,
  inferRequestedDate,
  buildCalendarInsertPayload,
};

async function queryExactSlotBusy(args: {
  calendar: ReturnType<typeof google.calendar>;
  calendarId: string;
  startTime: string;
  endTime: string;
}) {
  const freebusy = await args.calendar.freebusy.query({
    requestBody: {
      timeMin: args.startTime,
      timeMax: args.endTime,
      items: [{ id: args.calendarId }],
    },
  });

  return freebusy.data.calendars?.[args.calendarId]?.busy?.filter((entry) => entry.start && entry.end) ?? [];
}

function buildBusyCalendarResponse(args: {
  action: string;
  date: string;
  requestedTime: string;
  requestedMinutes: number;
  busySlots: CalendarEventSummary[];
  config: SchedulingConfig;
  request: string;
  params: Prisma.JsonValue;
  mode: "live" | "test";
}) {
  const suggestedTimes = findAlternativeTimes({
    requestedMinutes: args.requestedMinutes,
    busySlots: args.busySlots,
    config: args.config,
  });

  return {
    integration: "GOOGLE_CALENDAR",
    mode: args.mode,
    status: "busy",
    action: args.action,
    date: args.date,
    requestedTime: args.requestedTime,
    suggestedTimes,
    message: `${args.requestedTime} is busy. Available nearby: ${suggestedTimes.join(", ")}`,
    summary:
      suggestedTimes.length > 0
        ? `Consultation slot ${args.requestedTime} is busy. Nearby openings: ${suggestedTimes.join(", ")}.`
        : `Consultation slot ${args.requestedTime} is busy and no nearby openings were found in the working window.`,
    request: args.request,
    params: args.params,
  };
}
