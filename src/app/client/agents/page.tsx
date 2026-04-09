import Link from "next/link";

import { StatusBadge } from "@/components/stafless/foundation";
import { requireClientSession } from "@/lib/client-auth";
import { db } from "@/lib/db";

export default async function ClientAgentsPage() {
  const session = await requireClientSession();
  const tenantId = session.user.tenantId;
  const agents = await db.agent.findMany({
    where: { tenantId },
    include: {
      channel: true,
      conversations: {
        orderBy: { updatedAt: "desc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl">
          <span className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8d4b00]">
            Management
          </span>
          <h1 className="mt-2 text-5xl font-extrabold tracking-tight">Agents</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-[#554336]">
            Review the agents assigned to your business, their current status, channel, and recent
            activity.
          </p>
        </div>
      </header>

      {agents.length === 0 ? (
        <div className="rounded-xl bg-white p-8 text-sm text-[#554336] shadow-sm">
          Your team is still preparing the first agent for this account.
        </div>
      ) : (
        <section className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="rounded-xl bg-white p-8 shadow-[0_24px_48px_rgba(27,28,25,0.06)] transition hover:shadow-[0_24px_48px_rgba(27,28,25,0.09)]"
            >
              <div className="mb-8 flex items-start justify-between">
                <div className="flex size-14 items-center justify-center rounded-full bg-[#f0eee9] text-xl font-bold text-[#8d4b00]">
                  {agent.name.charAt(0).toUpperCase()}
                </div>
                <StatusBadge status={agent.status === "ACTIVE" ? "ACTIVE" : "PAUSED"} />
              </div>
              <h2 className="text-xl font-bold">{agent.name}</h2>
              <div className="mt-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#8d4b00]">
                <span>{agent.channel.type}</span>
              </div>
              <p className="mt-4 text-sm leading-7 text-[#554336]">{agent.persona}</p>
              <div className="mt-8 border-t border-[#eae8e3] pt-6">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#636563]">
                    Last Activity
                  </span>
                  <span className="text-xs font-medium text-[#1b1c19]">
                    {agent.conversations[0]
                      ? agent.conversations[0].updatedAt.toLocaleString()
                      : "No dialog activity yet"}
                  </span>
                </div>
              </div>
              <Link
                href={`/client/dialogs?agent=${agent.id}`}
                className="mt-6 inline-flex rounded-full border border-[#dbc2b0] px-4 py-2 text-sm font-semibold text-[#1b1c19] transition hover:bg-[#f5f3ee]"
              >
                View dialogs
              </Link>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
