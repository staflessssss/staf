import Link from "next/link";
import { ChannelConnection, IntegrationConnection } from "@prisma/client";
import type { ReactNode } from "react";

import { AgentTestChatDrawer } from "@/components/stafless/agent-test-chat-drawer";
import {
  StatusBadge,
  secondaryButtonClassName,
} from "@/components/stafless/foundation";

type ShellTenant = {
  id: string;
  name: string;
  slug: string;
  timezone?: string;
  channelConnections: ChannelConnection[];
  integrationConnections: IntegrationConnection[];
  agents?: Array<{
    id: string;
    name: string;
    channelId: string;
  }>;
};

type ShellAgent = {
  id: string;
  name: string;
  status: string;
  deployedAt: Date | string | null;
};

export function AgentWorkbenchShell({
  tenant,
  agent,
  children,
}: {
  tenant: ShellTenant;
  agent: ShellAgent;
  children: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Link href="/admin/clients" className="transition hover:text-foreground">
              Clients
            </Link>
            <span>/</span>
            <Link href={`/admin/clients/${tenant.id}`} className="transition hover:text-foreground">
              {tenant.name}
            </Link>
            <span>/</span>
            <span className="font-medium text-foreground">{agent.name}</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {agent.name}
            </h1>
            <StatusBadge status={agent.status} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/admin/clients/${tenant.id}`} className={secondaryButtonClassName}>
            Back to client
          </Link>
          <AgentTestChatDrawer
            agentId={agent.id}
            agentName={agent.name}
            tenantId={tenant.id}
          />
        </div>
      </div>

      {children}
    </div>
  );
}

