import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("integrations section is exported as a neutral section component", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/components/stafless/workspace-sections/integrations-section.tsx"),
    "utf8",
  );

  assert.match(source, /export function IntegrationsSection\(/);
  assert.doesNotMatch(source, /export function WorkspaceIntegrationsSection\(/);
});

test("integrations section uses available and disconnected tabs with real toggles", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/components/stafless/workspace-sections/integrations-section.tsx"),
    "utf8",
  );

  assert.match(source, /Доступные/);
  assert.match(source, /Не подключены/);
  assert.match(source, /ToggleSwitch/);
  assert.match(source, /onIntegrationEnabledChange/);
  assert.doesNotMatch(source, /Connection management remains a separate surface/);
});

test("integrations section reads a human identity hint from metadata when available", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/components/stafless/workspace-sections/integrations-section.tsx"),
    "utf8",
  );

  assert.match(source, /function readIntegrationIdentityHint/);
  assert.match(source, /provider/);
  assert.match(source, /via/);
});

test("integrations section renders disconnected catalog entries as disabled cards", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/components/stafless/workspace-sections/integrations-section.tsx"),
    "utf8",
  );

  assert.match(source, /Object\.values\(IntegrationType\)/);
  assert.match(source, /NOT_CONNECTED/);
  assert.match(source, /disabled=\{!isAvailable \|\| !integration\.id\}/);
});
