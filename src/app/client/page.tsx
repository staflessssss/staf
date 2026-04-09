import Link from "next/link";
import { MessageRole } from "@prisma/client";

import { StatusBadge } from "@/components/stafless/foundation";
import { requireClientSession } from "@/lib/client-auth";
import { db } from "@/lib/db";

function formatShortDate(value: Date) {
  return value.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default async function ClientDashboardPage() {
  const session = await requireClientSession();
  const tenantId = session.user.tenantId;

  const [tenant, agents, recentConversations, conversationCount, messages] = await Promise.all([
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
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 4,
    }),
    db.conversation.count({
      where: {
        agent: { tenantId },
      },
    }),
    db.message.findMany({
      where: {
        conversation: {
          agent: { tenantId },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  if (!tenant) return <div>Client not found.</div>;

  const leadActions = messages.filter(
    (message) => message.role === MessageRole.TOOL && message.toolName,
  );
  const activeAgents = agents.filter((agent) => agent.status === "ACTIVE");
  const bars = [40, 55, 35, 75, 90, 65, 45, 30, 50, 60, 40, 25];

  return (
    <div className="space-y-12">
      <section className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-center">
        <div className="relative overflow-hidden rounded-xl bg-[#f5eadb] p-10 lg:col-span-7">
          <div className="relative z-10">
            <h1 className="max-w-2xl text-4xl font-extrabold tracking-tight text-[#1b1c19]">
              Your agents are active and assisting customers
            </h1>
            <p className="mt-3 max-w-xl text-base leading-7 text-[#554336]">
              Real-time engagement is steady across your connected channels. Use this dashboard to
              track business activity, not technical setup.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/client/dialogs"
                className="rounded-full bg-[linear-gradient(135deg,#8d4b00_0%,#b15f00_100%)] px-6 py-3 text-sm font-semibold text-white shadow-sm"
              >
                View Active Dialogs
              </Link>
              <Link
                href="/client/agents"
                className="rounded-full border border-[#dbc2b0] px-6 py-3 text-sm font-semibold text-[#1b1c19] transition hover:bg-white/70"
              >
                View Agents
              </Link>
            </div>
          </div>
          <div className="absolute -bottom-16 -right-10 size-64 rounded-full bg-[#8d4b00]/5 blur-3xl" />
        </div>

        <div className="space-y-4 lg:col-span-5">
          <div className="flex items-center justify-between rounded-xl bg-white p-6 shadow-[0_24px_48px_rgba(27,28,25,0.04)]">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#636563]">
                Active Agents
              </p>
              <h2 className="mt-1 text-3xl font-bold tracking-tight">{activeAgents.length}</h2>
            </div>
            <StatusBadge status={activeAgents.length > 0 ? "ACTIVE" : "PAUSED"} />
          </div>
          <div className="flex items-center justify-between rounded-xl bg-white p-6 shadow-[0_24px_48px_rgba(27,28,25,0.04)]">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#636563]">
                Channels Connected
              </p>
              <h2 className="mt-1 text-3xl font-bold tracking-tight">
                {tenant._count.channelConnections}
              </h2>
            </div>
            <div className="rounded-full bg-[#f0eee9] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8d4b00]">
              Current
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-8 md:grid-cols-3">
        <div className="rounded-xl bg-white p-10 shadow-[0_24px_48px_rgba(27,28,25,0.06)]">
          <h3 className="text-4xl font-extrabold tracking-tight">{conversationCount}</h3>
          <p className="mt-2 text-sm font-semibold uppercase tracking-[0.18em] text-[#636563]">
            Total Dialogs
          </p>
        </div>
        <div className="rounded-xl bg-white p-10 shadow-[0_24px_48px_rgba(27,28,25,0.06)]">
          <h3 className="text-4xl font-extrabold tracking-tight">{messages.length}</h3>
          <p className="mt-2 text-sm font-semibold uppercase tracking-[0.18em] text-[#636563]">
            Total Messages
          </p>
        </div>
        <div className="rounded-xl bg-white p-10 shadow-[0_24px_48px_rgba(27,28,25,0.06)]">
          <h3 className="text-4xl font-extrabold tracking-tight">{leadActions.length}</h3>
          <p className="mt-2 text-sm font-semibold uppercase tracking-[0.18em] text-[#636563]">
            New Leads
          </p>
        </div>
      </section>

      <section className="rounded-xl bg-white p-8 shadow-[0_24px_48px_rgba(27,28,25,0.04)] md:p-12">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h3 className="text-2xl font-extrabold tracking-tight">Engagement Activity</h3>
            <p className="mt-2 text-[#554336]">
              Hourly interaction distribution across active agents.
            </p>
          </div>
          <div className="rounded-full bg-[#f0eee9] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#1b1c19]">
            This month
          </div>
        </div>
        <div className="flex h-64 items-end gap-4">
          {bars.map((bar, index) => (
            <div
              key={bar + index}
              className="flex-1 rounded-t-lg bg-[#8d4b00]/10"
              style={{ height: `${bar}%` }}
            />
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-12 lg:grid-cols-2">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-extrabold tracking-tight">Recent Dialogs</h3>
            <Link href="/client/dialogs" className="text-xs font-bold uppercase tracking-[0.18em] text-[#8d4b00]">
              View All
            </Link>
          </div>
          <div className="space-y-3">
            {recentConversations.length === 0 ? (
              <div className="rounded-xl bg-white p-5 text-sm text-[#554336] shadow-sm">
                No dialogs yet.
              </div>
            ) : (
              recentConversations.map((conversation) => (
                <Link
                  key={conversation.id}
                  href={`/client/dialogs?conversation=${conversation.id}`}
                  className="flex items-center gap-4 rounded-xl bg-white p-5 transition hover:bg-[#f5f3ee]"
                >
                  <div className="flex size-12 items-center justify-center rounded-full bg-[#e2e3e0] text-sm font-bold text-[#636563]">
                    {conversation.contactId.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold">{conversation.contactId}</p>
                    <p className="text-xs text-[#554336]">
                      Handled by <span className="text-[#8d4b00]">{conversation.agent.name}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#636563]">
                      {conversation.channel}
                    </p>
                    <p className="mt-1 text-[11px] text-[#636563]">
                      {formatShortDate(conversation.updatedAt)}
                    </p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-extrabold tracking-tight">Recent Leads</h3>
            <Link href="/client/leads" className="text-xs font-bold uppercase tracking-[0.18em] text-[#8d4b00]">
              Open Leads
            </Link>
          </div>
          <div className="overflow-hidden rounded-xl bg-white shadow-[0_24px_48px_rgba(27,28,25,0.04)]">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-[#f5f3ee]">
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-[#636563]">
                    Action
                  </th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-[#636563]">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eae8e3]">
                {leadActions.slice(0, 4).map((message) => (
                  <tr key={message.id} className="hover:bg-[#faf6f0]">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold">{message.toolName}</span>
                        <span className="text-[10px] text-[#636563]">Lead action recorded</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-[#554336]">
                      {message.createdAt.toLocaleString()}
                    </td>
                  </tr>
                ))}
                {leadActions.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-6 py-6 text-sm text-[#554336]">
                      No lead actions yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
