import Link from "next/link";
import { MessageRole } from "@prisma/client";

import { StatusBadge } from "@/components/stafless/foundation";
import { requireClientSession } from "@/lib/client-auth";
import { db } from "@/lib/db";
import { isQualifiedLeadToolMessage } from "@/lib/lead-qualification";

function formatShortDate(value: Date) {
  return value.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default async function ClientDashboardPage() {
  const session = await requireClientSession();
  const tenantId = session.user.tenantId;

  const [
    tenant,
    agents,
    recentConversations,
    conversationCount,
    visibleMessageCount,
    toolCallCount,
    recentMessages,
    toolMessages,
  ] = await Promise.all([
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
    db.message.count({
      where: {
        conversation: {
          agent: { tenantId },
        },
        role: MessageRole.TOOL,
        NOT: {
          toolName: null,
        },
      },
    }),
    db.message.findMany({
      where: {
        conversation: {
          agent: { tenantId },
        },
        role: {
          in: [MessageRole.USER, MessageRole.ASSISTANT],
        },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
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
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
  ]);

  if (!tenant) return <div>Client not found.</div>;

  const targetActions = toolMessages.filter((message) =>
    isQualifiedLeadToolMessage({
      toolName: message.toolName,
      toolResult: message.toolResult,
    }),
  );
  const activeAgents = agents.filter((agent) => agent.status === "ACTIVE");
  const dayBuckets = Array.from({ length: 12 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (11 - index));
    date.setHours(0, 0, 0, 0);

    return {
      key: date.toISOString().slice(0, 10),
      label: formatShortDate(date),
      count: 0,
    };
  });
  const bucketByKey = new Map(dayBuckets.map((bucket) => [bucket.key, bucket]));

  for (const message of recentMessages) {
    const key = message.createdAt.toISOString().slice(0, 10);
    const bucket = bucketByKey.get(key);

    if (bucket) {
      bucket.count += 1;
    }
  }

  const maxBucketCount = Math.max(1, ...dayBuckets.map((bucket) => bucket.count));

  return (
    <div className="space-y-12">
      <section className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-center">
        <div className="relative overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,#ffffff_0%,#f4f2ff_52%,#e9edff_100%)] p-10 shadow-[0_24px_60px_rgba(24,24,54,0.08)] ring-1 ring-[#d8d6fe]/80 lg:col-span-7">
          <div className="relative z-10">
            <p className="text-[10px] font-bold uppercase tracking-[0.26em] text-[#5c5c7e]">
              Business overview
            </p>
            <h1 className="mt-3 max-w-2xl font-heading text-4xl font-bold tracking-tight text-[#181836] md:text-5xl">
              Your agents are active and assisting customers
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-[#464554]">
              Real-time engagement is steady across your connected channels. Use this dashboard to
              track business activity, not technical setup.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/client/dialogs"
                className="rounded-xl bg-[linear-gradient(135deg,#4648d4_0%,#6063ee_100%)] px-6 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(70,72,212,0.18)] transition hover:-translate-y-0.5"
              >
                View Active Dialogs
              </Link>
              <Link
                href="/client/agents"
                className="rounded-xl bg-white/85 px-6 py-3 text-sm font-semibold text-[#181836] ring-1 ring-[#d8d6fe] transition hover:bg-white"
              >
                View Agents
              </Link>
            </div>
          </div>
          <div className="absolute -bottom-16 -right-10 size-64 rounded-full bg-[#4648d4]/10 blur-3xl" />
        </div>

        <div className="space-y-4 lg:col-span-5">
          <div className="flex items-center justify-between rounded-[24px] bg-white p-6 shadow-[0_18px_40px_rgba(24,24,54,0.06)] ring-1 ring-[#d8d6fe]/80">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#636563]">
                Active Agents
              </p>
              <h2 className="mt-1 font-heading text-3xl font-bold tracking-tight text-[#181836]">{activeAgents.length}</h2>
            </div>
            <StatusBadge status={activeAgents.length > 0 ? "ACTIVE" : "PAUSED"} />
          </div>
          <div className="flex items-center justify-between rounded-[24px] bg-white p-6 shadow-[0_18px_40px_rgba(24,24,54,0.06)] ring-1 ring-[#d8d6fe]/80">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#636563]">
                Channels Connected
              </p>
              <h2 className="mt-1 font-heading text-3xl font-bold tracking-tight text-[#181836]">
                {tenant._count.channelConnections}
              </h2>
            </div>
            <div className="rounded-lg bg-[#efecff] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#4648d4]">
              Current
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <div className="rounded-[24px] bg-white p-10 shadow-[0_18px_40px_rgba(24,24,54,0.06)] ring-1 ring-[#d8d6fe]/80">
          <h3 className="font-heading text-4xl font-bold tracking-tight text-[#181836]">{conversationCount}</h3>
          <p className="mt-2 text-sm font-semibold uppercase tracking-[0.18em] text-[#636563]">
            Total Dialogs
          </p>
        </div>
        <div className="rounded-[24px] bg-white p-10 shadow-[0_18px_40px_rgba(24,24,54,0.06)] ring-1 ring-[#d8d6fe]/80">
          <h3 className="font-heading text-4xl font-bold tracking-tight text-[#181836]">{visibleMessageCount}</h3>
          <p className="mt-2 text-sm font-semibold uppercase tracking-[0.18em] text-[#636563]">
            Total Messages
          </p>
        </div>
        <div className="rounded-[24px] bg-white p-10 shadow-[0_18px_40px_rgba(24,24,54,0.06)] ring-1 ring-[#d8d6fe]/80">
          <h3 className="font-heading text-4xl font-bold tracking-tight text-[#181836]">{toolCallCount}</h3>
          <p className="mt-2 text-sm font-semibold uppercase tracking-[0.18em] text-[#636563]">
            Function Calls
          </p>
        </div>
        <div className="rounded-[24px] bg-white p-10 shadow-[0_18px_40px_rgba(24,24,54,0.06)] ring-1 ring-[#d8d6fe]/80">
          <h3 className="font-heading text-4xl font-bold tracking-tight text-[#181836]">{targetActions.length}</h3>
          <p className="mt-2 text-sm font-semibold uppercase tracking-[0.18em] text-[#636563]">
            Target Actions
          </p>
        </div>
      </section>

      <section className="rounded-[28px] bg-white p-8 shadow-[0_18px_40px_rgba(24,24,54,0.06)] ring-1 ring-[#d8d6fe]/80 md:p-12">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h3 className="font-heading text-2xl font-bold tracking-tight text-[#181836]">
              Engagement Activity
            </h3>
            <p className="mt-2 text-[#464554]">
              Message volume across active agents.
            </p>
          </div>
          <div className="rounded-lg bg-[#efecff] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#4648d4]">
            Last 12 days
          </div>
        </div>
        <div className="flex h-64 items-end gap-4">
          {dayBuckets.map((bucket) => (
            <div
              key={bucket.key}
              className="flex h-full flex-1 flex-col items-center justify-end gap-2"
              title={`${bucket.label}: ${bucket.count} messages`}
            >
              <div
                className="w-full rounded-t-lg bg-[linear-gradient(180deg,rgba(70,72,212,0.28),rgba(70,72,212,0.08))]"
                style={{ height: `${Math.max(8, (bucket.count / maxBucketCount) * 100)}%` }}
              />
              <span className="text-[10px] font-medium text-[#6b6a78]">{bucket.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-12 lg:grid-cols-2">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-xl font-bold tracking-tight text-[#181836]">
              Recent Dialogs
            </h3>
            <Link href="/client/dialogs" className="text-xs font-bold uppercase tracking-[0.18em] text-[#4648d4]">
              View All
            </Link>
          </div>
          <div className="space-y-3">
            {recentConversations.length === 0 ? (
              <div className="rounded-[20px] bg-white p-5 text-sm text-[#464554] shadow-[0_12px_28px_rgba(24,24,54,0.05)] ring-1 ring-[#d8d6fe]/70">
                No dialogs yet.
              </div>
            ) : (
              recentConversations.map((conversation) => (
                <Link
                  key={conversation.id}
                  href={`/client/dialogs?conversation=${conversation.id}`}
                  className="flex items-center gap-4 rounded-[20px] bg-white p-5 shadow-[0_12px_28px_rgba(24,24,54,0.05)] ring-1 ring-[#d8d6fe]/70 transition hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(24,24,54,0.08)]"
                >
                  <div className="flex size-12 items-center justify-center rounded-full bg-[#efecff] text-sm font-bold text-[#4648d4]">
                    {conversation.contactId.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold">{conversation.contactId}</p>
                    <p className="text-xs text-[#554336]">
                      Handled by <span className="text-[#4648d4]">{conversation.agent.name}</span>
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
            <h3 className="font-heading text-xl font-bold tracking-tight text-[#181836]">
              Recent Leads
            </h3>
            <Link href="/client/leads" className="text-xs font-bold uppercase tracking-[0.18em] text-[#4648d4]">
              Open Leads
            </Link>
          </div>
          <div className="overflow-hidden rounded-[20px] bg-white shadow-[0_12px_28px_rgba(24,24,54,0.05)] ring-1 ring-[#d8d6fe]/70">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-[#f5f2ff]">
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-[#5c5c7e]">
                    Action
                  </th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-[#5c5c7e]">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef0ff]">
                {targetActions.slice(0, 4).map((message) => (
                  <tr key={message.id} className="hover:bg-[#f8f8ff]">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-[#181836]">{message.toolName}</span>
                        <span className="text-[10px] text-[#5c5c7e]">Lead action recorded</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-[#464554]">
                      {message.createdAt.toLocaleString()}
                    </td>
                  </tr>
                ))}
                {targetActions.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-6 py-6 text-sm text-[#464554]">
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
