import Link from "next/link";

import { StatusBadge, formatEnumLabel } from "@/components/stafless/foundation";
import { requireAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";

function getClientState(input: {
  status: string;
  channelCount: number;
  integrationCount: number;
  agentCount: number;
  activeAgentCount: number;
}) {
  if (input.status === "ONBOARDING" && input.channelCount === 0) return "NEW";
  if (input.channelCount === 0) return "NEEDS_SETUP";
  if (input.agentCount === 0) return "READY_FOR_AGENT";
  if (input.activeAgentCount === 0) return "NEEDS_ATTENTION";
  return "ACTIVE";
}

export default async function AdminClientsPage() {
  await requireAdminSession();

  const clients = await db.tenant.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      channelConnections: true,
      integrationConnections: true,
      agents: true,
      _count: {
        select: {
          users: true,
          agents: true,
        },
      },
    },
  });

  const averageReadiness = clients.length
    ? Math.round(
        clients.reduce((sum, client) => {
          const connectedChannels = client.channelConnections.filter(
            (channel) => channel.status === "CONNECTED",
          ).length;
          const connectedIntegrations = client.integrationConnections.filter(
            (integration) => integration.status === "CONNECTED",
          ).length;
          const activeAgents = client.agents.filter((agent) => agent.status === "ACTIVE").length;
          const state = getClientState({
            status: client.status,
            channelCount: connectedChannels,
            integrationCount: connectedIntegrations,
            agentCount: client._count.agents,
            activeAgentCount: activeAgents,
          });

          if (state === "ACTIVE") return sum + 100;
          if (state === "READY_FOR_AGENT") return sum + 72;
          if (state === "NEEDS_SETUP") return sum + 38;
          if (state === "NEW") return sum + 22;
          return sum + 48;
        }, 0) / clients.length,
      )
    : 0;

  return (
    <div className="space-y-8">
      <div className="rounded-[28px] bg-[linear-gradient(135deg,#ffffff_0%,#f4f2ff_52%,#e9edff_100%)] p-8 shadow-[0_18px_40px_rgba(24,24,54,0.06)] ring-1 ring-[#d8d6fe]/80 md:p-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#5c5c7e]">
              Client operations
            </p>
            <h1 className="mt-2 font-heading text-4xl font-bold tracking-tight text-[#181836]">
              Clients
            </h1>
            <p className="mt-2 max-w-2xl text-[#464554]">
            Manage and monitor operator-assisted portfolios.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-2xl bg-white/80 p-1 shadow-[0_10px_24px_rgba(24,24,54,0.05)] ring-1 ring-[#d8d6fe]/70">
              <span className="rounded-xl bg-[#efecff] px-4 py-1.5 text-xs font-semibold text-[#4648d4] shadow-sm">
              All Clients
              </span>
              <span className="px-4 py-1.5 text-xs font-medium text-[#5c5c7e]">
              Active Only
              </span>
              <span className="px-4 py-1.5 text-xs font-medium text-[#5c5c7e]">
              Needs Attention
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-[28px] bg-white shadow-[0_12px_28px_rgba(24,24,54,0.05)] ring-1 ring-[#d8d6fe]/70">
        <div className="grid grid-cols-12 bg-[#f5f2ff] px-6 py-4">
          <div className="col-span-4 text-[10px] uppercase tracking-[0.2em] text-[#5c5c7e]">
            Company &amp; Core Metrics
          </div>
          <div className="col-span-2 text-[10px] uppercase tracking-[0.2em] text-[#5c5c7e]">
            Status
          </div>
          <div className="col-span-2 text-[10px] uppercase tracking-[0.2em] text-[#5c5c7e]">
            Connectivity
          </div>
          <div className="col-span-2 text-[10px] uppercase tracking-[0.2em] text-[#5c5c7e]">
            Readiness
          </div>
          <div className="col-span-2 text-right text-[10px] uppercase tracking-[0.2em] text-[#5c5c7e]">
            Actions
          </div>
        </div>

        <div className="divide-y divide-[#eef0ff]">
          {clients.map((client) => {
            const connectedChannels = client.channelConnections.filter(
              (channel) => channel.status === "CONNECTED",
            ).length;
            const connectedIntegrations = client.integrationConnections.filter(
              (integration) => integration.status === "CONNECTED",
            ).length;
            const activeAgentCount = client.agents.filter((agent) => agent.status === "ACTIVE").length;
            const state = getClientState({
              status: client.status,
              channelCount: connectedChannels,
              integrationCount: connectedIntegrations,
              agentCount: client._count.agents,
              activeAgentCount,
            });
            const readiness =
              state === "ACTIVE"
                ? 92
                : state === "READY_FOR_AGENT"
                  ? 74
                  : state === "NEEDS_SETUP"
                    ? 38
                    : state === "NEW"
                      ? 16
                      : 48;

            return (
              <div
                key={client.id}
                className="grid grid-cols-12 items-center px-6 py-6 transition hover:bg-[#f8f8ff]"
              >
                <div className="col-span-4 flex items-center gap-4">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-[#efecff] font-bold text-[#4648d4]">
                    {client.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <Link
                      href={`/admin/clients/${client.id}`}
                      className="font-bold text-[#181836] transition hover:text-[#4648d4]"
                    >
                      {client.name}
                    </Link>
                    <div className="mt-1 flex items-center gap-3 text-xs text-[#5c5c7e]">
                      <span>{client._count.agents} Agents</span>
                      <span className="size-1 rounded-full bg-[#5c5c7e]/25" />
                      <span>{client.slug}</span>
                    </div>
                  </div>
                </div>
                <div className="col-span-2">
                  <StatusBadge status={state} />
                </div>
                <div className="col-span-2 flex gap-4">
                  <div>
                    <p className="text-sm font-bold text-[#181836]">{connectedChannels}</p>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-[#5c5c7e]">
                      Channels
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#181836]">{connectedIntegrations}</p>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-[#5c5c7e]">
                      Integrs
                    </p>
                  </div>
                </div>
                <div className="col-span-2">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-lg bg-[#f0eee9]">
                      <div
                        className="h-full bg-[#8d4b00]"
                        style={{ width: `${readiness}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-[#8d4b00]">{readiness}%</span>
                  </div>
                </div>
                <div className="col-span-2 text-right">
                  <Link
                    href={`/admin/clients/${client.id}`}
                    className="rounded-lg bg-[#efecff] px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#4648d4] transition hover:bg-[#e8e5ff]"
                  >
                    {state === "NEEDS_ATTENTION" ? "Review" : "Open"}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="flex h-48 flex-col justify-between overflow-hidden rounded-[24px] bg-white p-8 shadow-[0_12px_28px_rgba(24,24,54,0.05)] ring-1 ring-[#d8d6fe]/70">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#5c5c7e]">
              Network Health
            </p>
            <h3 className="mt-2 font-heading text-3xl font-bold text-[#181836]">98.2%</h3>
          </div>
          <p className="text-xs font-bold text-[#4648d4]">Clients are stable this week</p>
        </div>
        <div className="flex h-48 flex-col justify-between overflow-hidden rounded-[24px] bg-[linear-gradient(135deg,#4648d4_0%,#6063ee_100%)] p-8 text-white shadow-[0_18px_40px_rgba(70,72,212,0.18)]">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/70">
              Managed Accounts
            </p>
            <h3 className="mt-2 font-heading text-3xl font-bold">{clients.length}</h3>
          </div>
          <p className="text-xs font-bold text-white/80">Client-first operator queue</p>
        </div>
        <div className="flex h-48 flex-col justify-between overflow-hidden rounded-[24px] bg-[#f5f2ff] p-8 shadow-[0_12px_28px_rgba(24,24,54,0.05)] ring-1 ring-[#d8d6fe]/70">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#5c5c7e]">
              Average Readiness
            </p>
            <h3 className="mt-2 font-heading text-3xl font-bold text-[#181836]">{averageReadiness}%</h3>
          </div>
          <p className="text-xs font-bold text-[#464554]">
            Based on {formatEnumLabel("READY_FOR_AGENT").toLowerCase()} and active states
          </p>
        </div>
      </div>
    </div>
  );
}
