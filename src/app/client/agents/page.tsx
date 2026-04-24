import Link from "next/link";

import { AgentTestChatDrawer } from "@/components/stafless/agent-test-chat-drawer";
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
        where: {
          messages: {
            some: {},
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="space-y-10">
      <header className="rounded-[28px] bg-[linear-gradient(135deg,#ffffff_0%,#f4f2ff_52%,#e9edff_100%)] p-8 shadow-[0_18px_40px_rgba(24,24,54,0.06)] ring-1 ring-[#d8d6fe]/80 md:p-10">
        <div className="max-w-3xl">
          <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#5c5c7e]">
            Management
          </span>
          <h1 className="mt-2 font-heading text-5xl font-bold tracking-tight text-[#181836]">
            Agents
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-[#464554]">
            Review the agents assigned to your business, their current status, channel, and recent
            activity.
          </p>
        </div>
      </header>

      {agents.length === 0 ? (
        <div className="rounded-[24px] bg-white p-8 text-sm text-[#464554] shadow-[0_12px_28px_rgba(24,24,54,0.05)] ring-1 ring-[#d8d6fe]/70">
          Your team is still preparing the first agent for this account.
        </div>
      ) : (
        <section className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="rounded-[24px] bg-white p-8 shadow-[0_12px_28px_rgba(24,24,54,0.05)] ring-1 ring-[#d8d6fe]/70 transition hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(24,24,54,0.08)]"
            >
              <div className="mb-8 flex items-start justify-between">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-[#efecff] text-xl font-bold text-[#4648d4]">
                  {agent.name.charAt(0).toUpperCase()}
                </div>
                <StatusBadge status={agent.status === "ACTIVE" ? "ACTIVE" : "PAUSED"} />
              </div>
              <h2 className="font-heading text-xl font-bold text-[#181836]">{agent.name}</h2>
              <div className="mt-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#4648d4]">
                <span>{agent.channel.type}</span>
              </div>
              <p className="mt-4 text-sm leading-7 text-[#464554]">{agent.persona}</p>
              <div className="mt-8 border-t border-[#eef0ff] pt-6">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#5c5c7e]">
                    Last Activity
                  </span>
                  <span className="text-xs font-medium text-[#181836]">
                    {agent.conversations[0]
                      ? agent.conversations[0].updatedAt.toLocaleString()
                      : "No dialog activity yet"}
                  </span>
                </div>
              </div>
              <Link
                href={`/client/dialogs?agent=${agent.id}`}
                className="mt-6 inline-flex rounded-xl bg-[#efecff] px-4 py-2 text-sm font-semibold text-[#4648d4] transition hover:bg-[#e8e5ff]"
              >
                View dialogs
              </Link>
              {agent.status === "ACTIVE" ? (
                <div className="mt-3">
                  <AgentTestChatDrawer
                    agentId={agent.id}
                    agentName={agent.name}
                    tenantId={tenantId}
                    audience="client"
                  />
                </div>
              ) : null}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
