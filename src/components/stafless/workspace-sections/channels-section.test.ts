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
    disabled?: boolean;
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

test("channels section does not expose Gmail pricing asset controls", () => {
  const source = fs.readFileSync(channelsSectionPath, "utf8");

  assert.doesNotMatch(source, /Pricing attachment/);
  assert.doesNotMatch(source, /Sales assets/);
  assert.doesNotMatch(source, /onPriceAttachment/);
});

test("channels section presents channel cards and internal setup instructions", () => {
  const source = fs.readFileSync(channelsSectionPath, "utf8");

  assert.match(source, /Connection instructions/);
  assert.match(source, /Client opens Connections in their cabinet/);
  assert.match(source, /Client creates or opens the business bot through BotFather/);
  assert.match(source, /only live channel assigned to this agent/i);
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
  const setupLinks = collectElements(tree, (element) => element.type === "a").filter((link) =>
    textOf(link).includes("Setup"),
  );
  const chooseButtons = buttons.filter((button) => textOf(button).includes("Choose"));
  const selectedLabels = collectElements(tree, (element) => element.type === "span").filter(
    (element) =>
      textOf(element).includes("Selected") &&
      typeof element.props?.className === "string" &&
      element.props.className.includes("h-9"),
  );

  assert.equal(buttons.length, 1);
  assert.equal(selectedLabels.length, 1);
  assert.equal(chooseButtons.length, 1);
  assert.equal(setupLinks.length, 1);

  chooseButtons[0]?.props?.onClick?.();

  assert.equal(selected.length, 1);
  assert.equal(selected[0]?.id, telegram.id);
});

test("channels section treats disconnected and assigned channels as non-selectable setup states", async () => {
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
  const setupLinks = collectElements(tree, (element) => element.type === "a").filter((link) =>
    textOf(link).includes("Setup"),
  );

  assert.equal(buttons.length, 0);
  assert.equal(setupLinks.length, 2);
  assert.match(allText, /Needs reconnection/);
  assert.match(allText, /Reconnect it or choose another connected channel before saving this agent/);
  assert.match(allText, /Already assigned to Other agent/);
  assert.equal(selected.length, 0);
});
