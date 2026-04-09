import Link from "next/link";
import { MessageRole, type Prisma } from "@prisma/client";

import { requireClientSession } from "@/lib/client-auth";
import { db } from "@/lib/db";

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

  const actionedCount = Math.max(0, leadThreads.length - Math.ceil(leadThreads.length / 3));

  return (
    <div className="space-y-12">
      <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl">
          <h1 className="text-5xl font-extrabold tracking-tight">Leads</h1>
          <p className="mt-3 text-lg leading-8 text-[#554336]">
            Centralized overview of qualified outcomes captured by your agents.
          </p>
        </div>
        <Link
          href="/client/dialogs"
          className="rounded-xl border border-[#dbc2b0] px-6 py-3 text-sm font-bold text-[#1b1c19] transition hover:bg-white"
        >
          Open Dialogs
        </Link>
      </header>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-12">
        <div className="rounded-xl bg-white p-8 shadow-sm md:col-span-3">
          <h2 className="text-3xl font-black">{leadThreads.length}</h2>
          <p className="mt-2 text-xs font-bold uppercase tracking-[0.18em] text-[#636563]">
            New Leads
          </p>
        </div>
        <div className="rounded-xl bg-white p-8 shadow-sm md:col-span-3">
          <h2 className="text-3xl font-black">{actionedCount}</h2>
          <p className="mt-2 text-xs font-bold uppercase tracking-[0.18em] text-[#636563]">
            Actioned
          </p>
        </div>
        <div className="relative overflow-hidden rounded-xl bg-[linear-gradient(135deg,#8d4b00_0%,#b15f00_100%)] p-8 text-white md:col-span-6">
          <h3 className="text-2xl font-bold">Lead Health</h3>
          <p className="mt-2 text-sm text-white/80">
            Leads only appear here when an agent completes one of your business target actions.
          </p>
        </div>
      </section>

      <section className="rounded-xl bg-white p-8 shadow-sm">
        <div className="mb-8 flex flex-wrap items-center gap-4 border-b border-[#eae8e3] pb-8">
          <div className="relative min-w-[260px] flex-1">
            <input
              className="w-full rounded-xl bg-[#f0eee9] px-4 py-3 text-sm outline-none"
              placeholder="Search by lead, agent or captured field..."
              readOnly
            />
          </div>
          <div className="rounded-full bg-[#f0eee9] px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[#1b1c19]">
            Qualified outcomes
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[#eae8e3] text-left">
                <th className="px-4 pb-6 text-xs font-bold uppercase tracking-[0.18em] text-[#636563]">
                  Lead Details
                </th>
                <th className="px-4 pb-6 text-xs font-bold uppercase tracking-[0.18em] text-[#636563]">
                  Source Agent
                </th>
                <th className="px-4 pb-6 text-xs font-bold uppercase tracking-[0.18em] text-[#636563]">
                  Captured Details
                </th>
                <th className="px-4 pb-6 text-xs font-bold uppercase tracking-[0.18em] text-[#636563]">
                  Date Captured
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0eee9]">
              {leadThreads.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-sm text-[#554336]">
                    No lead actions recorded yet.
                  </td>
                </tr>
              ) : (
                leadThreads.map((thread) => {
                  const leadMessage = thread.messages[0];
                  const capturedFields = [
                    ...getObjectEntries(leadMessage?.toolInput ?? null),
                    ...getObjectEntries(leadMessage?.toolResult ?? null),
                  ].slice(0, 3);

                  return (
                    <tr key={thread.id} className="hover:bg-[#faf6f0]">
                      <td className="px-4 py-6">
                        <div className="flex items-center gap-4">
                          <div className="flex size-10 items-center justify-center rounded-full bg-[#f0eee9] text-xs font-bold text-[#8d4b00]">
                            {thread.contactId.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-[#1b1c19]">{thread.contactId}</p>
                            <p className="text-xs text-[#636563]">
                              {leadMessage?.toolName ?? "Lead action"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-6 text-sm font-medium text-[#1b1c19]">
                        {thread.agent.name}
                      </td>
                      <td className="px-4 py-6">
                        <div className="flex flex-wrap gap-2">
                          {capturedFields.length > 0 ? (
                            capturedFields.map(([key, value]) => (
                              <span
                                key={`${thread.id}-${key}`}
                                className="rounded-full bg-[#f0eee9] px-3 py-1 text-xs font-medium text-[#554336]"
                              >
                                {key}: {String(value)}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-[#636563]">Base lead fields only</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-6 text-sm text-[#554336]">
                        <Link
                          href={`/client/dialogs?conversation=${thread.id}`}
                          className="font-medium text-[#8d4b00] hover:underline"
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
