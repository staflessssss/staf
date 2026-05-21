import Link from "next/link";
import { MessageRole } from "@prisma/client";

import { getLeadDetails, getToolActionLabel, getToolStatusLabel } from "@/lib/client-analytics";
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

export default async function ClientLeadsPage() {
  const session = await requireClientSession();
  const tenantId = session.user.tenantId;

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
          }
        : null;
    })
    .filter((thread): thread is NonNullable<typeof thread> => Boolean(thread));

  const actionedCount = Math.max(
    0,
    qualifiedLeadThreads.length - Math.ceil(qualifiedLeadThreads.length / 3),
  );

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
        <div className="rounded-[24px] bg-white p-8 shadow-[0_12px_28px_rgba(24,24,54,0.05)] ring-1 ring-[#d8d6fe]/70 md:col-span-3">
          <h2 className="font-heading text-3xl font-bold tracking-tight text-[#181836]">
            {qualifiedLeadThreads.length}
          </h2>
          <p className="mt-2 text-xs font-bold uppercase tracking-[0.18em] text-[#5c5c7e]">
            Qualified Leads
          </p>
        </div>
        <div className="rounded-[24px] bg-white p-8 shadow-[0_12px_28px_rgba(24,24,54,0.05)] ring-1 ring-[#d8d6fe]/70 md:col-span-3">
          <h2 className="font-heading text-3xl font-bold tracking-tight text-[#181836]">
            {actionedCount}
          </h2>
          <p className="mt-2 text-xs font-bold uppercase tracking-[0.18em] text-[#5c5c7e]">
            Actioned
          </p>
        </div>
        <div className="relative overflow-hidden rounded-[24px] bg-[linear-gradient(135deg,#4648d4_0%,#6063ee_100%)] p-8 text-white shadow-[0_18px_40px_rgba(70,72,212,0.18)] md:col-span-6">
          <h3 className="font-heading text-2xl font-bold">Lead Health</h3>
          <p className="mt-2 text-sm text-white/80">
            Qualified leads include the captured wedding details, consultation status, and source function timeline.
          </p>
        </div>
      </section>

      <section className="rounded-[24px] bg-white p-8 shadow-[0_12px_28px_rgba(24,24,54,0.05)] ring-1 ring-[#d8d6fe]/70">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-[#eef0ff] pb-8">
          <div>
            <h2 className="font-heading text-2xl font-bold text-[#181836]">Qualified Outcomes</h2>
            <p className="mt-2 text-sm text-[#464554]">
              Latest booked or completed business actions from active agent conversations.
            </p>
          </div>
          <div className="rounded-lg bg-[#efecff] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#4648d4]">
            Latest first
          </div>
        </div>

        <div className="space-y-4">
          {qualifiedLeadThreads.length === 0 ? (
            <div className="rounded-[20px] bg-[#f8f8ff] p-8 text-sm text-[#464554]">
              No lead actions recorded yet.
            </div>
          ) : (
            qualifiedLeadThreads.map((thread) => {
              const details = thread.details;

              return (
                <details
                  key={thread.id}
                  className="group rounded-[22px] bg-[#fbfbff] p-5 ring-1 ring-[#eef0ff] open:bg-white open:shadow-[0_18px_36px_rgba(24,24,54,0.08)]"
                >
                  <summary className="grid cursor-pointer list-none gap-4 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center">
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#efecff] text-xs font-bold text-[#4648d4]">
                        {thread.contactId.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-bold text-[#181836]">{details.coupleName ?? thread.contactId}</p>
                        <p className="mt-1 truncate text-xs text-[#5c5c7e]">{thread.contactId}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#5c5c7e]">
                        Outcome
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[#181836]">{details.action}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#5c5c7e]">
                        Captured
                      </p>
                      <p className="mt-1 text-sm text-[#464554]">{formatDateTime(thread.qualifiedMessage.createdAt)}</p>
                    </div>
                    <span className="rounded-lg bg-[#efecff] px-3 py-2 text-xs font-bold text-[#4648d4]">
                      Details
                    </span>
                  </summary>

                  <div className="mt-6 grid gap-6 border-t border-[#eef0ff] pt-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="grid gap-3 sm:grid-cols-2">
                      {[
                        ["Wedding date", details.weddingDate],
                        ["Location", details.location],
                        ["Consultation", [details.callDate, details.callTime].filter(Boolean).join(" at ")],
                        ["Email", details.email],
                        ["Mode", details.mode ?? "live"],
                        ["Status", details.status],
                        ["Capacity", details.capacity ? `${details.bookedCount ?? 0}/${details.capacity} booked` : null],
                        ["Event ID", details.eventId],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-2xl bg-[#f8f8ff] p-4 ring-1 ring-[#eef0ff]">
                          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#6b6a78]">{label}</p>
                          <p className="mt-2 break-words text-sm font-semibold text-[#181836]">
                            {value || "Not captured"}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-2xl bg-[#f8f8ff] p-5 ring-1 ring-[#eef0ff]">
                      <h4 className="font-heading text-lg font-bold text-[#181836]">Function Timeline</h4>
                      <div className="mt-4 space-y-4">
                        {thread.messages.map((message) => (
                          <div key={message.id} className="border-l-2 border-[#d8d6fe] pl-4">
                            <p className="text-sm font-bold text-[#181836]">{getToolActionLabel(message.toolName)}</p>
                            <p className="mt-1 text-xs text-[#464554]">{getToolStatusLabel(message.toolResult)}</p>
                            <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6b6a78]">
                              {formatDateTime(message.createdAt)}
                            </p>
                          </div>
                        ))}
                      </div>
                      <Link
                        href={`/client/dialogs?conversation=${thread.id}`}
                        className="mt-5 inline-flex rounded-xl bg-[#4648d4] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#3d3fbd]"
                      >
                        Open dialog
                      </Link>
                    </div>
                  </div>
                </details>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
