import Link from "next/link";
import { MessageRole, type Prisma } from "@prisma/client";
import {
  BarChart3,
  CalendarCheck2,
  CalendarDays,
  ChevronDown,
  FileText,
  Home,
  ImageIcon,
  LinkIcon,
  MessageSquareText,
  MoreVertical,
  Paperclip,
  Plug,
  Search,
  Send,
  Settings,
  Target,
  UsersRound,
} from "lucide-react";

import { LogoutButton } from "@/components/auth/logout-button";
import {
  getLeadDetails,
  getToolActionLabel,
  getToolStatusLabel,
  getToolSummary,
} from "@/lib/client-analytics";
import { requireClientSession } from "@/lib/client-auth";
import { db } from "@/lib/db";
import { isQualifiedLeadToolMessage } from "@/lib/lead-qualification";

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

function getInitials(value: string) {
  const cleaned = value.includes("@") ? value.split("@")[0] : value;
  const parts = cleaned
    .replace(/[^a-zA-Z0-9\s._-]/g, " ")
    .split(/[\s._-]+/)
    .filter(Boolean);

  return (parts[0]?.[0] ?? "C").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase();
}

function getContactName(contactId: string) {
  if (contactId.includes("@")) return contactId;

  return contactId
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getLastMessagePreview(messages: Array<{ content: string; role: MessageRole }>) {
  const message = messages.find((item) => item.role === MessageRole.USER || item.role === MessageRole.ASSISTANT);
  const content = message?.content.trim();

  if (!content) return "No visible messages yet.";

  return content.length > 74 ? `${content.slice(0, 71)}...` : content;
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
        [details.coupleName ?? details.contactId, [details.callDate, details.callTime].filter(Boolean).join(" at ")]
          .filter(Boolean)
          .join(" - ") || getToolSummary(event.toolResult) || status,
    };
  }

  if (event.toolName === "check_consultation_calendar") {
    return {
      title: status === "Available" ? "Call time available" : "Call time reviewed",
      detail:
        [[details.callDate, details.callTime].filter(Boolean).join(" at "), status]
          .filter(Boolean)
          .join(" - ") || getToolSummary(event.toolResult) || status,
    };
  }

  if (event.toolName === "check_wedding_availability") {
    return {
      title: status === "Available" ? "Wedding date available" : "Wedding date reviewed",
      detail:
        [details.weddingDate, details.location, details.capacity ? `${details.bookedCount ?? 0}/${details.capacity} booked` : null]
          .filter(Boolean)
          .join(" - ") || getToolSummary(event.toolResult) || status,
    };
  }

  return {
    title: getToolActionLabel(event.toolName),
    detail: getToolSummary(event.toolResult) ?? status,
  };
}

export default async function ClientDashboardPage() {
  const session = await requireClientSession();
  const tenantId = session.user.tenantId;

  const [tenant, agents, recentConversations, conversationCount, visibleMessageCount, toolMessages] =
    await Promise.all([
      db.tenant.findUnique({
        where: { id: tenantId },
        include: {
          _count: {
            select: {
              channelConnections: true,
              integrationConnections: true,
            },
          },
        },
      }),
      db.agent.findMany({
        where: { tenantId },
        include: { channel: true },
        orderBy: { updatedAt: "desc" },
      }),
      db.conversation.findMany({
        where: {
          agent: { tenantId },
        },
        include: {
          agent: true,
          messages: {
            where: {
              role: {
                in: [MessageRole.USER, MessageRole.ASSISTANT],
              },
            },
            orderBy: { createdAt: "desc" },
            take: 8,
          },
          _count: {
            select: {
              messages: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 5,
      }),
      db.conversation.count({
        where: {
          agent: { tenantId },
        },
      }),
      db.message.count({
        where: {
          conversation: {
            agent: { tenantId },
          },
          role: {
            in: [MessageRole.USER, MessageRole.ASSISTANT],
          },
        },
      }),
      db.message.findMany({
        where: {
          conversation: {
            agent: { tenantId },
          },
          role: MessageRole.TOOL,
          NOT: {
            toolName: null,
          },
        },
        include: {
          conversation: {
            include: {
              agent: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 24,
      }),
    ]);

  if (!tenant) return <div>Client not found.</div>;

  const activeAgents = agents.filter((agent) => agent.status === "ACTIVE");
  const targetActions = toolMessages.filter((message) =>
    isQualifiedLeadToolMessage({
      toolName: message.toolName,
      toolResult: message.toolResult,
    }),
  );
  const selectedConversation = recentConversations[0] ?? null;
  const selectedMessages = selectedConversation ? [...selectedConversation.messages].reverse() : [];
  const selectedContactName = selectedConversation ? getContactName(selectedConversation.contactId) : "No conversation yet";
  const selectedChannel = selectedConversation ? formatChannel(selectedConversation.channel) : "No channel";
  const selectedInitials = getInitials(selectedContactName);
  const latestOutcome = targetActions[0] ?? toolMessages[0] ?? null;
  const latestLeadDetails = latestOutcome ? getLeadDetails(latestOutcome, latestOutcome.conversation.contactId) : null;
  const latestWork = latestOutcome ? buildAgentWorkOutcome(latestOutcome) : null;
  const leadScore = Math.min(96, 58 + targetActions.length * 14 + Math.min(agents.length, 3) * 4);
  const navItems = [
    [Home, "Overview", "/client", null],
    [MessageSquareText, "Conversations", "/client/dialogs", conversationCount || null],
    [UsersRound, "Leads", "/client/leads", targetActions.length || null],
    [CalendarDays, "Bookings", "/client/leads", null],
    [Target, "Outcomes", "/client/leads", null],
    [BarChart3, "Analytics", "/client", null],
  ] as const;
  const lowerNav = [
    [Plug, "Integrations", "/client/connections"],
    [Settings, "Settings", "/client/agents"],
  ] as const;
  const leadRows = [
    ["Name", latestLeadDetails?.coupleName ?? selectedContactName],
    ["Email", selectedConversation?.contactId.includes("@") ? selectedConversation.contactId : "Not captured yet"],
    ["Channel", selectedChannel],
    ["Agent", selectedConversation?.agent.name ?? activeAgents[0]?.name ?? "No active agent"],
    ["Date", latestLeadDetails?.weddingDate ?? latestLeadDetails?.callDate ?? "Not captured yet"],
    ["Location", latestLeadDetails?.location ?? "Not captured yet"],
  ];

  return (
    <main className="min-h-screen overflow-hidden bg-[#070705] p-3 text-[#f7f0e7] md:p-5">
      <section className="relative mx-auto grid min-h-[calc(100vh-40px)] max-w-[1880px] overflow-hidden rounded-[1.6rem] border border-[#d7a96d]/70 bg-[#0d0d0b] shadow-[0_0_0_1px_rgba(255,255,255,0.045),0_0_48px_rgba(215,169,109,0.32),0_46px_140px_rgba(0,0,0,0.66)] xl:grid-cols-[350px_420px_minmax(560px,1fr)_430px]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_9%_-4%,rgba(226,176,111,0.14),transparent_27%),radial-gradient(circle_at_72%_10%,rgba(255,255,255,0.06),transparent_24%),linear-gradient(120deg,rgba(255,255,255,0.025),transparent_38%)]" />

        <aside className="relative hidden border-r border-white/[0.09] bg-[#10100e]/88 p-7 xl:flex xl:flex-col">
          <div className="flex items-center justify-between">
            <Link href="/client" className="flex items-center gap-4">
              <span
                className="block size-12 bg-[#d7a96d]"
                style={{
                  WebkitMask: "url('/assets/landing/behalfy-mark.svg') center / contain no-repeat",
                  mask: "url('/assets/landing/behalfy-mark.svg') center / contain no-repeat",
                }}
              />
              <span className="text-[2rem] font-semibold tracking-[-0.07em] text-white">Behalfy</span>
            </Link>
            <span className="text-3xl text-white/58">‹</span>
          </div>

          <nav className="mt-14 space-y-2">
            {navItems.map(([Icon, label, href, badge], index) => (
              <Link
                key={label}
                href={href}
                className={[
                  "flex items-center justify-between rounded-xl px-4 py-3.5 text-lg transition",
                  index === 1
                    ? "bg-[#3a2c1e] text-white ring-1 ring-[#d7a96d]/34 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]"
                    : "text-white/72 hover:bg-white/[0.04] hover:text-white",
                ].join(" ")}
              >
                <span className="flex items-center gap-4">
                  <Icon className="size-5" />
                  {label}
                </span>
                {badge ? (
                  <span className="rounded-md border border-[#d7a96d]/42 px-2.5 py-0.5 text-sm text-[#e9be86]">{badge}</span>
                ) : null}
              </Link>
            ))}
          </nav>

          <div className="mt-9 border-t border-white/[0.09] pt-7">
            <div className="space-y-2">
              {lowerNav.map(([Icon, label, href]) => (
                <Link
                  key={label}
                  href={href}
                  className="flex items-center gap-4 rounded-xl px-4 py-3.5 text-lg text-white/72 transition hover:bg-white/[0.04] hover:text-white"
                >
                  <Icon className="size-5" />
                  {label}
                </Link>
              ))}
            </div>
          </div>

          <div className="mt-auto border-t border-white/[0.09] pt-5">
            <div className="mb-4 flex items-center gap-3">
              <span className="relative grid size-12 place-items-center rounded-full border border-[#d7a96d]/35 bg-[#271f17] text-sm font-semibold text-[#e9be86]">
                {getInitials(session.user.name ?? session.user.email ?? "Client")}
                <span className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-[#10100e] bg-[#34d37d]" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-white">{session.user.name ?? tenant.name}</p>
                <p className="text-sm text-white/46">Client</p>
              </div>
              <ChevronDown className="ml-auto size-4 text-white/42" />
            </div>
            <LogoutButton label="Sign out" variant="sidebar" />
          </div>
        </aside>

        <section className="relative border-r border-white/[0.09] bg-[#11110f]">
          <div className="border-b border-white/[0.09] p-7">
            <div className="flex items-center justify-between gap-4 xl:block">
              <div>
                <h1 className="text-3xl font-semibold tracking-[-0.055em] text-white">Conversations</h1>
                <p className="mt-2 text-sm text-white/42">{tenant.name}</p>
              </div>
              <Link href="/client/dialogs" className="rounded-lg border border-[#d7a96d]/38 px-3 py-2 text-sm text-[#e9be86] xl:hidden">
                Open
              </Link>
            </div>
            <div className="mt-6 flex items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-lg border border-white/[0.1] px-4 py-2 text-sm text-white/68">
                All channels <ChevronDown className="size-3" />
              </span>
              <span className="inline-flex items-center gap-2 rounded-lg border border-white/[0.1] px-4 py-2 text-sm text-white/68">
                Newest <ChevronDown className="size-3" />
              </span>
              <Search className="ml-auto size-5 text-white/52" />
            </div>
          </div>

          <div>
            {recentConversations.length === 0 ? (
              <div className="p-7 text-sm leading-6 text-white/48">No customer conversations yet.</div>
            ) : (
              recentConversations.map((conversation, index) => {
                const name = getContactName(conversation.contactId);
                const channel = formatChannel(conversation.channel);
                const preview = getLastMessagePreview(conversation.messages);
                const isBooked = targetActions.some((action) => action.conversationId === conversation.id);

                return (
                  <Link
                    key={conversation.id}
                    href="/client/dialogs"
                    className={[
                      "block border-b border-white/[0.075] px-6 py-5 transition hover:bg-white/[0.035]",
                      index === 0 ? "bg-[#27231e]" : "",
                    ].join(" ")}
                  >
                    <div className="flex gap-4">
                      <span className="grid size-12 shrink-0 place-items-center rounded-full border border-white/[0.1] bg-white/[0.06] text-sm font-semibold text-white/76">
                        {getInitials(name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <p className="truncate text-lg font-semibold text-white">{name}</p>
                          <span
                            className={[
                              "rounded-md border px-2.5 py-1 text-sm",
                              isBooked
                                ? "border-[#54b67a]/45 text-[#78d49a]"
                                : index === 0
                                  ? "border-[#d7a96d]/45 text-[#e9be86]"
                                  : "border-[#5d82c8]/45 text-[#8aa9ed]",
                            ].join(" ")}
                          >
                            {isBooked ? "Booked" : index === 0 ? "New" : "Lead"}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-white/42">
                          {channel} · {formatRelative(conversation.updatedAt)}
                        </p>
                        <p className="mt-3 text-base leading-6 text-white/72">{preview}</p>
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>

          <Link href="/client/dialogs" className="block px-7 py-5 text-base text-white/72">
            View all conversations →
          </Link>
        </section>

        <section className="relative flex min-h-[720px] flex-col border-r border-white/[0.09] bg-[#11110f]">
          <div className="border-b border-white/[0.09] p-7">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-5">
                <span className="grid size-16 place-items-center rounded-full border border-[#d7a96d]/35 bg-[#2a2118] text-lg font-semibold text-[#e9be86]">
                  {selectedInitials}
                </span>
                <div>
                  <h2 className="text-3xl font-semibold tracking-[-0.055em] text-white">{selectedContactName}</h2>
                  <p className="mt-2 flex items-center gap-2 text-base text-white/54">
                    <span className="size-4 rounded-full border border-[#e9be86]/75" />
                    {selectedChannel} {selectedConversation ? `· ${formatRelative(selectedConversation.updatedAt)} ago` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-md border border-[#d7a96d]/45 px-4 py-2 text-base text-[#e9be86]">
                  {selectedConversation ? "New" : "Empty"}
                </span>
                <span className="grid size-10 place-items-center rounded-full border border-white/[0.09] text-white/54">
                  <MoreVertical className="size-5" />
                </span>
              </div>
            </div>

            <div className="mt-10 flex gap-12 text-lg">
              {["Conversation", "Lead details", "Notes", "Activity"].map((tab, index) => (
                <span
                  key={tab}
                  className={index === 0 ? "border-b-2 border-[#e9be86] pb-4 text-[#e9be86]" : "text-white/48"}
                >
                  {tab}
                </span>
              ))}
            </div>
          </div>

          <div className="flex-1 space-y-6 overflow-hidden p-8">
            {selectedMessages.length === 0 ? (
              <div className="rounded-xl border border-white/[0.09] bg-white/[0.04] p-5 text-white/56">
                Customer conversations will appear here once the assistant starts replying.
              </div>
            ) : (
              selectedMessages.map((message) => {
                const isAssistant = message.role === MessageRole.ASSISTANT;

                return (
                  <div
                    key={message.id}
                    className={isAssistant ? "flex justify-end" : "flex items-start gap-3"}
                  >
                    {!isAssistant ? (
                      <span className="mt-1 grid size-10 shrink-0 place-items-center rounded-full border border-white/[0.1] bg-white/[0.07] text-xs font-semibold text-white/62">
                        {selectedInitials}
                      </span>
                    ) : null}
                    <div
                      className={[
                        "max-w-[76%] rounded-xl px-4 py-3 text-lg leading-7",
                        isAssistant ? "bg-[#60442b] text-white" : "bg-white/[0.08] text-white/82",
                      ].join(" ")}
                    >
                      <p className="mb-1 text-sm text-white/46">
                        {isAssistant ? "Behalfy AI" : selectedContactName.split("@")[0]} · {formatMessageTime(message.createdAt)}
                      </p>
                      {message.content}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="mx-8 mb-7 rounded-xl border border-white/[0.09] bg-black/18 p-5">
            <p className="text-lg text-white/38">Reply or type a message...</p>
            <div className="mt-7 flex items-center justify-between">
              <div className="flex gap-5 text-white/42">
                <MessageSquareText className="size-5" />
                <Paperclip className="size-5" />
                <LinkIcon className="size-5" />
                <ImageIcon className="size-5" />
                <FileText className="size-5" />
                <CalendarCheck2 className="size-5" />
              </div>
              <span className="grid size-12 place-items-center rounded-full bg-[#e9be86] text-black">
                <Send className="size-5" />
              </span>
            </div>
          </div>
        </section>

        <aside className="relative bg-[#10100e]/96 p-6">
          <div className="rounded-xl border border-white/[0.09] bg-white/[0.025] p-6">
            <div className="flex items-center justify-between">
              <p className="text-xl font-semibold text-white">Lead score</p>
              <MoreVertical className="size-5 text-white/42" />
            </div>
            <div className="mt-7 flex items-center gap-6">
              <div className="grid size-24 place-items-center rounded-full border-[6px] border-[#d7a96d] text-3xl font-normal text-white">
                {leadScore}
              </div>
              <div>
                <p className="text-xl font-semibold text-white">{targetActions.length > 0 ? "High intent" : "In progress"}</p>
                <p className="mt-2 text-lg leading-7 text-white/48">
                  {activeAgents.length > 0 ? "Agent active" : "Needs setup"}
                  <br />
                  {targetActions.length > 0 ? "Likely to convert" : "Collecting details"}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-white/[0.09] bg-white/[0.025] p-6">
            <p className="text-xl font-semibold text-white">Lead details</p>
            <div className="mt-7 space-y-4 text-lg">
              {leadRows.map(([label, value]) => (
                <div key={label} className="grid grid-cols-[96px_minmax(0,1fr)] gap-4">
                  <span className="text-white/42">{label}</span>
                  <span className="min-w-0 truncate text-white">{value}</span>
                </div>
              ))}
            </div>
            <Link
              href="/client/leads"
              className="mt-7 flex w-full items-center justify-center rounded-lg bg-[#3a3028] px-5 py-4 text-lg font-semibold text-white transition hover:bg-[#473a2f]"
            >
              View full profile →
            </Link>
          </div>

          <div className="mt-4 rounded-xl border border-white/[0.09] bg-white/[0.025] p-6">
            <p className="text-xl font-semibold text-white">Next step</p>
            <div className="mt-7 flex gap-4">
              <div className="grid size-11 place-items-center rounded-lg border border-[#d7a96d]/32 text-[#e9be86]">
                <CalendarCheck2 className="size-5" />
              </div>
              <div>
                <p className="text-lg text-white">{latestWork?.title ?? "Keep qualifying"}</p>
                <p className="mt-4 text-base leading-7 text-white/48">
                  {latestWork?.detail ?? "The assistant will collect details and move the conversation forward."}
                </p>
              </div>
            </div>
            <Link
              href="/client/leads"
              className="mt-7 flex w-full items-center justify-center rounded-lg bg-[#3a3028] px-5 py-4 text-lg font-semibold text-[#e9be86] transition hover:bg-[#473a2f]"
            >
              {targetActions.length > 0 ? "Outcome recorded" : "Review leads"} →
            </Link>
          </div>

          <div className="mt-4 rounded-xl border border-white/[0.09] bg-white/[0.025] p-6">
            <p className="text-xl font-semibold text-white">Workspace</p>
            <div className="mt-5 grid grid-cols-3 gap-3 text-center">
              {[
                ["Agents", activeAgents.length],
                ["Dialogs", conversationCount],
                ["Messages", visibleMessageCount],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-white/[0.08] bg-black/16 p-3">
                  <p className="text-2xl font-semibold text-white">{value}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-white/38">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

