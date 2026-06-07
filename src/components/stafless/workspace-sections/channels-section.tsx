import { ChannelType } from "@prisma/client";
import type { SafeChannelConnection } from "@/components/stafless/agent-editor-shared";
import { Camera, Mail, MessageCircle, Radio, Send } from "lucide-react";

import { EmptyState, SurfaceCard } from "@/components/stafless/foundation";

type ChannelCatalogItem = {
  type: ChannelType;
  title: string;
  description: string;
  icon: typeof Radio;
};

const channelCatalog: ChannelCatalogItem[] = [
  {
    type: ChannelType.GMAIL,
    title: "Gmail",
    description: "Use this agent in Gmail conversations.",
    icon: Mail,
  },
  {
    type: ChannelType.TELEGRAM,
    title: "Telegram",
    description: "Use this agent in Telegram bot chats.",
    icon: Send,
  },
  {
    type: ChannelType.INSTAGRAM,
    title: "Instagram",
    description: "Use this agent in Instagram Direct.",
    icon: Camera,
  },
  {
    type: ChannelType.WHATSAPP,
    title: "WhatsApp",
    description: "WhatsApp support is not available yet.",
    icon: MessageCircle,
  },
];

function readMetadataLabel(connection?: SafeChannelConnection | null) {
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
  connections: SafeChannelConnection[],
  type: ChannelType,
) {
  return connections.find((connection) => connection.type === type) ?? null;
}

export function WorkspaceChannelsSection({
  channelConnections,
  selectedChannelId,
  assignedChannels,
  isReadOnlyMode,
  onSelectChannel,
}: {
  channelConnections: SafeChannelConnection[];
  selectedChannelId: string;
  assignedChannels: Map<string, string>;
  isReadOnlyMode: boolean;
  tenantId: string;
  onSelectChannel: (connection: SafeChannelConnection) => void;
  sectionCanvasClassName: string;
  softInfoPanelClassName: string;
}) {
  return (
    <div>
      <SurfaceCard
        className="rounded-[24px] border-[#e1e7f0] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
        title="Channels"
        description="Choose one already connected channel for this agent."
      >
        {channelConnections.length === 0 ? (
          <EmptyState
            title="No connected channels"
            description="The client needs to connect a channel before you can assign one to this agent."
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
                : "Disconnected"
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
                        Select
                      </button>
                    ) : isSelected ? (
                      <span className="inline-flex h-9 items-center justify-center rounded-[8px] bg-[#eef2ff] px-5 text-xs font-semibold text-[#5b53ea]">
                        Selected
                      </span>
                    ) : (
                      <span className="inline-flex h-9 items-center justify-center rounded-[8px] bg-[#eef2f7] px-5 text-xs font-semibold text-[#98a2b3]">
                        {assignedAgentName
                          ? "Assigned"
                          : isPlannedOnly
                            ? "Later"
                            : "Not connected"}
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
                      Already used by {assignedAgentName}.
                    </p>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </SurfaceCard>
    </div>
  );
}
