import Link from "next/link";
import { ArrowUpRight, Bot } from "lucide-react";

import { AgentTestChatDrawer } from "@/components/stafless/agent-test-chat-drawer";
import { requireClientSession } from "@/lib/client-auth";
import { db } from "@/lib/db";

function AgentStatusPill({ status }: { status: string }) {
  const isActive = status === "ACTIVE";

  return (
    <span
      className={[
        "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium uppercase tracking-[0.16em] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur",
        isActive
          ? "border-[#47c978]/34 bg-[linear-gradient(135deg,rgba(42,119,73,0.34),rgba(15,42,28,0.44))] text-[#62d990]"
          : "border-[#d7a96d]/42 bg-[linear-gradient(135deg,rgba(116,78,38,0.4),rgba(45,31,20,0.48))] text-[#e9be86]",
      ].join(" ")}
    >
      <span
        className={[
          "size-1.5 rounded-full",
          isActive ? "bg-[#62d990]" : "bg-[#e9be86]",
        ].join(" ")}
      />
      {isActive ? "Active" : "Paused"}
    </span>
  );
}

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
    <div className="mx-auto max-w-[1440px] px-5 py-10 md:px-8">
      <header className="relative overflow-hidden rounded-[1.6rem] border border-[#d7a96d]/55 bg-[#0a0a09] p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.035),0_0_46px_rgba(215,169,109,0.18),0_46px_140px_rgba(0,0,0,0.66)] md:p-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(215,169,109,0.08),transparent_28%),linear-gradient(120deg,rgba(255,255,255,0.026),transparent_36%)]" />
        <div className="relative max-w-3xl">
          <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/62">
            <span className="size-2 rounded-full bg-[#ff6a1a]" />
            Management
          </p>
          <h1 className="mt-5 font-serif text-5xl font-normal leading-[1.02] tracking-[-0.055em] text-white">
            Agents
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-white/60">
            Review the agents assigned to your business, their current status, channel, and recent
            activity.
          </p>
        </div>
      </header>

      {agents.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-white/[0.09] bg-[#111313] p-8 text-base text-white/56">
          Your team is still preparing the first agent for this account.
        </div>
      ) : (
        <section className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="flex flex-col rounded-2xl border border-white/[0.09] bg-[#111313] p-7 transition hover:-translate-y-0.5 hover:border-[#d7a96d]/35 hover:shadow-[0_0_36px_rgba(215,169,109,0.12)]"
            >
              <div className="mb-7 flex items-start justify-between">
                <div className="flex size-14 items-center justify-center rounded-2xl border border-[#d7a96d]/28 bg-[#20201d] text-[#e9be86]">
                  <Bot className="size-6" />
                </div>
                <AgentStatusPill status={agent.status} />
              </div>

              <h2 className="font-serif text-2xl font-normal tracking-[-0.04em] text-white">
                {agent.name}
              </h2>
              <div className="mt-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#e9be86]">
                <span>{agent.channel.type}</span>
              </div>
              <p className="mt-4 text-sm leading-7 text-white/56">{agent.persona}</p>

              <div className="mt-7 border-t border-white/[0.08] pt-6">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/42">
                    Last Activity
                  </span>
                  <span className="text-xs font-medium text-white/78">
                    {agent.conversations[0]
                      ? agent.conversations[0].updatedAt.toLocaleString()
                      : "No dialog activity yet"}
                  </span>
                </div>
              </div>

              <div className="mt-auto flex flex-wrap items-center gap-3 pt-6">
                <Link
                  href={`/client/dialogs?agent=${agent.id}`}
                  className="inline-flex items-center gap-2 rounded-lg border border-[#d7a96d]/38 bg-[linear-gradient(135deg,#3c342c,#2a241f)] px-4 py-2.5 text-sm font-medium text-[#e9be86] transition hover:border-[#d7a96d]/60"
                >
                  View dialogs
                  <ArrowUpRight className="size-4" />
                </Link>
                {agent.status === "ACTIVE" ? (
                  <AgentTestChatDrawer
                    agentId={agent.id}
                    agentName={agent.name}
                    tenantId={tenantId}
                    audience="client"
                  />
                ) : null}
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
