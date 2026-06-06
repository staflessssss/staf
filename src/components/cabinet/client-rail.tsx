"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bot,
  ChevronLeft,
  MessageSquareText,
  PanelLeft,
  Plug,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import { LogoutButton } from "@/components/auth/logout-button";

type NavItem = { icon: LucideIcon; label: string; href: string };

const NAV: NavItem[] = [
  { icon: BarChart3, label: "Overview", href: "/client/overview" },
  { icon: MessageSquareText, label: "Conversations", href: "/client/dialogs" },
  { icon: Bot, label: "Agents", href: "/client/agents" },
  { icon: UsersRound, label: "Leads", href: "/client/leads" },
  { icon: Plug, label: "Connections", href: "/client/connections" },
];

const STORAGE_KEY = "behalfy.rail.collapsed";

function isActive(pathname: string, href: string) {
  if (href === "/client/overview") {
    return pathname === "/client" || pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function ClientRail({
  userInitials,
  userName,
}: {
  userInitials: string;
  userName: string;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  return (
    <aside
      data-collapsed={collapsed}
      className={[
        "relative z-10 flex w-full shrink-0 items-center gap-3 overflow-x-auto border-b border-white/[0.09] bg-[#10100e]/88 px-3 py-3 md:flex-col md:items-stretch md:overflow-visible md:border-b-0 md:border-r md:transition-[width] md:duration-200 md:ease-out",
        collapsed ? "md:w-[78px] md:items-center md:px-3 md:py-6" : "md:w-[248px] md:px-5 md:py-6",
      ].join(" ")}
    >
      <div
        className={[
          "flex shrink-0 items-center",
          collapsed ? "md:flex-col md:gap-3" : "md:justify-between",
        ].join(" ")}
      >
        <Link href="/client/overview" title="Behalfy" className="flex items-center gap-2 md:gap-3">
          <Image
            src="/favicon.ico"
            alt=""
            width={36}
            height={36}
            unoptimized
            className="block size-8 shrink-0 object-contain md:size-9"
          />
          <span
            className={[
              "hidden text-xl font-semibold tracking-[-0.06em] text-white sm:inline md:text-2xl",
              collapsed ? "md:hidden" : "",
            ].join(" ")}
          >
            Behalfy
          </span>
        </Link>
        <button
          type="button"
          onClick={toggle}
          title={collapsed ? "Expand" : "Collapse"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="hidden size-9 place-items-center rounded-lg text-white/55 transition hover:bg-white/[0.05] hover:text-white md:grid"
        >
          {collapsed ? <PanelLeft className="size-5" /> : <ChevronLeft className="size-5" />}
        </button>
      </div>

      <nav
        className={[
          "flex min-w-0 flex-1 gap-1.5 overflow-x-auto md:mt-9 md:flex-none md:flex-col md:overflow-visible",
          collapsed ? "md:items-center" : "",
        ].join(" ")}
      >
        {NAV.map(({ icon: Icon, label, href }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              aria-label={label}
              className={[
                "flex shrink-0 items-center rounded-xl transition",
                collapsed
                  ? "gap-2.5 px-3 py-2.5 text-sm md:size-11 md:justify-center md:p-0"
                  : "gap-2.5 px-3 py-2.5 text-sm md:gap-3.5 md:px-3.5 md:py-3 md:text-[15px]",
                active
                  ? "bg-[#3a2c1e] text-[#e9be86] ring-1 ring-[#d7a96d]/34 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]"
                  : "text-white/60 hover:bg-white/[0.05] hover:text-white",
              ].join(" ")}
            >
              <Icon className="size-5 shrink-0" />
              <span className={["hidden sm:inline", collapsed ? "md:hidden" : ""].join(" ")}>
                {label}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 md:hidden">
        <LogoutButton variant="rail" label="Sign out" />
      </div>

      <div
        className={[
          "mt-auto hidden border-t border-white/[0.09] pt-5 md:block",
          collapsed ? "md:flex md:flex-col md:items-center md:gap-3" : "",
        ].join(" ")}
      >
        {collapsed ? (
          <>
            <span className="relative grid size-10 place-items-center rounded-full border border-[#d7a96d]/35 bg-[#271f17] text-xs font-semibold text-[#e9be86]">
              {userInitials}
              <span className="absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-[#10100e] bg-[#34d37d]" />
            </span>
            <LogoutButton variant="rail" label="Sign out" />
          </>
        ) : (
          <>
            <div className="mb-4 flex items-center gap-3">
              <span className="relative grid size-10 shrink-0 place-items-center rounded-full border border-[#d7a96d]/35 bg-[#271f17] text-xs font-semibold text-[#e9be86]">
                {userInitials}
                <span className="absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-[#10100e] bg-[#34d37d]" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{userName}</p>
                <p className="text-xs text-white/46">Client</p>
              </div>
            </div>
            <LogoutButton variant="sidebar" label="Sign out" />
          </>
        )}
      </div>
    </aside>
  );
}
