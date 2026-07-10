import Image from "next/image";
import Link from "next/link";
import { ChannelType } from "@prisma/client";
import { ArrowUpRight, Plug, Radio, Wrench } from "lucide-react";

import { CabinetShell } from "@/components/cabinet/cabinet-shell";
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

function statusPillClassName(isConnected: boolean) {
  return isConnected
    ? "border-[#47c978]/34 bg-[#47c978]/[0.08] text-[#62d990]"
    : "border-[#d7a96d]/34 bg-[#3a2c1e] text-[#e9be86]";
}

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

  const header = (
    <>
      <div>
        <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/62">
          <span className="size-2 rounded-full bg-[#ff6a1a]" />
          Setup hub
        </p>
        <h1 className="mt-3 font-serif text-4xl font-normal leading-[1.02] tracking-[-0.055em] text-white">
          Connections
        </h1>
      </div>
      {tenant ? (
        <div className="flex flex-wrap items-center gap-3 text-sm text-white/60">
          <span className="rounded-lg border border-white/[0.1] px-4 py-2">
            {tenant.channelConnections.length} channels
          </span>
          <span className="rounded-lg border border-white/[0.1] px-4 py-2">
            {tenant.integrationConnections.length} integrations
          </span>
        </div>
      ) : null}
    </>
  );

  if (!tenant) {
    return (
      <CabinetShell header={header}>
        <div className="border-b border-white/[0.09] bg-[#10110f] p-8 text-sm text-white/58">
          Tenant not found.
        </div>
      </CabinetShell>
    );
  }

  const gmailConnected = tenant.channelConnections.some(
    (item) => item.type === ChannelType.GMAIL && item.status === "CONNECTED",
  );
  const connectedChannels = tenant.channelConnections.filter(
    (item) => item.status === "CONNECTED",
  ).length;
  const connectedIntegrations = integrationDefinitions.filter((definition) => {
    const connection = tenant.integrationConnections.find((item) => item.type === definition.type);

    return (
      connection?.status === "CONNECTED" ||
      (definition.requiresGoogleWorkspace && gmailConnected)
    );
  }).length;

  return (
    <CabinetShell header={header}>
      <div className="space-y-5">
        {saved ? (
          <div className="rounded-xl border border-[#47c978]/28 bg-[#47c978]/[0.08] px-4 py-3 text-sm text-[#62d990]">
            {saved === "channel"
              ? "Channel successfully connected."
              : "Integration successfully connected."}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-xl border border-[#ff6a1a]/32 bg-[#3a2018] px-4 py-3 text-sm text-[#ffb089]">
            Could not complete the connection.
          </div>
        ) : null}

        <section className="grid grid-cols-1 overflow-hidden border-b border-white/[0.09] bg-[#10110f] sm:grid-cols-3">
          {[
            {
              icon: Radio,
              label: "Connected channels",
              value: connectedChannels,
              sub: `${channelDefinitions.length} available`,
            },
            {
              icon: Wrench,
              label: "Business tools",
              value: connectedIntegrations,
              sub: `${integrationDefinitions.length} available`,
            },
            {
              icon: Plug,
              label: "Google Workspace",
              value: gmailConnected ? "Ready" : "Needs Gmail",
              sub: "Calendar, Sheets, Drive",
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

        <div className="grid grid-cols-1 bg-[#10110f] lg:grid-cols-2">
          <section className="border-b border-white/[0.09] lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between gap-4 border-b border-white/[0.08] px-5 py-5 md:px-6">
              <div>
                <h2 className="font-serif text-xl font-normal tracking-[-0.04em] text-white">
                  Channels
                </h2>
                <p className="mt-1 text-sm text-white/45">Dialog sources for inbound messages.</p>
              </div>
              <span className="rounded-lg border border-[#d7a96d]/32 bg-[#d7a96d]/[0.06] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#e9be86]">
                Sources
              </span>
            </div>

            <div className="divide-y divide-white/[0.08]">
              {channelDefinitions.map((definition) => {
                const connection = tenant.channelConnections.find(
                  (item) => item.type === definition.type,
                );
                const isConnected = connection?.status === "CONNECTED";

                return (
                  <div
                    key={definition.key}
                    className="p-5 transition hover:bg-white/[0.035]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white">
                        <Image src={definition.icon} alt={definition.title} width={30} height={30} />
                      </div>
                      <span
                        className={[
                          "rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em]",
                          statusPillClassName(isConnected),
                        ].join(" ")}
                      >
                        {getConnectionStatusLabel(connection?.status)}
                      </span>
                    </div>
                    <h3 className="mt-5 font-serif text-xl font-normal tracking-[-0.04em] text-white">
                      {definition.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-white/55">
                      {definition.shortDescription}
                    </p>
                    <div className="mt-5 flex justify-end border-t border-white/[0.08] pt-5">
                      <Link
                        href={`/client/connections/${definition.key}`}
                        className={[
                          "inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition",
                          isConnected
                            ? "border border-[#d7a96d]/34 bg-[#3a3028] text-[#e9be86] hover:bg-[#473a2f]"
                            : "bg-[#e9be86] text-black hover:bg-[#f3c893]",
                        ].join(" ")}
                      >
                        {isConnected ? "Open" : "Connect"}
                        <ArrowUpRight className="size-4" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between gap-4 border-b border-white/[0.08] px-5 py-5 md:px-6">
              <div>
                <h2 className="font-serif text-xl font-normal tracking-[-0.04em] text-white">
                  Integrations
                </h2>
                <p className="mt-1 text-sm text-white/45">Business tools behind your agents.</p>
              </div>
              <span className="rounded-lg border border-[#d7a96d]/32 bg-[#d7a96d]/[0.06] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#e9be86]">
                Tools
              </span>
            </div>

            <div className="divide-y divide-white/[0.08]">
              {integrationDefinitions.map((definition) => {
                const connection = tenant.integrationConnections.find(
                  (item) => item.type === definition.type,
                );
                const isConnected =
                  connection?.status === "CONNECTED" ||
                  Boolean(definition.requiresGoogleWorkspace && gmailConnected);

                return (
                  <div
                    key={definition.key}
                    className="p-5 transition hover:bg-white/[0.035]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white">
                        <Image src={definition.icon} alt={definition.title} width={30} height={30} />
                      </div>
                      <span
                        className={[
                          "rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em]",
                          statusPillClassName(isConnected),
                        ].join(" ")}
                      >
                        {isConnected ? "Connected" : "Not connected"}
                      </span>
                    </div>
                    <h3 className="mt-5 font-serif text-xl font-normal tracking-[-0.04em] text-white">
                      {definition.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-white/55">
                      {definition.shortDescription}
                    </p>
                    {definition.requiresGoogleWorkspace ? (
                      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#e9be86]">
                        {gmailConnected
                          ? "Available through your connected Google account"
                          : "Connect Gmail first"}
                      </p>
                    ) : null}
                    <div className="mt-5 flex justify-end border-t border-white/[0.08] pt-5">
                      <Link
                        href={`/client/connections/${definition.key}`}
                        className={[
                          "inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition",
                          isConnected
                            ? "border border-[#d7a96d]/34 bg-[#3a3028] text-[#e9be86] hover:bg-[#473a2f]"
                            : "border border-white/[0.1] bg-white/[0.06] text-white hover:bg-white/[0.1]",
                        ].join(" ")}
                      >
                        {isConnected ? "Open" : "Connect"}
                        <ArrowUpRight className="size-4" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </CabinetShell>
  );
}
