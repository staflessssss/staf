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
                "rounded-xl px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.22em]",
              variant === "topbar" &&
                "border-b-2 border-transparent pb-1 text-sm font-medium",
              isActive
                ? variant === "sidebar"
                  ? "translate-x-1 rounded-xl bg-white text-[#8d4b00] shadow-sm"
                  : "border-[#8d4b00] text-[#8d4b00]"
                : variant === "sidebar"
                  ? "text-[#1b1c19]/70 hover:bg-[#eae8e3]"
                  : "text-[#1b1c19]/60 hover:text-[#8d4b00]",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
