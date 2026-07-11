import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";

import { AdminSidebar } from "@/components/admin-sidebar";
import { LogoutButton } from "@/components/auth/logout-button";

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

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#181836]">
      <Suspense fallback={null}>
        <AdminSidebar />
      </Suspense>

      <div className="md:ml-72">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#e7ebf3] bg-[rgba(248,250,252,0.86)] px-6 backdrop-blur-xl md:px-8">
          <div className="text-sm font-medium text-[#667085]">Clients-centered operator workspace</div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-[#667085]">Admin</span>
            <LogoutButton variant="header" />
            <div className="flex size-8 items-center justify-center rounded-lg border border-[#dfe6f1] bg-white text-xs font-semibold text-[#5b5cf0]">
              A
            </div>
          </div>
        </header>
        <main className="px-6 py-8 md:px-8 xl:px-10">{children}</main>
      </div>
    </div>
  );
}
