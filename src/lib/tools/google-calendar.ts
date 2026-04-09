import { google } from "googleapis";
import { Prisma } from "@prisma/client";

import { decrypt } from "@/lib/crypto";

type CalendarExecutionArgs = {
  action: string;
  params: Prisma.JsonValue;
  request: string;
  metadata?: Prisma.JsonValue | null;
  credentialsEnc?: string;
  date?: string;
};

function asObject(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, Prisma.JsonValue>;
}

function inferIntent(action: string) {
  const normalized = action.toLowerCase();

  if (
    normalized.includes("availability") ||
    normalized.includes("freebusy") ||
    normalized.includes("check") ||
    normalized.includes("calendar")
  ) {
    return "availability";
  }

  if (normalized.includes("book") || normalized.includes("create") || normalized.includes("schedule")) {
    return "create_event";
  }

  return "calendar_lookup";
}

const monthMap: Record<string, number> = {
  january: 0,
  jan: 0,
  "января": 0,
  januarys: 0,
  february: 1,
  feb: 1,
  "февраля": 1,
  march: 2,
  mar: 2,
  "марта": 2,
  april: 3,
  apr: 3,
  "апреля": 3,
  may: 4,
  "мая": 4,
  june: 5,
  jun: 5,
  "июня": 5,
  july: 6,
  jul: 6,
  "июля": 6,
  august: 7,
  aug: 7,
  "августа": 7,
  september: 8,
  sep: 8,
  sept: 8,
  "сентября": 8,
  october: 9,
  oct: 9,
  "октября": 9,
  november: 10,
  nov: 10,
  "ноября": 10,
  december: 11,
  dec: 11,
  "декабря": 11,
};

function inferRequestedDate(request: string, explicitDate?: string) {
  if (explicitDate && /^\d{4}-\d{2}-\d{2}$/.test(explicitDate)) {
    const [year, month, day] = explicitDate.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }

  const trimmed = request.trim().toLowerCase();
  const now = new Date();

  const isoMatch = trimmed.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);

  if (isoMatch) {
    return new Date(Date.UTC(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3])));
  }

  const dottedMatch = trimmed.match(/\b(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?\b/);

  if (dottedMatch) {
    const year = dottedMatch[3] ? Number(dottedMatch[3]) : now.getUTCFullYear();
    let candidate = new Date(Date.UTC(year, Number(dottedMatch[2]) - 1, Number(dottedMatch[1])));

    if (!dottedMatch[3] && candidate < now) {
      candidate = new Date(Date.UTC(year + 1, Number(dottedMatch[2]) - 1, Number(dottedMatch[1])));
    }

    return candidate;
  }

  const namedMonthMatch = trimmed.match(
    /\b(\d{1,2})\s+(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|sept|october|oct|november|nov|december|dec|января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)(?:\s+(\d{4}))?\b/u,
  );

  if (namedMonthMatch) {
    const day = Number(namedMonthMatch[1]);
    const month = monthMap[namedMonthMatch[2]];
    const year = namedMonthMatch[3] ? Number(namedMonthMatch[3]) : now.getUTCFullYear();
    let candidate = new Date(Date.UTC(year, month, day));

    if (!namedMonthMatch[3] && candidate < now) {
      candidate = new Date(Date.UTC(year + 1, month, day));
    }

    return candidate;
  }

  return null;
}

function buildDayWindow(date: Date) {
  const timeMin = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0));
  const timeMax = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1, 0, 0, 0));

  return { timeMin, timeMax };
}

function formatDate(date: Date) {
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

async function createCalendarClient(credentialsEnc: string) {
  const credentials = JSON.parse(decrypt(credentialsEnc)) as {
    access_token?: string;
    refresh_token?: string;
    expiry_date?: number;
    scope?: string;
    token_type?: string;
  };
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri =
    `${process.env.APP_BASE_URL?.trim() || process.env.NEXTAUTH_URL?.trim() || ""}/api/google/callback`;

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth client credentials are missing.");
  }

  const auth = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  auth.setCredentials(credentials);

  return google.calendar({ version: "v3", auth });
}

async function runAvailabilityLookup(args: CalendarExecutionArgs) {
  const metadata = asObject(args.metadata);
  const calendarId = typeof metadata?.calendarId === "string" ? metadata.calendarId : "primary";
  const requestedDate = inferRequestedDate(args.request, args.date);

  if (!requestedDate || !args.credentialsEnc) {
    return {
      integration: "GOOGLE_CALENDAR",
      mode: "live_unavailable",
      status: "needs_date",
      action: args.action,
      calendarId,
      summary:
        "The calendar tool is connected, but the request did not contain a date I could safely check.",
      request: args.request,
      params: args.params,
    };
  }

  const { timeMin, timeMax } = buildDayWindow(requestedDate);
  const calendar = await createCalendarClient(args.credentialsEnc);
  const freebusy = await calendar.freebusy.query({
    requestBody: {
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      items: [{ id: calendarId }],
    },
  });
  const busy =
    freebusy.data.calendars?.[calendarId]?.busy?.filter((entry) => entry.start && entry.end) ?? [];
  const isAvailable = busy.length === 0;
  const formattedDate = formatDate(requestedDate);

  return {
    integration: "GOOGLE_CALENDAR",
    mode: "live",
    status: isAvailable ? "available" : "busy",
    action: args.action,
    calendarId,
    date: requestedDate.toISOString().slice(0, 10),
    busySlots: busy,
    summary: isAvailable
      ? `Calendar check completed for ${formattedDate}. No busy events were found that day.`
      : `Calendar check completed for ${formattedDate}. Busy events were found that day.`,
    request: args.request,
    params: args.params,
  };
}

export async function executeGoogleCalendarStep(args: CalendarExecutionArgs) {
  const metadata = asObject(args.metadata);
  const calendarId = typeof metadata?.calendarId === "string" ? metadata.calendarId : "primary";
  const intent = inferIntent(args.action);

  if (intent === "create_event") {
    return {
      integration: "GOOGLE_CALENDAR",
      mode: "simulated",
      status: "accepted",
      action: args.action,
      calendarId,
      summary:
        "Calendar event creation was requested. The runtime accepted the instruction and recorded it as a simulated booking step until booking creation rules are finalized.",
      request: args.request,
      params: args.params,
    };
  }

  return runAvailabilityLookup(args);
}
