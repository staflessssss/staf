import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const promptingSectionPath = path.join(
  process.cwd(),
  "src/components/stafless/workspace-sections/prompting-section.tsx",
);

type ReactNodeLike = {
  type?: unknown;
  props?: Record<string, unknown> & {
    children?: unknown;
    onChange?: (event: { target: { value: string } }) => void;
  };
};

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

async function loadPromptingSection() {
  const React = await import("react");
  (globalThis as typeof globalThis & { React: typeof React }).React = React;

  return import("@/components/stafless/workspace-sections/prompting-section");
}

test("prompting section does not expose fake actions or runtime visibility toggles", () => {
  const source = fs.readFileSync(promptingSectionPath, "utf8");

  assert.match(source, /Define the agent(?:'|&apos;)s behavior, voice, and core instruction layer\./);
  assert.doesNotMatch(source, /AI polish/);
  assert.doesNotMatch(source, /Edit agent/);
  assert.doesNotMatch(source, /Prompt templates/);
  assert.doesNotMatch(source, /Expand instruction/);
  assert.doesNotMatch(source, /Preferred response language/);
  assert.doesNotMatch(source, /Contact identity visibility/);
  assert.doesNotMatch(source, /Messenger visibility/);
  assert.doesNotMatch(source, /href="#"/);
});

test("prompting section wires only instruction, persona, tone, and operator notes", async () => {
  const { WorkspacePromptingSection } = await loadPromptingSection();
  const changes: Record<string, string[]> = {
    instruction: [],
    notes: [],
    persona: [],
    tone: [],
  };

  const tree = WorkspacePromptingSection({
    isReadOnlyMode: false,
    tone: "professional",
    persona: "Support operator",
    promptingInstruction: "Answer clearly.",
    promptingNotes: "Keep it short.",
    onToneChange: (value) => changes.tone.push(value),
    onPersonaChange: (value) => changes.persona.push(value),
    onPromptingInstructionChange: (value) => changes.instruction.push(value),
    onPromptingNotesChange: (value) => changes.notes.push(value),
  });

  const editable = collectElements(
    tree,
    (element) => element.type === "textarea" || element.type === "input",
  );
  const buttons = collectElements(tree, (element) => element.type === "button");
  const links = collectElements(tree, (element) => element.type === "a");

  assert.equal(editable.length, 4);
  assert.equal(buttons.length, 0);
  assert.equal(links.length, 0);

  editable.forEach((element, index) => {
    element.props?.onChange?.({ target: { value: `value-${index}` } });
  });

  assert.deepEqual(changes.instruction, ["value-0"]);
  assert.deepEqual(changes.persona, ["value-1"]);
  assert.deepEqual(changes.tone, ["value-2"]);
  assert.deepEqual(changes.notes, ["value-3"]);
});
