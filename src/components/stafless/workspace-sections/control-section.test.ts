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
  assert.match(source, /User message limit/);
  assert.match(source, /Limit repeated messages/);
  assert.doesNotMatch(source, /Operator intervention/);
  assert.doesNotMatch(source, /Pause when operator/);
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
  assert.equal(inputs[1]?.props?.disabled, true);
  assert.equal(inputs[2]?.props?.disabled, true);
  assert.equal(textareas[0]?.props?.disabled, true);

  selects[0]?.props?.onChange?.({ target: { value: "message_count" } });
  inputs[0]?.props?.onChange?.({ target: { value: "20" } });
  selects[1]?.props?.onChange?.({ target: { value: "7" } });
  toggles[0]?.props?.onCheckedChange?.(true);
  inputs[1]?.props?.onChange?.({ target: { value: "4" } });
  inputs[2]?.props?.onChange?.({ target: { value: "60" } });
  textareas[0]?.props?.onChange?.({ target: { value: "Please wait a moment." } });

  assert.deepEqual(updates, [
    { historyWindowType: "message_count" },
    { maxMessages: 20 },
    { maxDays: 7 },
    { antiSpamEnabled: true },
    { antiSpamMessageCount: 4 },
    { antiSpamWindowSeconds: 3600 },
    { antiSpamAutoReply: "Please wait a moment." },
  ]);
});
