import type { ReactNode } from "react";

import { ClientRail } from "./client-rail";

/**
 * Full-window cabinet frame: a fixed-height bordered shell with the collapsible
 * left rail and a scrollable content column. Drop this around any client page's
 * content so the navigation stays identical everywhere.
 */
export function CabinetShell({
  userInitials,
  userName,
  header,
  children,
}: {
  userInitials: string;
  userName: string;
  header?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="h-screen overflow-hidden bg-[#070705] p-3 text-[#f7f0e7] md:p-5">
      <section className="relative flex h-[calc(100vh-24px)] overflow-hidden rounded-[1.6rem] border border-[#d7a96d]/70 bg-[#0d0d0b] shadow-[0_0_0_1px_rgba(255,255,255,0.045),0_0_48px_rgba(215,169,109,0.32),0_46px_140px_rgba(0,0,0,0.66)] md:h-[calc(100vh-40px)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_9%_-4%,rgba(226,176,111,0.14),transparent_27%),radial-gradient(circle_at_72%_10%,rgba(255,255,255,0.06),transparent_24%),linear-gradient(120deg,rgba(255,255,255,0.025),transparent_38%)]" />

        <ClientRail userInitials={userInitials} userName={userName} />

        <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col">
          {header ? (
            <header className="flex items-end justify-between gap-6 border-b border-white/[0.09] px-8 py-6">
              {header}
            </header>
          ) : null}
          <div className="min-h-0 flex-1 overflow-y-auto px-8 py-7">{children}</div>
        </div>
      </section>
    </main>
  );
}
