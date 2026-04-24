import Link from "next/link";
import { MessageRole, type Prisma } from "@prisma/client";

import { requireClientSession } from "@/lib/client-auth";
import { db } from "@/lib/db";
import { isQualifiedLeadToolMessage } from "@/lib/lead-qualification";

function getObjectEntries(value: Prisma.JsonValue | null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>).slice(0, 4);
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
        take: 1,
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
            messages: [qualifiedMessage],
          }
        : null;
    })
    .filter((thread): thread is (typeof leadThreads)[number] => Boolean(thread));

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
              Centralized overview of qualified outcomes captured by your agents.
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
            New Leads
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
            Leads only appear here when an agent completes one of your business target actions.
          </p>
        </div>
      </section>

      <section className="rounded-[24px] bg-white p-8 shadow-[0_12px_28px_rgba(24,24,54,0.05)] ring-1 ring-[#d8d6fe]/70">
        <div className="mb-8 flex flex-wrap items-center gap-4 border-b border-[#eef0ff] pb-8">
          <div className="relative min-w-[260px] flex-1">
            <input
              className="w-full rounded-2xl bg-[#f8f8ff] px-4 py-3 text-sm outline-none ring-1 ring-[#d8d6fe]/70"
              placeholder="Search by lead, agent or captured field..."
              readOnly
            />
          </div>
          <div className="rounded-lg bg-[#efecff] px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[#4648d4]">
            Qualified outcomes
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[#eef0ff] text-left">
                <th className="px-4 pb-6 text-xs font-bold uppercase tracking-[0.18em] text-[#5c5c7e]">
                  Lead Details
                </th>
                <th className="px-4 pb-6 text-xs font-bold uppercase tracking-[0.18em] text-[#5c5c7e]">
                  Source Agent
                </th>
                <th className="px-4 pb-6 text-xs font-bold uppercase tracking-[0.18em] text-[#5c5c7e]">
                  Captured Details
                </th>
                <th className="px-4 pb-6 text-xs font-bold uppercase tracking-[0.18em] text-[#5c5c7e]">
                  Date Captured
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eef0ff]">
              {qualifiedLeadThreads.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-sm text-[#464554]">
                    No lead actions recorded yet.
                  </td>
                </tr>
              ) : (
                qualifiedLeadThreads.map((thread) => {
                  const leadMessage = thread.messages[0];
                  const capturedFields = [
                    ...getObjectEntries(leadMessage?.toolInput ?? null),
                    ...getObjectEntries(leadMessage?.toolResult ?? null),
                  ].slice(0, 3);

                  return (
                    <tr key={thread.id} className="hover:bg-[#f8f8ff]">
                      <td className="px-4 py-6">
                        <div className="flex items-center gap-4">
                          <div className="flex size-10 items-center justify-center rounded-2xl bg-[#efecff] text-xs font-bold text-[#4648d4]">
                            {thread.contactId.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-[#181836]">{thread.contactId}</p>
                            <p className="text-xs text-[#5c5c7e]">
                              {leadMessage?.toolName ?? "Lead action"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-6 text-sm font-medium text-[#181836]">
                        {thread.agent.name}
                      </td>
                      <td className="px-4 py-6">
                        <div className="flex flex-wrap gap-2">
                          {capturedFields.length > 0 ? (
                            capturedFields.map(([key, value]) => (
                              <span
                                key={`${thread.id}-${key}`}
                                className="rounded-lg bg-[#f5f2ff] px-3 py-1 text-xs font-medium text-[#464554]"
                              >
                                {key}: {String(value)}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-[#5c5c7e]">Base lead fields only</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-6 text-sm text-[#464554]">
                        <Link
                          href={`/client/dialogs?conversation=${thread.id}`}
                          className="font-medium text-[#4648d4] hover:underline"
                        >
                          {thread.updatedAt.toLocaleString()}
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
