import { google } from "googleapis";
import { Prisma } from "@prisma/client";

import {
  createGoogleOAuthClientFromEncryptedCredentials,
  parseSpreadsheetId,
} from "@/lib/google-api-client";

type SheetsExecutionArgs = {
  action: string;
  params: Prisma.JsonValue;
  request: string;
  metadata?: Prisma.JsonValue | null;
  credentialsEnc?: string;
  date?: string;
};

type BookingLookupConfig = {
  operation?: string;
  spreadsheetId?: string;
  sheetName?: string;
  lookupColumn?: string;
  matchMode?: string;
  headerRow?: number;
  spreadsheetTitle?: string;
};

const monthMap: Record<string, number> = {
  january: 0,
  jan: 0,
  "января": 0,
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

function asObject(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, Prisma.JsonValue>;
}

function toJsonValue(value: unknown): Prisma.JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => toJsonValue(item));
  }

  if (value && typeof value === "object") {
    return Object.entries(value).reduce<Prisma.JsonObject>((acc, [key, entry]) => {
      acc[key] = toJsonValue(entry);
      return acc;
    }, {});
  }

  return String(value);
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase();
}

function normalizeDateString(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildUtcDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month, day));
}

function inferRequestedDate(request: string, explicitDate?: string) {
  if (explicitDate && /^\d{4}-\d{2}-\d{2}$/.test(explicitDate)) {
    const [year, month, day] = explicitDate.split("-").map(Number);
    return buildUtcDate(year, month - 1, day);
  }

  const trimmed = normalizeDateString(request);
  const now = new Date();

  const isoMatch = trimmed.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);

  if (isoMatch) {
    return buildUtcDate(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
  }

  const dottedMatch = trimmed.match(/\b(\d{1,2})[./](\d{1,2})(?:[./](\d{4}))?\b/);

  if (dottedMatch) {
    const year = dottedMatch[3] ? Number(dottedMatch[3]) : now.getUTCFullYear();
    let candidate = buildUtcDate(year, Number(dottedMatch[2]) - 1, Number(dottedMatch[1]));

    if (!dottedMatch[3] && candidate < now) {
      candidate = buildUtcDate(year + 1, Number(dottedMatch[2]) - 1, Number(dottedMatch[1]));
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
    let candidate = buildUtcDate(year, month, day);

    if (!namedMonthMatch[3] && candidate < now) {
      candidate = buildUtcDate(year + 1, month, day);
    }

    return candidate;
  }

  return null;
}

export function normalizeSheetDateValue(value: unknown) {
  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) {
      return null;
    }

    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    }

    const dottedMatch = trimmed.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);

    if (dottedMatch) {
      return `${dottedMatch[3]}-${dottedMatch[2].padStart(2, "0")}-${dottedMatch[1].padStart(2, "0")}`;
    }

    const namedMonthMatch = normalizeDateString(trimmed).match(
      /^(\d{1,2})\s+(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|sept|october|oct|november|nov|december|dec|января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\s+(\d{4})$/u,
    );

    if (namedMonthMatch) {
      const day = namedMonthMatch[1].padStart(2, "0");
      const month = String(monthMap[namedMonthMatch[2]] + 1).padStart(2, "0");
      return `${namedMonthMatch[3]}-${month}-${day}`;
    }

    const parsed = new Date(trimmed);

    if (!Number.isNaN(parsed.getTime())) {
      return toIsoDate(parsed);
    }
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const base = Date.UTC(1899, 11, 30);
    const millis = Math.round(value * 24 * 60 * 60 * 1000);
    return toIsoDate(new Date(base + millis));
  }

  return null;
}

function parseBookingLookupConfig(
  params: Prisma.JsonValue,
  metadata?: Prisma.JsonValue | null,
): BookingLookupConfig {
  const config = asObject(params);
  const integrationMetadata = asObject(metadata);

  return {
    operation:
      typeof config?.operation === "string" ? config.operation : "booking_date_lookup",
    spreadsheetId: parseSpreadsheetId(
      typeof config?.spreadsheetId === "string"
        ? config.spreadsheetId
        : typeof integrationMetadata?.spreadsheetId === "string"
          ? integrationMetadata.spreadsheetId
          : "",
    ),
    spreadsheetTitle:
      typeof config?.spreadsheetTitle === "string" ? config.spreadsheetTitle : undefined,
    sheetName: typeof config?.sheetName === "string" ? config.sheetName : undefined,
    lookupColumn: typeof config?.lookupColumn === "string" ? config.lookupColumn : undefined,
    matchMode:
      typeof config?.matchMode === "string" ? config.matchMode : "date_equals_requested_date",
    headerRow:
      typeof config?.headerRow === "number" && config.headerRow > 0 ? config.headerRow : 1,
  };
}

function formatDate(date: Date) {
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

async function createSheetsClient(credentialsEnc: string) {
  const auth = createGoogleOAuthClientFromEncryptedCredentials(credentialsEnc);
  return google.sheets({ version: "v4", auth });
}

function getColumnIndex(headers: unknown[], lookupColumn: string) {
  return headers.findIndex(
    (header) => typeof header === "string" && normalizeHeader(header) === normalizeHeader(lookupColumn),
  );
}

function mapRowToObject(headers: unknown[], row: unknown[]) {
  return headers.reduce<Prisma.JsonObject>((acc, header, index) => {
    if (typeof header === "string" && header.trim()) {
      acc[header] = toJsonValue(row[index] ?? "");
    }

    return acc;
  }, {});
}

async function runBookingDateLookup(args: SheetsExecutionArgs) {
  const config = parseBookingLookupConfig(args.params, args.metadata);
  const requestedDate = inferRequestedDate(args.request, args.date);

  if (!args.credentialsEnc) {
    return {
      integration: "GOOGLE_SHEETS",
      mode: "live_unavailable",
      status: "missing_credentials",
      action: args.action,
      summary: "This Google Sheets integration does not have usable OAuth credentials.",
      params: args.params,
      request: args.request,
    };
  }

  if (!config.spreadsheetId || !config.sheetName || !config.lookupColumn) {
    return {
      integration: "GOOGLE_SHEETS",
      mode: "live_unavailable",
      status: "misconfigured",
      action: args.action,
      summary:
        "This Google Sheets tool needs a spreadsheet, a sheet tab, and a lookup column before it can answer booking questions.",
      params: args.params,
      request: args.request,
    };
  }

  if (!requestedDate) {
    return {
      integration: "GOOGLE_SHEETS",
      mode: "live_unavailable",
      status: "needs_date",
      action: args.action,
      spreadsheetId: config.spreadsheetId,
      sheetName: config.sheetName,
      summary:
        "The booking sheet is connected, but the request did not contain a date I could safely check.",
      params: args.params,
      request: args.request,
    };
  }

  const sheets = await createSheetsClient(args.credentialsEnc);
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId: config.spreadsheetId,
    fields: "properties.title",
  });
  const valuesResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: config.spreadsheetId,
    range: `'${config.sheetName.replace(/'/g, "''")}'`,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });
  const rows = valuesResponse.data.values ?? [];
  const headerRowIndex = Math.max((config.headerRow ?? 1) - 1, 0);
  const headers = rows[headerRowIndex] ?? [];
  const columnIndex = getColumnIndex(headers, config.lookupColumn);

  if (columnIndex === -1) {
    return {
      integration: "GOOGLE_SHEETS",
      mode: "live",
      status: "column_not_found",
      action: args.action,
      spreadsheetId: config.spreadsheetId,
      spreadsheetTitle: metadata.data.properties?.title ?? config.spreadsheetTitle ?? null,
      sheetName: config.sheetName,
      lookupColumn: config.lookupColumn,
      summary: `Column "${config.lookupColumn}" was not found in sheet "${config.sheetName}".`,
      params: args.params,
      request: args.request,
    };
  }

  const requestedIso = toIsoDate(requestedDate);
  const matchedRows = rows
    .slice(headerRowIndex + 1)
    .map((row, index) => ({
      rowNumber: headerRowIndex + 2 + index,
      value: row[columnIndex],
      row,
    }))
    .filter((row) => normalizeSheetDateValue(row.value) === requestedIso)
    .map((row) => ({
      rowNumber: row.rowNumber,
      matchedValue: toJsonValue(row.value),
      row: mapRowToObject(headers, row.row),
    }));

  const isBooked = matchedRows.length > 0;
  const formattedDate = formatDate(requestedDate);
  const spreadsheetTitle = metadata.data.properties?.title ?? config.spreadsheetTitle ?? null;

  return {
    integration: "GOOGLE_SHEETS",
    mode: "live",
    status: isBooked ? "booked" : "available",
    action: args.action,
    operation: config.operation,
    spreadsheetId: config.spreadsheetId,
    spreadsheetTitle,
    sheetName: config.sheetName,
    lookupColumn: config.lookupColumn,
    date: requestedIso,
    matchedRows,
    summary: isBooked
      ? `Booking sheet check completed for ${formattedDate}. Matching booking rows were found.`
      : `Booking sheet check completed for ${formattedDate}. No matching booking rows were found.`,
    params: args.params,
    request: args.request,
  };
}

export async function executeGoogleSheetsStep(args: SheetsExecutionArgs) {
  const config = parseBookingLookupConfig(args.params, args.metadata);

  if (config.operation === "booking_date_lookup") {
    return runBookingDateLookup(args);
  }

  return {
    integration: "GOOGLE_SHEETS",
    mode: "live_unavailable",
    status: "unsupported_operation",
    action: args.action,
    summary: `The Google Sheets executor does not support operation "${config.operation ?? "unknown"}" yet.`,
    params: args.params,
    request: args.request,
  };
}
