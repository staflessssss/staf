import Link from "next/link";
import { ArrowUpRight, Bot } from "lucide-react";

import { AgentTestChatDrawer } from "@/components/stafless/agent-test-chat-drawer";
import { CabinetShell } from "@/components/cabinet/cabinet-shell";

import { AgentStatusToggle } from "./agent-status-toggle";

export type AgentsViewAgent = {
  id: string;
  name: string;
  status: string;
  persona: string;
  channel: { type: string };
  conversations: Array<{ updatedAt: Date }>;
};

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

export function AgentsView({
  agents,
  tenantId,
  userInitials,
  userName,
}: {
  agents: AgentsViewAgent[];
  tenantId: string;
  userInitials: string;
  userName: string;
}) {
  const activeCount = agents.filter((agent) => agent.status === "ACTIVE").length;

  const header = (
    <>
      <div>
        <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/62">
          <span className="size-2 rounded-full bg-[#ff6a1a]" />
          Management
        </p>
        <h1 className="mt-3 font-serif text-4xl font-normal leading-[1.02] tracking-[-0.055em] text-white">
          Agents
        </h1>
      </div>
      <div className="hidden items-center gap-3 text-sm text-white/60 sm:flex">
        <span className="rounded-lg border border-white/[0.1] px-4 py-2">{agents.length} total</span>
        <span className="rounded-lg border border-[#47c978]/30 bg-[#47c978]/[0.06] px-4 py-2 text-[#62d990]">
          {activeCount} active
        </span>
      </div>
    </>
  );

  return (
    <CabinetShell userInitials={userInitials} userName={userName} header={header}>
      {agents.length === 0 ? (
        <div className="border-b border-white/[0.09] bg-[#10110f] p-8 text-base text-white/56">
          Your team is still preparing the first agent for this account.
        </div>
      ) : (
        <section className="divide-y divide-white/[0.08] bg-[#10110f]">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="grid gap-5 p-5 transition hover:bg-white/[0.025] md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center md:p-6"
            >
              <div className="flex size-12 items-center justify-center rounded-xl border border-[#d7a96d]/28 bg-[#20201d] text-[#e9be86]">
                <Bot className="size-5" />
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="truncate text-xl font-semibold tracking-[-0.04em] text-white">
                    {agent.name}
                  </h2>
                  <AgentStatusPill status={agent.status} />
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#e9be86]">
                    {agent.channel.type}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 max-w-3xl text-sm leading-6 text-white/56">
                  {agent.persona}
                </p>
                <p className="mt-3 text-xs text-white/42">
                  Last activity:{" "}
                  {agent.conversations[0]
                    ? agent.conversations[0].updatedAt.toLocaleString()
                    : "No dialog activity yet"}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 md:justify-end">
                <AgentStatusToggle agentId={agent.id} initialStatus={agent.status} />
                <Link
                  href={`/client/dialogs?agent=${agent.id}`}
                  className="inline-flex items-center gap-2 rounded-lg border border-[#d7a96d]/38 bg-[#3a3028] px-4 py-2.5 text-sm font-medium text-[#e9be86] transition hover:border-[#d7a96d]/60"
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
    </CabinetShell>
  );
}
