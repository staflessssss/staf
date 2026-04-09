import { Prisma } from "@prisma/client";

type DriveExecutionArgs = {
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

export async function executeGoogleDriveStep(args: DriveExecutionArgs) {
  const metadata = asObject(args.metadata);
  const folderId = typeof metadata?.folderId === "string" ? metadata.folderId : "connected-drive";

  return {
    integration: "GOOGLE_DRIVE",
    mode: "simulated",
    status: "retrieved",
    action: args.action,
    folderId,
    summary:
      "The Google Drive step executed in runtime simulation mode and returned a retrieval-ready result for the requested file context.",
    request: args.request,
    params: args.params,
  };
}
