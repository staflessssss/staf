import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const createWizardPath = resolve(
  process.cwd(),
  "src/components/stafless/agent-create-wizard-client.tsx",
);

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
