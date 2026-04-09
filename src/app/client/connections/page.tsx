import Image from "next/image";
import Link from "next/link";
import { ChannelType } from "@prisma/client";

import {
  channelDefinitions,
  getConnectionStatusLabel,
  integrationDefinitions,
} from "@/lib/connections-catalog";
import { requireClientSession } from "@/lib/client-auth";
import { db } from "@/lib/db";

type ClientConnectionsPageProps = {
  searchParams: Promise<{ saved?: string; error?: string }>;
};

export default async function ClientConnectionsPage({
  searchParams,
}: ClientConnectionsPageProps) {
  const session = await requireClientSession();
  const tenantId = session.user.tenantId;
  const { saved, error } = await searchParams;
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    include: {
      channelConnections: { orderBy: { type: "asc" } },
      integrationConnections: { orderBy: { type: "asc" } },
    },
  });

  if (!tenant) {
    return <div>Tenant not found.</div>;
  }

  const gmailConnected = tenant.channelConnections.some(
    (item) => item.type === ChannelType.GMAIL && item.status === "CONNECTED",
  );

  return (
    <div className="space-y-12">
      <header className="max-w-3xl">
        <h1 className="text-5xl font-extrabold tracking-tight">Connections</h1>
        <p className="mt-4 text-lg leading-8 text-[#554336]">
          Подключите каналы и сервисы, которые использует ваш бизнес. По каждой кнопке откроется
          отдельная понятная инструкция.
        </p>
      </header>

      {saved ? (
        <div className="rounded-xl border border-[#b9dec8] bg-[#eef8f1] px-4 py-3 text-sm text-[#157347]">
          {saved === "channel"
            ? "Канал успешно подключён."
            : "Интеграция успешно подключена."}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-[#efc4c1] bg-[#fff0ef] px-4 py-3 text-sm text-[#b42318]">
          Не удалось завершить подключение.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
        <section>
          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-2xl font-bold">Channels</h2>
            <span className="rounded-full bg-[#f0eee9] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#1b1c19]/70">
              Dialog sources
            </span>
          </div>
          <div className="space-y-4">
            {channelDefinitions.map((definition) => {
              const connection = tenant.channelConnections.find(
                (item) => item.type === definition.type,
              );
              const isConnected = connection?.status === "CONNECTED";

              return (
                <div
                  key={definition.key}
                  className="rounded-xl bg-white p-8 shadow-[0_24px_48px_rgba(27,28,25,0.06)]"
                >
                  <div className="mb-6 flex items-start justify-between">
                    <div className="flex size-14 items-center justify-center rounded-xl bg-[#f5f3ee]">
                      <Image
                        src={definition.icon}
                        alt={definition.title}
                        width={32}
                        height={32}
                      />
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${
                        isConnected
                          ? "bg-[#eef8f1] text-[#157347]"
                          : "bg-[#f0eee9] text-[#636563]"
                      }`}
                    >
                      {getConnectionStatusLabel(connection?.status)}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold">{definition.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-[#554336]">
                    {definition.shortDescription}
                  </p>
                  <div className="mt-6 flex items-center justify-between border-t border-[#eae8e3] pt-6">
                    <Link
                      href={`/client/connections/${definition.key}`}
                      className={`ml-auto rounded-xl px-5 py-3 text-sm font-bold ${
                        isConnected
                          ? "border border-[#dbc2b0] text-[#1b1c19]"
                          : "bg-[linear-gradient(135deg,#8d4b00_0%,#b15f00_100%)] text-white"
                      }`}
                    >
                      {isConnected ? "Open" : "Connect"}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-2xl font-bold">Integrations</h2>
            <span className="rounded-full bg-[#f0eee9] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#1b1c19]/70">
              Business tools
            </span>
          </div>
          <div className="space-y-4">
            {integrationDefinitions.map((definition) => {
              const connection = tenant.integrationConnections.find(
                (item) => item.type === definition.type,
              );
              const isConnected = connection?.status === "CONNECTED" || (definition.requiresGoogleWorkspace && gmailConnected);

              return (
                <div
                  key={definition.key}
                  className="rounded-xl bg-white p-8 shadow-[0_24px_48px_rgba(27,28,25,0.06)]"
                >
                  <div className="mb-6 flex items-start justify-between">
                    <div className="flex size-14 items-center justify-center rounded-xl bg-[#f5f3ee]">
                      <Image
                        src={definition.icon}
                        alt={definition.title}
                        width={32}
                        height={32}
                      />
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${
                        isConnected
                          ? "bg-[#eef8f1] text-[#157347]"
                          : "bg-[#f0eee9] text-[#636563]"
                      }`}
                    >
                      {isConnected ? "Подключено" : "Не подключено"}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold">{definition.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-[#554336]">
                    {definition.shortDescription}
                  </p>
                  {definition.requiresGoogleWorkspace ? (
                    <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#8d4b00]">
                      {gmailConnected
                        ? "Available through your connected Google account"
                        : "Connect Gmail first"}
                    </p>
                  ) : null}
                  <div className="mt-6 flex items-center justify-between border-t border-[#eae8e3] pt-6">
                    <Link
                      href={`/client/connections/${definition.key}`}
                      className={`ml-auto rounded-xl px-5 py-3 text-sm font-bold ${
                        isConnected
                          ? "border border-[#dbc2b0] text-[#1b1c19]"
                          : "bg-[#f0eee9] text-[#1b1c19]"
                      }`}
                    >
                      {isConnected ? "Open" : "Connect"}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
