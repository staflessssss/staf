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
  timeText?: string;
  coupleName?: string;
  weddingDate?: string;
  location?: string;
  email?: string;
  channel?: string;
};

type SheetsValueSource =
  | "literal"
  | "requested_date"
  | "user_message"
  | "time_text"
  | "couple_name"
  | "wedding_date"
  | "location"
  | "email"
  | "channel";

type SheetsFilterConfig = {
  column: string;
  operator: "equals" | "not_equals" | "contains" | "is_empty" | "is_not_empty";
  valueSource: SheetsValueSource;
  value?: string;
};

type SheetsColumnMappingConfig = {
  column: string;
  valueSource: SheetsValueSource;
  value?: string;
};

type SheetsBaseConfig = {
  operation: "get_rows" | "append_row" | "update_rows";
  spreadsheetId?: string;
  spreadsheetTitle?: string;
  sheetName?: string;
  headerRow: number;
};

type SheetsLookupConfig = SheetsBaseConfig & {
  operation: "get_rows";
  combineFilters: "AND" | "OR";
  filters: SheetsFilterConfig[];
};

type SheetsAppendConfig = SheetsBaseConfig & {
  operation: "append_row";
  columnMappings: SheetsColumnMappingConfig[];
};

type SheetsUpdateConfig = SheetsBaseConfig & {
  operation: "update_rows";
  combineFilters: "AND" | "OR";
  filters: SheetsFilterConfig[];
  columnMappings: SheetsColumnMappingConfig[];
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

function asArray(value: Prisma.JsonValue | null | undefined) {
  return Array.isArray(value) ? value : [];
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

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function addUtcDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
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

  const trimmed = normalizeText(request);
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

    const namedMonthMatch = normalizeText(trimmed).match(
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

function parseFilterConfig(value: Prisma.JsonValue): SheetsFilterConfig | null {
  const filter = asObject(value);

  if (!filter || typeof filter.column !== "string" || !filter.column.trim()) {
    return null;
  }

  const operator =
    typeof filter.operator === "string" &&
    ["equals", "not_equals", "contains", "is_empty", "is_not_empty"].includes(filter.operator)
      ? (filter.operator as SheetsFilterConfig["operator"])
      : "equals";
  const valueSource =
    typeof filter.valueSource === "string" &&
    [
      "literal",
      "requested_date",
      "user_message",
      "time_text",
      "couple_name",
      "wedding_date",
      "location",
      "email",
      "channel",
    ].includes(filter.valueSource)
      ? (filter.valueSource as SheetsFilterConfig["valueSource"])
      : "literal";

  return {
    column: filter.column,
    operator,
    valueSource,
    value: typeof filter.value === "string" ? filter.value : "",
  };
}

function parseColumnMappingConfig(value: Prisma.JsonValue): SheetsColumnMappingConfig | null {
  const mapping = asObject(value);

  if (!mapping || typeof mapping.column !== "string" || !mapping.column.trim()) {
    return null;
  }

  const valueSource =
    typeof mapping.valueSource === "string" &&
    [
      "literal",
      "requested_date",
      "user_message",
      "time_text",
      "couple_name",
      "wedding_date",
      "location",
      "email",
      "channel",
    ].includes(mapping.valueSource)
      ? (mapping.valueSource as SheetsColumnMappingConfig["valueSource"])
      : "literal";

  return {
    column: mapping.column,
    valueSource,
    value: typeof mapping.value === "string" ? mapping.value : "",
  };
}

function parseSheetsBaseConfig(
  params: Prisma.JsonValue,
  metadata?: Prisma.JsonValue | null,
): SheetsBaseConfig {
  const config = asObject(params);
  const integrationMetadata = asObject(metadata);

  return {
    operation:
      config?.operation === "append_row" || config?.operation === "update_rows"
        ? config.operation
        : "get_rows",
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
    headerRow:
      typeof config?.headerRow === "number" && config.headerRow > 0 ? config.headerRow : 1,
  };
}

function parseSheetsLookupConfig(
  params: Prisma.JsonValue,
  metadata?: Prisma.JsonValue | null,
): SheetsLookupConfig {
  const base = parseSheetsBaseConfig(params, metadata);
  const config = asObject(params);

  return {
    ...base,
    operation: "get_rows",
    combineFilters:
      typeof config?.combineFilters === "string" && config.combineFilters === "OR" ? "OR" : "AND",
    filters: asArray(config?.filters)
      .map((filter) => parseFilterConfig(filter))
      .filter((filter): filter is SheetsFilterConfig => Boolean(filter)),
  };
}

function parseSheetsAppendConfig(
  params: Prisma.JsonValue,
  metadata?: Prisma.JsonValue | null,
): SheetsAppendConfig {
  const base = parseSheetsBaseConfig(params, metadata);
  const config = asObject(params);

  return {
    ...base,
    operation: "append_row",
    columnMappings: asArray(config?.columnMappings)
      .map((mapping) => parseColumnMappingConfig(mapping))
      .filter((mapping): mapping is SheetsColumnMappingConfig => Boolean(mapping)),
  };
}

function parseSheetsUpdateConfig(
  params: Prisma.JsonValue,
  metadata?: Prisma.JsonValue | null,
): SheetsUpdateConfig {
  const base = parseSheetsBaseConfig(params, metadata);
  const config = asObject(params);

  return {
    ...base,
    operation: "update_rows",
    combineFilters:
      typeof config?.combineFilters === "string" && config.combineFilters === "OR" ? "OR" : "AND",
    filters: asArray(config?.filters)
      .map((filter) => parseFilterConfig(filter))
      .filter((filter): filter is SheetsFilterConfig => Boolean(filter)),
    columnMappings: asArray(config?.columnMappings)
      .map((mapping) => parseColumnMappingConfig(mapping))
      .filter((mapping): mapping is SheetsColumnMappingConfig => Boolean(mapping)),
  };
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

function normalizeRegion(value: string) {
  const normalized = normalizeText(value);

  if (
    normalized.includes("florida") ||
    normalized === "fl" ||
    normalized.includes("wedding in florida")
  ) {
    return "FL" as const;
  }

  if (
    normalized.includes("north carolina") ||
    normalized.includes("south carolina") ||
    normalized.includes("georgia") ||
    normalized.includes("charlotte") ||
    normalized.includes("nc/sc/ga") ||
    normalized.includes("nc, sc") ||
    normalized.includes("wedding in nc, sc or ga")
  ) {
    return "NC_SC_GA" as const;
  }

  return null;
}

function inferRequestedRegion(request: string, location?: string) {
  return normalizeRegion(location ?? "") ?? normalizeRegion(request);
}

function mapRowToObject(headers: unknown[], row: unknown[]) {
  return headers.reduce<Prisma.JsonObject>((acc, header, index) => {
    if (typeof header === "string" && header.trim()) {
      acc[header] = toJsonValue(row[index] ?? "");
    }

    return acc;
  }, {});
}

async function loadSheetSnapshot(args: {
  sheets: Awaited<ReturnType<typeof createSheetsClient>>;
  config: SheetsBaseConfig;
}) {
  const metadata = await args.sheets.spreadsheets.get({
    spreadsheetId: args.config.spreadsheetId,
    fields: "properties.title",
  });
  const valuesResponse = await args.sheets.spreadsheets.values.get({
    spreadsheetId: args.config.spreadsheetId,
    range: `'${args.config.sheetName?.replace(/'/g, "''")}'`,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });
  const rows = valuesResponse.data.values ?? [];
  const headerRowIndex = Math.max(args.config.headerRow - 1, 0);
  const headers = rows[headerRowIndex] ?? [];

  return {
    metadata,
    rows,
    headerRowIndex,
    headers,
  };
}

function getMissingColumns(headers: unknown[], columns: string[]) {
  return columns.filter((column) => getColumnIndex(headers, column) === -1);
}

function buildMappedRowValues(args: {
  headers: unknown[];
  mappings: Array<SheetsColumnMappingConfig & { resolvedValue: string | null }>;
  baseRow?: unknown[];
}) {
  const rowValues = Array.isArray(args.baseRow)
    ? [...args.baseRow]
    : Array.from({ length: args.headers.length }, () => "");

  args.mappings.forEach((mapping) => {
    const columnIndex = getColumnIndex(args.headers, mapping.column);

    if (columnIndex !== -1) {
      rowValues[columnIndex] = mapping.resolvedValue ?? "";
    }
  });

  return rowValues;
}

function resolveSheetValue(args: {
  valueSource: SheetsValueSource;
  value?: string;
  request: string;
  date?: string;
  timeText?: string;
  coupleName?: string;
  weddingDate?: string;
  location?: string;
  email?: string;
  channel?: string;
}) {
  switch (args.valueSource) {
    case "requested_date": {
      const requestedDate = inferRequestedDate(args.request, args.date);
      return requestedDate ? toIsoDate(requestedDate) : null;
    }
    case "user_message":
      return args.request;
    case "time_text":
      return args.timeText ?? null;
    case "couple_name":
      return args.coupleName ?? null;
    case "wedding_date":
      return args.weddingDate ?? null;
    case "location":
      return args.location ?? null;
    case "email":
      return args.email ?? null;
    case "channel":
      return args.channel ?? null;
    default:
      return args.value ?? "";
  }
}

function evaluateFilter(args: {
  cellValue: unknown;
  filter: SheetsFilterConfig;
  resolvedValue: string | null;
}) {
  const rawCell = args.cellValue == null ? "" : String(args.cellValue);
  const normalizedCell = normalizeText(rawCell);

  if (args.filter.operator === "is_empty") {
    return !rawCell.trim();
  }

  if (args.filter.operator === "is_not_empty") {
    return Boolean(rawCell.trim());
  }

  if (args.resolvedValue === null) {
    return false;
  }

  const normalizedTarget = normalizeText(args.resolvedValue);
  const normalizedCellDate = normalizeSheetDateValue(args.cellValue);
  const normalizedTargetDate = normalizeSheetDateValue(args.resolvedValue);

  if (args.filter.operator === "contains") {
    return normalizedCell.includes(normalizedTarget);
  }

  const equalsByDate =
    Boolean(normalizedCellDate && normalizedTargetDate) && normalizedCellDate === normalizedTargetDate;
  const equalsByText = normalizedCell === normalizedTarget;
  const isEqual = equalsByDate || equalsByText;

  return args.filter.operator === "not_equals" ? !isEqual : isEqual;
}

async function runSheetsLookup(args: SheetsExecutionArgs) {
  const config = parseSheetsLookupConfig(args.params, args.metadata);

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

  if (!config.spreadsheetId || !config.sheetName) {
    return {
      integration: "GOOGLE_SHEETS",
      mode: "live_unavailable",
      status: "misconfigured",
      action: args.action,
      summary: "This Google Sheets tool needs a spreadsheet and a sheet tab before it can run.",
      params: args.params,
      request: args.request,
    };
  }

  if (config.filters.length === 0) {
    return {
      integration: "GOOGLE_SHEETS",
      mode: "live_unavailable",
      status: "missing_filters",
      action: args.action,
      summary: "This Google Sheets tool needs at least one filter before it can run.",
      params: args.params,
      request: args.request,
    };
  }

  const resolvedFilters = config.filters.map((filter) => ({
    ...filter,
    resolvedValue: resolveSheetValue({
      valueSource: filter.valueSource,
      value: filter.value,
      request: args.request,
      date: args.date,
      timeText: args.timeText,
      coupleName: args.coupleName,
      weddingDate: args.weddingDate,
      location: args.location,
      email: args.email,
      channel: args.channel,
    }),
  }));

  const unresolvedRequestedDate = resolvedFilters.some(
    (filter) => filter.valueSource === "requested_date" && filter.resolvedValue === null,
  );

  if (unresolvedRequestedDate) {
    return {
      integration: "GOOGLE_SHEETS",
      mode: "live_unavailable",
      status: "needs_date",
      action: args.action,
      spreadsheetId: config.spreadsheetId,
      sheetName: config.sheetName,
      summary:
        "This lookup expects a requested date, but the customer's message did not contain one I could safely use.",
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
  const headerRowIndex = Math.max(config.headerRow - 1, 0);
  const headers = rows[headerRowIndex] ?? [];

  const missingColumns = resolvedFilters
    .filter((filter) => getColumnIndex(headers, filter.column) === -1)
    .map((filter) => filter.column);

  if (missingColumns.length > 0) {
    return {
      integration: "GOOGLE_SHEETS",
      mode: "live",
      status: "column_not_found",
      action: args.action,
      spreadsheetId: config.spreadsheetId,
      spreadsheetTitle: metadata.data.properties?.title ?? config.spreadsheetTitle ?? null,
      sheetName: config.sheetName,
      missingColumns,
      summary: `Columns not found: ${missingColumns.join(", ")}.`,
      params: args.params,
      request: args.request,
    };
  }

  const matchedRows = rows
    .slice(headerRowIndex + 1)
    .map((row, index) => ({
      rowNumber: headerRowIndex + 2 + index,
      row,
      rowObject: mapRowToObject(headers, row),
    }))
    .filter((row) => {
      const results = resolvedFilters.map((filter) => {
        const columnIndex = getColumnIndex(headers, filter.column);
        return evaluateFilter({
          cellValue: row.row[columnIndex],
          filter,
          resolvedValue: filter.resolvedValue,
        });
      });

      return config.combineFilters === "OR" ? results.some(Boolean) : results.every(Boolean);
    })
    .map((row) => ({
      rowNumber: row.rowNumber,
      row: row.rowObject,
    }));

  const dateColumn = resolvedFilters.find((filter) => filter.valueSource === "requested_date")?.column;
  const statusColumn = headers.find(
    (header) => typeof header === "string" && normalizeHeader(header) === "status",
  );
  const regionColumn = headers.find(
    (header) => typeof header === "string" && normalizeHeader(header) === "region",
  );
  const requestedDate =
    resolvedFilters.find((filter) => filter.valueSource === "requested_date")?.resolvedValue ?? null;
  const requestedRegion =
    typeof regionColumn === "string" ? inferRequestedRegion(args.request, args.location) : null;

  if (
    typeof requestedDate === "string" &&
    typeof dateColumn === "string" &&
    typeof statusColumn === "string" &&
    typeof regionColumn === "string" &&
    requestedRegion
  ) {
    const bookedCounts = new Map<string, number>();

    for (const row of rows.slice(headerRowIndex + 1)) {
      const rowObject = mapRowToObject(headers, row);
      const normalizedDate = normalizeSheetDateValue(rowObject[dateColumn]);
      const normalizedStatus = normalizeText(String(rowObject[statusColumn] ?? ""));
      const normalizedRegion = normalizeRegion(String(rowObject[regionColumn] ?? ""));

      if (!normalizedDate || !normalizedStatus.includes("booked") || !normalizedRegion) {
        continue;
      }

      const key = `${normalizedDate}:${normalizedRegion}`;
      bookedCounts.set(key, (bookedCounts.get(key) ?? 0) + 1);
    }

    const requestedCount = bookedCounts.get(`${requestedDate}:${requestedRegion}`) ?? 0;
    const available = requestedRegion === "FL" ? requestedCount === 0 : requestedCount < 2;
    const findNearestAvailableDate = (direction: -1 | 1) => {
      let cursor = buildUtcDate(
        Number(requestedDate.slice(0, 4)),
        Number(requestedDate.slice(5, 7)) - 1,
        Number(requestedDate.slice(8, 10)),
      );

      for (let dayOffset = 1; dayOffset <= 45; dayOffset += 1) {
        cursor = addUtcDays(cursor, direction);
        const candidateIso = toIsoDate(cursor);
        const candidateCount = bookedCounts.get(`${candidateIso}:${requestedRegion}`) ?? 0;
        const candidateAvailable = requestedRegion === "FL" ? candidateCount === 0 : candidateCount < 2;

        if (candidateAvailable) {
          return candidateIso;
        }
      }

      return null;
    };

    const nearestAvailableDates = available
      ? null
      : {
          before: findNearestAvailableDate(-1),
          after: findNearestAvailableDate(1),
        };
    const suggestedDates = nearestAvailableDates
      ? [nearestAvailableDates.before, nearestAvailableDates.after].filter(
          (value): value is string => Boolean(value),
        )
      : [];

    return {
      integration: "GOOGLE_SHEETS",
      mode: "live",
      status: available ? "available" : "unavailable",
      action: args.action,
      operation: config.operation,
      spreadsheetId: config.spreadsheetId,
      spreadsheetTitle: metadata.data.properties?.title ?? config.spreadsheetTitle ?? null,
      sheetName: config.sheetName,
      requestedDate,
      requestedRegion,
      bookedCount: requestedCount,
      matchedRows,
      nearestAvailableDates,
      suggestedDates,
      summary: available
        ? `Wedding date check: ${requestedDate} is available for ${requestedRegion}.`
        : suggestedDates.length > 0
          ? `Wedding date check: ${requestedDate} is unavailable for ${requestedRegion}. Offer these nearby dates right away: ${suggestedDates.join(", ")}.`
          : `Wedding date check: ${requestedDate} is unavailable for ${requestedRegion} and no nearby replacement dates were found automatically.`,
      params: args.params,
      request: args.request,
    };
  }

  return {
    integration: "GOOGLE_SHEETS",
    mode: "live",
    status: matchedRows.length > 0 ? "matched" : "not_found",
    action: args.action,
    operation: config.operation,
    spreadsheetId: config.spreadsheetId,
    spreadsheetTitle: metadata.data.properties?.title ?? config.spreadsheetTitle ?? null,
    sheetName: config.sheetName,
    combineFilters: config.combineFilters,
    filters: resolvedFilters.map((filter) => ({
      column: filter.column,
      operator: filter.operator,
      valueSource: filter.valueSource,
      resolvedValue: filter.resolvedValue,
    })),
    matchedRows,
    summary:
      matchedRows.length > 0
        ? `Google Sheets lookup found ${matchedRows.length} matching row(s).`
        : "Google Sheets lookup found no matching rows.",
    params: args.params,
    request: args.request,
  };
}

async function runSheetsAppend(args: SheetsExecutionArgs) {
  const config = parseSheetsAppendConfig(args.params, args.metadata);

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

  if (!config.spreadsheetId || !config.sheetName) {
    return {
      integration: "GOOGLE_SHEETS",
      mode: "live_unavailable",
      status: "misconfigured",
      action: args.action,
      summary: "This Google Sheets action needs a spreadsheet and a sheet tab before it can run.",
      params: args.params,
      request: args.request,
    };
  }

  if (config.columnMappings.length === 0) {
    return {
      integration: "GOOGLE_SHEETS",
      mode: "live_unavailable",
      status: "missing_mappings",
      action: args.action,
      summary: "This Google Sheets action needs at least one column mapping before it can append a row.",
      params: args.params,
      request: args.request,
    };
  }

  const sheets = await createSheetsClient(args.credentialsEnc);
  const snapshot = await loadSheetSnapshot({ sheets, config });
  const missingColumns = getMissingColumns(
    snapshot.headers,
    config.columnMappings.map((mapping) => mapping.column),
  );

  if (missingColumns.length > 0) {
    return {
      integration: "GOOGLE_SHEETS",
      mode: "live",
      status: "column_not_found",
      action: args.action,
      spreadsheetId: config.spreadsheetId,
      spreadsheetTitle: snapshot.metadata.data.properties?.title ?? config.spreadsheetTitle ?? null,
      sheetName: config.sheetName,
      missingColumns,
      summary: `Columns not found: ${missingColumns.join(", ")}.`,
      params: args.params,
      request: args.request,
    };
  }

  const resolvedMappings = config.columnMappings.map((mapping) => ({
    ...mapping,
    resolvedValue: resolveSheetValue({
      valueSource: mapping.valueSource,
      value: mapping.value,
      request: args.request,
      date: args.date,
      timeText: args.timeText,
      coupleName: args.coupleName,
      weddingDate: args.weddingDate,
      location: args.location,
      email: args.email,
      channel: args.channel,
    }),
  }));

  const rowValues = buildMappedRowValues({
    headers: snapshot.headers,
    mappings: resolvedMappings,
  });

  await sheets.spreadsheets.values.append({
    spreadsheetId: config.spreadsheetId,
    range: `'${config.sheetName.replace(/'/g, "''")}'`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [rowValues],
    },
  });

  return {
    integration: "GOOGLE_SHEETS",
    mode: "live",
    status: "row_appended",
    action: args.action,
    operation: config.operation,
    spreadsheetId: config.spreadsheetId,
    spreadsheetTitle: snapshot.metadata.data.properties?.title ?? config.spreadsheetTitle ?? null,
    sheetName: config.sheetName,
    summary: "Google Sheets appended a new row successfully.",
    params: args.params,
    request: args.request,
  };
}

async function runSheetsUpdate(args: SheetsExecutionArgs) {
  const config = parseSheetsUpdateConfig(args.params, args.metadata);

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

  if (!config.spreadsheetId || !config.sheetName) {
    return {
      integration: "GOOGLE_SHEETS",
      mode: "live_unavailable",
      status: "misconfigured",
      action: args.action,
      summary: "This Google Sheets action needs a spreadsheet and a sheet tab before it can run.",
      params: args.params,
      request: args.request,
    };
  }

  if (config.filters.length === 0) {
    return {
      integration: "GOOGLE_SHEETS",
      mode: "live_unavailable",
      status: "missing_filters",
      action: args.action,
      summary: "This Google Sheets update action needs at least one row condition before it can run.",
      params: args.params,
      request: args.request,
    };
  }

  if (config.columnMappings.length === 0) {
    return {
      integration: "GOOGLE_SHEETS",
      mode: "live_unavailable",
      status: "missing_mappings",
      action: args.action,
      summary: "This Google Sheets update action needs at least one column mapping before it can run.",
      params: args.params,
      request: args.request,
    };
  }

  const lookupResult = await runSheetsLookup(args);
  if (typeof lookupResult !== "object" || lookupResult == null || Array.isArray(lookupResult)) {
    return lookupResult;
  }

  if (!("matchedRows" in lookupResult) || !Array.isArray(lookupResult.matchedRows)) {
    return lookupResult;
  }

  if (!lookupResult.matchedRows.length) {
    return {
      ...lookupResult,
      operation: config.operation,
      status: "not_found",
      summary: "Google Sheets update found no matching rows to change.",
    };
  }

  const sheets = await createSheetsClient(args.credentialsEnc);
  const snapshot = await loadSheetSnapshot({ sheets, config });
  const missingColumns = getMissingColumns(
    snapshot.headers,
    [
      ...config.filters.map((filter) => filter.column),
      ...config.columnMappings.map((mapping) => mapping.column),
    ],
  );

  if (missingColumns.length > 0) {
    return {
      integration: "GOOGLE_SHEETS",
      mode: "live",
      status: "column_not_found",
      action: args.action,
      spreadsheetId: config.spreadsheetId,
      spreadsheetTitle: snapshot.metadata.data.properties?.title ?? config.spreadsheetTitle ?? null,
      sheetName: config.sheetName,
      missingColumns,
      summary: `Columns not found: ${missingColumns.join(", ")}.`,
      params: args.params,
      request: args.request,
    };
  }

  const resolvedMappings = config.columnMappings.map((mapping) => ({
    ...mapping,
    resolvedValue: resolveSheetValue({
      valueSource: mapping.valueSource,
      value: mapping.value,
      request: args.request,
      date: args.date,
      timeText: args.timeText,
      coupleName: args.coupleName,
      weddingDate: args.weddingDate,
      location: args.location,
      email: args.email,
      channel: args.channel,
    }),
  }));

  for (const matchedRow of lookupResult.matchedRows as Array<{ rowNumber: number }>) {
    const rowIndex = matchedRow.rowNumber - 1;
    const baseRow = snapshot.rows[rowIndex] ?? [];
    const nextRow = buildMappedRowValues({
      headers: snapshot.headers,
      mappings: resolvedMappings,
      baseRow,
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId: config.spreadsheetId,
      range: `'${config.sheetName.replace(/'/g, "''")}'!${matchedRow.rowNumber}:${matchedRow.rowNumber}`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [nextRow],
      },
    });
  }

  return {
    integration: "GOOGLE_SHEETS",
    mode: "live",
    status: "rows_updated",
    action: args.action,
    operation: config.operation,
    spreadsheetId: config.spreadsheetId,
    spreadsheetTitle: snapshot.metadata.data.properties?.title ?? config.spreadsheetTitle ?? null,
    sheetName: config.sheetName,
    updatedRows: lookupResult.matchedRows.length,
    summary: `Google Sheets updated ${lookupResult.matchedRows.length} matching row(s).`,
    params: args.params,
    request: args.request,
  };
}

export async function executeGoogleSheetsStep(args: SheetsExecutionArgs) {
  const operation =
    asObject(args.params)?.operation === "append_row" || asObject(args.params)?.operation === "update_rows"
      ? (asObject(args.params)?.operation as "append_row" | "update_rows")
      : "get_rows";

  if (operation === "append_row") {
    return runSheetsAppend(args);
  }

  if (operation === "update_rows") {
    return runSheetsUpdate(args);
  }

  return runSheetsLookup(args);
}
