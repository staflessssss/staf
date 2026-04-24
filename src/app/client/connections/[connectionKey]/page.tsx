import Image from "next/image";
import Link from "next/link";
import { ChannelType } from "@prisma/client";
import { notFound } from "next/navigation";

import {
  connectPresetChannelAction,
  revokeChannelConnectionAction,
  saveChannelConnectionAction,
} from "@/lib/connection-actions";
import {
  getConnectionDefinition,
  getConnectionStatusLabel,
} from "@/lib/connections-catalog";
import { requireClientSession } from "@/lib/client-auth";
import { db } from "@/lib/db";

type ConnectionDetailPageProps = {
  params: Promise<{ connectionKey: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
};

export default async function ConnectionDetailPage({
  params,
  searchParams,
}: ConnectionDetailPageProps) {
  const session = await requireClientSession();
  const tenantId = session.user.tenantId;
  const { connectionKey } = await params;
  const { saved, error } = await searchParams;
  const definition = getConnectionDefinition(connectionKey);

  if (!definition) {
    notFound();
  }

  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    include: {
      channelConnections: true,
      integrationConnections: true,
    },
  });

  if (!tenant) {
    return <div>Tenant not found.</div>;
  }

  const gmailConnected = tenant.channelConnections.some(
    (item) => item.type === ChannelType.GMAIL && item.status === "CONNECTED",
  );

  const connection =
    definition.kind === "channel"
      ? tenant.channelConnections.find((item) => item.type === definition.type)
      : tenant.integrationConnections.find((item) => item.type === definition.type);

  const isConnected =
    definition.kind === "integration" && definition.requiresGoogleWorkspace
      ? gmailConnected || connection?.status === "CONNECTED"
      : connection?.status === "CONNECTED";

  const isTelegram = definition.kind === "channel" && definition.type === ChannelType.TELEGRAM;
  const isGmail = definition.kind === "channel" && definition.type === ChannelType.GMAIL;
  const isGoogleWorkspace =
    definition.kind === "integration" && definition.key === "google-workspace";

  return (
    <div className="space-y-10">
      <div className="text-sm text-[#5c5c7e]">
        Client Portal <span className="mx-2">/</span>
        <Link href="/client/connections" className="hover:text-[#181836]">
          Connections
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#181836]">{definition.title}</span>
      </div>

      <header className="rounded-[28px] bg-[linear-gradient(135deg,#ffffff_0%,#f4f2ff_52%,#e9edff_100%)] p-8 shadow-[0_18px_40px_rgba(24,24,54,0.06)] ring-1 ring-[#d8d6fe]/80 md:p-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-center gap-5">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-white shadow-[0_12px_28px_rgba(24,24,54,0.05)] ring-1 ring-[#d8d6fe]/70">
              <Image src={definition.icon} alt={definition.title} width={36} height={36} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#5c5c7e]">
                Guided setup
              </p>
              <h1 className="mt-2 font-heading text-5xl font-bold tracking-tight text-[#181836]">
                {definition.title}
              </h1>
              <p className="mt-3 max-w-2xl text-lg leading-8 text-[#464554]">
                {definition.shortDescription}
              </p>
            </div>
          </div>
          <Link
            href="/client/connections"
            className="rounded-xl bg-[#efecff] px-6 py-3 text-sm font-bold text-[#4648d4] transition hover:bg-[#e8e5ff]"
          >
            Back to Connections
          </Link>
        </div>
      </header>

      {saved ? (
        <div className="rounded-[20px] bg-[#eef8f1] px-4 py-3 text-sm text-[#157347] ring-1 ring-[#b9dec8]">
          Connection saved.
        </div>
      ) : null}
      {error ? (
        <div className="rounded-[20px] bg-[#fff0ef] px-4 py-3 text-sm text-[#b42318] ring-1 ring-[#efc4c1]">
          Could not complete the connection.
        </div>
      ) : null}

      <section className="overflow-hidden rounded-[28px] bg-white shadow-[0_12px_28px_rgba(24,24,54,0.05)] ring-1 ring-[#d8d6fe]/70">
        <div className="grid gap-10 px-8 py-8 md:px-10 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <div className="rounded-[24px] bg-[#f5f2ff] p-6">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-lg bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-[#4648d4] shadow-sm">
                  Setup status
                </span>
                <span
                  className={`rounded-lg px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${
                    isConnected ? "bg-[#eef8f1] text-[#157347]" : "bg-white text-[#5c5c7e]"
                  }`}
                >
                  {isConnected ? "Connected" : getConnectionStatusLabel(connection?.status)}
                </span>
              </div>
              <div className="mt-5">
                <h2 className="font-heading text-3xl font-bold tracking-tight text-[#181836]">
                  Connect {definition.title} in a few clear steps
                </h2>
                <p className="mt-3 max-w-3xl text-base leading-7 text-[#464554]">
                  {isConnected
                    ? "This connection is already active. You can review the setup details, reconnect it, or disconnect it if something changed."
                    : "Follow the steps below and finish the connection in one place. The setup is written for a business user, not for a technical team."}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {definition.instructions.map((step, index) => (
                <div
                  key={step}
                  className="relative rounded-[24px] bg-[#f8f8ff] p-5 pl-20 shadow-[0_10px_24px_rgba(24,24,54,0.03)] ring-1 ring-[#d8d6fe]/60"
                >
                  <div className="absolute left-5 top-5 flex size-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#4648d4_0%,#6063ee_100%)] text-sm font-bold text-white shadow-[0_12px_24px_rgba(70,72,212,0.18)]">
                    {index + 1}
                  </div>
                  <p className="text-sm leading-7 text-[#464554]">{step}</p>
                </div>
              ))}
            </div>

            {definition.notes?.length ? (
              <div className="rounded-[24px] bg-[#eef2ff] p-5 ring-1 ring-[#d8d6fe]/70">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#4648d4]">
                  Helpful note
                </p>
                <div className="mt-3 space-y-2">
                  {definition.notes.map((note) => (
                    <p key={note} className="text-sm leading-7 text-[#464554]">
                      {note}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}

            {!isTelegram && !isGoogleWorkspace && !isGmail && definition.kind === "channel" ? (
              <form action={connectPresetChannelAction} className="pt-2">
                <input type="hidden" name="type" value={definition.type} />
                <input
                  type="hidden"
                  name="redirectTo"
                  value={`/client/connections/${definition.key}`}
                />
                <button
                  className="w-full rounded-2xl bg-[linear-gradient(135deg,#4648d4_0%,#6063ee_100%)] px-6 py-4 text-base font-bold text-white shadow-[0_16px_30px_rgba(70,72,212,0.18)] transition hover:-translate-y-0.5"
                  type="submit"
                >
                  {isConnected ? "Connected" : `Connect ${definition.title}`}
                </button>
              </form>
            ) : null}
          </div>

          <div className="space-y-6">
            <div className="rounded-[24px] bg-[#f5f2ff] p-6 shadow-[0_10px_24px_rgba(24,24,54,0.04)] ring-1 ring-[#d8d6fe]/70">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#4648d4]">
                    Connection panel
                  </p>
                  <h3 className="mt-2 font-heading text-xl font-bold text-[#181836]">
                    {isTelegram
                      ? "Enter your bot token"
                      : isGoogleWorkspace
                        ? "Google Workspace access"
                        : `${definition.title} connection`}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-[#464554]">
                    {isTelegram
                      ? "Paste the Telegram bot token from BotFather. We will store it securely and use it only for this workspace."
                      : isGoogleWorkspace
                        ? "Google Workspace is powered by the same Google account used for Gmail."
                        : "Confirm the connection here once you are ready."}
                  </p>
                </div>
                <div className="flex size-14 items-center justify-center rounded-2xl bg-white shadow-[0_10px_24px_rgba(24,24,54,0.05)] ring-1 ring-[#d8d6fe]/70">
                  <Image src={definition.icon} alt={definition.title} width={30} height={30} />
                </div>
              </div>

              {isTelegram ? (
                <div className="mt-6 space-y-4">
                  <form action={saveChannelConnectionAction} className="space-y-4">
                    <input type="hidden" name="type" value={definition.type} />
                    <input type="hidden" name="status" value="CONNECTED" />
                    <input
                      type="hidden"
                      name="metadata"
                      value='{"provider":"telegram","source":"botfather"}'
                    />
                    <label className="block space-y-2">
                      <span className="text-sm font-semibold text-[#181836]">
                        Telegram bot token
                      </span>
                      <input
                        name="credentials"
                        type="text"
                        placeholder="Paste Telegram bot token"
                        className="w-full rounded-2xl border border-[#d8d6fe] bg-white px-4 py-3.5 text-sm outline-none transition focus:border-[#4648d4]/40 focus:ring-4 focus:ring-[#4648d4]/10"
                        required
                      />
                    </label>
                    <button
                      className="w-full rounded-2xl bg-[linear-gradient(135deg,#4648d4_0%,#6063ee_100%)] px-6 py-4 text-base font-bold text-white shadow-[0_16px_30px_rgba(70,72,212,0.18)] transition hover:-translate-y-0.5"
                      type="submit"
                    >
                      Connect Telegram
                    </button>
                  </form>
                  {connection ? (
                    <form action={revokeChannelConnectionAction}>
                      <input type="hidden" name="type" value={definition.type} />
                      <input
                        type="hidden"
                        name="redirectTo"
                        value={`/client/connections/${definition.key}`}
                      />
                      <button
                        className="w-full rounded-2xl bg-[#efecff] px-6 py-4 text-base font-bold text-[#4648d4] transition hover:bg-[#e8e5ff]"
                        type="submit"
                      >
                        Disconnect Telegram
                      </button>
                    </form>
                  ) : null}
                </div>
              ) : isGmail ? (
                <div className="mt-6 space-y-4">
                  <div className="rounded-2xl bg-white p-4 text-sm leading-7 text-[#464554] ring-1 ring-[#d8d6fe]/70">
                    Use one Google sign-in to unlock Gmail, Calendar, Sheets, and Drive for this
                    business workspace.
                  </div>
                  <Link
                    href={`/api/google/connect?redirectTo=${encodeURIComponent("/client/connections/gmail")}`}
                    className="inline-flex w-full items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#4648d4_0%,#6063ee_100%)] px-6 py-4 text-base font-bold text-white shadow-[0_16px_30px_rgba(70,72,212,0.18)] transition hover:-translate-y-0.5"
                  >
                    {isConnected ? "Reconnect Google Account" : "Connect Google Account"}
                  </Link>
                  {connection ? (
                    <form action={revokeChannelConnectionAction}>
                      <input type="hidden" name="type" value={definition.type} />
                      <input
                        type="hidden"
                        name="redirectTo"
                        value={`/client/connections/${definition.key}`}
                      />
                      <button
                        className="w-full rounded-2xl bg-[#efecff] px-6 py-4 text-base font-bold text-[#4648d4] transition hover:bg-[#e8e5ff]"
                        type="submit"
                      >
                        Disconnect Google Account
                      </button>
                    </form>
                  ) : null}
                </div>
              ) : isGoogleWorkspace ? (
                <div className="mt-6 space-y-4">
                  <div className="rounded-2xl bg-white p-4 ring-1 ring-[#d8d6fe]/70">
                    <p className="text-sm font-semibold text-[#181836]">Included services</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-lg bg-[#f5f2ff] px-3 py-1 text-xs font-semibold text-[#464554]">
                        Google Calendar
                      </span>
                      <span className="rounded-lg bg-[#f5f2ff] px-3 py-1 text-xs font-semibold text-[#464554]">
                        Google Sheets
                      </span>
                      <span className="rounded-lg bg-[#f5f2ff] px-3 py-1 text-xs font-semibold text-[#464554]">
                        Google Drive
                      </span>
                    </div>
                  </div>
                  {gmailConnected ? (
                    <div className="rounded-2xl bg-[#eef8f1] p-4 text-sm leading-7 text-[#157347] ring-1 ring-[#b9dec8]">
                      Your Google Workspace access is already available through the connected Gmail
                      account.
                    </div>
                  ) : null}
                </div>
              ) : connection ? (
                <div className="mt-6 space-y-4">
                  <div className="rounded-2xl bg-white p-4 text-sm leading-7 text-[#464554] ring-1 ring-[#d8d6fe]/70">
                    {definition.kind === "channel"
                      ? "This channel is already connected. You can review the current connection or disconnect it if needed."
                      : "This integration is already connected. Review or disconnect it if needed."}
                  </div>
                  {definition.kind === "channel" ? (
                    <form action={revokeChannelConnectionAction}>
                      <input type="hidden" name="type" value={definition.type} />
                      <input
                        type="hidden"
                        name="redirectTo"
                        value={`/client/connections/${definition.key}`}
                      />
                      <button
                        className="w-full rounded-2xl bg-[#efecff] px-6 py-4 text-base font-bold text-[#4648d4] transition hover:bg-[#e8e5ff]"
                        type="submit"
                      >
                        Disconnect {definition.title}
                      </button>
                    </form>
                  ) : null}
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  <div className="rounded-2xl bg-white p-4 text-sm leading-7 text-[#464554] ring-1 ring-[#d8d6fe]/70">
                    {isGoogleWorkspace
                      ? "Use the Google account connection to unlock all Workspace tools."
                      : `${definition.title} is ready to connect.`}
                  </div>
                  <form action={connectPresetChannelAction} className="pt-2">
                    <input type="hidden" name="type" value={definition.type} />
                    <input
                      type="hidden"
                      name="redirectTo"
                      value={`/client/connections/${definition.key}`}
                    />
                    <button
                      className="w-full rounded-2xl bg-[linear-gradient(135deg,#4648d4_0%,#6063ee_100%)] px-6 py-4 text-base font-bold text-white shadow-[0_16px_30px_rgba(70,72,212,0.18)] transition hover:-translate-y-0.5"
                      type="submit"
                    >
                      {`Connect ${definition.title}`}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
