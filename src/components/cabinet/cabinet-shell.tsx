import type { ReactNode } from "react";

export function CabinetShell({
  header,
  children,
}: {
  header?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      {header ? (
        <header className="flex flex-col gap-4 border-b border-white/[0.09] px-5 py-5 sm:flex-row sm:items-end sm:justify-between md:px-8 md:py-6">
          {header}
        </header>
      ) : null}
      <div className="behalfy-scroll min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-8 md:py-7">
        {children}
      </div>
    </>
  );
}
