import test from "node:test";
import assert from "node:assert/strict";
import { AgentStatus, FeatureType } from "@prisma/client";

import {
  agentDraftSchema,
  buildFeatureCreateInput,
  buildMultilingualGuidance,
  formatEnumLabel,
  getToolIntegrationIds,
} from "@/lib/agent-builder";

test("agentDraftSchema normalizes empty language preference to null", () => {
  const parsed = agentDraftSchema.parse({
    name: "Studio Concierge",
    persona: "Helpful assistant",
    tone: "friendly",
    languagePreference: "",
    channelId: "channel-1",
  });

  assert.equal(parsed.languagePreference, null);
  assert.equal(parsed.status, AgentStatus.DRAFT);
});

test("buildFeatureCreateInput preserves knowledge before tools and creates tool steps", () => {
  const input = agentDraftSchema.parse({
    name: "Studio Concierge",
    persona: "Helpful assistant",
    tone: "friendly",
    channelId: "channel-1",
    knowledgeBlocks: [
      {
        name: "Services",
        description: "What the studio offers",
        knowledgeContent: "Wedding films and highlight edits.",
      },
    ],
    toolBlocks: [
      {
        name: "Calendar check",
        description: "Verify availability",
        steps: [
          {
            integrationId: "integration-1",
            action: "check calendar",
            params: { window: "30d" },
          },
        ],
      },
    ],
  });

  const features = buildFeatureCreateInput(input);

  assert.equal(features.length, 2);
  assert.equal(features[0]?.type, FeatureType.KNOWLEDGE);
  assert.equal(features[0]?.sortOrder, 0);
  assert.equal(features[1]?.type, FeatureType.TOOL);
  assert.equal(features[1]?.sortOrder, 1);

  const createdSteps = features[1]?.steps;
  assert.ok(createdSteps && "create" in createdSteps);
});

test("getToolIntegrationIds returns unique ids only", () => {
  const input = agentDraftSchema.parse({
    name: "Studio Concierge",
    persona: "Helpful assistant",
    tone: "friendly",
    channelId: "channel-1",
    toolBlocks: [
      {
        name: "Calendar check",
        description: "Verify availability",
        steps: [
          {
            integrationId: "integration-1",
            action: "check calendar",
            params: {},
          },
          {
            integrationId: "integration-1",
            action: "create hold",
            params: {},
          },
        ],
      },
    ],
  });

  assert.deepEqual(getToolIntegrationIds(input), ["integration-1"]);
});

test("buildMultilingualGuidance defaults to multilingual-first behavior", () => {
  const guidance = buildMultilingualGuidance({
    channel: { type: "TELEGRAM" },
  });

  assert.match(guidance, /customer's language/i);
  assert.match(guidance, /No default response language is pinned/i);
  assert.match(guidance, /Telegram/);
});

test("formatEnumLabel humanizes enum-like strings", () => {
  assert.equal(formatEnumLabel("GOOGLE_CALENDAR"), "Google Calendar");
});
