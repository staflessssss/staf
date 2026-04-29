import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("playbook section is exported as a shared section component", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/components/stafless/workspace-sections/playbook-section.tsx"),
    "utf8",
  );

  assert.match(source, /export function PlaybookSection\(/);
  assert.doesNotMatch(source, /export function WorkspacePlaybookSection\(/);
});

test("playbook section follows the clean workspace layout", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/components/stafless/workspace-sections/playbook-section.tsx"),
    "utf8",
  );

  assert.match(source, /max-w-\[720px\]/);
  assert.match(source, /title="Goal"/);
  assert.match(source, /title="Discovery"/);
  assert.match(source, /title="Rules before actions"/);
  assert.match(source, /title="Conversation behavior"/);
  assert.doesNotMatch(source, /Playbook direction/);
  assert.doesNotMatch(source, /Keep this universal/);
  assert.doesNotMatch(source, /radial-gradient/);
});

test("playbook section explains what each configuration group does", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/components/stafless/workspace-sections/playbook-section.tsx"),
    "utf8",
  );

  assert.match(source, /The main outcome the agent should push toward/);
  assert.match(source, /Selected fields become the agent's discovery checklist/);
  assert.match(source, /Required details before the agent checks a slot/);
  assert.match(source, /Required details before the agent shares price/);
  assert.match(source, /This is sent to the agent as behavior guidance/);
});

test("playbook section keeps all controls wired to workspace callbacks", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/components/stafless/workspace-sections/playbook-section.tsx"),
    "utf8",
  );

  assert.match(source, /onApplyPreset/);
  assert.match(source, /onUpdatePlaybook\(\{ primaryGoal \}\)/);
  assert.match(source, /onToggleDiscoveryField\(field, checked\)/);
  assert.match(source, /onToggleFieldArray\(group.key, field, event.target.checked\)/);
  assert.match(source, /onMoveDiscoveryOrder\(field, -1\)/);
  assert.match(source, /onMoveDiscoveryOrder\(field, 1\)/);
});
