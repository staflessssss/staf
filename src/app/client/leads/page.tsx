import Link from "next/link";
import { MessageRole } from "@prisma/client";
import { ArrowUpRight, CheckCircle2, Clock3, UsersRound } from "lucide-react";

import { CabinetShell } from "@/components/cabinet/cabinet-shell";
import { getCabinetUserName, getInitials } from "@/components/cabinet/user";
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
    .filter((field) =>
      [
        "Names",
        "Wedding Date",
        "Venue",
        "Location",
        "Consultation Date",
        "Consultation Time",
      ].includes(field.label),
    )
    .slice(0, 3)
    .map((field) => `${field.label}: ${field.value}`)
    .join(" - ");

  return preview || `${fields.length} collected field${fields.length === 1 ? "" : "s"}`;
}

function statusClassName(status: string) {
  const normalized = status.toLowerCase();

  if (
    normalized.includes("book") ||
    normalized.includes("confirm") ||
    normalized.includes("available")
  ) {
    return "border-[#47c978]/34 bg-[#47c978]/[0.08] text-[#62d990]";
  }

  return "border-[#d7a96d]/36 bg-[#3a2c1e] text-[#e9be86]";
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
  const selectedLead =
    qualifiedLeadThreads.find((thread) => thread.id === lead) ?? qualifiedLeadThreads[0] ?? null;
  const selectedTimeline = selectedLead?.messages ?? [];
  const userName = getCabinetUserName(session.user);

  const header = (
    <>
      <div>
        <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/62">
          <span className="size-2 rounded-full bg-[#ff6a1a]" />
          Lead review
        </p>
        <h1 className="mt-3 font-serif text-4xl font-normal leading-[1.02] tracking-[-0.055em] text-white">
          Leads
        </h1>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm text-white/60">
        <span className="rounded-lg border border-white/[0.1] px-4 py-2">
          {qualifiedLeadThreads.length} qualified
        </span>
        <span className="rounded-lg border border-[#47c978]/30 bg-[#47c978]/[0.06] px-4 py-2 text-[#62d990]">
          {bookedLeadCount} booked
        </span>
      </div>
    </>
  );

  return (
    <CabinetShell header={header} userInitials={getInitials(userName)} userName={userName}>
      <section className="grid grid-cols-1 overflow-hidden border-b border-white/[0.09] bg-[#10110f] sm:grid-cols-3">
        {[
          {
            icon: UsersRound,
            label: "Qualified leads",
            value: qualifiedLeadThreads.length,
            sub: "captured by agents",
          },
          {
            icon: CheckCircle2,
            label: "Booked",
            value: bookedLeadCount,
            sub: "high-intent outcomes",
          },
          {
            icon: Clock3,
            label: "Latest activity",
            value: selectedLead ? formatDateTime(selectedLead.qualifiedMessage.createdAt) : "-",
            sub: "from the active lead list",
          },
        ].map(({ icon: Icon, label, value, sub }) => (
          <div key={label} className="border-b border-white/[0.08] p-6 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
            <div className="flex items-center justify-between gap-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/42">
                {label}
              </p>
              <span className="grid size-9 place-items-center rounded-xl border border-[#d7a96d]/28 bg-[#20201d] text-[#e9be86]">
                <Icon className="size-4" />
              </span>
            </div>
            <p className="mt-5 break-words font-serif text-3xl font-normal tracking-[-0.04em] text-white">
              {value}
            </p>
            <p className="mt-2 text-xs text-white/45">{sub}</p>
          </div>
        ))}
      </section>

      <section className="grid xl:grid-cols-[minmax(0,0.88fr)_minmax(380px,0.92fr)]">
        <div className="overflow-hidden border-b border-white/[0.09] bg-[#10110f] xl:border-b-0 xl:border-r">
          <div className="flex flex-col gap-3 border-b border-white/[0.08] px-5 py-5 sm:flex-row sm:items-center sm:justify-between md:px-6">
            <div>
              <h2 className="font-serif text-xl font-normal tracking-[-0.04em] text-white">
                Qualified outcomes
              </h2>
              <p className="mt-1 text-sm text-white/45">Latest leads captured by active agents.</p>
            </div>
            <span className="w-fit rounded-lg border border-[#d7a96d]/32 bg-[#d7a96d]/[0.06] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#e9be86]">
              Latest first
            </span>
          </div>

          <div className="divide-y divide-white/[0.08]">
            {qualifiedLeadThreads.length === 0 ? (
              <div className="p-6 text-sm text-white/55">
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
                      "grid gap-4 p-5 transition md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center",
                      isSelected
                        ? "bg-[#27231e]"
                        : "hover:bg-white/[0.035]",
                    ].join(" ")}
                  >
                    <div className="grid size-11 shrink-0 place-items-center rounded-xl border border-[#d7a96d]/28 bg-[#20201d] text-xs font-bold text-[#e9be86]">
                      {getInitials(details.coupleName ?? thread.contactId)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-white">
                        {details.coupleName ?? thread.contactId}
                      </p>
                      <p className="mt-1 truncate text-xs text-white/42">
                        {details.action} by {thread.agent.name}
                      </p>
                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-white/62">
                        {buildLeadPreview(thread.capturedFields)}
                      </p>
                    </div>
                    <div className="flex items-start gap-2 md:flex-col md:text-right">
                      <span
                        className={[
                          "rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em]",
                          statusClassName(details.status),
                        ].join(" ")}
                      >
                        {details.status}
                      </span>
                      <span className="text-[11px] font-medium text-white/42">
                        {formatDateTime(thread.qualifiedMessage.createdAt)}
                      </span>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        <aside className="bg-[#10100e] p-5 xl:sticky xl:top-0 xl:self-start md:p-6">
          {selectedLead ? (
            <div className="space-y-6">
              <div className="flex flex-col gap-4 border-b border-white/[0.08] pb-6 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/42">
                    Lead details
                  </p>
                  <h2 className="mt-2 truncate font-serif text-3xl font-normal tracking-[-0.055em] text-white">
                    {selectedLead.details.coupleName ?? selectedLead.contactId}
                  </h2>
                  <p className="mt-2 truncate text-sm text-white/45">{selectedLead.contactId}</p>
                </div>
                <Link
                  href={`/client/dialogs?conversation=${selectedLead.id}`}
                  className="inline-flex w-fit items-center gap-2 rounded-lg border border-[#d7a96d]/38 bg-[#3a3028] px-4 py-2.5 text-sm font-semibold text-[#e9be86] transition hover:bg-[#473a2f]"
                >
                  Open dialog
                  <ArrowUpRight className="size-4" />
                </Link>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ["Outcome", selectedLead.details.action],
                  ["Status", selectedLead.details.status],
                  ["Captured", formatDateTime(selectedLead.qualifiedMessage.createdAt)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-white/[0.08] bg-black/16 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/38">
                      {label}
                    </p>
                    <p className="mt-2 break-words text-sm font-semibold text-white">{value}</p>
                  </div>
                ))}
              </div>

              <div>
                <h3 className="font-serif text-xl font-normal tracking-[-0.04em] text-white">
                  What the lead shared
                </h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {selectedLead.capturedFields.length === 0 ? (
                    <div className="rounded-xl border border-white/[0.08] bg-black/16 p-5 text-sm text-white/55 sm:col-span-2">
                      No structured fields captured for this lead yet.
                    </div>
                  ) : (
                    selectedLead.capturedFields.map((field) => (
                      <div
                        key={`${field.label}:${field.value}`}
                        className="rounded-xl border border-white/[0.08] bg-black/16 p-4"
                      >
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/38">
                          {field.label}
                        </p>
                        <p className="mt-2 break-words text-sm font-semibold text-white">
                          {field.value}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <h3 className="font-serif text-xl font-normal tracking-[-0.04em] text-white">
                  Agent actions
                </h3>
                <div className="mt-4 space-y-3">
                  {selectedTimeline.map((message) => {
                    const status = getToolStatusLabel(message.toolResult);

                    return (
                      <div
                        key={message.id}
                        className="rounded-xl border border-white/[0.08] bg-black/16 p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">
                              {getToolActionLabel(message.toolName)}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-white/52">{status}</p>
                          </div>
                          <span
                            className={[
                              "rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em]",
                              statusClassName(status),
                            ].join(" ")}
                          >
                            {status}
                          </span>
                        </div>
                        <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/38">
                          {formatDateTime(message.createdAt)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="border-y border-white/[0.08] py-8 text-sm text-white/55">
              Select a lead to review collected information.
            </div>
          )}
        </aside>
      </section>
    </CabinetShell>
  );
}
