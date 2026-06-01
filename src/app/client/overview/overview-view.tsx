import { Bot, MessagesSquare, MessageSquareText, Wrench } from "lucide-react";

import { CabinetShell } from "@/components/cabinet/cabinet-shell";

export type OverviewAgentRow = {
  id: string;
  name: string;
  channelType: string;
  status: string;
  conversations: number;
  messages: number;
  tools: number;
  lastActivity: Date | null;
};

export type OverviewData = {
  activeAgents: number;
  totalAgents: number;
  totalConversations: number;
  totalMessages: number;
  totalTools: number;
  agents: OverviewAgentRow[];
  topFunctions: Array<{ toolName: string; count: number }>;
};

export function OverviewView({
  data,
  userInitials,
  userName,
}: {
  data: OverviewData;
  userInitials: string;
  userName: string;
}) {
  const kpis = [
    { icon: Bot, label: "Active agents", value: data.activeAgents, sub: `${data.totalAgents} total` },
    {
      icon: MessagesSquare,
      label: "Conversations",
      value: data.totalConversations,
      sub: "across all agents",
    },
    { icon: MessageSquareText, label: "Messages", value: data.totalMessages, sub: "sent & received" },
    { icon: Wrench, label: "Function calls", value: data.totalTools, sub: "tools executed" },
  ];

  const maxFunctionCount = data.topFunctions[0]?.count ?? 0;

  const header = (
    <div>
      <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/62">
        <span className="size-2 rounded-full bg-[#ff6a1a]" />
        Analytics
      </p>
      <h1 className="mt-3 font-serif text-4xl font-normal leading-[1.02] tracking-[-0.055em] text-white">
        Overview
      </h1>
    </div>
  );

  return (
    <CabinetShell userInitials={userInitials} userName={userName} header={header}>
      <section className="grid grid-cols-1 overflow-hidden border-b border-white/[0.09] bg-[#10110f] sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(({ icon: Icon, label, value, sub }) => (
          <div
            key={label}
            className="border-b border-white/[0.08] p-6 last:border-b-0 sm:odd:border-r xl:border-b-0 xl:border-r xl:last:border-r-0"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/42">
                {label}
              </span>
              <span className="grid size-9 place-items-center rounded-xl border border-[#d7a96d]/28 bg-[#20201d] text-[#e9be86]">
                <Icon className="size-4" />
              </span>
            </div>
            <p className="mt-5 font-serif text-4xl font-normal tracking-[-0.04em] text-white">
              {value.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-white/45">{sub}</p>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 overflow-hidden bg-[#10110f] xl:grid-cols-[1fr_340px]">
        <div className="overflow-hidden border-b border-white/[0.09] xl:border-b-0 xl:border-r">
          <div className="border-b border-white/[0.08] px-6 py-4">
            <h2 className="font-serif text-lg font-normal tracking-[-0.03em] text-white">Per agent</h2>
          </div>
          {data.agents.length === 0 ? (
            <div className="p-6 text-sm text-white/55">No agents configured yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-[0.16em] text-white/40">
                    <th className="px-6 py-3 font-bold">Agent</th>
                    <th className="px-4 py-3 text-right font-bold">Dialogs</th>
                    <th className="px-4 py-3 text-right font-bold">Messages</th>
                    <th className="px-4 py-3 text-right font-bold">Functions</th>
                    <th className="px-6 py-3 text-right font-bold">Last active</th>
                  </tr>
                </thead>
                <tbody>
                  {data.agents.map((agent) => {
                    const isActive = agent.status === "ACTIVE";
                    return (
                      <tr
                        key={agent.id}
                        className="border-b border-white/[0.05] transition last:border-0 hover:bg-white/[0.02]"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <span className="flex size-9 items-center justify-center rounded-xl border border-[#d7a96d]/28 bg-[#20201d] text-[#e9be86]">
                              <Bot className="size-4" />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-white">{agent.name}</p>
                              <p className="flex items-center gap-1.5 text-[11px] text-white/45">
                                <span
                                  className={`size-1.5 rounded-full ${isActive ? "bg-[#62d990]" : "bg-[#e9be86]"}`}
                                />
                                {agent.channelType}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right tabular-nums text-white/80">
                          {agent.conversations}
                        </td>
                        <td className="px-4 py-4 text-right tabular-nums text-white/80">
                          {agent.messages}
                        </td>
                        <td className="px-4 py-4 text-right tabular-nums text-[#e9be86]">
                          {agent.tools}
                        </td>
                        <td className="px-6 py-4 text-right text-xs text-white/55">
                          {agent.lastActivity ? agent.lastActivity.toLocaleDateString() : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="p-6">
          <h2 className="font-serif text-lg font-normal tracking-[-0.03em] text-white">
            Top functions
          </h2>
          {data.topFunctions.length === 0 ? (
            <p className="mt-4 text-sm text-white/55">No functions called yet.</p>
          ) : (
            <div className="mt-5 space-y-4">
              {data.topFunctions.map((fn) => {
                const width = maxFunctionCount > 0 ? (fn.count / maxFunctionCount) * 100 : 0;
                return (
                  <div key={fn.toolName}>
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span className="truncate font-medium text-white/80">{fn.toolName}</span>
                      <span className="tabular-nums text-white/55">{fn.count}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className="h-full rounded-full bg-[linear-gradient(90deg,#d7a96d,#e9be86)]"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </CabinetShell>
  );
}
