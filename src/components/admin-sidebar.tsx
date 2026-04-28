"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Boxes,
  BookOpen,
  Bot,
  FlaskConical,
  Layers3,
  LayoutDashboard,
  MessageSquare,
  PenSquare,
  Radio,
  Settings2,
  Shield,
  Users,
  Workflow,
} from "lucide-react";

import { LogoutButton } from "@/components/auth/logout-button";
import { LayoutWrapper } from "@/components/layout-wrapper";
import { cn } from "@/lib/utils";

type SidebarItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
};

const adminRootItems: SidebarItem[] = [
  { href: "/admin/clients", label: "Clients", icon: Users },
  { href: "/admin/settings", label: "Settings", icon: Settings2 },
];

const agentWorkspaceItems: Array<{
  id: string;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "settings", label: "Settings", icon: Settings2 },
  { id: "prompting", label: "Prompting", icon: PenSquare },
  { id: "messages", label: "Messages", icon: MessageSquare },
  { id: "control", label: "Control", icon: Shield },
  { id: "functions", label: "Functions", icon: Boxes },
  { id: "knowledge", label: "Knowledge", icon: BookOpen },
  { id: "integrations", label: "Integrations", icon: Layers3 },
  { id: "channels", label: "Channels", icon: Radio },
  { id: "playbook", label: "Playbook", icon: Workflow },
  { id: "test", label: "Test", icon: FlaskConical },
];

function parseAgentRoute(pathname: string) {
  const match = pathname.match(/^\/admin\/tenants\/([^/]+)\/agents\/([^/?#]+)/);

  if (!match) {
    return null;
  }

  return {
    tenantId: match[1],
    agentId: match[2],
  };
}

function isItemActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarLink({
  href,
  label,
  icon: Icon,
  active,
  depth = "root",
}: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  active: boolean;
  depth?: "root" | "nested";
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-[12px] transition",
        depth === "root" ? "px-3 py-3 text-sm" : "px-3 py-2.5 text-sm",
        active
          ? "bg-[#eef2ff] text-[#4f46e5]"
          : "text-[#475467] hover:bg-[#f8fafc] hover:text-foreground",
      )}
    >
      <Icon className={cn("shrink-0", depth === "root" ? "size-4" : "size-3.5")} />
      <span className={cn(active ? "font-semibold" : "font-medium")}>{label}</span>
    </Link>
  );
}

export function AdminSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const agentRoute = parseAgentRoute(pathname);
  const currentSection = searchParams.get("section") ?? "overview";

  return (
    <aside className="fixed left-0 top-0 hidden h-screen w-72 border-r border-[#e7ebf3] bg-white px-4 py-5 md:flex">
      <LayoutWrapper direction="column" gap="lg" grow>
        <LayoutWrapper direction="column" gap="sm">
          <LayoutWrapper direction="row" gap="sm" align="center">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[#5b5cf0] text-white">
              B
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-foreground">Behalfy</h1>
              <p className="text-[11px] uppercase tracking-[0.14em] text-[#98a2b3]">
                Operator Console
              </p>
            </div>
          </LayoutWrapper>
        </LayoutWrapper>

        <LayoutWrapper direction="column" gap="xs">
          <p className="px-3 text-[11px] uppercase tracking-[0.14em] text-[#98a2b3]">
            Workspace
          </p>
          {adminRootItems.map((item) => (
            <SidebarLink
              key={item.href}
              active={isItemActive(pathname, item.href)}
              href={item.href}
              icon={item.icon}
              label={item.label}
            />
          ))}
        </LayoutWrapper>

        {agentRoute ? (
          <LayoutWrapper direction="column" gap="xs">
            <p className="px-3 text-[11px] uppercase tracking-[0.14em] text-[#98a2b3]">
              Current Agent
            </p>
            <div className="rounded-[14px] border border-[#e7ebf3] bg-[#f8fafc] px-3 py-3">
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-full bg-[#eef2ff] text-[#5b5cf0]">
                  <Bot className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">Agent workspace</p>
                  <p className="truncate text-xs text-[#98a2b3]">{agentRoute.agentId}</p>
                </div>
              </div>
            </div>
            <LayoutWrapper direction="column" gap="none">
              {agentWorkspaceItems.map((item) => (
                <SidebarLink
                  key={item.id}
                  active={
                    pathname === `/admin/tenants/${agentRoute.tenantId}/agents/${agentRoute.agentId}` &&
                    currentSection === item.id
                  }
                  depth="nested"
                  href={`/admin/tenants/${agentRoute.tenantId}/agents/${agentRoute.agentId}?section=${item.id}`}
                  icon={item.icon}
                  label={item.label}
                />
              ))}
            </LayoutWrapper>
          </LayoutWrapper>
        ) : null}

        <div className="mt-auto">
          <LogoutButton variant="sidebar" />
        </div>
      </LayoutWrapper>
    </aside>
  );
}
