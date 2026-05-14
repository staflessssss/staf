import { isValidTimezone } from "@/lib/timezones";

export type GoogleSheetsOperationDraft =
  | "get_rows"
  | "append_row"
  | "update_rows"
  | "capacity_availability";

export type GoogleSheetsValueSourceDraft =
  | "literal"
  | "requested_date"
  | "user_message"
  | "time_text"
  | "couple_name"
  | "wedding_date"
  | "location"
  | "email"
  | "channel";

export type GoogleSheetsFilterDraft = {
  column: string;
  operator: "equals" | "not_equals" | "contains" | "is_empty" | "is_not_empty";
  valueSource: GoogleSheetsValueSourceDraft;
  value: string;
};

export type GoogleSheetsColumnMappingDraft = {
  column: string;
  valueSource: GoogleSheetsValueSourceDraft;
  value: string;
};

export type GoogleSheetsCapacityRuleDraft = {
  region: string;
  aliases: string[];
  capacity: number;
};

export type GoogleCalendarOperationDraft = "check_calendar" | "book_call";

export type GoogleSheetsParams = {
  operation: GoogleSheetsOperationDraft;
  spreadsheetId: string;
  spreadsheetTitle: string;
  sheetName: string;
  combineFilters: string;
  headerRow: number;
  filters: GoogleSheetsFilterDraft[];
  columnMappings: GoogleSheetsColumnMappingDraft[];
  dateColumn: string;
  statusColumn: string;
  regionColumn: string;
  bookedStatusValue: string;
  capacityRules: GoogleSheetsCapacityRuleDraft[];
  suggestionSearchDays: number;
};

export type GoogleCalendarParams = {
  operation: GoogleCalendarOperationDraft;
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
  ownerTelegramChatId: string;
  syncLeadToSheets: boolean;
  leadSpreadsheetId: string;
  leadSpreadsheetTitle: string;
  leadSheetName: string;
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

type StepLike = {
  action: string;
  params: string | Record<string, unknown>;
};

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function isIsoDateLiteral(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

export function isEmailLiteral(value: string) {
  return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(value.trim());
}

export function isCalendarTimeLiteral(value: string) {
  return /(^\d{1,2}:\d{2}$)|(^\d{1,2}\s*(am|pm)$)|(^\d{1,2}:\d{2}\s*(am|pm)$)/i.test(
    value.trim(),
  );
}

export function safeParseExecutionParams(value: string | Record<string, unknown>) {
  if (typeof value !== "string") {
    return asRecord(value) ?? {};
  }

  try {
    const parsed = JSON.parse(value || "{}");
    return asRecord(parsed) ?? {};
  } catch {
    return {};
  }
}

export function stringifyExecutionParams(value: Record<string, unknown>) {
  return JSON.stringify(value, null, 2);
}

export function getDefaultGoogleSheetsParams(): GoogleSheetsParams {
  return {
    operation: "get_rows",
    spreadsheetId: "",
    spreadsheetTitle: "",
    sheetName: "",
    combineFilters: "AND",
    headerRow: 1,
    filters: [
      {
        column: "",
        operator: "equals",
        valueSource: "requested_date",
        value: "",
      },
    ],
    columnMappings: [
      {
        column: "",
        valueSource: "user_message",
        value: "",
      },
    ],
    dateColumn: "date",
    statusColumn: "status",
    regionColumn: "region",
    bookedStatusValue: "Booked",
    capacityRules: [
      {
        region: "FL",
        aliases: ["FL", "Florida"],
        capacity: 1,
      },
      {
        region: "NC/SC/GA",
        aliases: ["NC/SC/GA", "NC, SC", "North Carolina", "South Carolina", "Georgia", "Charlotte"],
        capacity: 2,
      },
    ],
    suggestionSearchDays: 45,
  };
}

function isGoogleSheetsValueSource(value: unknown): value is GoogleSheetsValueSourceDraft {
  return (
    value === "literal" ||
    value === "requested_date" ||
    value === "user_message" ||
    value === "time_text" ||
    value === "couple_name" ||
    value === "wedding_date" ||
    value === "location" ||
    value === "email" ||
    value === "channel"
  );
}

export function getGoogleSheetsParams(step: Pick<StepLike, "params">): GoogleSheetsParams {
  const params = safeParseExecutionParams(step.params);
  const defaults = getDefaultGoogleSheetsParams();
  const filters = Array.isArray(params.filters)
    ? params.filters
        .map((filter) => {
          const record = asRecord(filter);

          if (!record) {
            return null;
          }

          return {
            column: typeof record.column === "string" ? record.column : "",
            operator:
              record.operator === "not_equals" ||
              record.operator === "contains" ||
              record.operator === "is_empty" ||
              record.operator === "is_not_empty"
                ? record.operator
                : "equals",
            valueSource: isGoogleSheetsValueSource(record.valueSource)
              ? record.valueSource
              : "requested_date",
            value: typeof record.value === "string" ? record.value : "",
          } satisfies GoogleSheetsFilterDraft;
        })
        .filter((filter): filter is GoogleSheetsFilterDraft => Boolean(filter))
    : [];
  const columnMappings = Array.isArray(params.columnMappings)
    ? params.columnMappings
        .map((mapping) => {
          const record = asRecord(mapping);

          if (!record) {
            return null;
          }

          return {
            column: typeof record.column === "string" ? record.column : "",
            valueSource: isGoogleSheetsValueSource(record.valueSource)
              ? record.valueSource
              : "user_message",
            value: typeof record.value === "string" ? record.value : "",
          } satisfies GoogleSheetsColumnMappingDraft;
        })
        .filter((mapping): mapping is GoogleSheetsColumnMappingDraft => Boolean(mapping))
    : [];
  const capacityRules = Array.isArray(params.capacityRules)
    ? params.capacityRules
        .map((rule) => {
          const record = asRecord(rule);

          if (!record) {
            return null;
          }

          const region = typeof record.region === "string" ? record.region.trim() : "";
          const aliases = Array.isArray(record.aliases)
            ? record.aliases.filter(
                (alias): alias is string => typeof alias === "string" && alias.trim().length > 0,
              )
            : [];
          const capacity =
            typeof record.capacity === "number" && record.capacity > 0
              ? Math.floor(record.capacity)
              : 0;

          return region && capacity > 0
            ? {
                region,
                aliases: aliases.length > 0 ? aliases : [region],
                capacity,
              }
            : null;
        })
        .filter((rule): rule is GoogleSheetsCapacityRuleDraft => Boolean(rule))
    : [];

  return {
    operation:
      params.operation === "append_row" ||
      params.operation === "update_rows" ||
      params.operation === "capacity_availability"
        ? params.operation
        : defaults.operation,
    spreadsheetId:
      typeof params.spreadsheetId === "string" ? params.spreadsheetId : defaults.spreadsheetId,
    spreadsheetTitle:
      typeof params.spreadsheetTitle === "string"
        ? params.spreadsheetTitle
        : defaults.spreadsheetTitle,
    sheetName: typeof params.sheetName === "string" ? params.sheetName : defaults.sheetName,
    combineFilters:
      typeof params.combineFilters === "string" && params.combineFilters === "OR"
        ? "OR"
        : "AND",
    headerRow:
      typeof params.headerRow === "number" && params.headerRow > 0
        ? params.headerRow
        : defaults.headerRow,
    filters: filters.length > 0 ? filters : defaults.filters,
    columnMappings: columnMappings.length > 0 ? columnMappings : defaults.columnMappings,
    dateColumn: typeof params.dateColumn === "string" ? params.dateColumn : defaults.dateColumn,
    statusColumn:
      typeof params.statusColumn === "string" ? params.statusColumn : defaults.statusColumn,
    regionColumn:
      typeof params.regionColumn === "string" ? params.regionColumn : defaults.regionColumn,
    bookedStatusValue:
      typeof params.bookedStatusValue === "string"
        ? params.bookedStatusValue
        : defaults.bookedStatusValue,
    capacityRules: Array.isArray(params.capacityRules) ? capacityRules : defaults.capacityRules,
    suggestionSearchDays:
      typeof params.suggestionSearchDays === "number" && params.suggestionSearchDays > 0
        ? Math.floor(params.suggestionSearchDays)
        : defaults.suggestionSearchDays,
  };
}

export function getGoogleSheetsValidationErrors(step: Pick<StepLike, "params">) {
  const params = getGoogleSheetsParams(step);
  const errors: string[] = [];

  if (!params.spreadsheetId.trim()) {
    errors.push("Google Sheets needs a selected spreadsheet.");
  }

  if (!params.sheetName.trim()) {
    errors.push("Google Sheets needs a selected sheet tab.");
  }

  if (params.operation === "capacity_availability") {
    if (!params.dateColumn.trim()) {
      errors.push("Google Sheets capacity availability needs a date column.");
    }

    if (!params.statusColumn.trim()) {
      errors.push("Google Sheets capacity availability needs a status column.");
    }

    if (!params.regionColumn.trim()) {
      errors.push("Google Sheets capacity availability needs a region column.");
    }

    if (!params.bookedStatusValue.trim()) {
      errors.push("Google Sheets capacity availability needs a booked status value.");
    }

    if (params.capacityRules.length === 0) {
      errors.push("Google Sheets capacity availability needs at least one capacity rule.");
    }

    params.capacityRules.forEach((rule, index) => {
      if (!rule.region.trim()) {
        errors.push(`Google Sheets capacity rule ${index + 1} needs a region label.`);
      }

      if (rule.aliases.length === 0) {
        errors.push(`Google Sheets capacity rule ${index + 1} needs at least one alias.`);
      }

      if (rule.capacity < 1) {
        errors.push(`Google Sheets capacity rule ${index + 1} needs a capacity of at least 1.`);
      }
    });

    return errors;
  }

  if (params.operation === "get_rows" || params.operation === "update_rows") {
    if (params.filters.length === 0) {
      errors.push("Google Sheets lookup needs at least one row condition.");
    }

    params.filters.forEach((filter, index) => {
      if (!filter.column.trim()) {
        errors.push(`Google Sheets condition ${index + 1} needs a column.`);
      }

      if (filter.valueSource === "literal" && !filter.value.trim()) {
        errors.push(`Google Sheets condition ${index + 1} needs a fixed value.`);
      }
    });
  }

  if (params.operation === "append_row" || params.operation === "update_rows") {
    if (params.columnMappings.length === 0) {
      errors.push("Google Sheets write action needs at least one column mapping.");
    }

    params.columnMappings.forEach((mapping, index) => {
      if (!mapping.column.trim()) {
        errors.push(`Google Sheets mapping ${index + 1} needs a column.`);
      }

      if (mapping.valueSource === "literal" && !mapping.value.trim()) {
        errors.push(`Google Sheets mapping ${index + 1} needs a fixed value.`);
      }
    });
  }

  return errors;
}

export function getGoogleSheetsActionForOperation(operation: GoogleSheetsOperationDraft) {
  switch (operation) {
    case "append_row":
      return "append row to sheet";
    case "update_rows":
      return "update matching rows in sheet";
    case "capacity_availability":
      return "check capacity availability in sheet";
    default:
      return "lookup rows in sheet";
  }
}

export function inferGoogleCalendarOperation(action: string): GoogleCalendarOperationDraft {
  const normalized = action.trim().toLowerCase();

  if (
    normalized.includes("book call") ||
    normalized.includes("book_call") ||
    normalized.includes("send invite") ||
    normalized.includes("create consultation")
  ) {
    return "book_call";
  }

  return "check_calendar";
}

export function getGoogleCalendarActionForOperation(operation: GoogleCalendarOperationDraft) {
  return operation === "book_call"
    ? "book call and send invite"
    : "check consultation calendar availability";
}

export function getDefaultGoogleCalendarParams(): Omit<GoogleCalendarParams, "operation"> {
  return {
    calendarId: "",
    timeZone: "America/New_York",
    availabilityDateSource: "request_date",
    availabilityDateValue: "",
    bookingDateSource: "request_date",
    bookingDateValue: "",
    bookingTimeSource: "time_text",
    bookingTimeValue: "",
    inviteEmailSource: "customer_email",
    inviteEmailValue: "",
    slotDurationMinutes: 30,
    businessWindowStartHour: 9,
    businessWindowEndHour: 14,
    businessDays: [1, 2, 3, 4, 5],
    checkConflictsBeforeBooking: true,
    inviteCustomerByEmail: true,
    createMeetLink: true,
    reminderEnabled: false,
    reminderMinutesBefore: 30,
    eventSummaryTemplate: "Consultation call with {{coupleName}}",
    eventDescriptionTemplate:
      "Wedding date: {{weddingDate}}\nLocation: {{location}}\nChannel: {{channel}}",
    ownerTelegramChatId: "",
    syncLeadToSheets: false,
    leadSpreadsheetId: "",
    leadSpreadsheetTitle: "",
    leadSheetName: "",
    leadHeaderRow: 1,
    leadColumns: {
      coupleName: "couple_name",
      weddingDate: "wedding_date",
      location: "location",
      callDate: "call_date",
      callTime: "call_time",
      email: "email",
      channel: "channel",
    },
  };
}

export function getGoogleCalendarParams(step: StepLike): GoogleCalendarParams {
  const params = safeParseExecutionParams(step.params);
  const defaults = getDefaultGoogleCalendarParams();
  const leadColumns = asRecord(params.leadColumns) ?? {};
  const businessDays =
    Array.isArray(params.businessDays) && params.businessDays.every((value) => typeof value === "number")
      ? Array.from(new Set(params.businessDays.filter((value): value is number => value >= 0 && value <= 6)))
      : defaults.businessDays;

  return {
    operation: inferGoogleCalendarOperation(step.action),
    calendarId: typeof params.calendarId === "string" ? params.calendarId : defaults.calendarId,
    timeZone: typeof params.timeZone === "string" ? params.timeZone : defaults.timeZone,
    availabilityDateSource:
      params.availabilityDateSource === "time_text" || params.availabilityDateSource === "literal"
        ? params.availabilityDateSource
        : defaults.availabilityDateSource,
    availabilityDateValue:
      typeof params.availabilityDateValue === "string"
        ? params.availabilityDateValue
        : defaults.availabilityDateValue,
    bookingDateSource:
      params.bookingDateSource === "time_text" || params.bookingDateSource === "literal"
        ? params.bookingDateSource
        : defaults.bookingDateSource,
    bookingDateValue:
      typeof params.bookingDateValue === "string" ? params.bookingDateValue : defaults.bookingDateValue,
    bookingTimeSource:
      params.bookingTimeSource === "literal" ? params.bookingTimeSource : defaults.bookingTimeSource,
    bookingTimeValue:
      typeof params.bookingTimeValue === "string" ? params.bookingTimeValue : defaults.bookingTimeValue,
    inviteEmailSource:
      params.inviteEmailSource === "default_email" || params.inviteEmailSource === "literal"
        ? params.inviteEmailSource
        : defaults.inviteEmailSource,
    inviteEmailValue:
      typeof params.inviteEmailValue === "string" ? params.inviteEmailValue : defaults.inviteEmailValue,
    slotDurationMinutes:
      typeof params.slotDurationMinutes === "number" && params.slotDurationMinutes > 0
        ? params.slotDurationMinutes
        : defaults.slotDurationMinutes,
    businessWindowStartHour:
      typeof params.businessWindowStartHour === "number"
        ? params.businessWindowStartHour
        : defaults.businessWindowStartHour,
    businessWindowEndHour:
      typeof params.businessWindowEndHour === "number"
        ? params.businessWindowEndHour
        : defaults.businessWindowEndHour,
    businessDays,
    checkConflictsBeforeBooking:
      typeof params.checkConflictsBeforeBooking === "boolean"
        ? params.checkConflictsBeforeBooking
        : defaults.checkConflictsBeforeBooking,
    inviteCustomerByEmail:
      typeof params.inviteCustomerByEmail === "boolean"
        ? params.inviteCustomerByEmail
        : defaults.inviteCustomerByEmail,
    createMeetLink:
      typeof params.createMeetLink === "boolean"
        ? params.createMeetLink
        : defaults.createMeetLink,
    reminderEnabled:
      typeof params.reminderEnabled === "boolean"
        ? params.reminderEnabled
        : defaults.reminderEnabled,
    reminderMinutesBefore:
      typeof params.reminderMinutesBefore === "number" && params.reminderMinutesBefore >= 0
        ? params.reminderMinutesBefore
        : defaults.reminderMinutesBefore,
    eventSummaryTemplate:
      typeof params.eventSummaryTemplate === "string" && params.eventSummaryTemplate.trim()
        ? params.eventSummaryTemplate
        : defaults.eventSummaryTemplate,
    eventDescriptionTemplate:
      typeof params.eventDescriptionTemplate === "string"
        ? params.eventDescriptionTemplate
        : defaults.eventDescriptionTemplate,
    ownerTelegramChatId:
      typeof params.ownerTelegramChatId === "string"
        ? params.ownerTelegramChatId
        : defaults.ownerTelegramChatId,
    syncLeadToSheets:
      typeof params.syncLeadToSheets === "boolean"
        ? params.syncLeadToSheets
        : Boolean(
            (typeof params.leadSpreadsheetId === "string" && params.leadSpreadsheetId) ||
              (typeof params.leadSheetName === "string" && params.leadSheetName),
          ),
    leadSpreadsheetId:
      typeof params.leadSpreadsheetId === "string"
        ? params.leadSpreadsheetId
        : defaults.leadSpreadsheetId,
    leadSpreadsheetTitle:
      typeof params.leadSpreadsheetTitle === "string"
        ? params.leadSpreadsheetTitle
        : defaults.leadSpreadsheetTitle,
    leadSheetName:
      typeof params.leadSheetName === "string" ? params.leadSheetName : defaults.leadSheetName,
    leadHeaderRow:
      typeof params.leadHeaderRow === "number" && params.leadHeaderRow > 0
        ? params.leadHeaderRow
        : defaults.leadHeaderRow,
    leadColumns: {
      coupleName:
        typeof leadColumns.coupleName === "string"
          ? leadColumns.coupleName
          : defaults.leadColumns.coupleName,
      weddingDate:
        typeof leadColumns.weddingDate === "string"
          ? leadColumns.weddingDate
          : defaults.leadColumns.weddingDate,
      location:
        typeof leadColumns.location === "string"
          ? leadColumns.location
          : defaults.leadColumns.location,
      callDate:
        typeof leadColumns.callDate === "string"
          ? leadColumns.callDate
          : defaults.leadColumns.callDate,
      callTime:
        typeof leadColumns.callTime === "string"
          ? leadColumns.callTime
          : defaults.leadColumns.callTime,
      email:
        typeof leadColumns.email === "string" ? leadColumns.email : defaults.leadColumns.email,
      channel:
        typeof leadColumns.channel === "string"
          ? leadColumns.channel
          : defaults.leadColumns.channel,
    },
  };
}

export function getGoogleCalendarValidationErrors(step: StepLike) {
  const params = getGoogleCalendarParams(step);
  const errors: string[] = [];

  if (!params.timeZone.trim() || !isValidTimezone(params.timeZone.trim())) {
    errors.push("Google Calendar needs a valid IANA timezone.");
  }

  if (params.operation === "check_calendar") {
    if (params.availabilityDateSource === "literal" && !isIsoDateLiteral(params.availabilityDateValue)) {
      errors.push("Google Calendar availability lookup needs a fixed date in YYYY-MM-DD format.");
    }

    return errors;
  }

  if (params.bookingDateSource === "literal" && !isIsoDateLiteral(params.bookingDateValue)) {
    errors.push("Google Calendar booking needs a fixed booking date in YYYY-MM-DD format.");
  }

  if (params.bookingTimeSource === "literal" && !isCalendarTimeLiteral(params.bookingTimeValue)) {
    errors.push("Google Calendar booking needs a fixed booking time in HH:MM or am/pm format.");
  }

  if (params.inviteEmailSource === "literal" && !params.inviteEmailValue.trim()) {
    errors.push("Google Calendar booking needs a fixed invite email address.");
  } else if (params.inviteEmailSource === "literal" && !isEmailLiteral(params.inviteEmailValue)) {
    errors.push("Google Calendar booking needs a valid fixed invite email address.");
  }

  return errors;
}
