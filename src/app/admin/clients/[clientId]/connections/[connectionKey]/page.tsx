import Image from "next/image";
import Link from "next/link";
import { ChannelType } from "@prisma/client";
import { notFound } from "next/navigation";

import {
  revokeAdminChannelConnectionAction,
  saveAdminTelegramConnectionAction,
} from "@/lib/admin-connection-actions";
import { requireAdminSession } from "@/lib/admin-auth";
import { getConnectionDefinition, getConnectionStatusLabel } from "@/lib/connections-catalog";
import { db } from "@/lib/db";

type AdminClientConnectionPageProps = {
  params: Promise<{ clientId: string; connectionKey: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
};

export default async function AdminClientConnectionPage({
  params,
  searchParams,
}: AdminClientConnectionPageProps) {
  await requireAdminSession();
  const { clientId, connectionKey } = await params;
  const { saved, error } = await searchParams;
  const definition = getConnectionDefinition(connectionKey);

  if (!definition || definition.kind !== "channel") {
    notFound();
  }

  const client = await db.tenant.findUnique({
    where: { id: clientId },
    include: {
      channelConnections: true,
    },
  });

  if (!client) notFound();

  const connection = client.channelConnections.find((item) => item.type === definition.type);
  const isConnected = connection?.status === "CONNECTED";
  const isTelegram = definition.type === ChannelType.TELEGRAM;
  const isGmail = definition.type === ChannelType.GMAIL;
  const isInstagram = definition.type === ChannelType.INSTAGRAM;

  return (
    <div className="space-y-8">
      <div className="text-sm text-[#5c5c7e]">
        Clients <span className="mx-2">/</span>
        <Link href={`/admin/clients/${client.id}`} className="hover:text-[#181836]">
          {client.name}
        </Link>
        <span className="mx-2">/</span>
        <Link href={`/admin/clients/${client.id}/connections`} className="hover:text-[#181836]">
          Connections
        </Link>
        <span className="mx-2">/</span>
        <span className="font-semibold text-[#181836]">{definition.title}</span>
      </div>

      <header className="rounded-[28px] bg-[linear-gradient(135deg,#ffffff_0%,#f4f2ff_52%,#e9edff_100%)] p-8 shadow-[0_18px_40px_rgba(24,24,54,0.06)] ring-1 ring-[#d8d6fe]/80">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-center gap-5">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-white shadow-[0_12px_28px_rgba(24,24,54,0.05)] ring-1 ring-[#d8d6fe]/70">
              <Image src={definition.icon} alt={definition.title} width={36} height={36} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#5c5c7e]">
                Channel connection
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
            href={`/admin/clients/${client.id}/connections`}
            className="rounded-xl bg-[#efecff] px-6 py-3 text-sm font-bold text-[#4648d4] transition hover:bg-[#e8e5ff]"
          >
            Назад к подключениям
          </Link>
        </div>
      </header>

      {saved ? (
        <div className="rounded-[20px] bg-[#eef8f1] px-4 py-3 text-sm text-[#157347] ring-1 ring-[#b9dec8]">
          Подключение сохранено.
        </div>
      ) : null}
      {error ? (
        <div className="rounded-[20px] bg-[#fff0ef] px-4 py-3 text-sm text-[#b42318] ring-1 ring-[#efc4c1]">
          Не удалось сохранить подключение.
        </div>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="rounded-[28px] bg-white p-8 shadow-[0_12px_28px_rgba(24,24,54,0.05)] ring-1 ring-[#d8d6fe]/70">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-lg bg-[#f5f2ff] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#4648d4]">
              Status
            </span>
            <span
              className={`rounded-lg px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${
                isConnected ? "bg-[#eef8f1] text-[#157347]" : "bg-[#f5f2ff] text-[#5c5c7e]"
              }`}
            >
              {getConnectionStatusLabel(connection?.status)}
            </span>
          </div>

          <div className="mt-6 space-y-4">
            {definition.instructions.map((step, index) => (
              <div
                key={step}
                className="relative rounded-[20px] bg-[#f8f8ff] p-5 pl-16 ring-1 ring-[#d8d6fe]/60"
              >
                <div className="absolute left-5 top-5 flex size-8 items-center justify-center rounded-xl bg-[#6c63ff] text-xs font-bold text-white">
                  {index + 1}
                </div>
                <p className="text-sm leading-7 text-[#464554]">{step}</p>
              </div>
            ))}
          </div>
        </div>

        <aside className="rounded-[28px] bg-white p-6 shadow-[0_12px_28px_rgba(24,24,54,0.05)] ring-1 ring-[#d8d6fe]/70">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#4648d4]">
            Action
          </p>
          <h2 className="mt-2 text-xl font-bold text-[#181836]">
            {isTelegram
              ? "Telegram token"
              : isGmail
                ? "Google OAuth"
                : isInstagram
                  ? "Instagram API"
                  : "Connection"}
          </h2>

          {isTelegram ? (
            <form action={saveAdminTelegramConnectionAction} className="mt-5 space-y-4">
              <input type="hidden" name="clientId" value={client.id} />
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[#181836]">Bot token</span>
                <input
                  name="credentials"
                  type="text"
                  placeholder="Paste Telegram bot token"
                  className="w-full rounded-2xl border border-[#d8d6fe] bg-white px-4 py-3.5 text-sm outline-none transition focus:border-[#4648d4]/40 focus:ring-4 focus:ring-[#4648d4]/10"
                  required
                />
              </label>
              <button
                className="w-full rounded-2xl bg-[#6c63ff] px-6 py-4 text-base font-bold text-white transition hover:bg-[#5b53ea]"
                type="submit"
              >
                {isConnected ? "Обновить Telegram" : "Подключить Telegram"}
              </button>
            </form>
          ) : null}

          {isGmail ? (
            <p className="mt-5 text-sm leading-7 text-[#464554]">
              Gmail подключается через Google OAuth от имени клиента. Admin route открыт, но
              авторизацию должен пройти клиент в своем Connections workspace.
            </p>
          ) : null}

          {isInstagram ? (
            <p className="mt-5 text-sm leading-7 text-[#464554]">
              Страница подключения готова. Рабочий Meta OAuth/API flow добавим отдельным backend
              slice, чтобы не создавать фальшивое подключение.
            </p>
          ) : null}

          {connection ? (
            <form action={revokeAdminChannelConnectionAction} className="mt-5">
              <input type="hidden" name="clientId" value={client.id} />
              <input type="hidden" name="type" value={definition.type} />
              <button
                className="w-full rounded-2xl bg-[#efecff] px-6 py-4 text-base font-bold text-[#4648d4] transition hover:bg-[#e8e5ff]"
                type="submit"
              >
                Отключить {definition.title}
              </button>
            </form>
          ) : null}
        </aside>
      </section>
    </div>
  );
}
