import Link from "next/link";
import { ConversationStatus } from "@prisma/client";

import { requireClientSession } from "@/lib/client-auth";
import { db } from "@/lib/db";
import { isOperatorMessage } from "@/lib/operator-handoff";

type DialogsPageProps = {
  searchParams: Promise<{ agent?: string; conversation?: string }>;
};

function channelLabel(channel: string) {
  return channel.replaceAll("_", " ");
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

function messageBubbleKind(message: { role: string }) {
  if (message.role === "USER") {
    return "user";
  }

  if (message.role === "ASSISTANT") {
    return "assistant";
  }

  return "system";
}

function conversationStatusClassName(status: ConversationStatus) {
  switch (status) {
    case ConversationStatus.ESCALATED:
      return "bg-[#fff4df] text-[#9a6400]";
    case ConversationStatus.CLOSED:
      return "bg-[#f3f3f6] text-[#6b6a78]";
    case ConversationStatus.ACTIVE:
    default:
      return "bg-[#efecff] text-[#4648d4]";
  }
}

export default async function ClientDialogsPage({ searchParams }: DialogsPageProps) {
  const session = await requireClientSession();
  const tenantId = session.user.tenantId;
  const { agent, conversation } = await searchParams;

  const [agents, conversations] = await Promise.all([
    db.agent.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
    }),
    db.conversation.findMany({
      where: {
        agent: {
          tenantId,
          ...(agent ? { id: agent } : {}),
        },
        messages: {
          some: {},
        },
      },
      include: {
        agent: true,
        messages: {
          orderBy: { createdAt: "asc" },
          take: 24,
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const selectedConversation =
    conversations.find((item) => item.id === conversation) ?? conversations[0];
  const selectedVisibleMessages =
    selectedConversation?.messages.filter((message) => !isOperatorMessage(message as never)) ?? [];

  return (
    <div className="space-y-10">
      <header className="rounded-[28px] bg-[linear-gradient(135deg,#ffffff_0%,#f4f2ff_52%,#e9edff_100%)] p-8 shadow-[0_18px_40px_rgba(24,24,54,0.06)] ring-1 ring-[#d8d6fe]/80 md:p-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#5c5c7e]">
              Workspace
            </p>
            <h1 className="mt-2 font-heading text-5xl font-bold tracking-tight text-[#181836]">
              Dialogs
            </h1>
            <p className="mt-3 max-w-2xl text-lg text-[#464554]">
              Review conversations across your agents in a clean read-only workspace.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white/80 p-1.5 shadow-[0_10px_24px_rgba(24,24,54,0.05)] ring-1 ring-[#d8d6fe]/70">
            <Link
              href="/client/dialogs"
              className={`rounded-xl px-5 py-2 text-sm font-semibold ${
                !agent ? "bg-[#4648d4] text-white shadow-sm" : "text-[#5c5c7e]"
              }`}
            >
              All Agents
            </Link>
            {agents.slice(0, 3).map((item) => (
              <Link
                key={item.id}
                href={`/client/dialogs?agent=${item.id}`}
                className={`rounded-xl px-5 py-2 text-sm font-semibold ${
                  agent === item.id ? "bg-[#4648d4] text-white shadow-sm" : "text-[#5c5c7e]"
                }`}
              >
                {item.name}
              </Link>
            ))}
          </div>
        </div>
      </header>

      {conversations.length === 0 ? (
        <div className="rounded-[24px] bg-white p-8 text-sm text-[#464554] shadow-[0_12px_28px_rgba(24,24,54,0.05)] ring-1 ring-[#d8d6fe]/70">
          Customer dialogs will appear here after your agents start handling messages.
        </div>
      ) : (
        <div className="grid min-h-[640px] grid-cols-1 gap-8 xl:grid-cols-12 xl:items-start">
          <div className="overflow-hidden rounded-[24px] bg-[#f5f2ff] shadow-[0_12px_28px_rgba(24,24,54,0.05)] ring-1 ring-[#d8d6fe]/70 xl:col-span-4">
            <div className="border-b border-[#eef0ff] p-5">
              <input
                className="w-full rounded-2xl bg-white px-4 py-3 text-sm outline-none ring-1 ring-[#d8d6fe]/70"
                placeholder="Filter by agent or contact..."
                readOnly
              />
            </div>
            <div className="max-h-[760px] overflow-y-auto">
              {conversations.map((item) => {
                const isActive = selectedConversation?.id === item.id;
                const visibleMessages = item.messages.filter(
                  (message) => !isOperatorMessage(message as never),
                );
                const lastMessage = visibleMessages[visibleMessages.length - 1];

                return (
                  <Link
                    key={item.id}
                    href={`/client/dialogs?${agent ? `agent=${agent}&` : ""}conversation=${item.id}`}
                    className={`block border-b border-[#eef0ff] p-6 transition ${
                      isActive ? "bg-white shadow-[inset_4px_0_0_0_#4648d4]" : "hover:bg-[#f8f8ff]"
                    }`}
                  >
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-2xl bg-[#efecff] text-sm font-bold text-[#4648d4]">
                          {item.contactId.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-[#181836]">{item.contactId}</h3>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#4648d4]">
                              {item.agent.name}
                            </p>
                            <span
                              className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${conversationStatusClassName(item.status)}`}
                            >
                              {conversationStatusLabel(item.status)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] text-[#5c5c7e]">
                          {item.updatedAt.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                        <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-[#5c5c7e]">
                          {channelLabel(item.channel)}
                        </p>
                      </div>
                    </div>
                    <p className="line-clamp-2 text-sm leading-6 text-[#464554]">
                      {lastMessage?.content ?? "No messages yet."}
                    </p>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex min-h-[640px] flex-col rounded-[24px] bg-white shadow-[0_12px_28px_rgba(24,24,54,0.05)] ring-1 ring-[#d8d6fe]/70 xl:col-span-8">
            {selectedConversation ? (
              <>
                <div className="flex items-center justify-between border-b border-[#eef0ff] px-8 py-6">
                  <div className="flex items-center gap-4">
                    <div className="flex size-12 items-center justify-center rounded-2xl bg-[#efecff] text-base font-bold text-[#4648d4]">
                      {selectedConversation.contactId.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h2 className="font-heading text-xl font-bold text-[#181836]">
                        {selectedConversation.contactId}
                      </h2>
                      <p className="text-xs text-[#5c5c7e]">
                        Active via {channelLabel(selectedConversation.channel)} • Managed by{" "}
                        {selectedConversation.agent.name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] ${conversationStatusClassName(
                        selectedConversation.status,
                      )}`}
                    >
                      {conversationStatusLabel(selectedConversation.status)}
                    </span>
                    <Link
                      href="/client/leads"
                      className="rounded-xl bg-[#efecff] px-5 py-2.5 text-sm font-semibold text-[#4648d4] transition hover:bg-[#e8e5ff]"
                    >
                      Open Leads
                    </Link>
                  </div>
                </div>

                <div className="flex-1 space-y-8 overflow-y-auto p-10">
                  {selectedVisibleMessages.map((message) => {
                    const kind = messageBubbleKind(message);

                    return (
                      <div
                        key={message.id}
                        className={`flex ${kind === "user" ? "" : "justify-end"}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-[24px] p-5 ${
                            kind === "user"
                              ? "bg-[#f5f2ff] text-[#181836]"
                              : kind === "assistant"
                                  ? "bg-white text-[#181836] ring-1 ring-[#d8d6fe]/70"
                                  : "bg-[#eef2ff] text-[#4648d4] ring-1 ring-[#d8d6fe]/70"
                          }`}
                        >
                        <p className="leading-7">{message.content}</p>
                        <span className="mt-3 block text-[10px] font-medium opacity-65">
                          {message.createdAt.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    );
                  })}
                </div>

                <div className="border-t border-[#eef0ff] px-6 py-5">
                  {selectedConversation.status === ConversationStatus.ESCALATED ? (
                    <div className="rounded-2xl bg-[#fff8ea] px-4 py-4 text-sm text-[#7a5a00] ring-1 ring-[#f5d18c]">
                      Our team is reviewing this dialog. New customer messages stay visible here.
                    </div>
                  ) : (
                    <div className="rounded-2xl bg-[#f8f8ff] px-4 py-4 text-sm text-[#5c5c7e] ring-1 ring-[#d8d6fe]/70">
                      Dialogs are read-only for the client cabinet.
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="p-10 text-sm text-[#464554]">Choose a dialog from the list.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
