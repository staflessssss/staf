import Link from "next/link";
import { MessageRole, type Prisma } from "@prisma/client";

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
      title: "Consultation booked",
      detail:
        [details.coupleName ?? details.contactId, [details.callDate, details.callTime].filter(Boolean).join(" at ")]
          .filter(Boolean)
          .join(" - ") || getToolSummary(event.toolResult) || status,
      meta: `${event.conversation.agent.name} - ${formatDateTime(event.createdAt)}`,
    };
  }

  if (event.toolName === "check_consultation_calendar") {
    return {
      title: status === "Available" ? "Call time available" : "Call time reviewed",
      detail:
        [[details.callDate, details.callTime].filter(Boolean).join(" at "), status]
          .filter(Boolean)
          .join(" - ") || getToolSummary(event.toolResult) || status,
      meta: `${event.conversation.agent.name} - ${formatDateTime(event.createdAt)}`,
    };
  }

  if (event.toolName === "check_wedding_availability") {
    return {
      title: status === "Available" ? "Wedding date available" : "Wedding date reviewed",
      detail:
        [details.weddingDate, details.location, details.capacity ? `${details.bookedCount ?? 0}/${details.capacity} booked` : null]
          .filter(Boolean)
          .join(" - ") || getToolSummary(event.toolResult) || status,
      meta: `${event.conversation.agent.name} - ${formatDateTime(event.createdAt)}`,
    };
  }

  return {
    title: getToolActionLabel(event.toolName),
    detail: getToolSummary(event.toolResult) ?? status,
    meta: `${event.conversation.agent.name} - ${formatDateTime(event.createdAt)}`,
  };
}

function buildSmoothPath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) {
    return "";
  }

  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }

  return points.reduce((path, point, index) => {
    if (index === 0) {
      return `M ${point.x} ${point.y}`;
    }

    const previous = points[index - 1];
    const controlX = previous.x + (point.x - previous.x) / 2;

    return `${path} C ${controlX} ${previous.y}, ${controlX} ${point.y}, ${point.x} ${point.y}`;
  }, "");
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

  const chartWidth = 840;
  const chartHeight = 300;
  const chartPadding = { top: 24, right: 28, bottom: 46, left: 52 };
  const chartInnerWidth = chartWidth - chartPadding.left - chartPadding.right;
  const chartInnerHeight = chartHeight - chartPadding.top - chartPadding.bottom;
  const maxLineValue = Math.max(
    1,
    ...dayBuckets.map((bucket) =>
      Math.max(bucket.customerMessages, bucket.agentReplies, bucket.functionCalls, bucket.targetActions),
    ),
  );
  const yAxisMax = Math.max(5, Math.ceil(maxLineValue / 5) * 5);
  const xStep = dayBuckets.length > 1 ? chartInnerWidth / (dayBuckets.length - 1) : 0;
  const getChartPoint = (value: number, index: number) => ({
    x: chartPadding.left + xStep * index,
    y: chartPadding.top + chartInnerHeight - (value / yAxisMax) * chartInnerHeight,
  });
  const customerPoints = dayBuckets.map((bucket, index) => getChartPoint(bucket.customerMessages, index));
  const agentPoints = dayBuckets.map((bucket, index) => getChartPoint(bucket.agentReplies, index));
  const customerPath = buildSmoothPath(customerPoints);
  const agentPath = buildSmoothPath(agentPoints);
  const yAxisTicks = [yAxisMax, Math.round(yAxisMax * 0.75), Math.round(yAxisMax * 0.5), Math.round(yAxisMax * 0.25), 0];
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

      <section className="overflow-hidden rounded-[28px] border border-[#dfe4ff] bg-[linear-gradient(145deg,rgba(255,255,255,0.94),rgba(247,249,255,0.86))] p-8 shadow-[0_24px_70px_rgba(36,44,94,0.08),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur md:p-10">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-6">
          <div>
            <h3 className="font-heading text-2xl font-bold tracking-tight text-[#181836]">
              Agent Activity
            </h3>
            <p className="mt-2 text-[#464554]">
              Message momentum and agent response flow over the last 12 days.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-right md:grid-cols-4">
            {[
              ["Messages", visibleMessageCount],
              ["Functions", toolCallCount],
              ["Actions", targetActions.length],
              ["Action rate", `${actionRate}%`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-[22px] border border-[#dfe4ff] bg-white/70 px-5 py-3 shadow-[0_12px_26px_rgba(36,44,94,0.05),inset_0_1px_0_rgba(255,255,255,0.85)]">
                <p className="text-lg font-bold text-[#181836]">{value}</p>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#6b6a78]">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-5 text-xs font-semibold text-[#464554]">
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-6 rounded-full bg-[linear-gradient(90deg,#15c5d4,#61eadb)] shadow-[0_0_12px_rgba(21,197,212,0.38)]" />
            Customer messages
          </span>
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-6 rounded-full bg-[linear-gradient(90deg,#7a7cff,#b9a7ff)] shadow-[0_0_12px_rgba(122,124,255,0.32)]" />
            Agent replies
          </span>
          <span className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-[#70d6c7]" />
            Function events
          </span>
          <span className="flex items-center gap-2">
            <span className="size-3 rotate-45 bg-[#181836]" />
            Target actions
          </span>
        </div>

        <div className="rounded-[26px] border border-[#e4e8ff] bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(248,250,255,0.78))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="h-[340px] w-full overflow-visible"
            role="img"
            aria-label="Agent activity line chart"
          >
            <defs>
              <linearGradient id="customerLineGradient" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor="#15c5d4" />
                <stop offset="100%" stopColor="#61eadb" />
              </linearGradient>
              <linearGradient id="agentLineGradient" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor="#6d6ff2" />
                <stop offset="100%" stopColor="#b9a7ff" />
              </linearGradient>
              <filter id="lineGlow" x="-20%" y="-80%" width="140%" height="260%">
                <feGaussianBlur stdDeviation="5" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <rect
              x="1"
              y="1"
              width={chartWidth - 2}
              height={chartHeight - 2}
              rx="24"
              fill="rgba(255,255,255,0.58)"
              stroke="#edf0ff"
            />
            {yAxisTicks.map((tick) => {
              const y = chartPadding.top + chartInnerHeight - (tick / yAxisMax) * chartInnerHeight;

              return (
                <g key={tick}>
                  <line
                    x1={chartPadding.left}
                    x2={chartWidth - chartPadding.right}
                    y1={y}
                    y2={y}
                    stroke="#e9edff"
                    strokeDasharray="4 8"
                  />
                  <text
                    x={chartPadding.left - 16}
                    y={y + 4}
                    textAnchor="end"
                    className="fill-[#8a8fa8] text-[11px] font-semibold"
                  >
                    {tick}
                  </text>
                </g>
              );
            })}

            <path
              d={customerPath}
              fill="none"
              stroke="url(#customerLineGradient)"
              strokeWidth="4"
              strokeLinecap="round"
              filter="url(#lineGlow)"
            />
            <path
              d={agentPath}
              fill="none"
              stroke="url(#agentLineGradient)"
              strokeWidth="4"
              strokeLinecap="round"
              filter="url(#lineGlow)"
            />

            {dayBuckets.map((bucket, index) => {
              const customerPoint = customerPoints[index];
              const agentPoint = agentPoints[index];
              const eventY =
                chartPadding.top + chartInnerHeight - (bucket.functionCalls / yAxisMax) * chartInnerHeight;

              return (
                <g key={bucket.key}>
                  <title>
                    {`${bucket.label}: ${bucket.customerMessages} customer, ${bucket.agentReplies} agent, ${bucket.functionCalls} function, ${bucket.targetActions} target`}
                  </title>
                  <line
                    x1={customerPoint.x}
                    x2={customerPoint.x}
                    y1={chartPadding.top}
                    y2={chartPadding.top + chartInnerHeight}
                    stroke="transparent"
                    strokeWidth="16"
                  />
                  <circle cx={customerPoint.x} cy={customerPoint.y} r="4.5" fill="#fff" stroke="#15c5d4" strokeWidth="2.5" />
                  <circle cx={agentPoint.x} cy={agentPoint.y} r="4.5" fill="#fff" stroke="#7a7cff" strokeWidth="2.5" />
                  {bucket.functionCalls > 0 ? (
                    <circle cx={customerPoint.x} cy={eventY} r="4" fill="#70d6c7" opacity="0.9" />
                  ) : null}
                  {bucket.targetActions > 0 ? (
                    <rect
                      x={customerPoint.x - 4}
                      y={Math.min(customerPoint.y, agentPoint.y) - 22}
                      width="8"
                      height="8"
                      fill="#181836"
                      transform={`rotate(45 ${customerPoint.x} ${Math.min(customerPoint.y, agentPoint.y) - 18})`}
                    />
                  ) : null}
                  <text
                    x={customerPoint.x}
                    y={chartHeight - 18}
                    textAnchor="middle"
                    className="fill-[#737892] text-[10px] font-semibold"
                  >
                    {bucket.label}
                  </text>
                </g>
              );
            })}
          </svg>
          <div className="mt-2 flex items-center justify-between border-t border-[#eef0ff] pt-4 text-xs text-[#6b6a78]">
            <span>Last 12 days</span>
            <span>
              Last activity: {latestActivity ? formatDateTime(latestActivity.createdAt) : "No activity yet"}
            </span>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-[#dfe4ff] bg-[linear-gradient(135deg,#ffffff_0%,#fbfbff_62%,#f4fbff_100%)] p-8 shadow-[0_18px_46px_rgba(24,24,54,0.06)] md:p-10">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h3 className="font-heading text-2xl font-bold tracking-tight text-[#181836]">
              Agent Work Feed
            </h3>
            <p className="mt-2 text-[#464554]">
              Recent availability checks, calendar decisions, and booked consultations.
            </p>
          </div>
          <Link href="/client/leads" className="text-xs font-bold uppercase tracking-[0.18em] text-[#4648d4]">
            Open Leads
          </Link>
        </div>
        {recentEvents.length === 0 ? (
          <div className="rounded-[22px] bg-[#f8f8ff] p-6 text-sm text-[#464554] ring-1 ring-[#eef0ff]">
            No completed agent work yet.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {recentEvents.map((event) => {
              const outcome = buildAgentWorkOutcome(event);

              return (
                <Link
                  key={event.id}
                  href={`/client/dialogs?conversation=${event.conversationId}`}
                  className="group rounded-[22px] bg-white/84 p-5 ring-1 ring-[#e8ebff] transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_18px_36px_rgba(24,24,54,0.08)]"
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <span className="rounded-full bg-[#effffb] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#137d86] ring-1 ring-[#c9f4ed]">
                      {getToolStatusLabel(event.toolResult)}
                    </span>
                    <span className="text-[11px] font-semibold text-[#6b6a78]">
                      {formatShortDate(event.createdAt)}
                    </span>
                  </div>
                  <h4 className="font-heading text-lg font-bold text-[#181836]">{outcome.title}</h4>
                  <p className="mt-2 min-h-10 text-sm leading-5 text-[#464554]">{outcome.detail}</p>
                  <p className="mt-4 border-t border-[#eef0ff] pt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6b6a78] transition group-hover:text-[#4648d4]">
                    {outcome.meta}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
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
