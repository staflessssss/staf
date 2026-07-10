import assert from "node:assert/strict";
import test from "node:test";
import { ChannelType, ConnectionStatus, IntegrationType } from "@prisma/client";

import {
  buildGmailWorkspacePresetIntegrations,
  buildPresetChannelConnection,
} from "@/lib/connection-presets";

test("Gmail preset connects the Gmail channel and all Google Workspace integrations", () => {
  assert.deepEqual(buildPresetChannelConnection("tenant-1", ChannelType.GMAIL), {
    tenantId: "tenant-1",
    type: ChannelType.GMAIL,
    status: ConnectionStatus.CONNECTED,
    credentials: "preset:gmail:connected",
    metadata: {
      provider: "google",
      access: ["gmail", "calendar", "sheets", "drive"],
    },
  });

  assert.deepEqual(buildGmailWorkspacePresetIntegrations("tenant-1"), [
    {
      tenantId: "tenant-1",
      type: IntegrationType.GOOGLE_CALENDAR,
      status: ConnectionStatus.CONNECTED,
      credentials: "preset:google_calendar:connected",
      metadata: { provider: "google", via: "gmail_workspace" },
    },
    {
      tenantId: "tenant-1",
      type: IntegrationType.GOOGLE_SHEETS,
      status: ConnectionStatus.CONNECTED,
      credentials: "preset:google_sheets:connected",
      metadata: { provider: "google", via: "gmail_workspace" },
    },
    {
      tenantId: "tenant-1",
      type: IntegrationType.GOOGLE_DRIVE,
      status: ConnectionStatus.CONNECTED,
      credentials: "preset:google_drive:connected",
      metadata: { provider: "google", via: "gmail_workspace" },
    },
  ]);
});

test("non-Gmail preset channels stay channel-only", () => {
  assert.deepEqual(buildPresetChannelConnection("tenant-1", ChannelType.TELEGRAM), {
    tenantId: "tenant-1",
    type: ChannelType.TELEGRAM,
    status: ConnectionStatus.CONNECTED,
    credentials: "preset:telegram:connected",
    metadata: { provider: "telegram" },
  });
});
