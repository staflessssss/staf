import { Prisma } from "@prisma/client";

type SheetsExecutionArgs = {
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

export async function executeGoogleSheetsStep(args: SheetsExecutionArgs) {
  const metadata = asObject(args.metadata);
  const spreadsheetId =
    typeof metadata?.spreadsheetId === "string" ? metadata.spreadsheetId : "connected-sheet";

  return {
    integration: "GOOGLE_SHEETS",
    mode: "simulated",
    status: "logged",
    action: args.action,
    spreadsheetId,
    summary:
      "The Google Sheets step executed in runtime simulation mode and produced a log-style result for this request.",
    request: args.request,
    params: args.params,
  };
}
