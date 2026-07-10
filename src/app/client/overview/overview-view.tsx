import Link from "next/link";
import {
  Bot,
  CalendarCheck2,
  CheckCircle2,
  Clock3,
  FileImage,
  HeartPulse,
  MessagesSquare,
  ShieldAlert,
} from "lucide-react";

import { CabinetShell } from "@/components/cabinet/cabinet-shell";

export type OverviewPeriod = "7d" | "30d" | "90d" | "all";
export type OverviewChannel = "all" | "INSTAGRAM" | "GMAIL";

export type OverviewAgentRow = {
  id: string;
  name: string;
  channelType: string;
  status: string;
  conversations: number;
  replies: number;
  qualified: number;
  booked: number;
  lastActivity: Date | null;
};

export type OverviewData = {
  period: OverviewPeriod;
  channel: OverviewChannel;
  activeAgents: number;
  totalAgents: number;
  newConversations: number;
  repliesSent: number;
  availabilityChecks: number;
  guidesSent: number;
  qualifiedLeads: number;
  bookedCalls: number;
  automationRate: number;
  agents: OverviewAgentRow[];
  funnel: Array<{ label: string; count: number }>;
  health: {
    escalated: number;
    failedDeliveries: number;
    pendingFollowUps: number;
    handoffs: number;
    medianResponseMs: number | null;
    lastSuccessfulReply: Date | null;
  };
};

function overviewHref(period: OverviewPeriod, channel: OverviewChannel) {
  const query = new URLSearchParams();
  if (period !== "30d") query.set("period", period);
  if (channel !== "all") query.set("channel", channel);
  const suffix = query.toString();
  return `/client/overview${suffix ? `?${suffix}` : ""}`;
}

function formatLastReply(value: Date | null) {
  if (!value) return "No successful reply yet";
  return value.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDuration(value: number | null) {
  if (value === null) return "Not enough data";
  if (value < 60_000) return `${Math.max(1, Math.round(value / 1000))} sec`;
  return `${Math.round(value / 60_000)} min`;
}

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
    { icon: MessagesSquare, label: "New inquiries", value: data.newConversations, sub: "new conversations" },
    { icon: CheckCircle2, label: "Agent replies", value: data.repliesSent, sub: `${data.automationRate}% fully automated` },
    { icon: CalendarCheck2, label: "Dates checked", value: data.availabilityChecks, sub: "successful checks" },
    { icon: FileImage, label: "Pricing sent", value: data.guidesSent, sub: "regional guides" },
    { icon: Bot, label: "Qualified leads", value: data.qualifiedLeads, sub: "date, location and names" },
    { icon: Clock3, label: "Calls booked", value: data.bookedCalls, sub: "confirmed consultations" },
  ];
  const maxFunnel = Math.max(data.funnel[0]?.count ?? 0, 1);
  const periodOptions: Array<{ value: OverviewPeriod; label: string }> = [
    { value: "7d", label: "7 days" },
    { value: "30d", label: "30 days" },
    { value: "90d", label: "90 days" },
    { value: "all", label: "All time" },
  ];
  const channelOptions: Array<{ value: OverviewChannel; label: string }> = [
    { value: "all", label: "All channels" },
    { value: "INSTAGRAM", label: "Instagram" },
    { value: "GMAIL", label: "Gmail" },
  ];

  const header = (
    <>
      <div>
        <p className="flex items-center gap-2 text-[10px] font-black uppercase text-white/62">
          <span className="size-2 rounded-full bg-[#ff6a1a]" />
          Business outcomes
        </p>
        <h1 className="mt-3 font-serif text-4xl font-normal leading-none text-white">Overview</h1>
      </div>
      <div className="flex flex-wrap gap-2">
        {periodOptions.map((option) => (
          <Link
            key={option.value}
            href={overviewHref(option.value, data.channel)}
            className={`rounded-md border px-3 py-2 text-xs font-semibold transition ${
              data.period === option.value
                ? "border-[#d7a96d]/50 bg-[#3a2c1e] text-[#e9be86]"
                : "border-white/10 text-white/55 hover:text-white"
            }`}
          >
            {option.label}
          </Link>
        ))}
      </div>
    </>
  );

  return (
    <CabinetShell userInitials={userInitials} userName={userName} header={header}>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {channelOptions.map((option) => (
          <Link
            key={option.value}
            href={overviewHref(data.period, option.value)}
            className={`shrink-0 rounded-md border px-3 py-2 text-xs font-semibold transition ${
              data.channel === option.value
                ? "border-[#d7a96d]/50 bg-[#3a2c1e] text-[#e9be86]"
                : "border-white/10 text-white/55 hover:text-white"
            }`}
          >
            {option.label}
          </Link>
        ))}
      </div>

      <section className="grid grid-cols-1 overflow-hidden border-b border-white/[0.09] bg-[#10110f] sm:grid-cols-2 xl:grid-cols-3">
        {kpis.map(({ icon: Icon, label, value, sub }) => (
          <div key={label} className="border-b border-r border-white/[0.08] p-6">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase text-white/42">{label}</span>
              <span className="grid size-9 place-items-center rounded-md border border-[#d7a96d]/28 bg-[#20201d] text-[#e9be86]">
                <Icon className="size-4" />
              </span>
            </div>
            <p className="mt-5 font-serif text-4xl font-normal text-white">{value.toLocaleString()}</p>
            <p className="mt-1 text-xs text-white/45">{sub}</p>
          </div>
        ))}
      </section>

      <section className="grid border-b border-white/[0.09] bg-[#10110f] xl:grid-cols-[1fr_360px]">
        <div className="border-b border-white/[0.09] p-6 xl:border-b-0 xl:border-r">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-serif text-xl font-normal text-white">Lead funnel</h2>
              <p className="mt-1 text-sm text-white/45">Unique conversations reaching each outcome.</p>
            </div>
            <span className="text-xs text-white/45">{data.period === "all" ? "All time" : data.period}</span>
          </div>
          <div className="mt-6 space-y-4">
            {data.funnel.map((step) => (
              <div key={step.label}>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-white/75">{step.label}</span>
                  <span className="font-semibold text-white">{step.count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full bg-[#d7a96d]"
                    style={{ width: `${Math.max(2, (step.count / maxFunnel) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-md border border-[#d7a96d]/28 text-[#e9be86]">
              <HeartPulse className="size-4" />
            </span>
            <div>
              <h2 className="font-serif text-xl font-normal text-white">Agent health</h2>
              <p className="text-xs text-white/42">Current items requiring attention.</p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {[
              ["Escalated", data.health.escalated],
              ["Failed delivery", data.health.failedDeliveries],
              ["Pending follow-ups", data.health.pendingFollowUps],
              ["Handoffs", data.health.handoffs],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-md border border-white/[0.08] bg-black/20 p-4">
                <p className="text-[10px] font-bold uppercase text-white/38">{label}</p>
                <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-start gap-3 rounded-md border border-white/[0.08] bg-black/20 p-4">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-[#e9be86]" />
            <div>
              <p className="text-xs font-semibold text-white">Last successful reply</p>
              <p className="mt-1 text-xs text-white/48">{formatLastReply(data.health.lastSuccessfulReply)}</p>
              <p className="mt-2 text-xs text-white/48">
                Median first response: {formatDuration(data.health.medianResponseMs)}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden bg-[#10110f]">
        <div className="flex items-center justify-between border-b border-white/[0.08] px-6 py-4">
          <h2 className="font-serif text-lg font-normal text-white">Per channel agent</h2>
          <span className="text-xs text-white/45">{data.activeAgents} active / {data.totalAgents} total</span>
        </div>
        {data.agents.length === 0 ? (
          <div className="p-6 text-sm text-white/55">No agents configured for this channel.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-[10px] uppercase text-white/40">
                  <th className="px-6 py-3 font-bold">Agent</th>
                  <th className="px-4 py-3 text-right font-bold">Inquiries</th>
                  <th className="px-4 py-3 text-right font-bold">Replies</th>
                  <th className="px-4 py-3 text-right font-bold">Qualified</th>
                  <th className="px-4 py-3 text-right font-bold">Booked</th>
                  <th className="px-6 py-3 text-right font-bold">Last active</th>
                </tr>
              </thead>
              <tbody>
                {data.agents.map((agent) => (
                  <tr key={agent.id} className="border-b border-white/[0.05] last:border-0 hover:bg-white/[0.02]">
                    <td className="px-6 py-4">
                      <p className="font-medium text-white">{agent.name}</p>
                      <p className="mt-1 text-[11px] text-white/45">{agent.channelType} · {agent.status}</p>
                    </td>
                    <td className="px-4 py-4 text-right text-white/75">{agent.conversations}</td>
                    <td className="px-4 py-4 text-right text-white/75">{agent.replies}</td>
                    <td className="px-4 py-4 text-right text-[#e9be86]">{agent.qualified}</td>
                    <td className="px-4 py-4 text-right text-[#62d990]">{agent.booked}</td>
                    <td className="px-6 py-4 text-right text-xs text-white/55">
                      {agent.lastActivity ? agent.lastActivity.toLocaleDateString() : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </CabinetShell>
  );
}
