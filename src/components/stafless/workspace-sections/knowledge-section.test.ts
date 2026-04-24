import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("knowledge section uses stable ui ids for reorderable items", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/components/stafless/workspace-sections/knowledge-section.tsx"),
    "utf8",
  );

  assert.match(source, /export function KnowledgeSection\(/);
  assert.match(source, /type KnowledgeDraft = \{\s*uiId: string;/);
  assert.match(source, /key=\{block\.uiId\}/);
  assert.doesNotMatch(source, /key=\{index\}/);
});
