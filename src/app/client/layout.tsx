import type { ReactNode } from "react";

import { LogoutButton } from "@/components/auth/logout-button";
import { SurfaceNav } from "@/components/stafless/surface-nav";
import { requireClientSession } from "@/lib/client-auth";

const clientNav = [
  { href: "/client", label: "Dashboard" },
  { href: "/client/agents", label: "Agents" },
  { href: "/client/leads", label: "Leads" },
  { href: "/client/dialogs", label: "Dialogs" },
  { href: "/client/connections", label: "Connections" },
];

export default async function ClientLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireClientSession();
  const userEmail = session.user.email ?? "client@behalfy.local";
  const userInitial = userEmail.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-[#fbf9f4] text-[#1b1c19]">
      <header className="fixed top-0 z-40 w-full bg-[rgba(251,249,244,0.82)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1920px] items-center justify-between px-6 py-6 md:px-10 xl:px-12">
          <div className="flex items-center gap-8 xl:gap-12">
            <span className="text-2xl font-bold tracking-tight text-[#1b1c19]">Behalfy</span>
            <div className="hidden md:block">
              <SurfaceNav items={clientNav} variant="topbar" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden rounded-full border border-[#dbc2b0]/70 bg-white/70 px-4 py-2 text-sm text-[#554336] lg:block">
              {userEmail}
            </div>
            <LogoutButton
              className="hidden rounded-full border border-[#dbc2b0]/70 bg-white px-4 py-2 text-sm font-semibold text-[#1b1c19] transition hover:bg-[#f5f3ee] lg:inline-flex"
            />
            <div className="flex size-10 items-center justify-center rounded-full border border-[#dbc2b0]/70 bg-[#f0eee9] text-xs font-semibold text-[#8d4b00]">
              {userInitial}
            </div>
          </div>
        </div>
      </header>

      <aside className="fixed left-0 top-0 hidden h-screen w-64 flex-col bg-[#f5f3ee] px-6 pb-6 pt-28 xl:flex">
        <div className="mb-8 px-2">
          <h2 className="text-xl font-black uppercase tracking-tight text-[#1b1c19]">Behalfy</h2>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.28em] text-[#1b1c19]/50">
            Business Portal
          </p>
        </div>
        <SurfaceNav items={clientNav} variant="sidebar" />
        <div className="mt-auto pt-6">
          <LogoutButton
            className="inline-flex w-full items-center justify-center rounded-xl border border-[#dbc2b0]/70 bg-white px-4 py-3 text-[11px] font-bold uppercase tracking-[0.22em] text-[#1b1c19] transition hover:bg-[#f5f3ee]"
          />
        </div>
      </aside>

      <main className="px-6 pb-16 pt-28 md:px-8 xl:ml-64 xl:px-10">
        <div className="mx-auto max-w-[1600px]">{children}</div>
      </main>
    </div>
  );
}
