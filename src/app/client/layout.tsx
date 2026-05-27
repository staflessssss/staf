import type { ReactNode } from "react";

import { requireClientSession } from "@/lib/client-auth";

export default async function ClientLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireClientSession();

  return (
    <div className="min-h-screen bg-[#080806] text-white">
      {children}
    </div>
  );
}
