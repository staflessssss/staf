import Link from "next/link";

import { requireClientSession } from "@/lib/client-auth";
import { db } from "@/lib/db";

type DialogsPageProps = {
  searchParams: Promise<{ agent?: string; conversation?: string }>;
};

function channelLabel(channel: string) {
  return channel.replaceAll("_", " ");
}

export default async function ClientDialogsPage({
  searchParams,
}: DialogsPageProps) {
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

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-5xl font-extrabold tracking-tight">Dialogs</h1>
          <p className="mt-3 text-lg text-[#554336]">
            Review conversations across your agents in a clean read-only workspace.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 rounded-full bg-[#f0eee9] p-1.5">
          <Link
            href="/client/dialogs"
            className={`rounded-full px-5 py-2 text-sm font-semibold ${!agent ? "bg-[#8d4b00] text-white" : "text-[#636563]"}`}
          >
            All Agents
          </Link>
          {agents.slice(0, 3).map((item) => (
            <Link
              key={item.id}
              href={`/client/dialogs?agent=${item.id}`}
              className={`rounded-full px-5 py-2 text-sm font-semibold ${agent === item.id ? "bg-[#8d4b00] text-white" : "text-[#636563]"}`}
            >
              {item.name}
            </Link>
          ))}
        </div>
      </header>

      {conversations.length === 0 ? (
        <div className="rounded-xl bg-white p-8 text-sm text-[#554336] shadow-sm">
          Customer dialogs will appear here after your agents start handling messages.
        </div>
      ) : (
        <div className="grid min-h-[640px] grid-cols-1 gap-8 xl:grid-cols-12 xl:items-start">
          <div className="overflow-hidden rounded-xl bg-[#f5f3ee] xl:col-span-4">
            <div className="border-b border-[#dbc2b0]/30 p-5">
              <input
                className="w-full rounded-full bg-white px-4 py-3 text-sm outline-none"
                placeholder="Filter by agent or contact..."
                readOnly
              />
            </div>
            <div className="max-h-[760px] overflow-y-auto">
              {conversations.map((item) => {
                const isActive = selectedConversation?.id === item.id;
                const lastMessage = item.messages[item.messages.length - 1];

                return (
                  <Link
                    key={item.id}
                    href={`/client/dialogs?${agent ? `agent=${agent}&` : ""}conversation=${item.id}`}
                    className={`block border-b border-[#dbc2b0]/10 p-6 transition ${isActive ? "border-l-4 border-l-[#8d4b00] bg-white" : "hover:bg-[#eae8e3]"}`}
                  >
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-full bg-[#e2e3e0] text-sm font-bold text-[#636563]">
                          {item.contactId.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="text-base font-bold">{item.contactId}</h3>
                          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8d4b00]">
                            {item.agent.name}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] text-[#636563]">
                          {item.updatedAt.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                        <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-[#636563]">
                          {channelLabel(item.channel)}
                        </p>
                      </div>
                    </div>
                    <p className="line-clamp-2 text-sm leading-6 text-[#554336]">
                      {lastMessage?.content ?? "No messages yet."}
                    </p>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex min-h-[640px] flex-col rounded-xl border border-[#eae8e3] bg-white shadow-sm xl:col-span-8">
            {selectedConversation ? (
              <>
                <div className="flex items-center justify-between border-b border-[#eae8e3] px-8 py-6">
                  <div className="flex items-center gap-4">
                    <div className="flex size-12 items-center justify-center rounded-full bg-[#e2e3e0] text-base font-bold text-[#636563]">
                      {selectedConversation.contactId.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">{selectedConversation.contactId}</h2>
                      <p className="text-xs text-[#636563]">
                        Active via {channelLabel(selectedConversation.channel)} • Managed by{" "}
                        {selectedConversation.agent.name}
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/client/leads"
                    className="rounded-xl border border-[#dbc2b0] px-5 py-2.5 text-sm font-semibold text-[#1b1c19] transition hover:bg-[#f5f3ee]"
                  >
                    Open Leads
                  </Link>
                </div>

                <div className="flex-1 space-y-8 overflow-y-auto p-10">
                  {selectedConversation.messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.role === "USER" ? "" : "justify-end"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-[24px] p-5 ${message.role === "USER" ? "bg-[#f5f3ee] text-[#1b1c19]" : message.role === "ASSISTANT" ? "border border-[#f0d2b8] bg-[#fff6ee] text-[#1b1c19]" : "border border-[#c8d8ef] bg-[#eef5ff] text-[#175cd3]"}`}
                      >
                        <p className="leading-7">{message.content}</p>
                        <span className="mt-3 block text-[10px] font-medium opacity-65">
                          {message.createdAt.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-[#eae8e3] bg-[#faf6f0] px-6 py-5">
                  <div className="rounded-2xl border border-[#dbc2b0]/40 bg-white px-4 py-4 text-sm text-[#636563]">
                    Dialogs are read-only for clients in v1.
                  </div>
                </div>
              </>
            ) : (
              <div className="p-10 text-sm text-[#554336]">Choose a dialog from the list.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
