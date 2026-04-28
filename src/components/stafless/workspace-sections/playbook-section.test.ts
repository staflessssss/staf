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
