import { notFound } from "next/navigation";

import { AgentBuilderWorkspace } from "@/components/stafless/agent-builder";
import { AgentWorkbenchShell } from "@/components/stafless/agent-workbench-shell";
import { requireAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";

type EditAgentPageProps = {
  params: Promise<{ tenantId: string; agentId: string }>;
};

export default async function EditAgentPage({ params }: EditAgentPageProps) {
  await requireAdminSession();
  const { tenantId, agentId } = await params;
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    include: {
      channelConnections: true,
      integrationConnections: true,
      agents: {
        select: {
          id: true,
          name: true,
          channelId: true,
        },
      },
    },
  });
  const agent = await db.agent.findFirst({
    where: { id: agentId, tenantId },
    include: {
      channel: true,
      features: {
        orderBy: { sortOrder: "asc" },
        include: {
          steps: {
            orderBy: { sortOrder: "asc" },
            include: { integration: true },
          },
        },
      },
    },
  });

  if (!tenant || !agent) notFound();

  return (
    <AgentWorkbenchShell agent={agent} mode="edit" tenant={tenant}>
      <AgentBuilderWorkspace agent={agent} mode="edit" tenant={tenant} />
    </AgentWorkbenchShell>
  );
}
