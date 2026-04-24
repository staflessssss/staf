import { Prisma } from "@prisma/client";

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

export function isQualifiedLeadToolMessage(args: {
  toolName?: string | null;
  toolResult?: Prisma.JsonValue | null;
}) {
  const normalizedToolName = (args.toolName ?? "").toLowerCase();
  const resultObject = asObject(args.toolResult);

  if (normalizedToolName.includes("book")) {
    if (resultObject?.status === "booked" || typeof resultObject?.eventId === "string") {
      return true;
    }

    return getStepResults(args.toolResult).some(
      (stepResult) =>
        stepResult.status === "booked" ||
        typeof stepResult.eventId === "string" ||
        stepResult.action === "create calendar event",
    );
  }

  return false;
}

export const leadQualificationTestHelpers = {
  isQualifiedLeadToolMessage,
};
