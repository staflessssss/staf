import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { getDefaultChannelBehaviorConfig } from "@/lib/agent-config";
import { readMessageBehaviorConfig } from "@/lib/channels/message-behavior";

const messagesSectionPath = path.join(
  process.cwd(),
  "src/components/stafless/workspace-sections/messages-section.tsx",
);
const defaultFollowUpInstruction =
  "Check whether the user still needs help and ask one clear next-step question.";

type ReactNodeLike = {
  type?: unknown;
  props?: Record<string, unknown> & {
    children?: unknown;
    disabled?: boolean;
    onChange?: (event: { target: { value: string } }) => void;
    onCheckedChange?: (checked: boolean) => void;
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

async function loadMessagesSection() {
  const React = await import("react");
  (globalThis as typeof globalThis & { React: typeof React }).React = React;

  return import("@/components/stafless/workspace-sections/messages-section");
}

test("messages section is English and avoids fake schedule or notes controls", () => {
  const source = fs.readFileSync(messagesSectionPath, "utf8");

  assert.match(source, /Messages/);
  assert.match(source, /Message delivery/);
  assert.match(source, /Follow-up messages/);
  assert.doesNotMatch(source, /Schedule/);
  assert.doesNotMatch(source, /Internal notes/);
  assert.doesNotMatch(source, /notes:/);
  assert.doesNotMatch(source, /Р/);
});

test("messages section wires delivery controls without duplicating test chat", async () => {
  const { WorkspaceMessagesSection } = await loadMessagesSection();
  const updates: Array<Record<string, unknown>> = [];

  const tree = WorkspaceMessagesSection({
    channelBehavior: {
      ...getDefaultChannelBehaviorConfig(null),
      bufferDelaySeconds: 0,
      followUpEnabled: false,
      followUpRules: [],
    },
    isReadOnlyMode: false,
    onUpdateChannelBehavior: (patch) => updates.push(patch),
  });

  const text = textOf(tree);
  const toggles = collectElements(
    tree,
    (element) => typeof element.props?.onCheckedChange === "function",
  );
  const selects = collectElements(tree, (element) => element.type === "select");

  assert.match(text, /Split messages/);
  assert.match(text, /Message buffer/);
  assert.match(text, /Delayed follow-up/);
  assert.doesNotMatch(text, /Test chat/);
  assert.equal(selects[0]?.props?.disabled, true);

  toggles[0]?.props?.onCheckedChange?.(true);
  toggles[1]?.props?.onCheckedChange?.(true);
  toggles[2]?.props?.onCheckedChange?.(true);

  assert.deepEqual(updates, [
    { messageFormat: "split_into_2_3_messages" },
    { bufferDelaySeconds: 1 },
    {
      followUpEnabled: true,
      followUpRules: [
        {
          delayDays: 0,
          delayHours: 4,
          delayMinutes: 0,
          sendLimit: "once_per_dialog",
          outOfHoursBehavior: "send_immediately_ignore_schedule",
          instruction: defaultFollowUpInstruction,
        },
      ],
    },
  ]);
});

test("messages section edits follow-up rules", async () => {
  const { WorkspaceMessagesSection } = await loadMessagesSection();
  const updates: Array<Record<string, unknown>> = [];

  const tree = WorkspaceMessagesSection({
    channelBehavior: {
      ...getDefaultChannelBehaviorConfig(null),
      followUpEnabled: true,
      followUpRules: [
        {
          delayDays: 0,
          delayHours: 4,
          delayMinutes: 0,
          sendLimit: "once_per_dialog",
          outOfHoursBehavior: "send_immediately_ignore_schedule",
          instruction: "",
        },
      ],
    },
    isReadOnlyMode: false,
    onUpdateChannelBehavior: (patch) => updates.push(patch),
  });

  const inputs = collectElements(tree, (element) => element.type === "input");
  const selects = collectElements(tree, (element) => element.type === "select");
  const textareas = collectElements(tree, (element) => element.type === "textarea");
  const buttons = collectElements(tree, (element) => element.type === "button");

  inputs[0]?.props?.onChange?.({ target: { value: "1" } });
  selects[0]?.props?.onChange?.({ target: { value: "05" } });
  selects[1]?.props?.onChange?.({ target: { value: "15" } });
  selects[2]?.props?.onChange?.({ target: { value: "up_to_2_times_per_dialog" } });
  selects[3]?.props?.onChange?.({ target: { value: "wait_for_schedule_window" } });
  textareas[0]?.props?.onChange?.({ target: { value: "Ask if they still need help." } });
  buttons.find((button) => String(button.props?.["aria-label"]) === "Add follow-up rule")?.props?.onClick?.();
  buttons.find((button) => String(button.props?.["aria-label"]) === "Delete follow-up rule 1")?.props?.onClick?.();

  assert.deepEqual(updates[0], {
    followUpRules: [
      {
        delayDays: 1,
        delayHours: 4,
        delayMinutes: 0,
        sendLimit: "once_per_dialog",
        outOfHoursBehavior: "send_immediately_ignore_schedule",
        instruction: "",
      },
    ],
  });
  assert.deepEqual(updates[5], {
    followUpRules: [
      {
        delayDays: 0,
        delayHours: 4,
        delayMinutes: 0,
        sendLimit: "once_per_dialog",
        outOfHoursBehavior: "send_immediately_ignore_schedule",
        instruction: "Ask if they still need help.",
      },
    ],
  });
  assert.deepEqual(updates[6], {
    followUpRules: [
      {
        delayDays: 0,
        delayHours: 4,
        delayMinutes: 0,
        sendLimit: "once_per_dialog",
        outOfHoursBehavior: "send_immediately_ignore_schedule",
        instruction: "",
      },
      {
        delayDays: 0,
        delayHours: 4,
        delayMinutes: 0,
        sendLimit: "once_per_dialog",
        outOfHoursBehavior: "send_immediately_ignore_schedule",
        instruction: defaultFollowUpInstruction,
      },
    ],
  });
  assert.deepEqual(updates[7], {
    followUpEnabled: false,
    followUpRules: [],
  });
});

test("messages follow-up default is schedulable by runtime", () => {
  const runtimeBehavior = readMessageBehaviorConfig({
    channelBehavior: {
      ...getDefaultChannelBehaviorConfig(null),
      followUpEnabled: true,
      followUpRules: [
        {
          delayDays: 0,
          delayHours: 4,
          delayMinutes: 0,
          sendLimit: "once_per_dialog",
          outOfHoursBehavior: "send_immediately_ignore_schedule",
          instruction: defaultFollowUpInstruction,
        },
      ],
    },
  });

  assert.equal(runtimeBehavior.followUpEnabled, true);
  assert.equal(runtimeBehavior.followUpRules.length, 1);
  assert.equal(runtimeBehavior.followUpRules[0]?.instruction, defaultFollowUpInstruction);
});
