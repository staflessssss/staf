import test from "node:test";
import assert from "node:assert/strict";
import { FeatureType } from "@prisma/client";

import {
  type SerializableEditorAgent,
  serializeEditorAgent,
} from "@/components/stafless/agent-editor-shared";
import { type FunctionBlockConfig } from "@/lib/agent-builder";

function asFeatures(features: unknown): SerializableEditorAgent["features"] {
  return features as SerializableEditorAgent["features"];
}

function makeAgent(overrides: Partial<SerializableEditorAgent> = {}): SerializableEditorAgent {
  return {
    id: "agent-1",
    name: "Studio Concierge",
    persona: "Helpful assistant",
    tone: "friendly",
    languagePreference: null,
    status: "DRAFT",
    deployedAt: new Date("2026-04-28T10:00:00.000Z"),
    channelId: "channel-1",
    channelConfig: null,
    channel: { id: "channel-1", type: "TELEGRAM" } as SerializableEditorAgent["channel"],
    features: [],
    ...overrides,
  };
}

function getSerializedFunctionBlocks(agent: SerializableEditorAgent) {
  const serialized = serializeEditorAgent(agent);
  assert.ok(serialized);

  const channelConfig = serialized.channelConfig as Record<string, unknown>;
  return channelConfig.functionBlocks as FunctionBlockConfig[];
}

test("serializeEditorAgent returns empty functionBlocks when channelConfig functionBlocks is missing, even if legacy TOOL features exist", () => {
  const functionBlocks = getSerializedFunctionBlocks(
    makeAgent({
      features: asFeatures([
        {
          type: FeatureType.TOOL,
          name: "Calendar check",
          description: "Verify availability",
          steps: [
            {
              integrationId: "integration-1",
              action: "check_calendar",
              params: { window: "30d" },
            },
          ],
        },
      ]),
    }),
  );

  assert.deepEqual(functionBlocks, []);
});

test("serializeEditorAgent preserves existing channelConfig functionBlocks and ignores legacy TOOL features", () => {
  const existingFunctionBlocks: FunctionBlockConfig[] = [
    {
      name: "Existing function",
      description: "Already migrated",
      active: true,
      parameters: [],
      reactionAction: "ai_agent_decides",
      postAction: "continue_dialog",
      disableDelayedMessages: false,
      resultTargets: [],
      steps: [
        {
          id: "step-1",
          integrationId: "integration-existing",
          action: "append_row",
          params: { sheet: "Leads" },
        },
      ],
    },
  ];

  const functionBlocks = getSerializedFunctionBlocks(
    makeAgent({
      channelConfig: {
        functionBlocks: existingFunctionBlocks,
      } as unknown as SerializableEditorAgent["channelConfig"],
      features: asFeatures([
        {
          type: FeatureType.TOOL,
          name: "Legacy function",
          description: "Should not be used",
          steps: [
            {
              integrationId: "integration-legacy",
              action: "check_calendar",
              params: {},
            },
          ],
        },
      ]),
    }),
  );

  assert.equal(functionBlocks.length, 1);
  assert.equal(functionBlocks[0]?.name, "Existing function");
  assert.equal(functionBlocks[0]?.steps[0]?.integrationId, "integration-existing");
});

test("serializeEditorAgent returns empty functionBlocks when channelConfig functionBlocks is missing", () => {
  const functionBlocks = getSerializedFunctionBlocks(
    makeAgent({
      channelConfig: null,
      features: [],
    }),
  );

  assert.deepEqual(functionBlocks, []);
});

test("serializeEditorAgent keeps deployedAt as an ISO string", () => {
  const serialized = serializeEditorAgent(makeAgent());

  assert.equal(serialized?.deployedAt, "2026-04-28T10:00:00.000Z");
});
