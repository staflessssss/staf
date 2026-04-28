import Link from "next/link";
import { ChannelConnection, ChannelType } from "@prisma/client";
import {
  BadgeCheck,
  Camera,
  CircleAlert,
  ExternalLink,
  Mail,
  MessageCircle,
  Radio,
  Send,
} from "lucide-react";

import {
  EmptyState,
  StatusBadge,
  SurfaceCard,
  secondaryButtonClassName,
} from "@/components/stafless/foundation";

type ChannelCatalogItem = {
  type: ChannelType;
  title: string;
  description: string;
  connectLabel: string;
  setupSteps: string[];
  icon: typeof Radio;
};

const channelCatalog: ChannelCatalogItem[] = [
  {
    type: ChannelType.GMAIL,
    title: "Gmail",
    description: "Connect the agent to inbound emails and threaded replies.",
    connectLabel: "Connect Gmail",
    icon: Mail,
    setupSteps: [
      "Client opens Connections in their cabinet.",
      "Client chooses Gmail and connects the correct Google account.",
      "Google access also unlocks Calendar, Sheets, and Drive integrations.",
      "Operator returns here and selects the connected Gmail channel for this agent.",
    ],
  },
  {
    type: ChannelType.TELEGRAM,
    title: "Telegram",
    description: "Connect the agent to a Telegram bot owned by the client business.",
    connectLabel: "Connect Telegram",
    icon: Send,
    setupSteps: [
      "Client creates or opens the business bot through BotFather.",
      "Client copies the bot token from BotFather.",
      "Client pastes the token into Telegram in Connections.",
      "Operator selects the connected Telegram channel and deploys the agent.",
    ],
  },
  {
    type: ChannelType.INSTAGRAM,
    title: "Instagram",
    description: "Connect the agent to Instagram Direct for a business account.",
    connectLabel: "Connect Instagram",
    icon: Camera,
    setupSteps: [
      "Client confirms the account is an Instagram business account.",
      "Client connects Instagram from Connections when Meta access is available.",
      "Operator verifies the channel shows Connected here.",
      "Operator selects Instagram and deploys the agent once webhook setup is ready.",
    ],
  },
  {
    type: ChannelType.WHATSAPP,
    title: "WhatsApp",
    description: "WhatsApp is reserved for a later channel expansion pass.",
    connectLabel: "Unavailable",
    icon: MessageCircle,
    setupSteps: [
      "WhatsApp is intentionally out of the current v1 channel scope.",
      "Do not assign production agents to WhatsApp until the roadmap adds it.",
    ],
  },
];

function readMetadataLabel(connection?: ChannelConnection | null) {
  const metadata =
    connection?.metadata && typeof connection.metadata === "object" && !Array.isArray(connection.metadata)
      ? (connection.metadata as Record<string, unknown>)
      : null;
  const email = typeof metadata?.email === "string" ? metadata.email : "";
  const name = typeof metadata?.name === "string" ? metadata.name : "";
  const provider = typeof metadata?.provider === "string" ? metadata.provider : "";

  return email || name || provider || null;
}

function getChannelConnection(
  connections: ChannelConnection[],
  type: ChannelType,
) {
  return connections.find((connection) => connection.type === type) ?? null;
}

export function WorkspaceChannelsSection({
  channelConnections,
  selectedChannelId,
  assignedChannels,
  isReadOnlyMode,
  tenantId,
  onSelectChannel,
  sectionCanvasClassName,
  softInfoPanelClassName,
}: {
  channelConnections: ChannelConnection[];
  selectedChannelId: string;
  assignedChannels: Map<string, string>;
  isReadOnlyMode: boolean;
  tenantId: string;
  onSelectChannel: (connection: ChannelConnection) => void;
  sectionCanvasClassName: string;
  softInfoPanelClassName: string;
}) {
  const selectedChannel =
    channelConnections.find((connection) => connection.id === selectedChannelId) ?? null;
  const selectedCatalogItem =
    channelCatalog.find((item) => item.type === selectedChannel?.type) ?? channelCatalog[0];

  return (
    <>
      <SurfaceCard
        className="rounded-[24px] border-[#e1e7f0] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
        title="Channels"
        description="Choose the single connected channel this agent uses for live conversations."
      >
        {channelConnections.length === 0 ? (
          <EmptyState
            title="No channel available"
            description="Connect at least one tenant channel before turning this agent into a live delivery surface."
            action={
              <Link href={`/admin/clients/${tenantId}`} className={secondaryButtonClassName}>
                Open client workspace
              </Link>
            }
          />
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          {channelCatalog.map((item) => {
            const connection = getChannelConnection(channelConnections, item.type);
            const assignedAgentName = connection ? assignedChannels.get(connection.id) : null;
            const isSelected = Boolean(connection && selectedChannelId === connection.id);
            const isConnected = connection?.status === "CONNECTED";
            const isPlannedOnly = item.type === ChannelType.WHATSAPP && !connection;
            const canSelect =
              Boolean(connection) &&
              isConnected &&
              !isSelected &&
              !assignedAgentName &&
              !isReadOnlyMode;
            const Icon = item.icon;
            const metadataLabel = readMetadataLabel(connection);
            const badgeLabel = isSelected
              ? isConnected
                ? "Selected"
                : "Needs reconnection"
              : assignedAgentName
                ? "Assigned"
                : isConnected
                  ? "Connected"
                  : isPlannedOnly
                    ? "Later"
                    : "Not connected";

            return (
              <article
                key={item.type}
                className={
                  isSelected && isConnected
                    ? "rounded-[16px] border border-[#6c63ff] bg-[#fbfaff] p-4 shadow-[0_12px_30px_rgba(108,99,255,0.12)]"
                    : isSelected
                      ? "rounded-[16px] border border-[#fecdca] bg-[#fff8f7] p-4 shadow-[0_12px_30px_rgba(180,35,24,0.08)]"
                    : isPlannedOnly
                      ? "rounded-[16px] border border-[#edf1f6] bg-[#fbfcfe] p-4 opacity-70"
                      : "rounded-[16px] border border-[#dbe3ef] bg-[#fcfdff] p-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)]"
                }
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-[12px] border border-[#dbe3ef] bg-white text-[#6c63ff]">
                    <Icon className="size-5" />
                  </div>
                  <div className="flex items-center gap-3">
                    {canSelect ? (
                      <button
                        className="inline-flex h-9 items-center justify-center rounded-[8px] bg-[#6c63ff] px-5 text-xs font-semibold text-white transition hover:bg-[#5b53ea]"
                        onClick={() => {
                          if (connection) {
                            onSelectChannel(connection);
                          }
                        }}
                        type="button"
                      >
                        Choose
                      </button>
                    ) : !connection && !isPlannedOnly ? (
                      <a
                        className="inline-flex h-9 items-center justify-center rounded-[8px] bg-[#6c63ff] px-5 text-xs font-semibold text-white transition hover:bg-[#5b53ea]"
                        href={`#channel-setup-${item.type.toLowerCase()}`}
                      >
                        Setup
                      </a>
                    ) : connection && !isConnected && !isPlannedOnly ? (
                      <a
                        className="inline-flex h-9 items-center justify-center rounded-[8px] bg-[#6c63ff] px-5 text-xs font-semibold text-white transition hover:bg-[#5b53ea]"
                        href={`#channel-setup-${item.type.toLowerCase()}`}
                      >
                        Setup
                      </a>
                    ) : isSelected ? (
                      <span className="inline-flex h-9 items-center justify-center rounded-[8px] bg-[#eef2ff] px-5 text-xs font-semibold text-[#5b53ea]">
                        Selected
                      </span>
                    ) : (
                      <span className="inline-flex h-9 items-center justify-center rounded-[8px] bg-[#eef2f7] px-5 text-xs font-semibold text-[#98a2b3]">
                        {assignedAgentName ? "Assigned" : item.connectLabel}
                      </span>
                    )}
                    <span
                      aria-hidden="true"
                      className={
                        isSelected && isConnected
                          ? "relative inline-flex h-7 w-12 items-center rounded-full border border-[#6c63ff] bg-[#6c63ff]"
                          : isSelected
                            ? "relative inline-flex h-7 w-12 items-center rounded-full border border-[#fecdca] bg-[#fee4e2]"
                          : "relative inline-flex h-7 w-12 items-center rounded-full border border-[#e5ebf3] bg-[#edf1f6]"
                      }
                    >
                      <span
                        className={
                          isSelected && isConnected
                            ? "inline-block size-5 translate-x-6 rounded-full bg-white shadow-[0_1px_3px_rgba(16,24,40,0.18)]"
                            : "inline-block size-5 translate-x-1 rounded-full bg-white shadow-[0_1px_3px_rgba(16,24,40,0.18)]"
                        }
                      />
                    </span>
                  </div>
                </div>

                <div className="mt-5 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-[#111827]">{item.title}</h3>
                    <span
                      className={
                        isSelected && isConnected
                          ? "rounded-full bg-[#eef5ff] px-2.5 py-1 text-xs font-semibold text-[#175cd3]"
                          : isSelected
                            ? "rounded-full bg-[#fee4e2] px-2.5 py-1 text-xs font-semibold text-[#b42318]"
                            : isConnected
                              ? "rounded-full bg-[#eef5ff] px-2.5 py-1 text-xs font-semibold text-[#175cd3]"
                          : "rounded-full bg-[#eef2f7] px-2.5 py-1 text-xs font-semibold text-[#667085]"
                      }
                    >
                      {badgeLabel}
                    </span>
                  </div>
                  <p className="text-sm leading-6 text-[#667085]">{item.description}</p>
                  {metadataLabel ? (
                    <p className="text-xs font-medium text-[#475467]">{metadataLabel}</p>
                  ) : null}
                  {assignedAgentName ? (
                    <p className="text-xs font-semibold text-[#b42318]">
                      Already assigned to {assignedAgentName}.
                    </p>
                  ) : null}
                  {!connection && !isPlannedOnly ? (
                    <p className="text-xs font-medium text-[#667085]">
                      Open the setup instructions below before asking the client to connect this channel.
                    </p>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </SurfaceCard>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className={sectionCanvasClassName}>
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-[#f0efff] text-[#6c63ff]">
              <BadgeCheck className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#111827]">Selected channel</p>
              <p className="mt-1 text-sm leading-6 text-[#667085]">
                {selectedChannel?.status === "CONNECTED"
                  ? `${selectedCatalogItem.title} is the only live channel assigned to this agent. Save changes after switching channels.`
                  : selectedChannel
                    ? `${selectedCatalogItem.title} is selected but not connected. Reconnect it or choose another connected channel before saving this agent.`
                  : "Choose one connected channel before saving this agent."}
              </p>
              {selectedChannel ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <StatusBadge status={selectedChannel.status} />
                  <span className="rounded-full border border-[#dbe3ef] bg-white px-3 py-1 text-xs font-semibold text-[#475467]">
                    One agent per channel
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <aside className={softInfoPanelClassName}>
          <div className="flex items-start gap-3">
            <CircleAlert className="mt-0.5 size-5 shrink-0 text-[#6c63ff]" />
            <div>
              <p className="text-sm font-semibold text-[#111827]">Switching channel</p>
              <p className="mt-1 text-sm leading-6 text-[#667085]">
                Changing the selected channel changes the live delivery surface. Save the agent and
                redeploy before relying on inbound production traffic.
              </p>
            </div>
          </div>
        </aside>
      </div>

      <SurfaceCard
        className="rounded-[24px] border-[#e1e7f0] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
        title="Connection instructions"
        description="Use these internal setup notes when a channel is not connected yet. Client credentials still belong in the client Connections surface."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {channelCatalog.map((item) => {
            const connection = getChannelConnection(channelConnections, item.type);
            const Icon = item.icon;

            return (
              <div
                key={`${item.type}-instructions`}
                id={`channel-setup-${item.type.toLowerCase()}`}
                className="rounded-[16px] border border-[#dbe3ef] bg-[#fcfdff] p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-[12px] border border-[#dbe3ef] bg-white text-[#6c63ff]">
                    <Icon className="size-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#111827]">{item.title}</p>
                    <p className="text-xs text-[#667085]">
                      {connection?.status === "CONNECTED"
                        ? "Connection exists for this tenant."
                        : "Connection required before assignment."}
                    </p>
                  </div>
                </div>
                <ol className="mt-4 space-y-2 text-sm leading-6 text-[#667085]">
                  {item.setupSteps.map((step) => (
                    <li key={step} className="flex gap-2">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#6c63ff]" />
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            );
          })}
        </div>
        <div className="mt-5">
          <Link
            href={`/admin/clients/${tenantId}`}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#344054] transition hover:text-[#6c63ff]"
          >
            Open client workspace
            <ExternalLink className="size-4" />
          </Link>
        </div>
      </SurfaceCard>
    </>
  );
}
