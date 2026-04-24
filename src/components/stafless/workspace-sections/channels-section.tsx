import Link from "next/link";
import { ChannelConnection } from "@prisma/client";

import {
  EmptyState,
  FormField,
  StatusBadge,
  SurfaceCard,
  inputClassName,
  secondaryButtonClassName,
} from "@/components/stafless/foundation";
export function WorkspaceChannelsSection({
  channelConnections,
  selectedChannelId,
  assignedChannels,
  priceAttachmentFileId,
  priceAttachmentFileName,
  priceAttachmentMimeType,
  isReadOnlyMode,
  tenantId,
  onSelectChannel,
  onPriceAttachmentFileIdChange,
  onPriceAttachmentFileNameChange,
  onPriceAttachmentMimeTypeChange,
  sectionCanvasClassName,
  softInfoPanelClassName,
}: {
  channelConnections: ChannelConnection[];
  selectedChannelId: string;
  assignedChannels: Map<string, string>;
  priceAttachmentFileId: string;
  priceAttachmentFileName: string;
  priceAttachmentMimeType: string;
  isReadOnlyMode: boolean;
  tenantId: string;
  onSelectChannel: (connection: ChannelConnection) => void;
  onPriceAttachmentFileIdChange: (value: string) => void;
  onPriceAttachmentFileNameChange: (value: string) => void;
  onPriceAttachmentMimeTypeChange: (value: string) => void;
  sectionCanvasClassName: string;
  softInfoPanelClassName: string;
}) {
  return (
    <>
      <SurfaceCard
        className="border-0 bg-transparent p-0 shadow-none"
        title="Channel"
        description="Bind the agent to one connected tenant channel. Unavailable channels stay visible so the rule is obvious."
      >
        <div className="rounded-[34px] border border-[#ead7c0] bg-[radial-gradient(circle_at_top_left,#fffdf8_0%,#f8eee0_45%,#f4e7d6_100%)] p-6 shadow-[0_24px_54px_rgba(49,31,18,0.08)] sm:p-8">
          <div className="rounded-[26px] bg-white/72 px-5 py-5 ring-1 ring-[#eadccc]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8d7762]">
              Channel assignment
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[#201627]">
              Choose where this agent will live and respond.
            </h3>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-[#5d5245]">
              A channel is a real runtime boundary. Connected channels stay visible even when
              blocked, so the operator can see the assignment rule instead of guessing.
            </p>
          </div>
          <div className="mt-5">
            {channelConnections.length === 0 ? (
              <EmptyState
                title="No channel available"
                description="Connect at least one tenant channel before turning this draft into a real agent."
                action={
                  <Link
                    href={`/admin/tenants/${tenantId}`}
                    className={secondaryButtonClassName}
                  >
                    Open tenant workspace
                  </Link>
                }
              />
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {channelConnections.map((connection) => {
                  const assignedAgentName = assignedChannels.get(connection.id);
                  const isSelected = selectedChannelId === connection.id;
                  const isUnavailable =
                    connection.status !== "CONNECTED" || Boolean(assignedAgentName);

                  return (
                    <label
                      key={connection.id}
                      className={
                        isSelected
                          ? "flex cursor-pointer items-start gap-4 rounded-[24px] border border-[#d6a06c] bg-[#fff7ef] p-6 shadow-[0_12px_26px_rgba(199,92,42,0.12)]"
                          : "flex cursor-pointer items-start gap-4 rounded-[24px] border border-[#eadfcf] bg-[#fffcf8] p-6 transition hover:border-[#d8c1aa] hover:bg-white"
                      }
                    >
                      <input
                        checked={isSelected}
                        className="mt-1 size-4"
                        disabled={isReadOnlyMode || isUnavailable}
                        name="channelId"
                        onChange={() => onSelectChannel(connection)}
                        type="radio"
                      />
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-lg font-semibold text-foreground">{connection.type}</p>
                          <StatusBadge status={connection.status} />
                        </div>
                        <p className="text-sm leading-7 text-muted-foreground">
                          {assignedAgentName
                            ? `Already assigned to ${assignedAgentName}.`
                            : connection.status === "CONNECTED"
                              ? "Ready for agent assignment."
                              : "This channel must be connected before it can be assigned."}
                        </p>
                        <div className="pt-2">
                          <span className="rounded-full bg-[#f7efe2] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6d5c4d] ring-1 ring-[#eadccc]">
                            {assignedAgentName
                              ? "Unavailable"
                              : connection.status === "CONNECTED"
                                ? "Available"
                                : "Needs connection"}
                          </span>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </SurfaceCard>

      <SurfaceCard
        className="border-0 bg-transparent p-0 shadow-none"
        title="Sales assets"
        description="Configure optional files the agent can attach when it sends pricing or offer details."
      >
        <div className={sectionCanvasClassName}>
          <div className="grid gap-5 md:grid-cols-2">
            <FormField
              label="Pricing attachment"
              hint="Paste a Google Drive file ID or a share link. The runtime will extract the file ID automatically."
            >
              <input
                className={inputClassName}
                onChange={(event) => onPriceAttachmentFileIdChange(event.target.value)}
                placeholder="Drive file ID or URL"
                readOnly={isReadOnlyMode}
                value={priceAttachmentFileId}
              />
            </FormField>
            <FormField
              label="Attachment label"
              hint="Optional. Helpful if you want the outgoing email attachment to have a nicer file name."
            >
              <input
                className={inputClassName}
                onChange={(event) => onPriceAttachmentFileNameChange(event.target.value)}
                placeholder="For example: Myndful Films Pricing Guide"
                readOnly={isReadOnlyMode}
                value={priceAttachmentFileName}
              />
            </FormField>
          </div>
          <div className="mt-5 grid gap-5 md:grid-cols-[minmax(0,1fr)_240px]">
            <FormField
              label="Mime type"
              hint="Optional. Leave blank unless you want to force the attachment content type."
            >
              <input
                className={inputClassName}
                onChange={(event) => onPriceAttachmentMimeTypeChange(event.target.value)}
                placeholder="application/pdf or image/png"
                readOnly={isReadOnlyMode}
                value={priceAttachmentMimeType}
              />
            </FormField>
            <div className={softInfoPanelClassName}>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#636563]">
                Runtime behavior
              </p>
              <p className="mt-2 text-sm leading-6 text-[#433a49]">
                When a sales reply includes pricing, Gmail can attach this asset automatically
                without turning the whole flow into a special hardcoded case.
              </p>
            </div>
          </div>
        </div>
      </SurfaceCard>
    </>
  );
}
