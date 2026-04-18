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
  await requireClientSession();

  return (
    <div className="min-h-screen bg-[#fcf8ff] text-[#181836]">
      <header className="fixed top-0 z-40 w-full bg-[rgba(252,248,255,0.82)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1920px] items-center px-6 py-6 md:px-10 xl:px-12">
          <span className="text-2xl font-bold tracking-tight text-[#181836]">Behalfy</span>
        </div>
      </header>

      <aside className="fixed left-0 top-0 hidden h-screen w-64 flex-col bg-[#efecff] px-6 pb-6 pt-28 xl:flex">
        <div className="mb-8 px-2">
          <h2 className="text-xl font-black uppercase tracking-tight text-[#181836]">Behalfy</h2>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.28em] text-[#181836]/50">
            Business Portal
          </p>
        </div>
        <SurfaceNav items={clientNav} variant="sidebar" />
        <div className="mt-auto pt-6">
          <LogoutButton className="inline-flex w-full items-center justify-center rounded-xl border border-[#d8d6fe]/70 bg-white px-4 py-3 text-[11px] font-bold uppercase tracking-[0.22em] text-[#181836] transition hover:bg-[#f6f5ff]" />
        </div>
      </aside>

      <main className="px-6 pb-16 pt-28 md:px-8 xl:ml-64 xl:px-10">
        <div className="mx-auto max-w-[1600px]">{children}</div>
      </main>
    </div>
  );
}
