import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { FunctionBlockConfig } from "@/lib/agent-builder";

const createWizardPath = resolve(
  process.cwd(),
  "src/components/stafless/agent-create-wizard-client.tsx",
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

async function loadCreateWizardSerializers() {
  const React = await import("react");
  (globalThis as typeof globalThis & { React: typeof React }).React = React;

  return import("@/components/stafless/agent-create-wizard-client");
}

test("agent create wizard stays create-only and does not retain hidden workspace deploy scaffolding", () => {
  const source = readFileSync(createWizardPath, "utf8");

  assert.doesNotMatch(source, /shouldShowWorkspaceMessages/);
  assert.doesNotMatch(source, /shouldShowWorkspaceControl/);
  assert.doesNotMatch(source, /shouldShowWorkspaceIntegrations/);
  assert.doesNotMatch(source, /checkDeployReadiness/);
  assert.doesNotMatch(source, /deployCurrentAgent/);
  assert.doesNotMatch(source, /DeployReadinessResult/);
});

test("agent create wizard keeps prompt preview alive when function step JSON is invalid", () => {
  const source = readFileSync(createWizardPath, "utf8");

  assert.match(source, /const parsedFunctionBlocks = useMemo/);
  assert.match(source, /Fix invalid Functions configuration to restore the full prompt preview\./);
  assert.match(source, /Fix invalid Functions configuration before saving this agent\./);
  assert.match(source, /getGoogleCalendarValidationErrors/);
  assert.doesNotMatch(source, /throw new Error\(\s*`Function "\$\{fn\.name/);
});

test("agent create wizard routes functions through the shared FunctionsSection", () => {
  const source = readFileSync(createWizardPath, "utf8");

  assert.match(source, /import \{ FunctionsSection \} from "@\/components\/stafless\/workspace-sections\/functions-section"/);
  assert.match(source, /<FunctionsSection/);
  assert.match(source, /isWorkspaceMode=\{false\}/);
  assert.match(source, /functionBlocks: stripFunctionUiIds\(draft\.channelConfig\.functionBlocks\)/);
});

test("agent create wizard seeds draft and saved snapshot from one initial draft source", () => {
  const source = readFileSync(createWizardPath, "utf8");

  assert.match(source, /const initialDraft = useMemo\(\(\) => createInitialDraft\(tenant, agent\), \[agent, tenant\]\)/);
  assert.match(source, /const \[draft, setDraft\] = useState<BuilderDraft>\(initialDraft\)/);
  assert.match(source, /const \[savedDraftSnapshot, setSavedDraftSnapshot\] = useState\(\(\) => JSON\.stringify\(initialDraft\)\)/);
});

test("agent create wizard function draft UI ids round-trip without dropping persisted ids", async () => {
  const { stripFunctionUiIds, withFunctionUiIds } = await loadCreateWizardSerializers();
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
