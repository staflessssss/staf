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

test("integrations section surfaces blocking and idle dependency posture", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/components/stafless/workspace-sections/integrations-section.tsx"),
    "utf8",
  );

  assert.match(source, /Blocking/);
  assert.match(source, /Connected but idle/);
  assert.match(source, /Ready for runtime execution/);
  assert.match(source, /Blocking runtime execution/);
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
