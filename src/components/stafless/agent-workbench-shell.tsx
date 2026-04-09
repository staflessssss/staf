import Link from "next/link";
import { ChannelConnection, Feature, FeatureType, IntegrationConnection } from "@prisma/client";
import type { ReactNode } from "react";

import {
  HighlightPanel,
  MetricStrip,
  PageHeader,
  StatusBadge,
  SurfaceCard,
  formatEnumLabel,
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
  channel?: ChannelConnection | null;
  features?: Feature[];
};

function formatDateTime(value: Date | string | null | undefined) {
  if (!value) {
    return "Not deployed yet";
  }

  const date = typeof value === "string" ? new Date(value) : value;

  return date.toLocaleString("ru-RU");
}

function countAgentBlocks(agent?: ShellAgent) {
  const features = agent?.features ?? [];

  return {
    knowledgeCount: features.filter((feature) => feature.type === FeatureType.KNOWLEDGE).length,
    toolCount: features.filter((feature) => feature.type === FeatureType.TOOL).length,
  };
}

export function AgentWorkbenchShell({
  tenant,
  mode,
  agent,
  children,
}: {
  tenant: ShellTenant;
  mode: "create" | "edit" | "detail";
  agent?: ShellAgent;
  children: ReactNode;
}) {
  const connectedChannels = tenant.channelConnections.filter(
    (connection) => connection.status === "CONNECTED",
  );
  const connectedIntegrations = tenant.integrationConnections.filter(
    (connection) => connection.status === "CONNECTED",
  );
  const assignedChannelIds = new Set((tenant.agents ?? []).map((item) => item.channelId));
  const availableChannels = connectedChannels.filter(
    (connection) => !assignedChannelIds.has(connection.id) || connection.id === agent?.channel?.id,
  );
  const { knowledgeCount, toolCount } = countAgentBlocks(agent);

  const pageTitle =
    mode === "create"
      ? `Build an agent for ${tenant.name}`
      : mode === "edit"
        ? `Refine ${agent?.name ?? "agent"}`
        : agent?.name ?? "Agent workbench";
  const pageDescription =
    mode === "create"
      ? "Shape the persona, channel, knowledge, and tools in one focused workspace before you ever hit deploy."
      : mode === "edit"
        ? "Tune the current draft, pressure-test the tool stack, and keep deploy posture clear while you iterate."
        : "Review the live configuration, prompt shape, and operator-facing readiness of this agent in one place.";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Link href="/admin/clients" className="transition hover:text-foreground">
          Clients
        </Link>
        <span>/</span>
        <Link href={`/admin/clients/${tenant.id}`} className="transition hover:text-foreground">
          {tenant.name}
        </Link>
        <span>/</span>
        <span className="font-medium text-foreground">
          {mode === "create" ? "New agent" : agent?.name ?? "Agent"}
        </span>
      </div>

      <PageHeader
        eyebrow={mode === "create" ? "Agent Builder" : mode === "edit" ? "Edit Agent" : "Agent Detail"}
        title={pageTitle}
        description={pageDescription}
        badge={agent ? <StatusBadge status={agent.status} /> : undefined}
        actions={
          <>
            <Link href={`/admin/clients/${tenant.id}`} className={secondaryButtonClassName}>
              Back to client
            </Link>
            {mode === "detail" && agent ? (
              <Link
                href={`/admin/clients/${tenant.id}/agents/${agent.id}/edit`}
                className={secondaryButtonClassName}
              >
                Edit configuration
              </Link>
            ) : null}
            {mode === "edit" && agent ? (
              <Link
                href={`/admin/clients/${tenant.id}/agents/${agent.id}`}
                className={secondaryButtonClassName}
              >
                View detail
              </Link>
            ) : null}
          </>
        }
      />

      <MetricStrip
        items={[
          {
            label: "Connected channels",
            value: connectedChannels.length,
            detail:
              availableChannels.length > 0
                ? `${availableChannels.length} still free for assignment`
                : "Every connected channel is already assigned",
          },
          {
            label: "Connected integrations",
            value: connectedIntegrations.length,
            detail: "Available to bind into tool steps",
          },
          {
            label: mode === "create" ? "Planned knowledge blocks" : "Knowledge blocks",
            value: knowledgeCount,
            detail: "Business context that shapes replies",
          },
          {
            label: mode === "create" ? "Planned tool blocks" : "Tool blocks",
            value: toolCount,
            detail: "Operator actions the model can invoke",
          },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)]">
        <HighlightPanel
          eyebrow="Tenant context"
          title={`${tenant.name} operator workspace`}
          description="This workbench is scoped to one client tenant. Channel assignment remains one-channel-per-agent, and all tools stay isolated to this client's connected integrations."
          meta={`${tenant.slug}${tenant.timezone ? ` • ${tenant.timezone}` : ""}`}
        />
        <SurfaceCard title="Workbench focus" description="Keep the operator in flow while editing.">
          <div className="space-y-4 text-sm leading-6 text-muted-foreground">
            <p>
              {mode === "create"
                ? "Start from one available channel, then layer just enough knowledge and tooling for the first live use case."
                : "Use this page as the single source of truth for draft quality, tool coverage, and deploy readiness."}
            </p>
            <div className="space-y-2">
              <p className="font-semibold text-foreground">Current channel posture</p>
              <p>
                {agent?.channel
                  ? `${formatEnumLabel(agent.channel.type)} is currently bound to this agent.`
                  : availableChannels.length > 0
                    ? `${availableChannels.length} connected channel${availableChannels.length === 1 ? "" : "s"} can be assigned now.`
                    : "No free connected channels are available yet."}
              </p>
            </div>
            <div className="space-y-2">
              <p className="font-semibold text-foreground">Deploy timing</p>
              <p>{agent ? formatDateTime(agent.deployedAt) : "Draft has not been deployed yet"}</p>
            </div>
          </div>
        </SurfaceCard>
      </div>

      {children}
    </div>
  );
}
