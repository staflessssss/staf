import type { ReactNode } from "react";

import { ClientRail } from "./client-rail";

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
    <main className="min-h-dvh overflow-hidden bg-[#070705] p-2 text-[#f7f0e7] md:h-dvh md:p-5">
      <section className="relative flex h-[calc(100dvh-16px)] flex-col overflow-hidden rounded-[1.25rem] border border-[#d7a96d]/70 bg-[#0d0d0b] shadow-[0_0_0_1px_rgba(255,255,255,0.045),0_0_48px_rgba(215,169,109,0.32),0_46px_140px_rgba(0,0,0,0.66)] md:h-[calc(100dvh-40px)] md:flex-row md:rounded-[1.6rem]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_9%_-4%,rgba(226,176,111,0.14),transparent_27%),radial-gradient(circle_at_72%_10%,rgba(255,255,255,0.06),transparent_24%),linear-gradient(120deg,rgba(255,255,255,0.025),transparent_38%)]" />

        <ClientRail userInitials={userInitials} userName={userName} />

        <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col">
          {header ? (
            <header className="flex flex-col gap-4 border-b border-white/[0.09] px-5 py-5 sm:flex-row sm:items-end sm:justify-between md:px-8 md:py-6">
              {header}
            </header>
          ) : null}
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-8 md:py-7">
            {children}
          </div>
        </div>
      </section>
    </main>
  );
}
