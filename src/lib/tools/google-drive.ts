import { Prisma } from "@prisma/client";
import { google } from "googleapis";

import {
  createGoogleOAuthClientFromEncryptedCredentials,
  parseGoogleDriveFileId,
} from "@/lib/google-api-client";

type DriveExecutionArgs = {
  action: string;
  params: Prisma.JsonValue;
  request: string;
  metadata?: Prisma.JsonValue | null;
  credentialsEnc?: string;
};

function asObject(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, Prisma.JsonValue>;
}

function asString(value: Prisma.JsonValue | null | undefined) {
  return typeof value === "string" ? value : "";
}

function parseDriveConfig(params: Prisma.JsonValue, metadata?: Prisma.JsonValue | null) {
  const config = asObject(params);
  const integrationMetadata = asObject(metadata);

  return {
    fileId: parseGoogleDriveFileId(asString(config?.fileId) || asString(integrationMetadata?.fileId)),
    fileName: asString(config?.fileName) || asString(integrationMetadata?.fileName),
    mimeType: asString(config?.mimeType) || asString(integrationMetadata?.mimeType),
    folderId: asString(config?.folderId) || asString(integrationMetadata?.folderId),
  };
}

function createDriveClient(credentialsEnc?: string) {
  if (!credentialsEnc) {
    return null;
  }

  const auth = createGoogleOAuthClientFromEncryptedCredentials(credentialsEnc);
  return google.drive({ version: "v3", auth });
}

export async function executeGoogleDriveStep(args: DriveExecutionArgs) {
  const config = parseDriveConfig(args.params, args.metadata);

  if (!args.credentialsEnc) {
    return {
      integration: "GOOGLE_DRIVE",
      status: "missing_credentials",
      action: args.action,
      summary: "This Google Drive integration does not have usable OAuth credentials.",
      request: args.request,
      params: args.params,
    };
  }

  if (!config.fileId) {
    return {
      integration: "GOOGLE_DRIVE",
      status: "needs_configuration",
      action: args.action,
      summary:
        "This Google Drive step needs a fileId in step params or integration metadata before it can attach or retrieve a file.",
      request: args.request,
      params: args.params,
      folderId: config.folderId || null,
    };
  }

  const drive = createDriveClient(args.credentialsEnc);

  if (!drive) {
    return {
      integration: "GOOGLE_DRIVE",
      status: "missing_credentials",
      action: args.action,
      summary: "This Google Drive integration does not have usable OAuth credentials.",
      request: args.request,
      params: args.params,
    };
  }

  const metadata = await drive.files.get({
    fileId: config.fileId,
    fields: "id,name,mimeType,webViewLink,webContentLink",
    supportsAllDrives: true,
  });

  return {
    integration: "GOOGLE_DRIVE",
    status: "attachment_ready",
    action: args.action,
    fileId: config.fileId,
    fileName: config.fileName || metadata.data.name || null,
    mimeType: config.mimeType || metadata.data.mimeType || null,
    webViewLink: metadata.data.webViewLink || null,
    webContentLink: metadata.data.webContentLink || null,
    attachment: {
      source: "google_drive",
      fileId: config.fileId,
      fileName: config.fileName || metadata.data.name || undefined,
      mimeType: config.mimeType || metadata.data.mimeType || undefined,
    },
    summary:
      "The Google Drive file is ready to attach to the outbound reply or use as a shareable asset in the response.",
    request: args.request,
    params: args.params,
  };
}
