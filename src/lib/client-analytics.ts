import { type Message, type Prisma } from "@prisma/client";

type ToolMessage = Pick<Message, "toolName" | "toolResult" | "createdAt">;

function asObject(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, Prisma.JsonValue>;
}

function getStepResults(value: Prisma.JsonValue | null | undefined) {
  const objectValue = asObject(value);
  const steps = objectValue?.steps;

  if (!Array.isArray(steps)) {
    return [];
  }

  return steps
    .map((step) => asObject(step)?.result)
    .map((result) => asObject(result))
    .filter((result): result is Record<string, Prisma.JsonValue> => Boolean(result));
}

function getStringFromObject(objectValue: Record<string, Prisma.JsonValue> | null, keys: string[]) {
  if (!objectValue) {
    return null;
  }

  for (const key of keys) {
    const value = objectValue[key];

    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return null;
}

function getNumberFromObject(objectValue: Record<string, Prisma.JsonValue> | null, keys: string[]) {
  if (!objectValue) {
    return null;
  }

  for (const key of keys) {
    const value = objectValue[key];

    if (typeof value === "number") {
      return value;
    }
  }

  return null;
}

function titleCase(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function getToolActionLabel(toolName?: string | null) {
  switch (toolName) {
    case "check_wedding_availability":
      return "Availability checked";
    case "check_consultation_calendar":
      return "Calendar checked";
    case "book_consultation":
      return "Consultation booked";
    default:
      return toolName ? titleCase(toolName) : "Agent action";
  }
}

export function getToolStatusLabel(toolResult: Prisma.JsonValue | null | undefined) {
  const directResult = asObject(toolResult);
  const status = getStringFromObject(directResult, ["status"]);

  return status ? titleCase(status) : "Completed";
}

export function getToolSummary(toolResult: Prisma.JsonValue | null | undefined) {
  const directResult = asObject(toolResult);
  const stepSummary = getStepResults(toolResult)
    .map((step) => getStringFromObject(step, ["summary", "result", "reason"]))
    .find(Boolean);

  return getStringFromObject(directResult, ["summary", "result", "reason"]) ?? stepSummary ?? null;
}

export function getLeadDetails(message: ToolMessage, contactId: string) {
  const directResult = asObject(message.toolResult);
  const stepResults = getStepResults(message.toolResult);
  const sources = [directResult, ...stepResults];
  const findString = (keys: string[]) =>
    sources.map((source) => getStringFromObject(source, keys)).find(Boolean) ?? null;
  const findNumber = (keys: string[]) =>
    sources.map((source) => getNumberFromObject(source, keys)).find((value) => value !== null) ?? null;

  return {
    contactId,
    action: getToolActionLabel(message.toolName),
    status: getToolStatusLabel(message.toolResult),
    summary: getToolSummary(message.toolResult),
    coupleName: findString(["coupleName", "names", "name"]),
    email: findString(["email"]) ?? contactId,
    weddingDate: findString(["weddingDate", "requestedDate", "date"]),
    location: findString(["location", "region", "requestedRegion"]),
    callDate: findString(["callDate", "date"]),
    callTime: findString(["callTime", "time"]),
    channel: findString(["channel"]),
    mode: findString(["mode"]),
    eventId: findString(["eventId"]),
    meetLink: findString(["meetLink"]),
    bookedCount: findNumber(["bookedCount", "booked_count"]),
    capacity: findNumber(["capacity"]),
    capturedAt: message.createdAt,
  };
}

export const clientAnalyticsTestHelpers = {
  getLeadDetails,
  getToolActionLabel,
  getToolStatusLabel,
  getToolSummary,
};
