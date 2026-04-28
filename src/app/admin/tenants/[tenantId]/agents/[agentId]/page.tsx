import { notFound } from "next/navigation";

import { AgentWorkbenchShell } from "@/components/stafless/agent-workbench-shell";
import { AgentWorkspace } from "@/components/stafless/agent-workspace";
import { requireAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";

type AgentDetailPageProps = {
  params: Promise<{ tenantId: string; agentId: string }>;
  searchParams?: Promise<{ section?: string }>;
};

export default async function AgentDetailPage({
  params,
  searchParams,
}: AgentDetailPageProps) {
  await requireAdminSession();
  const { tenantId, agentId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
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
      },
    },
  });

  if (!tenant || !agent) notFound();

  return (
    <AgentWorkbenchShell agent={agent} mode="edit" tenant={tenant}>
      <AgentWorkspace
        agent={agent}
        initialWorkspaceSection={resolvedSearchParams?.section}
        tenant={tenant}
      />
    </AgentWorkbenchShell>
  );
}
