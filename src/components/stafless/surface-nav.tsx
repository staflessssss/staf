"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
};

export function SurfaceNav({
  items,
  variant = "sidebar",
}: {
  items: NavItem[];
  variant?: "sidebar" | "topbar";
}) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        "flex gap-2",
        variant === "sidebar" ? "flex-col" : "flex-wrap items-center gap-6",
      )}
    >
      {items.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== "/admin" &&
            item.href !== "/client" &&
            pathname.startsWith(`${item.href}/`));

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "transition",
              variant === "sidebar" &&
                "rounded-[16px] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.22em]",
              variant === "topbar" &&
                "border-b-2 border-transparent pb-1 text-sm font-medium",
              isActive
                ? variant === "sidebar"
                  ? "bg-white text-[#4648d4] shadow-[0_10px_24px_rgba(24,24,54,0.05)] ring-1 ring-[#d8d6fe]/70"
                  : "border-[#4648d4] text-[#4648d4]"
                : variant === "sidebar"
                  ? "text-[#5c5c7e] hover:bg-[#f5f2ff] hover:text-[#181836]"
                  : "text-[#5c5c7e] hover:text-[#4648d4]",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
