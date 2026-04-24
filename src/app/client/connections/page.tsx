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

export default async function ClientConnectionsPage({ searchParams }: ClientConnectionsPageProps) {
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
      <header className="rounded-[28px] bg-[linear-gradient(135deg,#ffffff_0%,#f4f2ff_52%,#e9edff_100%)] p-8 shadow-[0_18px_40px_rgba(24,24,54,0.06)] ring-1 ring-[#d8d6fe]/80 md:p-10">
        <div className="max-w-3xl">
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#5c5c7e]">
            Setup hub
          </p>
          <h1 className="mt-2 font-heading text-5xl font-bold tracking-tight text-[#181836]">
            Connections
          </h1>
          <p className="mt-4 text-lg leading-8 text-[#464554]">
            Connect the channels and services your business already uses.
          </p>
        </div>
      </header>

      {saved ? (
        <div className="rounded-[20px] bg-[#eef8f1] px-4 py-3 text-sm text-[#157347] ring-1 ring-[#b9dec8]">
          {saved === "channel"
            ? "Channel successfully connected."
            : "Integration successfully connected."}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-[20px] bg-[#fff0ef] px-4 py-3 text-sm text-[#b42318] ring-1 ring-[#efc4c1]">
          Could not complete the connection.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
        <section>
          <div className="mb-8 flex items-center justify-between">
            <h2 className="font-heading text-2xl font-bold text-[#181836]">Channels</h2>
            <span className="rounded-lg bg-[#efecff] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#4648d4]">
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
                  className="rounded-[24px] bg-white p-8 shadow-[0_12px_28px_rgba(24,24,54,0.05)] ring-1 ring-[#d8d6fe]/70"
                >
                  <div className="mb-6 flex items-start justify-between">
                    <div className="flex size-14 items-center justify-center rounded-2xl bg-[#f5f2ff]">
                      <Image src={definition.icon} alt={definition.title} width={32} height={32} />
                    </div>
                    <span
                      className={`rounded-lg px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${
                        isConnected
                          ? "bg-[#eef8f1] text-[#157347]"
                          : "bg-[#f5f2ff] text-[#4648d4]"
                      }`}
                    >
                      {getConnectionStatusLabel(connection?.status)}
                    </span>
                  </div>
                  <h3 className="font-heading text-xl font-bold text-[#181836]">
                    {definition.title}
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-[#464554]">{definition.shortDescription}</p>
                  <div className="mt-6 flex items-center justify-between border-t border-[#eef0ff] pt-6">
                    <Link
                      href={`/client/connections/${definition.key}`}
                      className={`ml-auto rounded-xl px-5 py-3 text-sm font-bold ${
                        isConnected
                          ? "bg-[#efecff] text-[#4648d4]"
                          : "bg-[linear-gradient(135deg,#4648d4_0%,#6063ee_100%)] text-white"
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
            <h2 className="font-heading text-2xl font-bold text-[#181836]">Integrations</h2>
            <span className="rounded-lg bg-[#efecff] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#4648d4]">
              Business tools
            </span>
          </div>
          <div className="space-y-4">
            {integrationDefinitions.map((definition) => {
              const connection = tenant.integrationConnections.find(
                (item) => item.type === definition.type,
              );
              const isConnected =
                connection?.status === "CONNECTED" ||
                (definition.requiresGoogleWorkspace && gmailConnected);

              return (
                <div
                  key={definition.key}
                  className="rounded-[24px] bg-white p-8 shadow-[0_12px_28px_rgba(24,24,54,0.05)] ring-1 ring-[#d8d6fe]/70"
                >
                  <div className="mb-6 flex items-start justify-between">
                    <div className="flex size-14 items-center justify-center rounded-2xl bg-[#f5f2ff]">
                      <Image src={definition.icon} alt={definition.title} width={32} height={32} />
                    </div>
                    <span
                      className={`rounded-lg px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${
                        isConnected
                          ? "bg-[#eef8f1] text-[#157347]"
                          : "bg-[#f5f2ff] text-[#4648d4]"
                      }`}
                    >
                      {isConnected ? "Connected" : "Not connected"}
                    </span>
                  </div>
                  <h3 className="font-heading text-xl font-bold text-[#181836]">
                    {definition.title}
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-[#464554]">{definition.shortDescription}</p>
                  {definition.requiresGoogleWorkspace ? (
                    <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#4648d4]">
                      {gmailConnected ? "Available through your connected Google account" : "Connect Gmail first"}
                    </p>
                  ) : null}
                  <div className="mt-6 flex items-center justify-between border-t border-[#eef0ff] pt-6">
                    <Link
                      href={`/client/connections/${definition.key}`}
                      className={`ml-auto rounded-xl px-5 py-3 text-sm font-bold ${
                        isConnected
                          ? "bg-[#efecff] text-[#4648d4]"
                          : "bg-[#f5f2ff] text-[#181836]"
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
