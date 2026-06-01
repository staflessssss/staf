import Image from "next/image";
import Link from "next/link";
import { ChannelType } from "@prisma/client";
import { notFound } from "next/navigation";

import { CabinetShell } from "@/components/cabinet/cabinet-shell";
import { getCabinetUserName, getInitials } from "@/components/cabinet/user";
import {
  connectPresetChannelAction,
  connectPresetIntegrationAction,
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

function statusPillClassName(isConnected: boolean) {
  return isConnected
    ? "border-[#47c978]/34 bg-[#47c978]/[0.08] text-[#62d990]"
    : "border-[#d7a96d]/34 bg-[#3a2c1e] text-[#e9be86]";
}

function primaryButtonClassName() {
  return "inline-flex w-full items-center justify-center rounded-lg bg-[#e9be86] px-5 py-3 text-sm font-semibold text-black transition hover:bg-[#f3c893]";
}

function secondaryButtonClassName() {
  return "inline-flex w-full items-center justify-center rounded-lg border border-[#d7a96d]/34 bg-[#3a3028] px-5 py-3 text-sm font-semibold text-[#e9be86] transition hover:bg-[#473a2f]";
}

export default async function ConnectionDetailPage({
  params,
  searchParams,
}: ConnectionDetailPageProps) {
  const session = await requireClientSession();
  const tenantId = session.user.tenantId;
  const { connectionKey } = await params;
  const { saved, error } = await searchParams;
  const definition = getConnectionDefinition(connectionKey);
  const userName = getCabinetUserName(session.user);

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

  const header = (
    <>
      <div className="flex min-w-0 items-center gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white">
          <Image src={definition.icon} alt={definition.title} width={30} height={30} />
        </span>
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/62">
            <span className="size-2 rounded-full bg-[#ff6a1a]" />
            Guided setup
          </p>
          <h1 className="mt-2 truncate font-serif text-4xl font-normal leading-[1.02] tracking-[-0.055em] text-white">
            {definition.title}
          </h1>
        </div>
      </div>
      <Link
        href="/client/connections"
        className="inline-flex w-fit items-center justify-center rounded-lg border border-white/[0.1] px-4 py-2.5 text-sm font-semibold text-white/68 transition hover:bg-white/[0.06] hover:text-white"
      >
        Back to Connections
      </Link>
    </>
  );

  if (!tenant) {
    return (
      <CabinetShell header={header} userInitials={getInitials(userName)} userName={userName}>
        <div className="border-b border-white/[0.09] bg-[#10110f] p-8 text-sm text-white/58">
          Tenant not found.
        </div>
      </CabinetShell>
    );
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
    <CabinetShell header={header} userInitials={getInitials(userName)} userName={userName}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2 text-sm text-white/46">
          <Link href="/client/connections" className="transition hover:text-[#e9be86]">
            Connections
          </Link>
          <span>/</span>
          <span className="font-semibold text-white">{definition.title}</span>
        </div>

        {saved ? (
          <div className="rounded-xl border border-[#47c978]/28 bg-[#47c978]/[0.08] px-4 py-3 text-sm text-[#62d990]">
            Connection saved.
          </div>
        ) : null}
        {error ? (
          <div className="rounded-xl border border-[#ff6a1a]/32 bg-[#3a2018] px-4 py-3 text-sm text-[#ffb089]">
            Could not complete the connection.
          </div>
        ) : null}

        <section className="grid bg-[#10110f] xl:grid-cols-[minmax(0,1.12fr)_minmax(360px,0.74fr)]">
          <div className="border-b border-white/[0.09] xl:border-b-0 xl:border-r">
            <div className="border-b border-white/[0.09] p-5 md:p-6">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-md border border-white/[0.1] bg-white/[0.05] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/58">
                  Setup status
                </span>
                <span
                  className={[
                    "rounded-md border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]",
                    statusPillClassName(Boolean(isConnected)),
                  ].join(" ")}
                >
                  {isConnected ? "Connected" : getConnectionStatusLabel(connection?.status)}
                </span>
              </div>
              <h2 className="mt-5 font-serif text-3xl font-normal tracking-[-0.05em] text-white">
                Connect {definition.title}
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/58 md:text-base md:leading-7">
                {isConnected
                  ? "This connection is active. You can review the setup details, reconnect it, or disconnect it if something changed."
                  : "Follow the steps below and finish the connection in one place. The setup stays business-facing and avoids technical handoff."}
              </p>
            </div>

            <div className="divide-y divide-white/[0.08]">
              {definition.instructions.map((step, index) => (
                <div
                  key={step}
                  className="relative p-5 pl-[4.5rem] md:pl-20"
                >
                  <div className="absolute left-5 top-5 grid size-10 place-items-center rounded-xl border border-[#d7a96d]/34 bg-[#3a2c1e] text-sm font-bold text-[#e9be86]">
                    {index + 1}
                  </div>
                  <p className="text-sm leading-6 text-white/62">{step}</p>
                </div>
              ))}
            </div>

            {definition.notes?.length ? (
              <div className="border-t border-[#d7a96d]/22 bg-[#2b241d] p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#e9be86]">
                  Helpful note
                </p>
                <div className="mt-3 space-y-2">
                  {definition.notes.map((note) => (
                    <p key={note} className="text-sm leading-6 text-white/62">
                      {note}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <aside className="p-5 xl:sticky xl:top-0 xl:self-start md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/42">
                  Connection panel
                </p>
                <h3 className="mt-2 font-serif text-2xl font-normal tracking-[-0.04em] text-white">
                  {isTelegram
                    ? "Enter your bot token"
                    : isGoogleWorkspace
                      ? "Google Workspace access"
                      : `${definition.title} connection`}
                </h3>
                <p className="mt-3 text-sm leading-6 text-white/56">
                  {isTelegram
                    ? "Paste the Telegram bot token from BotFather. It will be stored for this workspace only."
                    : isGoogleWorkspace
                      ? "Google Workspace is powered by the same Google account used for Gmail."
                      : "Confirm the connection here once you are ready."}
                </p>
              </div>
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white">
                <Image src={definition.icon} alt={definition.title} width={30} height={30} />
              </span>
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
                    <span className="text-sm font-semibold text-white">Telegram bot token</span>
                    <input
                      name="credentials"
                      type="text"
                      placeholder="Paste Telegram bot token"
                      className="w-full rounded-lg border border-white/[0.12] bg-black/22 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/32 focus:border-[#d7a96d]/60 focus:ring-4 focus:ring-[#d7a96d]/10"
                      required
                    />
                  </label>
                  <button className={primaryButtonClassName()} type="submit">
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
                    <button className={secondaryButtonClassName()} type="submit">
                      Disconnect Telegram
                    </button>
                  </form>
                ) : null}
              </div>
            ) : isGmail ? (
              <div className="mt-6 space-y-4">
                <div className="rounded-xl border border-white/[0.08] bg-black/16 p-4 text-sm leading-6 text-white/56">
                  Use one Google sign-in to unlock Gmail, Calendar, Sheets, and Drive for this
                  business workspace.
                </div>
                <Link
                  href={`/api/google/connect?redirectTo=${encodeURIComponent("/client/connections/gmail")}`}
                  className={primaryButtonClassName()}
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
                    <button className={secondaryButtonClassName()} type="submit">
                      Disconnect Google Account
                    </button>
                  </form>
                ) : null}
              </div>
            ) : isGoogleWorkspace ? (
              <div className="mt-6 space-y-4">
                <div className="rounded-xl border border-white/[0.08] bg-black/16 p-4">
                  <p className="text-sm font-semibold text-white">Included services</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {["Google Calendar", "Google Sheets", "Google Drive"].map((item) => (
                      <span
                        key={item}
                        className="rounded-md border border-white/[0.08] bg-white/[0.05] px-3 py-1 text-xs font-semibold text-white/62"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
                {gmailConnected ? (
                  <div className="rounded-xl border border-[#47c978]/28 bg-[#47c978]/[0.08] p-4 text-sm leading-6 text-[#62d990]">
                    Your Google Workspace access is already available through the connected Gmail
                    account.
                  </div>
                ) : (
                  <Link href="/client/connections/gmail" className={primaryButtonClassName()}>
                    Connect Gmail first
                  </Link>
                )}
              </div>
            ) : connection ? (
              <div className="mt-6 space-y-4">
                <div className="rounded-xl border border-white/[0.08] bg-black/16 p-4 text-sm leading-6 text-white/56">
                  {definition.kind === "channel"
                    ? "This channel is already connected. You can review the current connection or disconnect it if needed."
                    : "This integration is already connected. Review it here if needed."}
                </div>
                {definition.kind === "channel" ? (
                  <form action={revokeChannelConnectionAction}>
                    <input type="hidden" name="type" value={definition.type} />
                    <input
                      type="hidden"
                      name="redirectTo"
                      value={`/client/connections/${definition.key}`}
                    />
                    <button className={secondaryButtonClassName()} type="submit">
                      Disconnect {definition.title}
                    </button>
                  </form>
                ) : null}
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                <div className="rounded-xl border border-white/[0.08] bg-black/16 p-4 text-sm leading-6 text-white/56">
                  {`${definition.title} is ready to connect.`}
                </div>
                {definition.kind === "channel" ? (
                  <form action={connectPresetChannelAction}>
                    <input type="hidden" name="type" value={definition.type} />
                    <input
                      type="hidden"
                      name="redirectTo"
                      value={`/client/connections/${definition.key}`}
                    />
                    <button className={primaryButtonClassName()} type="submit">
                      {`Connect ${definition.title}`}
                    </button>
                  </form>
                ) : (
                  <form action={connectPresetIntegrationAction}>
                    <input type="hidden" name="type" value={definition.type} />
                    <input
                      type="hidden"
                      name="redirectTo"
                      value={`/client/connections/${definition.key}`}
                    />
                    <button className={primaryButtonClassName()} type="submit">
                      {`Connect ${definition.title}`}
                    </button>
                  </form>
                )}
              </div>
            )}
          </aside>
        </section>
      </div>
    </CabinetShell>
  );
}
