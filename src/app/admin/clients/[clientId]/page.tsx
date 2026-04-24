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

  const connectedChannels = client.channelConnections.filter((channel) => channel.status === "CONNECTED");
  const assignedChannelIds = new Set(client.agents.map((agent) => agent.channelId));
  const availableChannels = connectedChannels.filter((channel) => !assignedChannelIds.has(channel.id));

  return (
    <div className="space-y-12">
      <div className="text-sm text-[#5c5c7e]">
        Clients <span className="mx-2">/</span>
        <span className="font-semibold text-[#181836]">{client.name}</span>
      </div>

      <section className="rounded-[28px] bg-[linear-gradient(135deg,#ffffff_0%,#f4f2ff_52%,#e9edff_100%)] p-8 shadow-[0_18px_40px_rgba(24,24,54,0.06)] ring-1 ring-[#d8d6fe]/80 md:p-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="flex items-center gap-8">
            <div className="flex size-24 items-center justify-center rounded-[28px] bg-white text-3xl font-extrabold text-[#4648d4] shadow-[0_16px_32px_rgba(24,24,54,0.06)] ring-1 ring-[#d8d6fe]/70">
              {client.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-heading text-5xl font-bold tracking-tight text-[#181836]">
                  {client.name}
                </h1>
                <StatusBadge status={client.status} />
              </div>
              <p className="mt-3 max-w-xl text-[#464554]">
                {client.slug} • {client.timezone}
              </p>
              <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[#5c5c7e]">
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
              className="rounded-xl bg-white/80 px-6 py-3 text-sm font-bold text-[#181836] ring-1 ring-[#d8d6fe]/70 transition hover:bg-white"
            >
              Back to Clients
            </Link>
            {availableChannels.length > 0 ? (
              <Link
                href={`/admin/clients/${client.id}/agents/new`}
                className="rounded-xl bg-[linear-gradient(135deg,#4648d4_0%,#6063ee_100%)] px-6 py-3 text-sm font-bold text-white shadow-[0_16px_30px_rgba(70,72,212,0.18)]"
              >
                Create Agent
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 grid grid-cols-1 gap-8 lg:col-span-8 md:grid-cols-2">
          <div className="rounded-[24px] bg-white p-8 shadow-[0_12px_28px_rgba(24,24,54,0.05)] ring-1 ring-[#d8d6fe]/70">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-heading text-xl font-bold text-[#181836]">Active Channels</h2>
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#4648d4]">
                {connectedChannels.length} Connected
              </span>
            </div>
            <div className="space-y-4">
              {client.channelConnections.map((channel) => {
                const assignedAgent = client.agents.find((agent) => agent.channelId === channel.id);
                return (
                  <div key={channel.id} className="flex items-center justify-between rounded-2xl bg-[#f5f2ff] p-4">
                    <div>
                      <p className="text-sm font-bold text-[#181836]">{channel.type}</p>
                      <p className="text-[10px] uppercase tracking-[0.14em] text-[#5c5c7e]">
                        {assignedAgent
                          ? `Assigned to ${assignedAgent.name}`
                          : "Available for agent assignment"}
                      </p>
                    </div>
                    <StatusBadge status={assignedAgent ? "ACTIVE" : channel.status} />
                  </div>
                );
              })}
              {client.channelConnections.length === 0 ? (
                <div className="rounded-2xl bg-[#f5f2ff] p-4 text-sm text-[#464554]">
                  No channels connected yet.
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-[24px] bg-white p-8 shadow-[0_12px_28px_rgba(24,24,54,0.05)] ring-1 ring-[#d8d6fe]/70">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-heading text-xl font-bold text-[#181836]">Integrations</h2>
              <span className="text-[10px] uppercase tracking-[0.18em] text-[#5c5c7e]">
                Syncing Live
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {client.integrationConnections.map((integration) => (
                <div key={integration.id} className="rounded-2xl bg-[#f5f2ff] p-4 text-center">
                  <p className="text-sm font-bold text-[#181836]">{integration.type}</p>
                  <p className="mt-2 text-[10px] uppercase tracking-[0.16em] text-[#5c5c7e]">
                    {integration.status}
                  </p>
                </div>
              ))}
              {client.integrationConnections.length === 0 ? (
                <div className="col-span-2 rounded-2xl bg-[#f5f2ff] p-4 text-sm text-[#464554]">
                  No integrations connected yet.
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-[24px] bg-white p-8 shadow-[0_12px_28px_rgba(24,24,54,0.05)] ring-1 ring-[#d8d6fe]/70 md:col-span-2">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h2 className="font-heading text-xl font-bold text-[#181836]">Client Agents</h2>
                <p className="mt-1 text-sm text-[#5c5c7e]">
                  {client.agents.length} agents assigned to this client.
                </p>
              </div>
              {availableChannels.length > 0 ? (
                <Link
                  href={`/admin/clients/${client.id}/agents/new`}
                  className="rounded-xl bg-[linear-gradient(135deg,#4648d4_0%,#6063ee_100%)] px-5 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white"
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
                  className="group flex items-center justify-between rounded-2xl bg-[#fcfcff] p-4 transition hover:bg-[#f8f8ff]"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex size-12 items-center justify-center rounded-2xl bg-[#efecff] text-sm font-bold text-[#4648d4]">
                      {agent.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-[#181836]">{agent.name}</p>
                      <p className="text-[10px] uppercase tracking-[0.16em] text-[#5c5c7e]">
                        {agent.channel.type} • {agent.status}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-[#4648d4]">Open</span>
                </Link>
              ))}
              {client.agents.length === 0 ? (
                <div className="rounded-2xl bg-[#f5f2ff] p-4 text-sm text-[#464554]">
                  No agents yet. Create the first one once a free connected channel is available.
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="col-span-12 rounded-[24px] bg-[#f5f2ff] p-8 shadow-[0_12px_28px_rgba(24,24,54,0.05)] ring-1 ring-[#d8d6fe]/70 lg:col-span-4">
          <div>
            <h2 className="font-heading text-xl font-bold text-[#181836]">Audit Trail</h2>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[#5c5c7e]">
              Live Activity Stream
            </p>
          </div>
          <div className="mt-8 space-y-8">
            <div>
              <p className="text-sm font-bold text-[#181836]">Client users</p>
              <div className="mt-2 space-y-2">
                {client.users.length === 0 ? (
                  <p className="text-sm text-[#464554]">No client users have joined yet.</p>
                ) : (
                  client.users.map((user) => (
                    <p key={user.id} className="text-sm text-[#464554]">
                      {user.email}
                    </p>
                  ))
                )}
              </div>
            </div>
            <div>
              <p className="text-sm font-bold text-[#181836]">Readiness note</p>
              <p className="mt-2 text-sm leading-7 text-[#464554]">
                {connectedChannels.length === 0
                  ? "The client needs at least one connected channel before agent creation can continue."
                  : availableChannels.length > 0
                    ? "A free connected channel is available, so another agent can be created."
                    : "Every connected channel is already assigned. Add another channel before creating the next agent."}
              </p>
            </div>
            <div>
              <p className="text-sm font-bold text-[#181836]">Channel rule</p>
              <p className="mt-2 text-sm leading-7 text-[#464554]">
                One connected channel can only belong to one agent.
              </p>
            </div>
          </div>
        </div>
      </div>

      {availableChannels.length > 0 ? (
        <section className="relative overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,#4648d4_0%,#6063ee_100%)] px-8 py-6 text-white shadow-[0_18px_40px_rgba(70,72,212,0.18)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="font-heading text-xl font-bold">Unassigned Channels Detected</h3>
              <p className="mt-1 text-sm text-white/80">
                You have {availableChannels.length} connected channel
                {availableChannels.length > 1 ? "s" : ""} with no active agent assigned.
              </p>
            </div>
            <Link
              href={`/admin/clients/${client.id}/agents/new`}
              className="rounded-xl bg-white px-8 py-4 text-sm font-bold uppercase tracking-[0.16em] text-[#181836] shadow-[0_12px_24px_rgba(24,24,54,0.08)]"
            >
              Create Agent
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
