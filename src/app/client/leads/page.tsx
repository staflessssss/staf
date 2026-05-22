import Link from "next/link";
import { MessageRole } from "@prisma/client";

import {
  getCapturedLeadFields,
  getLeadDetails,
  getToolActionLabel,
  getToolStatusLabel,
} from "@/lib/client-analytics";
import { requireClientSession } from "@/lib/client-auth";
import { db } from "@/lib/db";
import { isQualifiedLeadToolMessage } from "@/lib/lead-qualification";

function formatDateTime(value: Date) {
  return value.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function buildLeadPreview(fields: Array<{ label: string; value: string }>) {
  const preview = fields
    .filter((field) => ["Names", "Wedding Date", "Venue", "Location", "Consultation Date", "Consultation Time"].includes(field.label))
    .slice(0, 3)
    .map((field) => `${field.label}: ${field.value}`)
    .join(" - ");

  return preview || `${fields.length} collected field${fields.length === 1 ? "" : "s"}`;
}

type ClientLeadsPageProps = {
  searchParams: Promise<{ lead?: string }>;
};

export default async function ClientLeadsPage({ searchParams }: ClientLeadsPageProps) {
  const session = await requireClientSession();
  const tenantId = session.user.tenantId;
  const { lead } = await searchParams;

  const leadThreads = await db.conversation.findMany({
    where: {
      agent: { tenantId },
      messages: {
        some: {
          role: MessageRole.TOOL,
          NOT: { toolName: null },
        },
      },
    },
    include: {
      agent: true,
      messages: {
        where: {
          role: MessageRole.TOOL,
          NOT: { toolName: null },
        },
        orderBy: { createdAt: "desc" },
        take: 12,
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const qualifiedLeadThreads = leadThreads
    .map((thread) => {
      const qualifiedMessage = thread.messages.find((message) =>
        isQualifiedLeadToolMessage({
          toolName: message.toolName,
          toolResult: message.toolResult,
        }),
      );

      return qualifiedMessage
        ? {
            ...thread,
            qualifiedMessage,
            details: getLeadDetails(qualifiedMessage, thread.contactId),
            capturedFields: Array.from(
              new Map(
                thread.messages
                  .flatMap((message) => getCapturedLeadFields(message))
                  .map((field) => [field.label.toLowerCase(), field] as const),
              ).values(),
            ),
          }
        : null;
    })
    .filter((thread): thread is NonNullable<typeof thread> => Boolean(thread));

  const bookedLeadCount = qualifiedLeadThreads.filter((thread) =>
    isQualifiedLeadToolMessage({
      toolName: thread.qualifiedMessage.toolName,
      toolResult: thread.qualifiedMessage.toolResult,
    }),
  ).length;
  const selectedLead = qualifiedLeadThreads.find((thread) => thread.id === lead) ?? qualifiedLeadThreads[0] ?? null;
  const selectedTimeline = selectedLead?.messages ?? [];

  return (
    <div className="space-y-12">
      <header className="rounded-[28px] bg-[linear-gradient(135deg,#ffffff_0%,#f4f2ff_52%,#e9edff_100%)] p-8 shadow-[0_18px_40px_rgba(24,24,54,0.06)] ring-1 ring-[#d8d6fe]/80 md:p-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#5c5c7e]">
              Lead review
            </p>
            <h1 className="mt-2 font-heading text-5xl font-bold tracking-tight text-[#181836]">
              Leads
            </h1>
            <p className="mt-3 text-lg leading-8 text-[#464554]">
              Qualified outcomes captured by your agents, with the source details collected during each dialog.
            </p>
          </div>
          <Link
            href="/client/dialogs"
            className="rounded-xl bg-[#efecff] px-6 py-3 text-sm font-bold text-[#4648d4] transition hover:bg-[#e8e5ff]"
          >
            Open Dialogs
          </Link>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-12">
        <div className="rounded-[24px] bg-white p-8 shadow-[0_12px_28px_rgba(24,24,54,0.05)] ring-1 ring-[#d8d6fe]/70 md:col-span-4">
          <h2 className="font-heading text-3xl font-bold tracking-tight text-[#181836]">
            {qualifiedLeadThreads.length}
          </h2>
          <p className="mt-2 text-xs font-bold uppercase tracking-[0.18em] text-[#5c5c7e]">
            Qualified Leads
          </p>
        </div>
        <div className="rounded-[24px] bg-white p-8 shadow-[0_12px_28px_rgba(24,24,54,0.05)] ring-1 ring-[#d8d6fe]/70 md:col-span-4">
          <h2 className="font-heading text-3xl font-bold tracking-tight text-[#181836]">
            {bookedLeadCount}
          </h2>
          <p className="mt-2 text-xs font-bold uppercase tracking-[0.18em] text-[#5c5c7e]">
            Booked
          </p>
        </div>
        <div className="relative overflow-hidden rounded-[24px] bg-[linear-gradient(135deg,#4648d4_0%,#18b7c4_100%)] p-8 text-white shadow-[0_18px_40px_rgba(70,72,212,0.18)] md:col-span-4">
          <h3 className="font-heading text-2xl font-bold">Client Details</h3>
          <p className="mt-2 text-sm text-white/80">
            Only the information shared by the lead is shown here.
          </p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,0.82fr)_minmax(440px,1fr)]">
        <div className="rounded-[28px] bg-white p-6 shadow-[0_12px_28px_rgba(24,24,54,0.05)] ring-1 ring-[#d8d6fe]/70">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-[#eef0ff] pb-6">
            <div>
              <h2 className="font-heading text-2xl font-bold text-[#181836]">Qualified Outcomes</h2>
              <p className="mt-2 text-sm text-[#464554]">Latest leads captured by active agents.</p>
            </div>
            <span className="rounded-lg bg-[#efecff] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#4648d4]">
              Latest first
            </span>
          </div>

          <div className="space-y-3">
            {qualifiedLeadThreads.length === 0 ? (
              <div className="rounded-[20px] bg-[#f8f8ff] p-8 text-sm text-[#464554]">
                No lead actions recorded yet.
              </div>
            ) : (
              qualifiedLeadThreads.map((thread) => {
                const details = thread.details;
                const isSelected = selectedLead?.id === thread.id;

                return (
                  <Link
                    key={thread.id}
                    href={`/client/leads?lead=${thread.id}`}
                    className={[
                      "grid gap-4 rounded-[22px] p-5 ring-1 transition md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center",
                      isSelected
                        ? "bg-[#f5fbff] ring-[#8fdfe7] shadow-[0_16px_34px_rgba(24,24,54,0.08)]"
                        : "bg-[#fbfbff] ring-[#eef0ff] hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_14px_30px_rgba(24,24,54,0.07)]",
                    ].join(" ")}
                  >
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#efecff] text-xs font-bold text-[#4648d4]">
                      {thread.contactId.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-bold text-[#181836]">{details.coupleName ?? thread.contactId}</p>
                      <p className="mt-1 truncate text-xs text-[#5c5c7e]">
                        {details.action} by {thread.agent.name}
                      </p>
                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#464554]">
                        {buildLeadPreview(thread.capturedFields)}
                      </p>
                    </div>
                    <div className="flex items-start gap-2 md:flex-col md:text-right">
                      <span className="rounded-lg bg-[#effffb] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#137d86] ring-1 ring-[#c9f4ed]">
                        {details.status}
                      </span>
                      <span className="text-[11px] font-semibold text-[#6b6a78]">
                        {formatDateTime(thread.qualifiedMessage.createdAt)}
                      </span>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        <aside className="rounded-[28px] bg-[linear-gradient(135deg,#ffffff_0%,#fbfbff_60%,#f4fbff_100%)] p-6 shadow-[0_18px_46px_rgba(24,24,54,0.07)] ring-1 ring-[#dfe4ff] xl:sticky xl:top-8 xl:self-start">
          {selectedLead ? (
            <div className="space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#eef0ff] pb-6">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#5c5c7e]">
                    Lead Details
                  </p>
                  <h2 className="mt-2 truncate font-heading text-3xl font-bold tracking-tight text-[#181836]">
                    {selectedLead.details.coupleName ?? selectedLead.contactId}
                  </h2>
                  <p className="mt-2 truncate text-sm text-[#464554]">{selectedLead.contactId}</p>
                </div>
                <Link
                  href={`/client/dialogs?conversation=${selectedLead.id}`}
                  className="rounded-xl bg-[#4648d4] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#3d3fbd]"
                >
                  Open Dialog
                </Link>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ["Outcome", selectedLead.details.action],
                  ["Status", selectedLead.details.status],
                  ["Captured", formatDateTime(selectedLead.qualifiedMessage.createdAt)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl bg-white/80 p-4 ring-1 ring-[#eef0ff]">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#6b6a78]">{label}</p>
                    <p className="mt-2 break-words text-sm font-semibold text-[#181836]">{value}</p>
                  </div>
                ))}
              </div>

              <div>
                <h3 className="font-heading text-xl font-bold text-[#181836]">What the lead shared</h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {selectedLead.capturedFields.length === 0 ? (
                    <div className="rounded-2xl bg-white/80 p-5 text-sm text-[#464554] ring-1 ring-[#eef0ff] sm:col-span-2">
                      No structured fields captured for this lead yet.
                    </div>
                  ) : (
                    selectedLead.capturedFields.map((field) => (
                      <div key={`${field.label}:${field.value}`} className="rounded-2xl bg-white/84 p-4 ring-1 ring-[#eef0ff]">
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#6b6a78]">{field.label}</p>
                        <p className="mt-2 break-words text-sm font-semibold text-[#181836]">{field.value}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <h3 className="font-heading text-xl font-bold text-[#181836]">Agent Actions</h3>
                <div className="mt-4 space-y-4">
                  {selectedTimeline.map((message) => (
                    <div key={message.id} className="rounded-2xl bg-white/84 p-4 ring-1 ring-[#eef0ff]">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-[#181836]">{getToolActionLabel(message.toolName)}</p>
                          <p className="mt-1 text-xs leading-5 text-[#464554]">
                            {getToolStatusLabel(message.toolResult)}
                          </p>
                        </div>
                        <span className="rounded-lg bg-[#efecff] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#4648d4]">
                          {getToolStatusLabel(message.toolResult)}
                        </span>
                      </div>
                      <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6b6a78]">
                        {formatDateTime(message.createdAt)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-[22px] bg-white/80 p-8 text-sm text-[#464554] ring-1 ring-[#eef0ff]">
              Select a lead to review collected information.
            </div>
          )}
        </aside>
      </section>
    </div>
  );
}
