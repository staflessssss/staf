import Link from "next/link";
import {
  AgentEventSource,
  AgentEventStatus,
  AgentEventType,
  ChannelType,
  ConversationStatus,
  MessageRole,
  type Prisma,
} from "@prisma/client";
import { CalendarCheck2, Wrench } from "lucide-react";

import { CabinetShell } from "@/components/cabinet/cabinet-shell";
import { getCabinetUserName, getInitials } from "@/components/cabinet/user";
import { isBusinessManualMessage } from "@/lib/business-handoff";
import {
  getLeadDetails,
  getToolActionLabel,
  getToolStatusLabel,
  getToolSummary,
} from "@/lib/client-analytics";
import { requireClientSession } from "@/lib/client-auth";
import { db } from "@/lib/db";
import { INSTAGRAM_OUTBOUND_DELIVERY_TOOL_NAME } from "@/lib/instagram-outbound";
import { isQualifiedLeadToolMessage } from "@/lib/lead-qualification";

type DialogsPageProps = {
  searchParams: Promise<{
    agent?: string;
    channel?: string;
    conversation?: string;
    sort?: string;
    tab?: string;
    q?: string;
    page?: string;
  }>;
};

type DialogTab = "conversation" | "lead" | "activity";
type DialogSort = "newest" | "oldest";

const CHANNEL_FILTERS: Array<{ label: string; value?: ChannelType }> = [
  { label: "All" },
  { label: "Gmail", value: ChannelType.GMAIL },
  { label: "Instagram", value: ChannelType.INSTAGRAM },
  { label: "Telegram", value: ChannelType.TELEGRAM },
];

const SORT_OPTIONS: Array<{ label: string; value: DialogSort }> = [
  { label: "Newest", value: "newest" },
  { label: "Oldest", value: "oldest" },
];

const DIALOG_TABS: Array<{ label: string; value: DialogTab }> = [
  { label: "Conversation", value: "conversation" },
  { label: "Lead details", value: "lead" },
  { label: "Activity", value: "activity" },
];

function formatRelative(value: Date) {
  const diffMs = Date.now() - value.getTime();
  const minutes = Math.max(1, Math.round(diffMs / 60000));

  if (minutes < 60) return `${minutes}m`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;

  return `${Math.round(hours / 24)}d`;
}

function formatMessageTime(value: Date) {
  return value.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatChannel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getContactName(contactId: string) {
  if (contactId.includes("@")) return contactId;

  return contactId
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

type ConversationContact = {
  channel: ChannelType;
  contactId: string;
  contactUsername?: string | null;
  contactDisplayName?: string | null;
};

function formatInstagramUsername(username: string) {
  const normalized = username.trim().replace(/^@+/, "");
  return normalized ? `@${normalized}` : "";
}

function getConversationContactName(conversation: ConversationContact) {
  if (conversation.channel === ChannelType.INSTAGRAM) {
    const username = conversation.contactUsername
      ? formatInstagramUsername(conversation.contactUsername)
      : "";

    if (username) return username;
    if (conversation.contactDisplayName?.trim()) return conversation.contactDisplayName.trim();
  }

  return getContactName(conversation.contactId);
}

function isEmail(value: string | null | undefined) {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
}

function isInternalInstagramDelivery(message: { role: MessageRole; toolName?: string | null }) {
  return (
    message.role === MessageRole.TOOL &&
    message.toolName === INSTAGRAM_OUTBOUND_DELIVERY_TOOL_NAME
  );
}

function getLastMessagePreview(
  messages: Array<{ content: string; role: MessageRole; toolName?: string | null }>,
) {
  const message = messages.find(
    (item) =>
      item.role === MessageRole.USER ||
      item.role === MessageRole.ASSISTANT ||
      isBusinessManualMessage(item),
  );
  const content = message?.content.trim();

  if (!content) return "No visible messages yet.";

  return content.length > 84 ? `${content.slice(0, 81)}...` : content;
}

function parseChannelFilter(value?: string) {
  return CHANNEL_FILTERS.find((item) => item.value === value)?.value;
}

function parseSort(value?: string): DialogSort {
  return value === "oldest" ? "oldest" : "newest";
}

function parseTab(value?: string): DialogTab {
  return DIALOG_TABS.some((item) => item.value === value) ? (value as DialogTab) : "conversation";
}

function buildToolCallView(message: {
  toolName: string | null;
  toolResult: Prisma.JsonValue | null;
  content: string;
}) {
  const status = getToolStatusLabel(message.toolResult);
  const summary = getToolSummary(message.toolResult) ?? message.content.trim();

  return {
    title: getToolActionLabel(message.toolName),
    status,
    summary: summary.length > 110 ? `${summary.slice(0, 107)}...` : summary,
  };
}

function conversationStatusLabel(status: ConversationStatus) {
  switch (status) {
    case ConversationStatus.ESCALATED:
      return "Being reviewed";
    case ConversationStatus.CLOSED:
      return "Closed";
    case ConversationStatus.ACTIVE:
    default:
      return "Active";
  }
}

function conversationStatusClassName(status: ConversationStatus) {
  switch (status) {
    case ConversationStatus.ESCALATED:
      return "border-[#e9be86]/35 bg-[#3a2c1e] text-[#e9be86]";
    case ConversationStatus.CLOSED:
      return "border-white/[0.12] bg-white/[0.06] text-white/58";
    case ConversationStatus.ACTIVE:
    default:
      return "border-[#47c978]/30 bg-[#47c978]/[0.08] text-[#62d990]";
  }
}

function buildDialogsHref(params: {
  agent?: string;
  channel?: ChannelType;
  conversation?: string;
  sort?: DialogSort;
  tab?: DialogTab;
  q?: string;
  page?: number;
}) {
  const query = new URLSearchParams();

  if (params.agent) query.set("agent", params.agent);
  if (params.channel) query.set("channel", params.channel);
  if (params.conversation) query.set("conversation", params.conversation);
  if (params.sort && params.sort !== "newest") query.set("sort", params.sort);
  if (params.tab && params.tab !== "conversation") query.set("tab", params.tab);
  if (params.q) query.set("q", params.q);
  if (params.page && params.page > 1) query.set("page", String(params.page));

  const text = query.toString();
  return text ? `/client/dialogs?${text}` : "/client/dialogs";
}

function getDialogBadge(args: {
  status: ConversationStatus;
  hasQualifiedLead: boolean;
  hasBookedAction: boolean;
  isSelected: boolean;
}) {
  if (args.status === ConversationStatus.ESCALATED) {
    return {
      label: "Needs review",
      className: "border-[#e9be86]/45 text-[#e9be86]",
    };
  }

  if (args.status === ConversationStatus.CLOSED) {
    return {
      label: "Closed",
      className: "border-white/[0.12] text-white/52",
    };
  }

  if (args.hasBookedAction) {
    return {
      label: "Booked",
      className: "border-[#54b67a]/45 text-[#78d49a]",
    };
  }

  if (args.hasQualifiedLead) {
    return {
      label: "Qualified",
      className: "border-[#5d82c8]/45 text-[#8aa9ed]",
    };
  }

  return {
    label: args.isSelected ? "Active" : "New",
    className: args.isSelected ? "border-[#d7a96d]/45 text-[#e9be86]" : "border-white/[0.14] text-white/54",
  };
}

function buildAgentWorkOutcome(event: {
  toolName: string | null;
  toolResult: Prisma.JsonValue | null;
  conversation: { contactId: string; agent: { name: string } };
  createdAt: Date;
}) {
  const details = getLeadDetails(event, event.conversation.contactId);
  const status = getToolStatusLabel(event.toolResult);

  if (event.toolName === "book_consultation") {
    return {
      title: "Booking confirmed",
      detail:
        [
          details.coupleName ?? details.contactId,
          [details.callDate, details.callTime].filter(Boolean).join(" at "),
        ]
          .filter(Boolean)
          .join(" - ") ||
        getToolSummary(event.toolResult) ||
        status,
    };
  }

  if (event.toolName === "check_consultation_calendar") {
    return {
      title: status === "Available" ? "Call time available" : "Call time reviewed",
      detail:
        [[details.callDate, details.callTime].filter(Boolean).join(" at "), status]
          .filter(Boolean)
          .join(" - ") ||
        getToolSummary(event.toolResult) ||
        status,
    };
  }

  if (event.toolName === "check_wedding_availability") {
    return {
      title: status === "Available" ? "Wedding date available" : "Wedding date reviewed",
      detail:
        [
          details.weddingDate,
          details.location,
          details.capacity ? `${details.bookedCount ?? 0}/${details.capacity} booked` : null,
        ]
          .filter(Boolean)
          .join(" - ") ||
        getToolSummary(event.toolResult) ||
        status,
    };
  }

  return {
    title: getToolActionLabel(event.toolName),
    detail: getToolSummary(event.toolResult) ?? status,
  };
}

export default async function ClientDialogsPage({ searchParams }: DialogsPageProps) {
  const session = await requireClientSession();
  const tenantId = session.user.tenantId;
  const { agent, channel, conversation, sort, tab, q, page: rawPage } = await searchParams;
  const channelFilter = parseChannelFilter(channel);
  const sortOrder = parseSort(sort);
  const activeTab = parseTab(tab);
  const searchQuery = q?.trim().slice(0, 120) ?? "";
  const page = Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1);
  const pageSize = 40;
  const conversationWhere = {
    agent: {
      tenantId,
      ...(agent ? { id: agent } : {}),
    },
    ...(channelFilter ? { channel: channelFilter } : {}),
    ...(searchQuery
      ? {
          OR: [
            { contactId: { contains: searchQuery, mode: "insensitive" as const } },
            { contactUsername: { contains: searchQuery, mode: "insensitive" as const } },
            { contactDisplayName: { contains: searchQuery, mode: "insensitive" as const } },
          ],
        }
      : {}),
    messages: { some: {} },
  };

  const [agents, conversations, conversationCount, visibleMessageCount, toolMessages, outcomeEvents] =
    await Promise.all([
      db.agent.findMany({
        where: { tenantId },
        orderBy: { updatedAt: "desc" },
      }),
      db.conversation.findMany({
        where: conversationWhere,
        include: {
          agent: true,
          messages: {
            where: {
              OR: [
                {
                  role: {
                    in: [MessageRole.USER, MessageRole.ASSISTANT],
                  },
                },
                {
                  role: MessageRole.TOOL,
                  toolName: "business_manual_message",
                },
              ],
            },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          _count: {
            select: { messages: true },
          },
        },
        orderBy: { updatedAt: sortOrder === "oldest" ? "asc" : "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.conversation.count({
        where: conversationWhere,
      }),
      db.message.count({
        where: {
          conversation: {
            agent: { tenantId },
          },
          OR: [
            {
              role: {
                in: [MessageRole.USER, MessageRole.ASSISTANT],
              },
            },
            {
              role: MessageRole.TOOL,
              toolName: "business_manual_message",
            },
          ],
        },
      }),
      db.message.findMany({
        where: {
          conversation: {
            agent: { tenantId },
          },
          role: MessageRole.TOOL,
          AND: [
            { toolName: { not: null } },
            {
              NOT: {
                toolName: {
                  in: [
                    INSTAGRAM_OUTBOUND_DELIVERY_TOOL_NAME,
                    "business_manual_message",
                    "__wedding_sales_simple_state",
                    "__wedding_sales_simple_safety_log",
                    "__wedding_sales_simple_follow_up_log",
                  ],
                },
              },
            },
          ],
        },
        include: {
          conversation: {
            include: {
              agent: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 250,
      }),
      db.agentEvent.findMany({
        where: {
          agent: { tenantId },
          type: { in: [AgentEventType.LEAD_QUALIFIED, AgentEventType.CONSULTATION_BOOKED] },
          status: AgentEventStatus.SUCCEEDED,
          source: { in: [AgentEventSource.LIVE, AgentEventSource.BACKFILL] },
        },
        select: { conversationId: true, type: true },
      }),
    ]);
  const totalPages = Math.max(1, Math.ceil(conversationCount / pageSize));

  const userName = getCabinetUserName(session.user);
  const selectedConversation =
    conversations.find((item) => item.id === conversation) ?? conversations[0] ?? null;
  const selectedMessages = selectedConversation
    ? (
        await db.message.findMany({
          where: {
            conversationId: selectedConversation.id,
            conversation: { agent: { tenantId } },
            OR: [
              {
                role: {
                  in: [MessageRole.USER, MessageRole.ASSISTANT],
                },
              },
              {
                role: MessageRole.TOOL,
                AND: [
                  {
                    toolName: {
                      not: null,
                    },
                  },
                  {
                    NOT: {
                      toolName: INSTAGRAM_OUTBOUND_DELIVERY_TOOL_NAME,
                    },
                  },
                ],
              },
            ],
          },
          orderBy: { createdAt: "desc" },
          take: 100,
        })
      ).reverse()
    : [];
  const selectedToolMessages = selectedMessages.filter(
    (message) => message.role === MessageRole.TOOL && !isBusinessManualMessage(message),
  );
  const agentToolMessages = toolMessages.filter(
    (message) => !isBusinessManualMessage(message) && !isInternalInstagramDelivery(message),
  );
  const selectedContactName = selectedConversation
    ? getConversationContactName(selectedConversation)
    : "No conversation yet";
  const selectedChannel = selectedConversation
    ? formatChannel(selectedConversation.channel)
    : "No channel";
  const selectedInitials = getInitials(selectedContactName);
  const targetActions = agentToolMessages.filter((message) =>
    isQualifiedLeadToolMessage({
      toolName: message.toolName,
      toolResult: message.toolResult,
    }),
  );
  const latestOutcome =
    (selectedConversation
      ? targetActions.find((message) => message.conversationId === selectedConversation.id) ??
        agentToolMessages.find((message) => message.conversationId === selectedConversation.id)
      : null) ??
    targetActions[0] ??
    agentToolMessages[0] ??
    null;
  const selectedQualifiedActions = selectedConversation
    ? targetActions.filter((message) => message.conversationId === selectedConversation.id)
    : [];
  const selectedLatestOutcome =
    selectedQualifiedActions[0] ??
    (selectedConversation
      ? agentToolMessages.find((message) => message.conversationId === selectedConversation.id)
      : null) ??
    null;
  const latestLeadDetails = latestOutcome
    ? getLeadDetails(latestOutcome, latestOutcome.conversation.contactId)
    : null;
  const selectedLeadDetails = selectedLatestOutcome
    ? getLeadDetails(selectedLatestOutcome, selectedLatestOutcome.conversation.contactId)
    : null;
  const fallbackLeadDetails = selectedConversation ? null : latestLeadDetails;
  const selectedEmail = isEmail(selectedLeadDetails?.email)
    ? selectedLeadDetails?.email
    : isEmail(selectedConversation?.contactId)
      ? selectedConversation?.contactId
      : null;
  const latestWork = latestOutcome ? buildAgentWorkOutcome(latestOutcome) : null;
  const selectedOutcomeEvents = selectedConversation
    ? outcomeEvents.filter((event) => event.conversationId === selectedConversation.id)
    : [];
  const selectedBooked = selectedOutcomeEvents.some(
    (event) => event.type === AgentEventType.CONSULTATION_BOOKED,
  );
  const selectedQualified = selectedOutcomeEvents.some(
    (event) => event.type === AgentEventType.LEAD_QUALIFIED,
  );
  const selectedLeadStage = selectedBooked ? "Booked" : selectedQualified ? "Qualified" : "In progress";
  const leadRows = [
    ["Name", selectedLeadDetails?.coupleName ?? fallbackLeadDetails?.coupleName ?? selectedContactName],
    ...(selectedConversation?.channel === ChannelType.INSTAGRAM
      ? [["Instagram", selectedContactName]]
      : []),
    [
      "Email",
      selectedEmail ?? (isEmail(fallbackLeadDetails?.email) ? fallbackLeadDetails?.email : "Not captured yet"),
    ],
    ["Channel", selectedChannel],
    ["Agent", selectedConversation?.agent.name ?? agents[0]?.name ?? "No active agent"],
    [
      "Date",
      selectedLeadDetails?.weddingDate ??
        selectedLeadDetails?.callDate ??
        fallbackLeadDetails?.weddingDate ??
        fallbackLeadDetails?.callDate ??
        "Not captured yet",
    ],
    ["Location", selectedLeadDetails?.location ?? fallbackLeadDetails?.location ?? "Not captured yet"],
  ];

  const header = (
    <h1 className="text-2xl font-semibold tracking-[-0.055em] text-white">
      Conversations
    </h1>
  );

  return (
    <CabinetShell
      header={header}
      userInitials={getInitials(userName)}
      userName={userName}
    >
      <div className="-mx-4 -my-5 grid min-h-[calc(100%+2.5rem)] gap-0 md:-mx-8 md:-my-7 md:min-h-[calc(100%+3.5rem)] xl:h-[calc(100%+3.5rem)] xl:min-h-0 xl:overflow-hidden xl:grid-cols-[360px_minmax(520px,1fr)_340px] 2xl:grid-cols-[410px_minmax(680px,1fr)_380px]">
        <section className="flex min-h-[560px] flex-col overflow-hidden border-b border-white/[0.09] bg-[#10110f] xl:h-full xl:min-h-0 xl:border-b-0 xl:border-r">
          <div className="border-b border-white/[0.08] p-5 md:p-6">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <Link
                href={buildDialogsHref({ channel: channelFilter, sort: sortOrder, q: searchQuery })}
                className={[
                  "shrink-0 rounded-lg border px-3 py-2 text-xs font-semibold transition",
                  !agent
                    ? "border-[#d7a96d]/45 bg-[#3a2c1e] text-[#e9be86]"
                    : "border-white/[0.1] text-white/58 hover:text-white",
                ].join(" ")}
              >
                All agents
              </Link>
              {agents.slice(0, 4).map((item) => (
                <Link
                  key={item.id}
                  href={buildDialogsHref({ agent: item.id, channel: channelFilter, sort: sortOrder, q: searchQuery })}
                  className={[
                    "shrink-0 rounded-lg border px-3 py-2 text-xs font-semibold transition",
                    agent === item.id
                      ? "border-[#d7a96d]/45 bg-[#3a2c1e] text-[#e9be86]"
                      : "border-white/[0.1] text-white/58 hover:text-white",
                  ].join(" ")}
                >
                  {item.name}
                </Link>
              ))}
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {CHANNEL_FILTERS.map((item) => {
                  const isActive = item.value === channelFilter || (!item.value && !channelFilter);

                  return (
                    <Link
                      key={item.label}
                      href={buildDialogsHref({ agent, channel: item.value, sort: sortOrder, q: searchQuery })}
                      className={[
                        "shrink-0 rounded-lg border px-3 py-2 text-xs font-semibold transition",
                        isActive
                          ? "border-[#d7a96d]/45 bg-[#3a2c1e] text-[#e9be86]"
                          : "border-white/[0.1] text-white/58 hover:text-white",
                      ].join(" ")}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {SORT_OPTIONS.map((item) => {
                  const isActive = item.value === sortOrder;

                  return (
                    <Link
                      key={item.value}
                      href={buildDialogsHref({
                        agent,
                        channel: channelFilter,
                        sort: item.value,
                        q: searchQuery,
                      })}
                      className={[
                        "shrink-0 rounded-lg border px-3 py-2 text-xs font-semibold transition",
                        isActive
                          ? "border-white/[0.14] bg-white/[0.08] text-white"
                          : "border-white/[0.1] text-white/50 hover:text-white",
                      ].join(" ")}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
              <form action="/client/dialogs" method="get" className="flex gap-2">
                {agent ? <input type="hidden" name="agent" value={agent} /> : null}
                {channelFilter ? <input type="hidden" name="channel" value={channelFilter} /> : null}
                {sortOrder !== "newest" ? <input type="hidden" name="sort" value={sortOrder} /> : null}
                <input
                  name="q"
                  defaultValue={searchQuery}
                  placeholder="Search contact"
                  className="min-w-0 flex-1 rounded-md border border-white/[0.1] bg-black/20 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#d7a96d]/50"
                />
                <button
                  type="submit"
                  className="rounded-md border border-[#d7a96d]/38 bg-[#3a3028] px-3 py-2 text-xs font-semibold text-[#e9be86]"
                >
                  Search
                </button>
              </form>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="p-6 text-sm leading-6 text-white/48">
                No customer conversations yet.
              </div>
            ) : (
              conversations.map((item) => {
                const name = getConversationContactName(item);
                const channel = formatChannel(item.channel);
                const preview = getLastMessagePreview(item.messages);
                const isSelected = selectedConversation?.id === item.id;
                const itemOutcomeEvents = outcomeEvents.filter(
                  (event) => event.conversationId === item.id,
                );
                const hasBookedAction = itemOutcomeEvents.some(
                  (event) => event.type === AgentEventType.CONSULTATION_BOOKED,
                );
                const badge = getDialogBadge({
                  status: item.status,
                  hasQualifiedLead: itemOutcomeEvents.some(
                    (event) => event.type === AgentEventType.LEAD_QUALIFIED,
                  ),
                  hasBookedAction,
                  isSelected,
                });

                return (
                  <Link
                    key={item.id}
                    href={buildDialogsHref({
                      agent,
                      channel: channelFilter,
                      conversation: item.id,
                      sort: sortOrder,
                      tab: activeTab,
                      q: searchQuery,
                      page,
                    })}
                    className={[
                      "block border-b border-white/[0.075] px-5 py-5 transition hover:bg-white/[0.035]",
                      isSelected ? "bg-[#27231e]" : "",
                    ].join(" ")}
                  >
                    <div className="flex gap-4">
                      <span className="grid size-11 shrink-0 place-items-center rounded-full border border-white/[0.1] bg-white/[0.06] text-xs font-semibold text-white/76">
                        {getInitials(name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <p className="truncate text-base font-semibold text-white">{name}</p>
                          <span
                            className={[
                              "shrink-0 rounded-md border px-2.5 py-1 text-[11px] font-semibold",
                              badge.className,
                            ].join(" ")}
                          >
                            {badge.label}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-white/42">
                          {channel} - {formatRelative(item.updatedAt)}
                        </p>
                        <p className="mt-3 line-clamp-2 text-sm leading-6 text-white/66">
                          {preview}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
          {conversationCount > pageSize ? (
            <div className="flex items-center justify-between border-t border-white/[0.08] px-5 py-3 text-xs text-white/50">
              <Link
                href={buildDialogsHref({
                  agent,
                  channel: channelFilter,
                  sort: sortOrder,
                  q: searchQuery,
                  page: Math.max(1, page - 1),
                })}
                aria-disabled={page <= 1}
                className={page <= 1 ? "pointer-events-none opacity-30" : "hover:text-white"}
              >
                Previous
              </Link>
              <span>Page {Math.min(page, totalPages)} of {totalPages}</span>
              <Link
                href={buildDialogsHref({
                  agent,
                  channel: channelFilter,
                  sort: sortOrder,
                  q: searchQuery,
                  page: Math.min(totalPages, page + 1),
                })}
                aria-disabled={page >= totalPages}
                className={page >= totalPages ? "pointer-events-none opacity-30" : "hover:text-white"}
              >
                Next
              </Link>
            </div>
          ) : null}
        </section>

        <section className="flex min-h-[620px] flex-col overflow-hidden border-b border-white/[0.09] bg-[#0f100f] xl:h-full xl:min-h-0 xl:border-b-0 xl:border-r">
          <div className="border-b border-white/[0.09] p-5 md:p-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4">
                <span className="grid size-14 place-items-center rounded-full border border-[#d7a96d]/35 bg-[#2a2118] text-base font-semibold text-[#e9be86]">
                  {selectedInitials}
                </span>
                <div>
                  <h2 className="text-2xl font-semibold tracking-[-0.055em] text-white">
                    {selectedContactName}
                  </h2>
                  <p className="mt-1 flex items-center gap-2 text-sm text-white/54">
                    <span className="size-3 rounded-full border border-[#e9be86]/75" />
                    {selectedChannel}
                    {selectedConversation ? ` - ${formatRelative(selectedConversation.updatedAt)} ago` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {selectedConversation ? (
                  <span
                    className={[
                      "rounded-md border px-3 py-2 text-xs font-semibold",
                      conversationStatusClassName(selectedConversation.status),
                    ].join(" ")}
                  >
                    {conversationStatusLabel(selectedConversation.status)}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="mt-7 flex gap-6 overflow-x-auto text-sm">
              {DIALOG_TABS.map((item) => (
                <Link
                  key={item.value}
                  href={buildDialogsHref({
                    agent,
                    channel: channelFilter,
                    conversation: selectedConversation?.id,
                    sort: sortOrder,
                    tab: item.value,
                    q: searchQuery,
                    page,
                  })}
                  className={[
                    "shrink-0 pb-3 transition",
                    activeTab === item.value
                      ? "border-b-2 border-[#e9be86] text-[#e9be86]"
                      : "text-white/48 hover:text-white",
                  ].join(" ")}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-5 md:p-7">
            {activeTab === "conversation" ? (
              <div className="space-y-5">
                {selectedMessages.length === 0 ? (
                  <div className="rounded-xl border border-white/[0.09] bg-white/[0.04] p-5 text-white/56">
                    Customer conversations will appear here once the assistant starts replying.
                  </div>
                ) : (
                  selectedMessages.map((message) => {
                    if (isBusinessManualMessage(message)) {
                      return (
                        <div key={message.id} className="flex justify-end">
                          <div className="max-w-[82%] rounded-xl border border-[#d7a96d]/28 bg-[#3a2c1e] px-4 py-3 text-sm leading-6 text-white md:text-base">
                            <p className="mb-1 text-xs text-[#e9be86]/72">
                              Business owner - {formatMessageTime(message.createdAt)}
                            </p>
                            {message.content}
                          </div>
                        </div>
                      );
                    }

                    if (message.role === MessageRole.TOOL) {
                      const toolCall = buildToolCallView(message);

                      return (
                        <div key={message.id} className="flex justify-center">
                          <div className="w-full max-w-[86%] rounded-xl border border-[#d7a96d]/22 bg-[#211b15] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="flex min-w-0 gap-3">
                                <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-[#d7a96d]/32 bg-[#3a2c1e] text-[#e9be86]">
                                  <Wrench className="size-4" />
                                </span>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#e9be86]">
                                    Agent called
                                  </p>
                                  <p className="mt-1 truncate text-sm font-semibold text-white">
                                    {toolCall.title}
                                  </p>
                                  {toolCall.summary ? (
                                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-white/52">
                                      {toolCall.summary}
                                    </p>
                                  ) : null}
                                </div>
                              </div>
                              <div className="flex shrink-0 flex-col gap-1 sm:items-end">
                                <span className="w-fit rounded-md border border-white/[0.1] bg-white/[0.05] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/62">
                                  {toolCall.status}
                                </span>
                                <span className="text-[11px] text-white/34">
                                  {formatMessageTime(message.createdAt)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    const isAssistant = message.role === MessageRole.ASSISTANT;

                    return (
                      <div
                        key={message.id}
                        className={isAssistant ? "flex justify-end" : "flex items-start gap-3"}
                      >
                        {!isAssistant ? (
                          <span className="mt-1 grid size-9 shrink-0 place-items-center rounded-full border border-white/[0.1] bg-white/[0.07] text-xs font-semibold text-white/62">
                            {selectedInitials}
                          </span>
                        ) : null}
                        <div
                          className={[
                            "max-w-[82%] rounded-xl px-4 py-3 text-sm leading-6 md:text-base",
                            isAssistant
                              ? "bg-[#60442b] text-white"
                              : "bg-white/[0.08] text-white/82",
                          ].join(" ")}
                        >
                          <p className="mb-1 text-xs text-white/46">
                            {isAssistant ? "Behalfy AI" : selectedContactName.split("@")[0]} -{" "}
                            {formatMessageTime(message.createdAt)}
                          </p>
                          {message.content}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ) : null}

            {activeTab === "lead" ? (
              <div className="space-y-5">
                <div className="rounded-xl border border-white/[0.09] bg-white/[0.04] p-5">
                  <p className="text-sm font-semibold text-white">Captured lead details</p>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {leadRows.map(([label, value]) => (
                      <div key={label} className="rounded-lg border border-white/[0.08] bg-black/16 p-4">
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/38">
                          {label}
                        </p>
                        <p className="mt-2 break-words text-sm font-semibold text-white">
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-white/[0.09] bg-white/[0.04] p-5">
                  <p className="text-sm font-semibold text-white">Latest outcome</p>
                  <p className="mt-3 text-sm leading-6 text-white/56">
                    {selectedLatestOutcome
                      ? buildAgentWorkOutcome(selectedLatestOutcome).detail
                      : "No tool outcomes captured for this conversation yet."}
                  </p>
                </div>
              </div>
            ) : null}

            {activeTab === "activity" ? (
              <div className="space-y-4">
                {selectedToolMessages.length === 0 ? (
                  <div className="rounded-xl border border-white/[0.09] bg-white/[0.04] p-5 text-white/56">
                    No agent tool calls recorded for this conversation yet.
                  </div>
                ) : (
                  selectedToolMessages.map((message) => {
                    const toolCall = buildToolCallView(message);

                    return (
                      <div
                        key={message.id}
                        className="rounded-xl border border-white/[0.08] bg-black/16 p-4"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-white">{toolCall.title}</p>
                            <p className="mt-2 text-xs leading-5 text-white/52">
                              {toolCall.summary || "Tool call completed."}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-col gap-1 sm:items-end">
                            <span className="w-fit rounded-md border border-[#d7a96d]/28 bg-[#3a2c1e] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#e9be86]">
                              {toolCall.status}
                            </span>
                            <span className="text-[11px] text-white/34">
                              {formatMessageTime(message.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ) : null}
          </div>
        </section>

        <aside className="bg-[#10100e] xl:h-full xl:overflow-hidden">
          <div className="border-b border-white/[0.09] p-5">
            <p className="text-lg font-semibold text-white">Lead stage</p>
            <div className="mt-5 rounded-md border border-[#d7a96d]/28 bg-[#3a2c1e] p-4">
              <p className="text-lg font-semibold text-[#e9be86]">{selectedLeadStage}</p>
              <p className="mt-2 text-sm leading-6 text-white/48">
                {selectedBooked
                  ? "A consultation has been booked."
                  : selectedQualified
                    ? "Date, location and contact details are qualified."
                    : "The agent is still collecting the required details."}
              </p>
            </div>
          </div>

          <div className="border-b border-white/[0.09] p-5">
            <p className="text-lg font-semibold text-white">Lead details</p>
            <div className="mt-5 space-y-3 text-sm">
              {leadRows.map(([label, value]) => (
                <div key={label} className="grid grid-cols-[82px_minmax(0,1fr)] gap-3">
                  <span className="text-white/42">{label}</span>
                  <span className="min-w-0 truncate text-white">{value}</span>
                </div>
              ))}
            </div>
            <Link
              href="/client/leads"
              className="mt-6 flex w-full items-center justify-center rounded-lg bg-[#3a3028] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#473a2f]"
            >
              View full profile
            </Link>
          </div>

          <div className="border-b border-white/[0.09] p-5">
            <p className="text-lg font-semibold text-white">Next step</p>
            <div className="mt-5 flex gap-4">
              <div className="grid size-11 shrink-0 place-items-center rounded-lg border border-[#d7a96d]/32 text-[#e9be86]">
                <CalendarCheck2 className="size-5" />
              </div>
              <div>
                <p className="text-base text-white">{latestWork?.title ?? "Keep qualifying"}</p>
                <p className="mt-3 text-sm leading-6 text-white/48">
                  {latestWork?.detail ??
                    "The assistant will collect details and move the conversation forward."}
                </p>
              </div>
            </div>
            <Link
              href="/client/leads"
              className="mt-6 flex w-full items-center justify-center rounded-lg bg-[#3a3028] px-5 py-3 text-sm font-semibold text-[#e9be86] transition hover:bg-[#473a2f]"
            >
              {targetActions.length > 0 ? "Outcome recorded" : "Review leads"}
            </Link>
          </div>

          <div className="p-5">
            <p className="text-lg font-semibold text-white">Workspace</p>
            <div className="mt-5 grid grid-cols-3 gap-3 text-center">
              {[
                ["Agents", agents.filter((item) => item.status === "ACTIVE").length],
                ["Dialogs", conversationCount],
                ["Messages", visibleMessageCount],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-white/[0.08] bg-black/16 p-3">
                  <p className="text-xl font-semibold text-white">{value}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-white/38">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </CabinetShell>
  );
}
