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
  const isGoogleWorkspace =
    definition.kind === "integration" && definition.key === "google-workspace";

  return (
    <div className="space-y-10">
      <div className="text-sm text-[#1b1c19]/60">
        Client Portal <span className="mx-2">/</span>
        <Link href="/client/connections" className="hover:text-[#1b1c19]">
          Connections
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#1b1c19]">{definition.title}</span>
      </div>

      <header className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-5">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-white shadow-sm">
            <Image src={definition.icon} alt={definition.title} width={36} height={36} />
          </div>
          <div>
            <h1 className="text-5xl font-extrabold tracking-tight">{definition.title}</h1>
            <p className="mt-3 max-w-2xl text-lg leading-8 text-[#554336]">
              {definition.shortDescription}
            </p>
          </div>
        </div>
        <Link
          href="/client/connections"
          className="rounded-xl border border-[#dbc2b0] px-6 py-3 text-sm font-bold text-[#1b1c19] transition hover:bg-white"
        >
          Back to Connections
        </Link>
      </header>

      {saved ? (
        <div className="rounded-xl border border-[#b9dec8] bg-[#eef8f1] px-4 py-3 text-sm text-[#157347]">
          Connection saved.
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-[#efc4c1] bg-[#fff0ef] px-4 py-3 text-sm text-[#b42318]">
          Could not complete the connection.
        </div>
      ) : null}

      <section className="overflow-hidden rounded-[28px] border border-[#e9e3d6] bg-white shadow-[0_30px_70px_rgba(27,28,25,0.08)]">
        <div className="border-b border-[#ece6da] bg-[linear-gradient(135deg,#fffaf4_0%,#f6f0e5_100%)] px-8 py-8 md:px-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-[#8d4b00]">
                  Guided Setup
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${
                    isConnected ? "bg-[#eef8f1] text-[#157347]" : "bg-white text-[#6b6458]"
                  }`}
                >
                  {isConnected ? "Connected" : getConnectionStatusLabel(connection?.status)}
                </span>
              </div>
              <div>
                <h2 className="text-3xl font-extrabold tracking-tight text-[#1b1c19]">
                  Connect {definition.title} in a few clear steps
                </h2>
                <p className="mt-3 max-w-3xl text-base leading-7 text-[#554336]">
                  {isConnected
                    ? "This connection is already active. You can review the setup details, reconnect it, or disconnect it if something changed."
                    : "Follow the steps below and finish the connection in one place. The setup is written for a business user, not for a technical team."}
                </p>
              </div>
            </div>
            <div className="grid min-w-[280px] gap-3 sm:grid-cols-2 lg:w-[360px] lg:grid-cols-1">
              <div className="rounded-2xl border border-white/60 bg-white/80 p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8d4b00]">
                  What this unlocks
                </p>
                <p className="mt-2 text-sm leading-6 text-[#554336]">
                  {isGoogleWorkspace
                    ? "Calendar access, spreadsheet logging, and shared Drive files."
                    : isTelegram
                      ? "Incoming Telegram dialogs for your agent."
                      : `${definition.title} access for your business workflows.`}
                </p>
              </div>
              <div className="rounded-2xl border border-white/60 bg-white/80 p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8d4b00]">
                  Setup style
                </p>
                <p className="mt-2 text-sm leading-6 text-[#554336]">
                  {isTelegram
                    ? "Paste one token and save."
                    : isGoogleWorkspace
                      ? "Use one Google account connection."
                      : "One guided connection flow."}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-10 px-8 py-8 md:px-10 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <div>
              <h3 className="text-2xl font-bold text-[#1b1c19]">Step by step</h3>
              <p className="mt-2 text-sm leading-7 text-[#554336]">
                Everything you need is here. Complete the steps below, then confirm the connection.
              </p>
            </div>

            <div className="space-y-4">
              {definition.instructions.map((step, index) => (
                <div
                  key={step}
                  className="relative rounded-[22px] border border-[#ece6da] bg-[#fbf9f4] p-5 pl-20 shadow-[0_10px_24px_rgba(27,28,25,0.03)]"
                >
                  <div className="absolute left-5 top-5 flex size-11 items-center justify-center rounded-full bg-[linear-gradient(135deg,#8d4b00_0%,#b15f00_100%)] text-sm font-bold text-white shadow-lg shadow-[#8d4b00]/15">
                    {index + 1}
                  </div>
                  <p className="text-sm leading-7 text-[#43372a]">{step}</p>
                </div>
              ))}
            </div>

            {definition.notes?.length ? (
              <div className="rounded-[22px] border border-[#d9e3f2] bg-[linear-gradient(180deg,#f8fbff_0%,#eef5ff_100%)] p-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#175cd3]">
                  Helpful note
                </p>
                <div className="mt-3 space-y-2">
                  {definition.notes.map((note) => (
                    <p key={note} className="text-sm leading-7 text-[#3a4a66]">
                      {note}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}

            {!isTelegram && !isGoogleWorkspace && definition.kind === "channel" ? (
              <form action={connectPresetChannelAction} className="pt-2">
                <input type="hidden" name="type" value={definition.type} />
                <input
                  type="hidden"
                  name="redirectTo"
                  value={`/client/connections/${definition.key}`}
                />
                <button
                  className="w-full rounded-2xl bg-[linear-gradient(135deg,#8d4b00_0%,#b15f00_100%)] px-6 py-4 text-base font-bold text-white shadow-[0_18px_30px_rgba(141,75,0,0.18)] transition hover:translate-y-[-1px]"
                  type="submit"
                >
                  {isConnected ? "Connected" : `Connect ${definition.title}`}
                </button>
              </form>
            ) : null}
          </div>

          <div className="space-y-6">
            <div className="rounded-[24px] border border-[#ece6da] bg-[#fbf9f4] p-6 shadow-[0_10px_24px_rgba(27,28,25,0.03)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8d4b00]">
                    Connection panel
                  </p>
                  <h3 className="mt-2 text-xl font-bold text-[#1b1c19]">
                    {isTelegram
                      ? "Enter your bot token"
                      : isGoogleWorkspace
                        ? "Google Workspace access"
                        : `${definition.title} connection`}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-[#554336]">
                    {isTelegram
                      ? "Paste the Telegram bot token from BotFather. We will store it securely and use it only for this workspace."
                      : isGoogleWorkspace
                        ? "Google Workspace is powered by the same Google account used for Gmail."
                        : "Confirm the connection here once you are ready."}
                  </p>
                </div>
                <div className="flex size-14 items-center justify-center rounded-2xl bg-white shadow-sm">
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
                      <span className="text-sm font-semibold text-[#1b1c19]">Telegram bot token</span>
                      <input
                        name="credentials"
                        type="text"
                        placeholder="Paste Telegram bot token"
                        className="w-full rounded-2xl border border-[#d8d0c2] bg-white px-4 py-3.5 text-sm outline-none transition focus:border-[#8d4b00] focus:ring-4 focus:ring-[#8d4b00]/10"
                        required
                      />
                    </label>
                    <button
                      className="w-full rounded-2xl bg-[linear-gradient(135deg,#8d4b00_0%,#b15f00_100%)] px-6 py-4 text-base font-bold text-white shadow-[0_18px_30px_rgba(141,75,0,0.18)] transition hover:translate-y-[-1px]"
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
                        className="w-full rounded-2xl border border-[#dbc2b0] bg-white px-6 py-4 text-base font-bold text-[#1b1c19] transition hover:bg-[#f7f3ed]"
                        type="submit"
                      >
                        Disconnect Telegram
                      </button>
                    </form>
                  ) : null}
                </div>
              ) : isGoogleWorkspace ? (
                <div className="mt-6 space-y-4">
                  <div className="rounded-2xl border border-[#ece6da] bg-white p-4">
                    <p className="text-sm font-semibold text-[#1b1c19]">Included services</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full bg-[#f0eee9] px-3 py-1 text-xs font-semibold text-[#554336]">
                        Google Calendar
                      </span>
                      <span className="rounded-full bg-[#f0eee9] px-3 py-1 text-xs font-semibold text-[#554336]">
                        Google Sheets
                      </span>
                      <span className="rounded-full bg-[#f0eee9] px-3 py-1 text-xs font-semibold text-[#554336]">
                        Google Drive
                      </span>
                    </div>
                  </div>
                  {gmailConnected ? (
                    <div className="rounded-2xl border border-[#b9dec8] bg-[#eef8f1] p-4 text-sm leading-7 text-[#157347]">
                      Your Google Workspace access is already available through the connected Gmail
                      account.
                    </div>
                  ) : (
                    <Link
                      href="/client/connections/gmail"
                      className="inline-flex w-full items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#8d4b00_0%,#b15f00_100%)] px-6 py-4 text-base font-bold text-white shadow-[0_18px_30px_rgba(141,75,0,0.18)] transition hover:translate-y-[-1px]"
                    >
                      Open Gmail Connection
                    </Link>
                  )}
                </div>
              ) : null}

              {definition.kind === "integration" && definition.requiresGoogleWorkspace && !gmailConnected ? (
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-[#8d4b00]">
                  Connect Gmail first to unlock Google services.
                </p>
              ) : null}
            </div>

            <div className="rounded-[24px] border border-[#ece6da] bg-white p-6 shadow-[0_10px_24px_rgba(27,28,25,0.03)]">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8d4b00]">
                Before you finish
              </p>
              <ul className="mt-4 space-y-3 text-sm leading-7 text-[#554336]">
                <li>Use the business account that should actually power this connection.</li>
                <li>Your operator will configure how the agent uses this connection afterward.</li>
                <li>You can come back later to reconnect or update it if something changes.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
