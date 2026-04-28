import { notFound } from "next/navigation";
import Link from "next/link";
import { ConnectionStatus } from "@prisma/client";

import { AgentMinimalCreateForm } from "@/components/stafless/agent-minimal-create-form";
import { EmptyState, secondaryButtonClassName } from "@/components/stafless/foundation";
import { requireAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";

type CreateAgentPageProps = {
  params: Promise<{ tenantId: string }>;
};

export default async function CreateAgentPage({
  params,
}: CreateAgentPageProps) {
  await requireAdminSession();
  const { tenantId } = await params;
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    include: {
      channelConnections: { orderBy: { createdAt: "asc" } },
      agents: {
        select: {
          id: true,
          name: true,
          channelId: true,
        },
      },
    },
  });

  if (!tenant) notFound();

  const connectedChannels = tenant.channelConnections.filter(
    (channel) => channel.status === ConnectionStatus.CONNECTED,
  );
  const assignedChannelIds = new Set(tenant.agents.map((agent) => agent.channelId));
  const availableChannels = connectedChannels.filter(
    (channel) => !assignedChannelIds.has(channel.id),
  );

  return (
    <main className="space-y-8">
      <div className="max-w-3xl space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
          Create agent
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Start with a draft
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Create the shell first, then complete settings, prompting, functions, and
          testing in the agent workspace.
        </p>
      </div>

      {availableChannels.length > 0 ? (
        <AgentMinimalCreateForm
          availableChannels={availableChannels}
          tenant={{
            id: tenant.id,
            name: tenant.name,
          }}
        />
      ) : (
        <EmptyState
          action={
            <Link className={secondaryButtonClassName} href="/client/connections">
              Open channel connections
            </Link>
          }
          description="No connected channels available. Connect a channel to this tenant before creating an agent."
          title="No available channels"
        />
      )}
    </main>
  );
}
