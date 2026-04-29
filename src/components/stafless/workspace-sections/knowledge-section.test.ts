import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

type ReactNodeLike = {
  type?: unknown;
  props?: Record<string, unknown> & {
    children?: unknown;
    disabled?: boolean;
    maxLength?: number;
    onChange?: (event: { target: { value: string } }) => void;
    onClick?: () => void;
  };
};

function textOf(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(textOf).join("");
  if (typeof value !== "object") return "";

  return textOf((value as ReactNodeLike).props?.children);
}

function collectElements(node: unknown, predicate: (element: ReactNodeLike) => boolean) {
  const matches: ReactNodeLike[] = [];

  function visit(value: unknown) {
    if (!value) return;

    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }

    if (typeof value !== "object") return;

    const element = value as ReactNodeLike;
    if (predicate(element)) {
      matches.push(element);
    }

    visit(element.props?.children);
  }

  visit(node);
  return matches;
}

async function loadKnowledgeSection() {
  const React = await import("react");
  (globalThis as typeof globalThis & { React: typeof React }).React = React;

  return import("@/components/stafless/workspace-sections/knowledge-section");
}

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

test("knowledge section follows workspace surface and avoids nested canvas props", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/components/stafless/workspace-sections/knowledge-section.tsx"),
    "utf8",
  );

  assert.match(source, /max-w-\[920px\]/);
  assert.match(source, /Add the business facts the agent can rely on in conversation\./);
  assert.doesNotMatch(source, /SurfaceCard/);
  assert.doesNotMatch(source, /sectionCanvasClassName/);
});

test("knowledge section wires add, update, move, and delete controls", async () => {
  const { KnowledgeSection } = await loadKnowledgeSection();
  const updates: Array<{ index: number; patch: Record<string, string> }> = [];
  const moves: Array<{ index: number; direction: -1 | 1 }> = [];
  const removed: number[] = [];
  let added = 0;

  const tree = KnowledgeSection({
    blocks: [
      {
        uiId: "knowledge-1",
        name: "Pricing",
        description: "Use for price questions",
        knowledgeContent: "Starter package is $100.",
      },
      {
        uiId: "knowledge-2",
        name: "",
        description: "",
        knowledgeContent: "",
      },
    ],
    isReadOnlyMode: false,
    onAddBlock: () => {
      added += 1;
    },
    onUpdateBlock: (index, patch) => updates.push({ index, patch }),
    onMoveBlock: (index, direction) => moves.push({ index, direction }),
    onRemoveBlock: (index) => removed.push(index),
  });

  const text = textOf(tree);
  const inputs = collectElements(tree, (element) => element.type === "input");
  const textareas = collectElements(tree, (element) => element.type === "textarea");
  const buttons = collectElements(tree, (element) => element.type === "button");

  assert.match(text, /Pricing/);
  assert.match(text, /Untitled knowledge 2/);
  assert.match(text, /Ready/);
  assert.match(text, /Incomplete/);
  assert.equal(inputs[0]?.props?.maxLength, 120);
  assert.equal(textareas[0]?.props?.maxLength, 500);
  assert.equal(textareas[1]?.props?.maxLength, 10000);

  buttons.find((button) => textOf(button).includes("Add item"))?.props?.onClick?.();
  inputs[0]?.props?.onChange?.({ target: { value: "Updated pricing" } });
  textareas[0]?.props?.onChange?.({ target: { value: "Updated use case" } });
  textareas[1]?.props?.onChange?.({ target: { value: "Updated facts" } });
  buttons.find((button) => String(button.props?.["aria-label"]).includes("down"))?.props?.onClick?.();
  buttons.find((button) => String(button.props?.["aria-label"]).includes("Delete"))?.props?.onClick?.();

  assert.equal(added, 1);
  assert.deepEqual(updates, [
    { index: 0, patch: { name: "Updated pricing" } },
    { index: 0, patch: { description: "Updated use case" } },
    { index: 0, patch: { knowledgeContent: "Updated facts" } },
  ]);
  assert.deepEqual(moves, [{ index: 0, direction: 1 }]);
  assert.deepEqual(removed, [0]);
});
