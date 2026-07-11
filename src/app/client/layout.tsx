import type { Metadata } from "next";
import type { ReactNode } from "react";

import { CabinetFrame } from "@/components/cabinet/cabinet-frame";
import { getCabinetUserName, getInitials } from "@/components/cabinet/user";
import { requireClientSession } from "@/lib/client-auth";

export const metadata: Metadata = {
  alternates: {
    canonical: null,
  },
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

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
