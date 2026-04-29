import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { FunctionBlockConfig } from "@/lib/agent-config";

const workspaceClientPath = resolve(
  process.cwd(),
  "src/components/stafless/agent-workspace-client.tsx",
);

const functionBlockFixture: FunctionBlockConfig = {
  name: "Lead capture",
  description: "Capture and route a lead.",
  active: true,
  parameters: [
    {
      name: "email",
      type: "email",
      instruction: "Customer email",
      allowedValues: [],
      required: true,
    },
  ],
  reactionAction: "ai_agent_decides",
  postAction: "continue_dialog",
  disableDelayedMessages: false,
  resultTargets: [
    {
      type: "google_sheets",
      label: "Lead sheet",
      primaryStepId: "step_persisted",
    },
  ],
  steps: [
    {
      id: "step_persisted",
      integrationId: "integration_sheets",
      action: "append lead",
      params: "{}",
    },
    {
      integrationId: "integration_calendar",
      action: "check availability",
      params: "{}",
    },
  ],
};

async function loadWorkspaceSerializers() {
  const React = await import("react");
  (globalThis as typeof globalThis & { React: typeof React }).React = React;

  return import("@/components/stafless/agent-workspace-client");
}

test("agent workspace blocks saving when Functions still contain invalid configuration", () => {
  const source = readFileSync(workspaceClientPath, "utf8");

  assert.match(source, /Fix invalid Functions configuration before saving this agent\./);
  assert.match(source, /getGoogleCalendarValidationErrors/);
});

test("agent workspace blocks saving when Settings schedule windows are invalid", () => {
  const source = readFileSync(workspaceClientPath, "utf8");

  assert.match(source, /hasInvalidScheduleWindow\(draft\.channelConfig\.agentSettings\)/);
  assert.match(source, /Fix invalid Settings schedule windows before saving this agent\./);
});

test("agent workspace removes the review rail and keeps save actions in the main flow", () => {
  const source = readFileSync(workspaceClientPath, "utf8");

  assert.doesNotMatch(source, /Workspace review/);
  assert.doesNotMatch(source, /<Checklist/);
  assert.match(source, /Open test section/);
  assert.match(source, /Save changes/);
});

test("agent workspace blocks saving incomplete Knowledge items", () => {
  const source = readFileSync(workspaceClientPath, "utf8");

  assert.match(source, /hasIncompleteKnowledgeBlocks\(draft\.knowledgeBlocks\)/);
  assert.match(source, /Complete or remove empty Knowledge items before saving this agent\./);
});

test("agent workspace does not inject sample Knowledge into empty drafts", () => {
  const source = readFileSync(workspaceClientPath, "utf8");

  assert.doesNotMatch(source, /sampleKnowledge/);
  assert.doesNotMatch(source, /knowledge_sample_service_scope/);
  assert.doesNotMatch(source, /wedding videography/);
  assert.match(source, /knowledgeBlocks,/);
});

test("agent workspace clears hidden legacy prompting language and visibility fields on save", () => {
  const source = readFileSync(workspaceClientPath, "utf8");

  assert.match(source, /const promptingForPayload = normalizePromptingConfig\(\{/);
  assert.match(source, /languagePreference: null/);
  assert.match(source, /showChannelContext: false/);
  assert.match(source, /showContactIdentity: false/);
  assert.match(source, /languagePreference: undefined/);
  assert.match(source, /prompting: promptingForPayload/);
});

test("agent workspace function draft UI ids round-trip without dropping persisted ids", async () => {
  const { stripFunctionUiIds, withFunctionUiIds } = await loadWorkspaceSerializers();
  const draft = withFunctionUiIds(functionBlockFixture);
  const [stripped] = stripFunctionUiIds([draft]);

  assert.ok(draft.uiId);
  assert.ok(draft.parameters[0]?.uiId);
  assert.ok(draft.resultTargets[0]?.uiId);
  assert.ok(draft.steps[0]?.uiId);
  assert.equal(stripped.resultTargets[0]?.primaryStepId, "step_persisted");
  assert.equal(stripped.steps[0]?.id, "step_persisted");
  assert.equal(stripped.steps[1]?.id, undefined);
  assert.equal("uiId" in stripped, false);
  assert.equal("uiId" in stripped.parameters[0], false);
  assert.equal("uiId" in stripped.resultTargets[0], false);
  assert.equal("uiId" in stripped.steps[0], false);
});
