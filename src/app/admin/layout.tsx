import Link from "next/link";
import type { ReactNode } from "react";

import { LogoutButton } from "@/components/auth/logout-button";
import { SurfaceNav } from "@/components/stafless/surface-nav";

const adminNav = [
  { href: "/admin/clients", label: "Clients" },
  { href: "/admin/settings", label: "Settings" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#fbf9f4] text-[#1b1c19]">
      <aside className="fixed left-0 top-0 hidden h-screen w-64 flex-col bg-[#f5f3ee] px-6 py-6 md:flex">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-[#8d4b00] text-white">
            B
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">Behalfy</h1>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#1b1c19]/55">
              Operator Console
            </p>
          </div>
        </div>

        <SurfaceNav items={adminNav} variant="sidebar" />

        <div className="mt-auto border-t border-[#dbc2b0]/40 pt-6">
          <Link
            href="/admin/clients"
            className="inline-flex w-full items-center justify-center rounded-xl bg-[linear-gradient(135deg,#8d4b00_0%,#b15f00_100%)] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.22em] text-white shadow-lg shadow-[#8d4b00]/10"
          >
            Open Clients
          </Link>
          <LogoutButton
            className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-[#dbc2b0]/70 bg-white px-4 py-3 text-[11px] font-bold uppercase tracking-[0.22em] text-[#1b1c19] transition hover:bg-[#f5f3ee]"
          />
        </div>
      </aside>

      <div className="md:ml-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between bg-[rgba(251,249,244,0.82)] px-6 backdrop-blur-xl md:px-8">
          <div className="text-sm font-medium text-[#1b1c19]/60">Clients-centered operator workspace</div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-[#1b1c19]/60">Admin</span>
            <LogoutButton
              className="hidden rounded-full border border-[#dbc2b0]/70 bg-white px-4 py-2 text-sm font-semibold text-[#1b1c19] transition hover:bg-[#f5f3ee] lg:inline-flex"
            />
            <div className="flex size-8 items-center justify-center rounded-full border border-[#dbc2b0]/70 bg-white text-xs font-semibold text-[#8d4b00]">
              A
            </div>
          </div>
        </header>
        <main className="px-6 py-8 md:px-8 xl:px-12">{children}</main>
      </div>
    </div>
  );
}
