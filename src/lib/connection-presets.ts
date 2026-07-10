import { ChannelType, ConnectionStatus, IntegrationType } from "@prisma/client";

import type {
  UpsertChannelConnectionInput,
  UpsertIntegrationConnectionInput,
} from "@/lib/connection-store";

export function buildPresetChannelConnection(
  tenantId: string,
  type: ChannelType,
): UpsertChannelConnectionInput {
  return {
    tenantId,
    type,
    status: ConnectionStatus.CONNECTED,
    credentials: `preset:${type.toLowerCase()}:connected`,
    metadata:
      type === ChannelType.GMAIL
        ? { provider: "google", access: ["gmail", "calendar", "sheets", "drive"] }
        : { provider: type.toLowerCase() },
  };
}

export function buildGmailWorkspacePresetIntegrations(
  tenantId: string,
): UpsertIntegrationConnectionInput[] {
  return [
    IntegrationType.GOOGLE_CALENDAR,
    IntegrationType.GOOGLE_SHEETS,
    IntegrationType.GOOGLE_DRIVE,
  ].map((type) => ({
    tenantId,
    type,
    status: ConnectionStatus.CONNECTED,
    credentials: `preset:${type.toLowerCase()}:connected`,
    metadata: { provider: "google", via: "gmail_workspace" },
  }));
}
