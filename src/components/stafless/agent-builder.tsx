import {
  ChannelConnection,
  Feature,
  IntegrationConnection,
  Step,
} from "@prisma/client";

import { AgentBuilderClient } from "@/components/stafless/agent-builder-client";

type BuilderTenant = {
  id: string;
  name: string;
  slug: string;
  channelConnections: ChannelConnection[];
  integrationConnections: IntegrationConnection[];
  agents?: Array<{
    id: string;
    name: string;
    channelId: string;
  }>;
};

type BuilderAgent = {
  id: string;
  name: string;
  persona: string;
  tone: string;
  languagePreference?: string | null;
  status: string;
  deployedAt: Date | null;
  channelId: string;
  channel: ChannelConnection;
  features: (Feature & {
    steps: (Step & { integration: IntegrationConnection })[];
  })[];
};

export function AgentBuilderWorkspace({
  tenant,
  mode,
  agent,
}: {
  tenant: BuilderTenant;
  mode: "create" | "edit" | "detail";
  agent?: BuilderAgent;
}) {
  return (
    <AgentBuilderClient
      agent={
        agent
          ? {
              ...agent,
              deployedAt: agent.deployedAt?.toISOString() ?? null,
            }
          : undefined
      }
      mode={mode}
      tenant={{
        ...tenant,
        agents: tenant.agents ?? [],
      }}
    />
  );
}
