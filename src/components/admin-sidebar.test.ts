import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const adminSidebarPath = resolve(process.cwd(), "src/components/admin-sidebar.tsx");

test("admin agent sidebar keeps test chat out of workspace navigation", () => {
  const source = readFileSync(adminSidebarPath, "utf8");

  assert.match(source, /id: "channels"/);
  assert.match(source, /id: "playbook"/);
  assert.doesNotMatch(source, /id: "test"/);
  assert.doesNotMatch(source, /FlaskConical/);
});
