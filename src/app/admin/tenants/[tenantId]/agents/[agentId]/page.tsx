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
    select: {
      id: true,
      name: true,
      slug: true,
      timezone: true,
      channelConnections: {
        omit: { credentialsEnc: true },
      },
      integrationConnections: {
        omit: { credentialsEnc: true },
      },
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
    select: {
      id: true,
      name: true,
      persona: true,
      tone: true,
      languagePreference: true,
      status: true,
      deployedAt: true,
      channelId: true,
      channelConfig: true,
      channel: {
        omit: { credentialsEnc: true },
      },
      features: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!tenant || !agent) notFound();

  return (
    <AgentWorkbenchShell agent={agent} tenant={tenant}>
      <AgentWorkspace
        agent={agent}
        initialWorkspaceSection={resolvedSearchParams?.section}
        tenant={tenant}
      />
    </AgentWorkbenchShell>
  );
}
