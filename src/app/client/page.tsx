import Link from "next/link";
import { MessageRole } from "@prisma/client";

import { StatusBadge } from "@/components/stafless/foundation";
import {
  getLeadDetails,
  getToolActionLabel,
  getToolStatusLabel,
  getToolSummary,
} from "@/lib/client-analytics";
import { requireClientSession } from "@/lib/client-auth";
import { db } from "@/lib/db";
import { isQualifiedLeadToolMessage } from "@/lib/lead-qualification";

function formatShortDate(value: Date) {
  return value.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(value: Date) {
  return value.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getLastMessagePreview(messages: Array<{ content: string; role: MessageRole }>) {
  const message = messages.find((item) => item.role === MessageRole.USER || item.role === MessageRole.ASSISTANT);
  const content = message?.content.trim();

  if (!content) {
    return "No visible messages yet.";
  }

  return content.length > 92 ? `${content.slice(0, 89)}...` : content;
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
          where: {
            role: {
              in: [MessageRole.USER, MessageRole.ASSISTANT],
            },
          },
          orderBy: { createdAt: "desc" },
          take: 3,
        },
        _count: {
          select: {
            messages: true,
          },
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
      include: {
        conversation: {
          include: {
            agent: true,
          },
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
  const targetActionIds = new Set(targetActions.map((message) => message.id));
  const activeAgents = agents.filter((agent) => agent.status === "ACTIVE");
  const dayBuckets = Array.from({ length: 12 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (11 - index));
    date.setHours(0, 0, 0, 0);

    return {
      key: date.toISOString().slice(0, 10),
      label: formatShortDate(date),
      customerMessages: 0,
      agentReplies: 0,
      functionCalls: 0,
      targetActions: 0,
    };
  });
  const bucketByKey = new Map(dayBuckets.map((bucket) => [bucket.key, bucket]));

  for (const message of recentMessages) {
    const key = message.createdAt.toISOString().slice(0, 10);
    const bucket = bucketByKey.get(key);

    if (!bucket) continue;

    if (message.role === MessageRole.USER) {
      bucket.customerMessages += 1;
    } else if (message.role === MessageRole.ASSISTANT) {
      bucket.agentReplies += 1;
    }
  }

  for (const message of toolMessages) {
    const key = message.createdAt.toISOString().slice(0, 10);
    const bucket = bucketByKey.get(key);

    if (!bucket) continue;

    bucket.functionCalls += 1;

    if (targetActionIds.has(message.id)) {
      bucket.targetActions += 1;
    }
  }

  const maxBucketCount = Math.max(
    1,
    ...dayBuckets.map(
      (bucket) =>
        bucket.customerMessages + bucket.agentReplies + bucket.functionCalls,
    ),
  );
  const actionRate = toolCallCount > 0 ? Math.round((targetActions.length / toolCallCount) * 100) : 0;
  const latestActivity = [...recentMessages, ...toolMessages].sort(
    (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
  )[0];
  const recentEvents = toolMessages.slice(0, 6);

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
              Track conversations, function calls, and booked outcomes from the agents working across
              your connected channels.
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
        <div className="rounded-[24px] bg-white p-8 shadow-[0_18px_40px_rgba(24,24,54,0.06)] ring-1 ring-[#d8d6fe]/80">
          <h3 className="font-heading text-4xl font-bold tracking-tight text-[#181836]">{conversationCount}</h3>
          <p className="mt-2 text-sm font-semibold uppercase tracking-[0.18em] text-[#636563]">
            Total Dialogs
          </p>
        </div>
        <div className="rounded-[24px] bg-white p-8 shadow-[0_18px_40px_rgba(24,24,54,0.06)] ring-1 ring-[#d8d6fe]/80">
          <h3 className="font-heading text-4xl font-bold tracking-tight text-[#181836]">{visibleMessageCount}</h3>
          <p className="mt-2 text-sm font-semibold uppercase tracking-[0.18em] text-[#636563]">
            Total Messages
          </p>
        </div>
        <div className="rounded-[24px] bg-white p-8 shadow-[0_18px_40px_rgba(24,24,54,0.06)] ring-1 ring-[#d8d6fe]/80">
          <h3 className="font-heading text-4xl font-bold tracking-tight text-[#181836]">{toolCallCount}</h3>
          <p className="mt-2 text-sm font-semibold uppercase tracking-[0.18em] text-[#636563]">
            Function Calls
          </p>
        </div>
        <div className="rounded-[24px] bg-white p-8 shadow-[0_18px_40px_rgba(24,24,54,0.06)] ring-1 ring-[#d8d6fe]/80">
          <h3 className="font-heading text-4xl font-bold tracking-tight text-[#181836]">{targetActions.length}</h3>
          <p className="mt-2 text-sm font-semibold uppercase tracking-[0.18em] text-[#636563]">
            Target Actions
          </p>
        </div>
      </section>

      <section className="rounded-[28px] bg-white p-8 shadow-[0_18px_40px_rgba(24,24,54,0.06)] ring-1 ring-[#d8d6fe]/80 md:p-10">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-6">
          <div>
            <h3 className="font-heading text-2xl font-bold tracking-tight text-[#181836]">
              Agent Activity
            </h3>
            <p className="mt-2 text-[#464554]">
              Daily message flow, function calls, and completed target actions.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-right md:grid-cols-4">
            {[
              ["Messages", visibleMessageCount],
              ["Functions", toolCallCount],
              ["Actions", targetActions.length],
              ["Action rate", `${actionRate}%`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-[#f8f8ff] px-4 py-3 ring-1 ring-[#d8d6fe]/70">
                <p className="text-lg font-bold text-[#181836]">{value}</p>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#6b6a78]">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-4 text-xs font-semibold text-[#464554]">
          <span className="flex items-center gap-2">
            <span className="size-3 rounded-sm bg-[#4648d4]" />
            Customers
          </span>
          <span className="flex items-center gap-2">
            <span className="size-3 rounded-sm bg-[#8e91ff]" />
            Agent replies
          </span>
          <span className="flex items-center gap-2">
            <span className="size-3 rounded-sm bg-[#70d6c7]" />
            Function calls
          </span>
          <span className="flex items-center gap-2">
            <span className="size-3 rotate-45 bg-[#181836]" />
            Target actions
          </span>
        </div>

        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-h-80 rounded-[22px] bg-[#fbfbff] p-6 ring-1 ring-[#eef0ff]">
            <div className="flex h-64 items-end gap-3">
              {dayBuckets.map((bucket) => {
                const total =
                  bucket.customerMessages + bucket.agentReplies + bucket.functionCalls;
                const height = Math.max(10, (total / maxBucketCount) * 100);

                return (
                  <div
                    key={bucket.key}
                    className="flex h-full flex-1 flex-col items-center justify-end gap-3"
                    title={`${bucket.label}: ${bucket.customerMessages} customer, ${bucket.agentReplies} agent, ${bucket.functionCalls} function, ${bucket.targetActions} target`}
                  >
                    <div className="flex w-full flex-col justify-end overflow-hidden rounded-t-xl bg-[#f0efff]" style={{ height: `${height}%` }}>
                      {bucket.targetActions > 0 ? <div className="mx-auto mb-1 size-2 rotate-45 bg-[#181836]" /> : null}
                      <div
                        className="w-full bg-[#70d6c7]"
                        style={{ height: `${Math.max(0, (bucket.functionCalls / Math.max(1, total)) * 100)}%` }}
                      />
                      <div
                        className="w-full bg-[#8e91ff]"
                        style={{ height: `${Math.max(0, (bucket.agentReplies / Math.max(1, total)) * 100)}%` }}
                      />
                      <div
                        className="w-full bg-[#4648d4]"
                        style={{ height: `${Math.max(0, (bucket.customerMessages / Math.max(1, total)) * 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-medium text-[#6b6a78]">{bucket.label}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-[#eef0ff] pt-4 text-xs text-[#6b6a78]">
              <span>Last 12 days</span>
              <span>
                Last activity: {latestActivity ? formatDateTime(latestActivity.createdAt) : "No activity yet"}
              </span>
            </div>
          </div>

          <div className="rounded-[22px] bg-[#fbfbff] p-6 ring-1 ring-[#eef0ff]">
            <div className="mb-5 flex items-center justify-between">
              <h4 className="font-heading text-lg font-bold text-[#181836]">Event Timeline</h4>
              <span className="rounded-lg bg-[#efecff] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#4648d4]">
                Live
              </span>
            </div>
            <div className="space-y-4">
              {recentEvents.length === 0 ? (
                <p className="text-sm text-[#464554]">No function events yet.</p>
              ) : (
                recentEvents.map((event) => (
                  <div key={event.id} className="border-l-2 border-[#d8d6fe] pl-4">
                    <p className="text-sm font-bold text-[#181836]">{getToolActionLabel(event.toolName)}</p>
                    <p className="mt-1 text-xs text-[#464554]">{getToolSummary(event.toolResult) ?? getToolStatusLabel(event.toolResult)}</p>
                    <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6b6a78]">
                      {formatDateTime(event.createdAt)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
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
                  className="grid gap-4 rounded-[20px] bg-white p-5 shadow-[0_12px_28px_rgba(24,24,54,0.05)] ring-1 ring-[#d8d6fe]/70 transition hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(24,24,54,0.08)] md:grid-cols-[auto_minmax(0,1fr)_auto]"
                >
                  <div className="flex size-12 items-center justify-center rounded-full bg-[#efecff] text-sm font-bold text-[#4648d4]">
                    {conversation.contactId.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{conversation.contactId}</p>
                    <p className="mt-1 text-xs text-[#554336]">
                      Handled by <span className="text-[#4648d4]">{conversation.agent.name}</span>
                    </p>
                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#464554]">
                      {getLastMessagePreview(conversation.messages)}
                    </p>
                  </div>
                  <div className="flex items-start gap-2 md:flex-col md:text-right">
                    <span className="rounded-lg bg-[#f5f2ff] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#5c5c7e]">
                      {conversation.channel}
                    </span>
                    <span className="rounded-lg bg-[#f8f8ff] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b6a78]">
                      {conversation._count.messages} events
                    </span>
                    <span className="text-[11px] text-[#636563]">
                      {formatShortDate(conversation.updatedAt)}
                    </span>
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
          <div className="space-y-3">
            {targetActions.length === 0 ? (
              <div className="rounded-[20px] bg-white p-5 text-sm text-[#464554] shadow-[0_12px_28px_rgba(24,24,54,0.05)] ring-1 ring-[#d8d6fe]/70">
                No lead actions yet.
              </div>
            ) : (
              targetActions.slice(0, 4).map((message) => {
                const details = getLeadDetails(message, message.conversation.contactId);

                return (
                  <details
                    key={message.id}
                    className="group rounded-[20px] bg-white p-5 shadow-[0_12px_28px_rgba(24,24,54,0.05)] ring-1 ring-[#d8d6fe]/70 open:shadow-[0_18px_36px_rgba(24,24,54,0.08)]"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-bold text-[#181836]">{details.contactId}</p>
                        <p className="mt-1 text-xs text-[#464554]">
                          {details.action} by <span className="text-[#4648d4]">{message.conversation.agent.name}</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-[#181836]">{details.callTime ?? details.status}</p>
                        <p className="text-[11px] text-[#6b6a78]">{formatDateTime(message.createdAt)}</p>
                      </div>
                    </summary>
                    <div className="mt-5 grid gap-3 border-t border-[#eef0ff] pt-5 text-xs text-[#464554] sm:grid-cols-2">
                      <span>Wedding: {details.weddingDate ?? "Not captured"}</span>
                      <span>Location: {details.location ?? "Not captured"}</span>
                      <span>Call: {[details.callDate, details.callTime].filter(Boolean).join(" at ") || "Not captured"}</span>
                      <span>Mode: {details.mode ?? "live"}</span>
                      <Link href={`/client/dialogs?conversation=${message.conversationId}`} className="font-bold text-[#4648d4]">
                        Open dialog
                      </Link>
                    </div>
                  </details>
                );
              })
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
