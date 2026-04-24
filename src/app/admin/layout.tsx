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
    <div className="min-h-screen bg-[#fcf8ff] text-[#181836]">
      <aside className="fixed left-0 top-0 hidden h-screen w-64 flex-col bg-[#efecff] px-6 py-6 md:flex">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-[#4648d4] text-white">
            B
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">Behalfy</h1>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#181836]/55">
              Operator Console
            </p>
          </div>
        </div>

        <SurfaceNav items={adminNav} variant="sidebar" />

        <div className="mt-auto border-t border-[#d8d6fe]/40 pt-6">
          <Link
            href="/admin/clients"
            className="inline-flex w-full items-center justify-center rounded-xl bg-[linear-gradient(135deg,#4648d4_0%,#6063ee_100%)] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.22em] text-white shadow-lg shadow-[#4648d4]/10"
          >
            Open Clients
          </Link>
          <LogoutButton
            className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-[#d8d6fe]/70 bg-white px-4 py-3 text-[11px] font-bold uppercase tracking-[0.22em] text-[#181836] transition hover:bg-[#f6f5ff]"
          />
        </div>
      </aside>

      <div className="md:ml-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between bg-[rgba(252,248,255,0.82)] px-6 backdrop-blur-xl md:px-8">
          <div className="text-sm font-medium text-[#181836]/60">Clients-centered operator workspace</div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-[#181836]/60">Admin</span>
            <LogoutButton className="hidden rounded-xl border border-[#d8d6fe]/70 bg-white px-4 py-2 text-sm font-semibold text-[#181836] transition hover:bg-[#f6f5ff] lg:inline-flex" />
            <div className="flex size-8 items-center justify-center rounded-lg border border-[#d8d6fe]/70 bg-white text-xs font-semibold text-[#4648d4]">
              A
            </div>
          </div>
        </header>
        <main className="px-6 py-8 md:px-8 xl:px-12">{children}</main>
      </div>
    </div>
  );
}
