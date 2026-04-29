import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { getDefaultControlConfig } from "@/lib/agent-config";

const controlSectionPath = path.join(
  process.cwd(),
  "src/components/stafless/workspace-sections/control-section.tsx",
);

type ReactNodeLike = {
  type?: unknown;
  props?: Record<string, unknown> & {
    children?: unknown;
    disabled?: boolean;
    onChange?: (event: { target: { value: string } }) => void;
    onCheckedChange?: (checked: boolean) => void;
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

async function loadControlSection() {
  const React = await import("react");
  (globalThis as typeof globalThis & { React: typeof React }).React = React;

  return import("@/components/stafless/workspace-sections/control-section");
}

test("control section renders only live controls", () => {
  const source = fs.readFileSync(controlSectionPath, "utf8");

  assert.match(source, /Control/);
  assert.match(source, /History optimization/);
  assert.match(source, /Operator handoff/);
  assert.match(source, /User message limit/);
  assert.match(source, /Limit repeated messages/);
  assert.match(source, /Pause when operator replies/);
  assert.match(source, /Exception phrases/);
  assert.doesNotMatch(source, /Stop phrases/);
  assert.doesNotMatch(source, /Resume phrases/);
  assert.doesNotMatch(source, /SurfaceCard/);
});

test("control section wires history and user message limit controls", async () => {
  const { WorkspaceControlSection } = await loadControlSection();
  const updates: Array<Record<string, unknown>> = [];

  const tree = WorkspaceControlSection({
    control: {
      ...getDefaultControlConfig(),
      historyWindowType: "hybrid",
      maxMessages: 30,
      maxDays: 14,
      antiSpamEnabled: false,
      antiSpamMessageCount: 3,
      antiSpamWindowSeconds: 3600,
      antiSpamAutoReply: "",
      pauseOnOperatorIntervention: true,
      ignoreFirstOperatorMessage: false,
      autoResumeEnabled: false,
      autoResumeAfterValue: 3,
      autoResumeAfterUnit: "hours",
      resumeMessageEnabled: false,
      resumeMessage: "",
      operatorExceptionPhrases: [],
    },
    isReadOnlyMode: false,
    onUpdateControl: (patch) => updates.push(patch),
  });

  const text = textOf(tree);
  const toggles = collectElements(
    tree,
    (element) => typeof element.props?.onCheckedChange === "function",
  );
  const inputs = collectElements(tree, (element) => element.type === "input");
  const selects = collectElements(tree, (element) => element.type === "select");
  const textareas = collectElements(tree, (element) => element.type === "textarea");

  assert.match(text, /History window/);
  assert.match(text, /Message count limit/);
  assert.match(text, /Time limit/);
  assert.match(text, /Operator handoff/);
  assert.match(text, /Pause when operator replies/);
  assert.match(text, /Auto-resume/);
  assert.match(text, /Exception phrases/);
  assert.equal(inputs[1]?.props?.disabled, true);
  assert.equal(inputs[2]?.props?.disabled, true);
  assert.equal(textareas[2]?.props?.disabled, true);

  selects[0]?.props?.onChange?.({ target: { value: "message_count" } });
  inputs[0]?.props?.onChange?.({ target: { value: "20" } });
  selects[1]?.props?.onChange?.({ target: { value: "7" } });
  toggles[0]?.props?.onCheckedChange?.(true);
  toggles[1]?.props?.onCheckedChange?.(true);
  toggles[2]?.props?.onCheckedChange?.(true);
  selects[2]?.props?.onChange?.({ target: { value: "6" } });
  selects[3]?.props?.onChange?.({ target: { value: "hours" } });
  toggles[3]?.props?.onCheckedChange?.(true);
  textareas[0]?.props?.onChange?.({ target: { value: "The agent is back." } });
  textareas[1]?.props?.onChange?.({ target: { value: "FYI\ninternal note" } });
  toggles[4]?.props?.onCheckedChange?.(true);
  inputs[1]?.props?.onChange?.({ target: { value: "4" } });
  inputs[2]?.props?.onChange?.({ target: { value: "60" } });
  textareas[2]?.props?.onChange?.({ target: { value: "Please wait a moment." } });

  assert.deepEqual(updates, [
    { historyWindowType: "message_count" },
    { maxMessages: 20 },
    { maxDays: 7 },
    { pauseOnOperatorIntervention: true },
    { ignoreFirstOperatorMessage: true },
    { autoResumeEnabled: true },
    { autoResumeAfterValue: 6 },
    { autoResumeAfterUnit: "hours" },
    { resumeMessageEnabled: true },
    { resumeMessage: "The agent is back." },
    { operatorExceptionPhrases: ["FYI", "internal note"] },
    { antiSpamEnabled: true },
    { antiSpamMessageCount: 4 },
    { antiSpamWindowSeconds: 3600 },
    { antiSpamAutoReply: "Please wait a moment." },
  ]);
});
