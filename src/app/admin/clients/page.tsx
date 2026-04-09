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
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-[#1b1c19]">Clients</h1>
          <p className="mt-1 text-[#1b1c19]/60">
            Manage and monitor operator-assisted portfolios.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-full border border-[#dbc2b0]/50 bg-[#f0eee9] p-1">
            <span className="rounded-full bg-white px-4 py-1.5 text-xs font-semibold shadow-sm">
              All Clients
            </span>
            <span className="px-4 py-1.5 text-xs font-medium text-[#1b1c19]/60">
              Active Only
            </span>
            <span className="px-4 py-1.5 text-xs font-medium text-[#1b1c19]/60">
              Needs Attention
            </span>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#dbc2b0]/40 bg-white shadow-[0_24px_48px_rgba(27,28,25,0.04)]">
        <div className="grid grid-cols-12 bg-[#f5f3ee] px-6 py-4">
          <div className="col-span-4 text-[10px] uppercase tracking-[0.2em] text-[#636563]">
            Company &amp; Core Metrics
          </div>
          <div className="col-span-2 text-[10px] uppercase tracking-[0.2em] text-[#636563]">
            Status
          </div>
          <div className="col-span-2 text-[10px] uppercase tracking-[0.2em] text-[#636563]">
            Connectivity
          </div>
          <div className="col-span-2 text-[10px] uppercase tracking-[0.2em] text-[#636563]">
            Readiness
          </div>
          <div className="col-span-2 text-right text-[10px] uppercase tracking-[0.2em] text-[#636563]">
            Actions
          </div>
        </div>

        <div className="divide-y divide-[#f0eee9]">
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
                className="grid grid-cols-12 items-center px-6 py-6 transition hover:bg-[#faf6f0]"
              >
                <div className="col-span-4 flex items-center gap-4">
                  <div className="flex size-12 items-center justify-center rounded-xl bg-[#ffdcc3] font-bold text-[#8d4b00]">
                    {client.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <Link
                      href={`/admin/clients/${client.id}`}
                      className="font-bold text-[#1b1c19] transition hover:text-[#8d4b00]"
                    >
                      {client.name}
                    </Link>
                    <div className="mt-1 flex items-center gap-3 text-xs text-[#1b1c19]/50">
                      <span>{client._count.agents} Agents</span>
                      <span className="size-1 rounded-full bg-[#1b1c19]/20" />
                      <span>{client.slug}</span>
                    </div>
                  </div>
                </div>
                <div className="col-span-2">
                  <StatusBadge status={state} />
                </div>
                <div className="col-span-2 flex gap-4">
                  <div>
                    <p className="text-sm font-bold">{connectedChannels}</p>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-[#1b1c19]/40">
                      Channels
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-bold">{connectedIntegrations}</p>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-[#1b1c19]/40">
                      Integrs
                    </p>
                  </div>
                </div>
                <div className="col-span-2">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[#f0eee9]">
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
                    className="rounded-lg bg-[#f0eee9] px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#1b1c19] transition hover:bg-[#e4e2dd]"
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
        <div className="flex h-48 flex-col justify-between overflow-hidden rounded-xl border border-[#dbc2b0]/30 bg-white p-8">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#1b1c19]/40">
              Network Health
            </p>
            <h3 className="mt-2 text-3xl font-bold">98.2%</h3>
          </div>
          <p className="text-xs font-bold text-[#006096]">Clients are stable this week</p>
        </div>
        <div className="flex h-48 flex-col justify-between overflow-hidden rounded-xl bg-[#b15f00] p-8 text-white">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/60">
              Managed Accounts
            </p>
            <h3 className="mt-2 text-3xl font-bold">{clients.length}</h3>
          </div>
          <p className="text-xs font-bold text-white/80">Client-first operator queue</p>
        </div>
        <div className="flex h-48 flex-col justify-between overflow-hidden rounded-xl bg-[#eae8e3] p-8">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#1b1c19]/40">
              Average Readiness
            </p>
            <h3 className="mt-2 text-3xl font-bold">{averageReadiness}%</h3>
          </div>
          <p className="text-xs font-bold text-[#1b1c19]/60">
            Based on {formatEnumLabel("READY_FOR_AGENT").toLowerCase()} and active states
          </p>
        </div>
      </div>
    </div>
  );
}
