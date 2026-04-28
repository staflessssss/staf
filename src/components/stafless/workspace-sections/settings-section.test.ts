import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { AgentStatus } from "@prisma/client";
import type { AgentSettingsConfig } from "@/lib/agent-config";

const settingsSectionPath = path.join(
  process.cwd(),
  "src/components/stafless/workspace-sections/settings-section.tsx",
);

const validSettings: AgentSettingsConfig = {
  defaultChatEnabled: true,
  timezone: "UTC",
  scheduleEnabled: true,
  weeklySchedule: [
    { day: "monday", enabled: true, start: "09:00", end: "18:00" },
    { day: "tuesday", enabled: false, start: "09:00", end: "18:00" },
    { day: "wednesday", enabled: false, start: "09:00", end: "18:00" },
    { day: "thursday", enabled: false, start: "09:00", end: "18:00" },
    { day: "friday", enabled: false, start: "09:00", end: "18:00" },
    { day: "saturday", enabled: false, start: "09:00", end: "18:00" },
    { day: "sunday", enabled: false, start: "09:00", end: "18:00" },
  ],
};

test("settings section treats bot status as pause and resume control", () => {
  const source = fs.readFileSync(settingsSectionPath, "utf8");

  assert.match(source, /Activate or pause this agent for incoming dialogs\./);
  assert.match(source, /checked \? AgentStatus\.ACTIVE : AgentStatus\.PAUSED/);
  assert.match(source, /disabled=\{!canToggleBotStatus\}/);
});

test("settings section does not expose a fake delete action", () => {
  const source = fs.readFileSync(settingsSectionPath, "utf8");

  assert.doesNotMatch(source, /Delete agent/);
  assert.match(source, />to<\/span>/);
});

async function loadSettingsSection() {
  const React = await import("react");
  (globalThis as typeof globalThis & { React: typeof React }).React = React;

  return import("@/components/stafless/workspace-sections/settings-section");
}

type ReactNodeLike = {
  type?: unknown;
  props?: Record<string, unknown> & {
    children?: unknown;
    onChange?: (event: { target: { value: string } }) => void;
    onCheckedChange?: (checked: boolean) => void;
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

test("settings section wires status, chat, timezone, and schedule callbacks", async () => {
  const { WorkspaceSettingsSection } = await loadSettingsSection();
  const nameChanges: string[] = [];
  const statusChanges: AgentStatus[] = [];
  const settingsPatches: Partial<AgentSettingsConfig>[] = [];

  const tree = WorkspaceSettingsSection({
    name: "Front desk",
    status: AgentStatus.ACTIVE,
    agentSettings: validSettings,
    tenantTimezone: "UTC",
    onNameChange: (value) => nameChanges.push(value),
    onStatusChange: (status) => statusChanges.push(status),
    onAgentSettingsChange: (patch) => settingsPatches.push(patch),
  });

  const nameInput = collectElements(
    tree,
    (element) => element.type === "input" && element.props?.value === "Front desk",
  )[0];
  nameInput?.props?.onChange?.({ target: { value: "Support agent" } });

  const statusSwitch = collectElements(
    tree,
    (element) =>
      element.props?.checked === true &&
      typeof element.props?.onCheckedChange === "function",
  )[0];
  statusSwitch?.props?.onCheckedChange?.(false);

  const timezoneSelect = collectElements(
    tree,
    (element) => element.type === "select" && element.props?.value === "UTC",
  )[0];
  timezoneSelect?.props?.onChange?.({ target: { value: "Europe/Moscow" } });

  assert.deepEqual(nameChanges, ["Support agent"]);
  assert.deepEqual(statusChanges, [AgentStatus.PAUSED]);
  assert.ok(settingsPatches.some((patch) => patch.timezone === "Europe/Moscow"));
});

test("settings section disables pause and resume for non-operational statuses", async () => {
  const { WorkspaceSettingsSection } = await loadSettingsSection();
  const statusChanges: AgentStatus[] = [];

  const tree = WorkspaceSettingsSection({
    name: "Front desk",
    status: AgentStatus.ERROR,
    agentSettings: validSettings,
    tenantTimezone: "UTC",
    onNameChange: () => undefined,
    onStatusChange: (status) => statusChanges.push(status),
    onAgentSettingsChange: () => undefined,
  });

  const switches = collectElements(
    tree,
    (element) => typeof element.props?.onCheckedChange === "function",
  );

  assert.equal(switches[0]?.props?.disabled, true);
  assert.deepEqual(statusChanges, []);
});

test("hasInvalidScheduleWindow only blocks enabled invalid windows", async () => {
  const { hasInvalidScheduleWindow } = await loadSettingsSection();

  assert.equal(hasInvalidScheduleWindow(validSettings), false);
  assert.equal(
    hasInvalidScheduleWindow({
      ...validSettings,
      weeklySchedule: validSettings.weeklySchedule.map((window, index) =>
        index === 0 ? { ...window, start: "18:00", end: "09:00" } : window,
      ),
    }),
    true,
  );
  assert.equal(
    hasInvalidScheduleWindow({
      ...validSettings,
      scheduleEnabled: false,
      weeklySchedule: validSettings.weeklySchedule.map((window, index) =>
        index === 0 ? { ...window, start: "18:00", end: "09:00" } : window,
      ),
    }),
    false,
  );
  assert.equal(
    hasInvalidScheduleWindow({
      ...validSettings,
      weeklySchedule: validSettings.weeklySchedule.map((window, index) =>
        index === 0
          ? { ...window, enabled: false, start: "18:00", end: "09:00" }
          : window,
      ),
    }),
    false,
  );
});
