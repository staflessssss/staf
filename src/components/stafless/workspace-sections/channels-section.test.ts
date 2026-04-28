import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { ChannelConnection, ChannelType, ConnectionStatus } from "@prisma/client";

const channelsSectionPath = path.join(
  process.cwd(),
  "src/components/stafless/workspace-sections/channels-section.tsx",
);

type ReactNodeLike = {
  type?: unknown;
  props?: Record<string, unknown> & {
    children?: unknown;
    onClick?: () => void;
  };
};

function createChannel(
  id: string,
  type: ChannelType,
  status: ConnectionStatus,
): ChannelConnection {
  return {
    id,
    tenantId: "tenant-1",
    type,
    status,
    credentialsEnc: "encrypted",
    metadata: { provider: type.toLowerCase() },
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

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

async function loadChannelsSection() {
  const React = await import("react");
  (globalThis as typeof globalThis & { React: typeof React }).React = React;

  return import("@/components/stafless/workspace-sections/channels-section");
}

test("channels section stays selection-only and does not expose setup or asset controls", () => {
  const source = fs.readFileSync(channelsSectionPath, "utf8");

  assert.match(source, /title="Channels"/);
  assert.match(source, /Choose one already connected channel for this agent/);
  assert.doesNotMatch(source, /Pricing attachment/);
  assert.doesNotMatch(source, /Sales assets/);
  assert.doesNotMatch(source, /onPriceAttachment/);
  assert.doesNotMatch(source, /href=|<Link|connections\/\[/);
  assert.doesNotMatch(source, /Connection instructions|BotFather|Google OAuth/);
});

test("channels section only selects connected and unassigned channels", async () => {
  const { WorkspaceChannelsSection } = await loadChannelsSection();
  const selected: ChannelConnection[] = [];
  const telegram = createChannel("telegram-1", ChannelType.TELEGRAM, ConnectionStatus.CONNECTED);
  const gmail = createChannel("gmail-1", ChannelType.GMAIL, ConnectionStatus.CONNECTED);

  const tree = WorkspaceChannelsSection({
    channelConnections: [telegram, gmail],
    selectedChannelId: gmail.id,
    assignedChannels: new Map(),
    isReadOnlyMode: false,
    tenantId: "tenant-1",
    onSelectChannel: (connection) => selected.push(connection),
    sectionCanvasClassName: "canvas",
    softInfoPanelClassName: "soft",
  });

  const buttons = collectElements(tree, (element) => element.type === "button");
  const links = collectElements(tree, (element) => element.type === "a");
  const chooseButtons = buttons.filter((button) => textOf(button).includes("Select"));
  const selectedLabels = collectElements(tree, (element) => element.type === "span").filter(
    (element) =>
      textOf(element).includes("Selected") &&
      typeof element.props?.className === "string" &&
      element.props.className.includes("h-9"),
  );

  assert.equal(links.length, 0);
  assert.equal(buttons.length, 1);
  assert.equal(selectedLabels.length, 1);
  assert.equal(chooseButtons.length, 1);

  chooseButtons[0]?.props?.onClick?.();

  assert.equal(selected.length, 1);
  assert.equal(selected[0]?.id, telegram.id);
});

test("channels section does not provide actions for disconnected or assigned channels", async () => {
  const { WorkspaceChannelsSection } = await loadChannelsSection();
  const selected: ChannelConnection[] = [];
  const telegram = createChannel("telegram-1", ChannelType.TELEGRAM, ConnectionStatus.REVOKED);
  const gmail = createChannel("gmail-1", ChannelType.GMAIL, ConnectionStatus.CONNECTED);
  const instagram = createChannel(
    "instagram-1",
    ChannelType.INSTAGRAM,
    ConnectionStatus.PENDING,
  );

  const tree = WorkspaceChannelsSection({
    channelConnections: [telegram, gmail, instagram],
    selectedChannelId: telegram.id,
    assignedChannels: new Map([[gmail.id, "Other agent"]]),
    isReadOnlyMode: false,
    tenantId: "tenant-1",
    onSelectChannel: (connection) => selected.push(connection),
    sectionCanvasClassName: "canvas",
    softInfoPanelClassName: "soft",
  });

  const allText = textOf(tree);
  const buttons = collectElements(tree, (element) => element.type === "button");
  const links = collectElements(tree, (element) => element.type === "a");

  assert.equal(buttons.length, 0);
  assert.equal(links.length, 0);
  assert.match(allText, /Disconnected/);
  assert.match(allText, /Already used by Other agent/);
  assert.equal(selected.length, 0);
});
