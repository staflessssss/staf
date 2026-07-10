import type { ReactNode } from "react";

import { CabinetFrame } from "@/components/cabinet/cabinet-frame";
import { getCabinetUserName, getInitials } from "@/components/cabinet/user";
import { requireClientSession } from "@/lib/client-auth";

export default async function ClientLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireClientSession();
  const userName = getCabinetUserName(session.user);

  return (
    <CabinetFrame userInitials={getInitials(userName)} userName={userName}>
      {children}
    </CabinetFrame>
  );
}
