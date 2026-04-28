import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { StatusBadge } from "@/components/stafless/foundation";
import { requireAdminSession } from "@/lib/admin-auth";
import { channelDefinitions, getConnectionStatusLabel } from "@/lib/connections-catalog";
import { db } from "@/lib/db";

export default async function AdminClientConnectionsPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  await requireAdminSession();
  const { clientId } = await params;
  const client = await db.tenant.findUnique({
    where: { id: clientId },
    include: {
      channelConnections: true,
    },
  });

  if (!client) notFound();

  return (
    <div className="space-y-8">
      <div className="text-sm text-[#5c5c7e]">
        Clients <span className="mx-2">/</span>
        <Link href={`/admin/clients/${client.id}`} className="hover:text-[#181836]">
          {client.name}
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#181836]">Connections</span>
      </div>

      <section className="rounded-[28px] bg-white p-8 shadow-[0_12px_28px_rgba(24,24,54,0.05)] ring-1 ring-[#d8d6fe]/70">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-heading text-4xl font-bold tracking-tight text-[#181836]">
              Каналы клиента
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#464554]">
              Откройте конкретный канал, чтобы подключить его или проверить состояние.
            </p>
          </div>
          <Link
            href={`/admin/clients/${client.id}`}
            className="rounded-xl bg-[#efecff] px-6 py-3 text-sm font-bold text-[#4648d4] transition hover:bg-[#e8e5ff]"
          >
            Назад к клиенту
          </Link>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        {channelDefinitions.map((definition) => {
          const connection = client.channelConnections.find(
            (item) => item.type === definition.type,
          );

          return (
            <Link
              key={definition.key}
              href={`/admin/clients/${client.id}/connections/${definition.key}`}
              className="rounded-[24px] bg-white p-6 shadow-[0_12px_28px_rgba(24,24,54,0.05)] ring-1 ring-[#d8d6fe]/70 transition hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(24,24,54,0.08)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-[#f5f2ff]">
                  <Image src={definition.icon} alt={definition.title} width={28} height={28} />
                </div>
                <StatusBadge status={connection?.status ?? getConnectionStatusLabel()} />
              </div>
              <h2 className="mt-5 text-lg font-bold text-[#181836]">{definition.title}</h2>
              <p className="mt-2 text-sm leading-6 text-[#667085]">
                {definition.shortDescription}
              </p>
              <span className="mt-5 inline-flex rounded-xl bg-[#6c63ff] px-5 py-2 text-xs font-semibold text-white">
                Открыть
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
