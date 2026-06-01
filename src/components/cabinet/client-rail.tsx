"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
  { icon: MessageSquareText, label: "Dialogs", href: "/client" },
  { icon: Bot, label: "Agents", href: "/client/agents" },
  { icon: UsersRound, label: "Leads", href: "/client/leads" },
  { icon: Plug, label: "Connections", href: "/client/connections" },
];

const STORAGE_KEY = "behalfy.rail.collapsed";

function isActive(pathname: string, href: string) {
  if (href === "/client") return pathname === "/client";
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
        "relative z-10 flex shrink-0 flex-col border-r border-white/[0.09] bg-[#10100e]/88 transition-[width] duration-200 ease-out",
        collapsed ? "w-[78px] items-center px-3 py-6" : "w-[248px] px-5 py-6",
      ].join(" ")}
    >
      {/* Brand + collapse toggle */}
      <div
        className={[
          "flex items-center",
          collapsed ? "flex-col gap-3" : "justify-between",
        ].join(" ")}
      >
        <Link href="/client" title="Behalfy" className="flex items-center gap-3">
          <span
            className="block size-9 shrink-0 bg-[#d7a96d]"
            style={{
              WebkitMask: "url('/assets/landing/behalfy-mark.svg') center / contain no-repeat",
              mask: "url('/assets/landing/behalfy-mark.svg') center / contain no-repeat",
            }}
          />
          {!collapsed ? (
            <span className="text-2xl font-semibold tracking-[-0.06em] text-white">Behalfy</span>
          ) : null}
        </Link>
        <button
          type="button"
          onClick={toggle}
          title={collapsed ? "Expand" : "Collapse"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="grid size-9 place-items-center rounded-lg text-white/55 transition hover:bg-white/[0.05] hover:text-white"
        >
          {collapsed ? <PanelLeft className="size-5" /> : <ChevronLeft className="size-5" />}
        </button>
      </div>

      {/* Primary nav */}
      <nav className={["mt-9 flex flex-col gap-1.5", collapsed ? "items-center" : ""].join(" ")}>
        {NAV.map(({ icon: Icon, label, href }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              aria-label={label}
              className={[
                "flex items-center rounded-xl transition",
                collapsed ? "size-11 justify-center" : "gap-3.5 px-3.5 py-3 text-[15px]",
                active
                  ? "bg-[#3a2c1e] text-[#e9be86] ring-1 ring-[#d7a96d]/34 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]"
                  : "text-white/60 hover:bg-white/[0.05] hover:text-white",
              ].join(" ")}
            >
              <Icon className="size-5 shrink-0" />
              {!collapsed ? <span>{label}</span> : null}
            </Link>
          );
        })}
      </nav>

      {/* Account */}
      <div
        className={[
          "mt-auto border-t border-white/[0.09] pt-5",
          collapsed ? "flex flex-col items-center gap-3" : "",
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
