import Link from "next/link";
import { notFound } from "next/navigation";

import { StatusBadge } from "@/components/stafless/foundation";
import { requireAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";

export default async function AdminClientDetailPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  await requireAdminSession();
  const { clientId } = await params;
  const client = await db.tenant.findUnique({
    where: { id: clientId },
    include: {
      channelConnections: { orderBy: { type: "asc" } },
      integrationConnections: { orderBy: { type: "asc" } },
      agents: {
        orderBy: { updatedAt: "desc" },
        include: { channel: true },
      },
      users: { orderBy: { createdAt: "desc" } },
      _count: {
        select: {
          users: true,
          agents: true,
        },
      },
    },
  });

  if (!client) notFound();

  const connectedChannels = client.channelConnections.filter(
    (channel) => channel.status === "CONNECTED",
  );
  const assignedChannelIds = new Set(client.agents.map((agent) => agent.channelId));
  const availableChannels = connectedChannels.filter(
    (channel) => !assignedChannelIds.has(channel.id),
  );

  return (
    <div className="space-y-12">
      <div className="text-sm text-[#1b1c19]/60">
        Clients <span className="mx-2">/</span>
        <span className="font-semibold text-[#1b1c19]">{client.name}</span>
      </div>

      <section className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="flex items-center gap-8">
          <div className="flex size-24 items-center justify-center rounded-full bg-white text-3xl font-extrabold text-[#8d4b00] shadow-sm">
            {client.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-5xl font-extrabold tracking-tight">{client.name}</h1>
              <StatusBadge status={client.status} />
            </div>
            <p className="mt-3 max-w-xl text-[#554336]">
              {client.slug} • {client.timezone}
            </p>
            <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[#1b1c19]/50">
              {availableChannels.length > 0
                ? "Ready for agent work"
                : connectedChannels.length === 0
                  ? "Waiting on first connected channel"
                  : "All connected channels are already assigned"}
            </p>
          </div>
        </div>
        <div className="flex gap-4">
          <Link
            href="/admin/clients"
            className="rounded-xl border border-[#dbc2b0] px-6 py-3 text-sm font-bold text-[#1b1c19] transition hover:bg-white"
          >
            Back to Clients
          </Link>
          {availableChannels.length > 0 ? (
            <Link
              href={`/admin/clients/${client.id}/agents/new`}
              className="rounded-xl bg-[linear-gradient(135deg,#8d4b00_0%,#b15f00_100%)] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-[#8d4b00]/10"
            >
              Create Agent
            </Link>
          ) : null}
        </div>
      </section>

      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 grid grid-cols-1 gap-8 lg:col-span-8 md:grid-cols-2">
          <div className="rounded-xl border border-[#dbc2b0]/20 bg-white p-8 shadow-[0_24px_48px_rgba(27,28,25,0.03)]">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold">Active Channels</h2>
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8d4b00]">
                {connectedChannels.length} Connected
              </span>
            </div>
            <div className="space-y-4">
              {client.channelConnections.map((channel) => {
                const assignedAgent = client.agents.find((agent) => agent.channelId === channel.id);
                return (
                  <div key={channel.id} className="flex items-center justify-between rounded-xl bg-[#f5f3ee] p-4">
                    <div>
                      <p className="text-sm font-bold">{channel.type}</p>
                      <p className="text-[10px] uppercase tracking-[0.14em] text-[#1b1c19]/50">
                        {assignedAgent ? `Assigned to ${assignedAgent.name}` : "Available for agent assignment"}
                      </p>
                    </div>
                    <StatusBadge status={assignedAgent ? "ACTIVE" : channel.status} />
                  </div>
                );
              })}
              {client.channelConnections.length === 0 ? (
                <div className="rounded-xl bg-[#f5f3ee] p-4 text-sm text-[#554336]">
                  No channels connected yet.
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-[#dbc2b0]/20 bg-white p-8 shadow-[0_24px_48px_rgba(27,28,25,0.03)]">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold">Integrations</h2>
              <span className="text-[10px] uppercase tracking-[0.18em] text-[#1b1c19]/40">
                Syncing Live
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {client.integrationConnections.map((integration) => (
                <div key={integration.id} className="rounded-xl bg-[#f0eee9] p-4 text-center">
                  <p className="text-sm font-bold">{integration.type}</p>
                  <p className="mt-2 text-[10px] uppercase tracking-[0.16em] text-[#1b1c19]/40">
                    {integration.status}
                  </p>
                </div>
              ))}
              {client.integrationConnections.length === 0 ? (
                <div className="col-span-2 rounded-xl bg-[#f5f3ee] p-4 text-sm text-[#554336]">
                  No integrations connected yet.
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-[#dbc2b0]/20 bg-white p-8 shadow-[0_24px_48px_rgba(27,28,25,0.03)] md:col-span-2">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">Client Agents</h2>
                <p className="mt-1 text-sm text-[#1b1c19]/50">
                  {client.agents.length} agents assigned to this client.
                </p>
              </div>
              {availableChannels.length > 0 ? (
                <Link
                  href={`/admin/clients/${client.id}/agents/new`}
                  className="rounded-xl bg-[linear-gradient(135deg,#8d4b00_0%,#b15f00_100%)] px-5 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white"
                >
                  Create Agent
                </Link>
              ) : null}
            </div>
            <div className="space-y-3">
              {client.agents.map((agent) => (
                <Link
                  key={agent.id}
                  href={`/admin/clients/${client.id}/agents/${agent.id}`}
                  className="group flex items-center justify-between rounded-xl bg-[#fbf9f4] p-4 transition hover:bg-[#f5f3ee]"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex size-12 items-center justify-center rounded-xl bg-[#ffdcc3] text-sm font-bold text-[#8d4b00]">
                      {agent.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold">{agent.name}</p>
                      <p className="text-[10px] uppercase tracking-[0.16em] text-[#1b1c19]/40">
                        {agent.channel.type} • {agent.status}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-[#8d4b00]">Open</span>
                </Link>
              ))}
              {client.agents.length === 0 ? (
                <div className="rounded-xl bg-[#f5f3ee] p-4 text-sm text-[#554336]">
                  No agents yet. Create the first one once a free connected channel is available.
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="col-span-12 rounded-xl border border-[#dbc2b0]/20 bg-[#f5f3ee] p-8 lg:col-span-4">
          <div>
            <h2 className="text-xl font-bold">Audit Trail</h2>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[#1b1c19]/50">
              Live Activity Stream
            </p>
          </div>
          <div className="mt-8 space-y-8">
            <div>
              <p className="text-sm font-bold">Client users</p>
              <div className="mt-2 space-y-2">
                {client.users.length === 0 ? (
                  <p className="text-sm text-[#554336]">No client users have joined yet.</p>
                ) : (
                  client.users.map((user) => (
                    <p key={user.id} className="text-sm text-[#554336]">
                      {user.email}
                    </p>
                  ))
                )}
              </div>
            </div>
            <div>
              <p className="text-sm font-bold">Readiness note</p>
              <p className="mt-2 text-sm leading-7 text-[#554336]">
                {connectedChannels.length === 0
                  ? "The client needs at least one connected channel before agent creation can continue."
                  : availableChannels.length > 0
                    ? "A free connected channel is available, so another agent can be created."
                    : "Every connected channel is already assigned. Add another channel before creating the next agent."}
              </p>
            </div>
            <div>
              <p className="text-sm font-bold">Channel rule</p>
              <p className="mt-2 text-sm leading-7 text-[#554336]">
                One connected channel can only belong to one agent.
              </p>
            </div>
          </div>
        </div>
      </div>

      {availableChannels.length > 0 ? (
        <section className="relative overflow-hidden rounded-full border border-[#8d4b00]/10 bg-[#ffdcc3]/35 px-8 py-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-xl font-bold text-[#6e3900]">Unassigned Channels Detected</h3>
              <p className="mt-1 text-sm text-[#6e3900]/80">
                You have {availableChannels.length} connected channel
                {availableChannels.length > 1 ? "s" : ""} with no active agent assigned.
              </p>
            </div>
            <Link
              href={`/admin/clients/${client.id}/agents/new`}
              className="rounded-full bg-[#2f1500] px-8 py-4 text-sm font-bold uppercase tracking-[0.16em] text-white"
            >
              Create Agent
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
