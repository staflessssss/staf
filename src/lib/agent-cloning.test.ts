import assert from "node:assert/strict";
import test from "node:test";

import { IntegrationType } from "@prisma/client";

import {
  buildIntegrationIdMap,
  getExternalResourceReferences,
  getReferencedIntegrationIds,
  prepareClonedChannelConfig,
} from "@/lib/agent-cloning";

test("buildIntegrationIdMap maps source integrations to target integrations by type", () => {
  const mapping = buildIntegrationIdMap({
    source: [
      { id: "source-calendar", type: IntegrationType.GOOGLE_CALENDAR },
      { id: "source-sheets", type: IntegrationType.GOOGLE_SHEETS },
    ],
    target: [
      { id: "target-calendar", type: IntegrationType.GOOGLE_CALENDAR },
      { id: "target-sheets", type: IntegrationType.GOOGLE_SHEETS },
    ],
    referencedIds: ["source-calendar", "source-sheets"],
  });

  assert.equal(mapping.get("source-calendar"), "target-calendar");
  assert.equal(mapping.get("source-sheets"), "target-sheets");
});

test("buildIntegrationIdMap rejects a missing target integration", () => {
  assert.throws(
    () =>
      buildIntegrationIdMap({
        source: [{ id: "source-sheets", type: IntegrationType.GOOGLE_SHEETS }],
        target: [],
        referencedIds: ["source-sheets"],
      }),
    /needs a connected GOOGLE_SHEETS integration/,
  );
});

test("prepareClonedChannelConfig remaps integrations and removes deployment state", () => {
  const source = {
    runtimeType: "langgraph_wedding_sales",
    webhookUrl: "https://source.example/webhook",
    webhookPath: "/source",
    gmailWatch: { historyId: "123" },
    integrations: { enabledIds: ["source-calendar", "source-sheets"] },
    functionBlocks: [
      {
        name: "Check date",
        steps: [{ integrationId: "source-sheets", action: "check capacity" }],
      },
    ],
  };

  const result = prepareClonedChannelConfig(
    source,
    new Map([
      ["source-calendar", "target-calendar"],
      ["source-sheets", "target-sheets"],
    ]),
    {
      spreadsheetId: "target-spreadsheet",
      calendarId: "target-calendar-id",
      priceAttachmentFileId: "target-price-file",
    },
  );

  assert.equal(result.runtimeType, "langgraph_wedding_sales");
  assert.equal(result.webhookUrl, undefined);
  assert.equal(result.webhookPath, undefined);
  assert.equal(result.gmailWatch, undefined);
  assert.deepEqual((result.integrations as { enabledIds: string[] }).enabledIds, [
    "target-calendar",
    "target-sheets",
  ]);
  assert.equal(
    (
      result.functionBlocks as Array<{
        steps: Array<{ integrationId: string }>;
      }>
    )[0]?.steps[0]?.integrationId,
    "target-sheets",
  );
});

test("prepareClonedChannelConfig replaces tenant-specific resource IDs", () => {
  const result = prepareClonedChannelConfig(
    {
      priceAttachmentFileId: "source-file",
      functionBlocks: [
        {
          steps: [
            {
              integrationId: "source-sheets",
              params: {
                spreadsheetId: "source-sheet",
                leadSpreadsheetId: "source-lead-sheet",
                calendarId: "source-calendar-id",
              },
            },
          ],
        },
      ],
    },
    new Map([["source-sheets", "target-sheets"]]),
    {
      spreadsheetId: "target-sheet",
      calendarId: "target-calendar-id",
      priceAttachmentFileId: "target-file",
    },
  );
  const step = (
    result.functionBlocks as Array<{ steps: Array<{ params: Record<string, string> }> }>
  )[0]!.steps[0]!;

  assert.equal(result.priceAttachmentFileId, "target-file");
  assert.equal(step.params.spreadsheetId, "target-sheet");
  assert.equal(step.params.leadSpreadsheetId, "target-sheet");
  assert.equal(step.params.calendarId, "target-calendar-id");
});

test("prepareClonedChannelConfig strips tenant-specific owner Telegram chat IDs", () => {
  const result = prepareClonedChannelConfig(
    {
      functionBlocks: [
        {
          steps: [
            {
              integrationId: "source-calendar",
              params: JSON.stringify({
                calendarId: "source-calendar-id",
                ownerTelegramChatId: "source-owner-chat",
              }),
            },
          ],
        },
      ],
    },
    new Map([["source-calendar", "target-calendar"]]),
  );
  const step = (
    result.functionBlocks as Array<{ steps: Array<{ params: string }> }>
  )[0]!.steps[0]!;
  const params = JSON.parse(step.params) as Record<string, unknown>;

  assert.equal(params.ownerTelegramChatId, undefined);
  assert.equal(params.calendarId, "source-calendar-id");
});

test("getReferencedIntegrationIds includes enabled and function integration IDs once", () => {
  assert.deepEqual(
    getReferencedIntegrationIds({
      integrations: { enabledIds: ["drive", "sheets"] },
      functionBlocks: [{ steps: [{ integrationId: "sheets" }, { integrationId: "calendar" }] }],
    }),
    ["drive", "sheets", "calendar"],
  );
});

test("getExternalResourceReferences reports copied file and spreadsheet references", () => {
  assert.deepEqual(
    getExternalResourceReferences({
      priceAttachmentFileId: "file-1",
      functionBlocks: [{ steps: [{ params: { spreadsheetId: "sheet-1", range: "Bookings!A:A" } }] }],
      unrelatedId: "not-a-resource",
      serializedParams: JSON.stringify({ folderId: "folder-1" }),
    }),
    [
      { path: "priceAttachmentFileId", value: "file-1" },
      {
        path: "functionBlocks[0].steps[0].params.spreadsheetId",
        value: "sheet-1",
      },
      { path: "serializedParams.folderId", value: "folder-1" },
    ],
  );
});
