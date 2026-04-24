import { notFound } from "next/navigation";

import { AgentCreateFlow } from "@/components/stafless/agent-create-flow";
import { AgentWorkbenchShell } from "@/components/stafless/agent-workbench-shell";
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
      integrationConnections: { orderBy: { createdAt: "asc" } },
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

  return (
    <AgentWorkbenchShell mode="create" tenant={tenant}>
      <AgentCreateFlow tenant={tenant} />
    </AgentWorkbenchShell>
  );
}
