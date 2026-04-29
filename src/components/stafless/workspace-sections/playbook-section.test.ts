import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  type ConversationPlaybookConfig,
  type DiscoveryField,
  getConversationPlaybookPreset,
} from "@/lib/agent-config";

type ReactNodeLike = {
  type?: unknown;
  props?: Record<string, unknown> & {
    children?: unknown;
    checked?: boolean;
    disabled?: boolean;
    onChange?: (event: { target: { checked: boolean; value: string } }) => void;
    onClick?: () => void;
    value?: string;
  };
};

function textOf(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(textOf).join("");
  if (typeof value !== "object") return "";

  const element = value as ReactNodeLike;
  if (typeof element.type === "function") {
    return textOf((element.type as (props: unknown) => unknown)(element.props));
  }

  return textOf(element.props?.children);
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

    if (typeof element.type === "function") {
      visit((element.type as (props: unknown) => unknown)(element.props));
      return;
    }

    visit(element.props?.children);
  }

  visit(node);
  return matches;
}

async function loadPlaybookSection() {
  const React = await import("react");
  (globalThis as typeof globalThis & { React: typeof React }).React = React;

  return import("@/components/stafless/workspace-sections/playbook-section");
}

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

test("playbook section controls emit real playbook updates", async () => {
  const { PlaybookSection } = await loadPlaybookSection();
  const playbook = getConversationPlaybookPreset("general_lead_capture");
  const labels: Record<DiscoveryField, string> = {
    customer_name: "Customer name",
    service_needed: "Service needed",
    preferred_date: "Preferred date",
    preferred_time: "Preferred time",
    location_or_branch: "Location or branch",
    budget: "Budget",
    urgency: "Urgency",
    preferred_specialist: "Preferred specialist",
    contact_preference: "Contact preference",
    notes_or_special_request: "Notes or special request",
  };
  const presets: ConversationPlaybookConfig["preset"][] = [];
  const patches: Partial<ConversationPlaybookConfig>[] = [];
  const discoveryToggles: Array<{ field: DiscoveryField; checked: boolean }> = [];
  const fieldArrayToggles: Array<{
    key: "openingFields" | "minInfoBeforeAvailability" | "minInfoBeforePricing";
    field: DiscoveryField;
    checked: boolean;
  }> = [];
  const moves: Array<{ field: DiscoveryField; direction: -1 | 1 }> = [];

  const tree = PlaybookSection({
    playbook,
    discoveryFieldLabels: labels,
    isReadOnlyMode: false,
    onApplyPreset: (preset) => presets.push(preset),
    onUpdatePlaybook: (patch) => patches.push(patch),
    onToggleDiscoveryField: (field, checked) => discoveryToggles.push({ field, checked }),
    onToggleFieldArray: (key, field, checked) =>
      fieldArrayToggles.push({ key, field, checked }),
    onMoveDiscoveryOrder: (field, direction) => moves.push({ field, direction }),
  });

  const text = textOf(tree);
  const selects = collectElements(tree, (element) => element.type === "select");
  const checkboxes = collectElements(tree, (element) => element.type === "input");
  const textareas = collectElements(tree, (element) => element.type === "textarea");
  const buttons = collectElements(tree, (element) => element.type === "button");

  assert.match(text, /Goal/);
  assert.match(text, /Discovery/);
  assert.match(text, /Rules before actions/);
  assert.match(text, /Conversation behavior/);

  selects[0]?.props?.onChange?.({
    target: { checked: false, value: "appointment_booking" },
  });
  selects[1]?.props?.onChange?.({
    target: { checked: false, value: "book_appointment" },
  });
  selects[2]?.props?.onChange?.({
    target: { checked: false, value: "booking_completed" },
  });
  selects[3]?.props?.onChange?.({
    target: { checked: false, value: "ask_one_thing_first" },
  });
  checkboxes[5]?.props?.onChange?.({
    target: { checked: true, value: "" },
  });
  buttons
    .find((button) => String(button.props?.["aria-label"]).includes("down"))
    ?.props?.onClick?.();
  checkboxes[10]?.props?.onChange?.({
    target: { checked: false, value: "" },
  });
  selects[4]?.props?.onChange?.({
    target: { checked: false, value: "after_qualification" },
  });
  textareas[0]?.props?.onChange?.({
    target: { checked: false, value: "Ask for service details before quoting." },
  });

  assert.deepEqual(presets, ["appointment_booking"]);
  assert.deepEqual(patches.slice(0, 3), [
    { primaryGoal: "book_appointment" },
    { successAction: "booking_completed" },
    { openingStrategy: "ask_one_thing_first" },
  ]);
  assert.deepEqual(discoveryToggles, [{ field: "budget", checked: true }]);
  assert.deepEqual(moves, [{ field: "customer_name", direction: 1 }]);
  assert.deepEqual(fieldArrayToggles, [
    { key: "openingFields", field: "customer_name", checked: false },
  ]);
  assert.deepEqual(patches.slice(3), [
    { pricingBehavior: "after_qualification" },
    { notes: "Ask for service details before quoting." },
  ]);
});

test("draft test chat prompt includes unsaved playbook settings", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/app/api/agent/invoke/route.ts"),
    "utf8",
  );

  assert.match(
    source,
    /conversationPlaybook:\s*parsed\.data\.draft\.channelConfig\.conversationPlaybook/,
  );
});
