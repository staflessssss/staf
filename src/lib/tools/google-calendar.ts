import { Prisma } from "@prisma/client";

type CalendarExecutionArgs = {
  action: string;
  params: Prisma.JsonValue;
  request: string;
  metadata?: Prisma.JsonValue | null;
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

  if (
    normalized.includes("book") ||
    normalized.includes("create") ||
    normalized.includes("schedule")
  ) {
    return "create_event";
  }

  return "calendar_lookup";
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
        "Calendar event creation was requested. The runtime accepted the instruction and recorded it as a simulated booking step until full calendar OAuth is wired.",
      request: args.request,
      params: args.params,
    };
  }

  return {
    integration: "GOOGLE_CALENDAR",
    mode: "simulated",
    status: "available",
    action: args.action,
    calendarId,
    summary:
      "Calendar availability lookup completed in shared runtime simulation mode. The configured Google Calendar connection is ready to be upgraded to direct API calls without changing the agent builder contract.",
    request: args.request,
    params: args.params,
  };
}
