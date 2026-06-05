import assert from "node:assert/strict";
import test from "node:test";

import { ConnectionStatus, IntegrationType } from "@prisma/client";

import type { RuntimeToolFeature, RuntimeToolStep } from "@/lib/agent-config";

import { createWeddingSalesToolContextFromFeatures } from "./tools";

const baseIntegration = {
  id: "integration-1",
  tenantId: "tenant-1",
  status: ConnectionStatus.CONNECTED,
  metadata: null,
  credentialsEnc: "credentials",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

function feature(args: {
  id: string;
  name: string;
  step: Omit<RuntimeToolStep, "id" | "functionId" | "integrationId" | "sortOrder">;
}): RuntimeToolFeature {
  return {
    id: args.id,
    agentId: "agent-1",
    name: args.name,
    description: args.name,
    sortOrder: 0,
    steps: [
      {
        id: `${args.id}-step`,
        functionId: args.id,
        integrationId: args.step.integration.id,
        sortOrder: 0,
        ...args.step,
      },
    ],
  };
}

test("wedding sales tool context maps booking to booking function, not calendar check", () => {
  const toolFeatures = [
    feature({
      id: "availability",
      name: "Check wedding availability",
      step: {
        action: "check capacity availability in sheet",
        params: { operation: "capacity_availability" },
        integration: {
          ...baseIntegration,
          id: "sheets-1",
          type: IntegrationType.GOOGLE_SHEETS,
        },
      },
    }),
    feature({
      id: "calendar-check",
      name: "Check consultation calendar",
      step: {
        action: "check consultation calendar availability",
        params: { calendarId: "calendar-check" },
        integration: {
          ...baseIntegration,
          id: "calendar-1",
          type: IntegrationType.GOOGLE_CALENDAR,
        },
      },
    }),
    feature({
      id: "calendar-book",
      name: "Book consultation call",
      step: {
        action: "book call and send invite",
        params: { calendarId: "calendar-book" },
        integration: {
          ...baseIntegration,
          id: "calendar-1",
          type: IntegrationType.GOOGLE_CALENDAR,
        },
      },
    }),
  ];

  const context = createWeddingSalesToolContextFromFeatures({
    tenantId: "tenant-1",
    toolFeatures,
  });

  assert.ok(context);
  assert.equal(context.consultationCalendar.action, "check consultation calendar availability");
  assert.equal(context.bookConsultation.action, "book call and send invite");
});

test("wedding sales tool context does not select write-style Sheets steps as availability", () => {
  const toolFeatures = [
    feature({
      id: "availability",
      name: "Check wedding availability",
      step: {
        action: "append row to sheet",
        params: { operation: "append_row" },
        integration: {
          ...baseIntegration,
          id: "sheets-1",
          type: IntegrationType.GOOGLE_SHEETS,
        },
      },
    }),
    feature({
      id: "calendar-check",
      name: "Check consultation calendar",
      step: {
        action: "check consultation calendar availability",
        params: { calendarId: "calendar-check" },
        integration: {
          ...baseIntegration,
          id: "calendar-1",
          type: IntegrationType.GOOGLE_CALENDAR,
        },
      },
    }),
    feature({
      id: "calendar-book",
      name: "Book consultation call",
      step: {
        action: "book call and send invite",
        params: { calendarId: "calendar-book" },
        integration: {
          ...baseIntegration,
          id: "calendar-1",
          type: IntegrationType.GOOGLE_CALENDAR,
        },
      },
    }),
  ];

  const context = createWeddingSalesToolContextFromFeatures({
    tenantId: "tenant-1",
    toolFeatures,
  });

  assert.equal(context, null);
});
