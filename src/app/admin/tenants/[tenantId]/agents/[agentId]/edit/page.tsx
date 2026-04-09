import Link from "next/link";
import { notFound } from "next/navigation";

import { AgentBuilderWorkspace } from "@/components/stafless/agent-builder";
import {
  PageHeader,
  secondaryButtonClassName,
} from "@/components/stafless/foundation";
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
    <div className="space-y-8">
      <PageHeader
        eyebrow="Edit agent"
        title={`Refine ${agent.name}`}
        description="Update the draft, rebalance its knowledge and tools, and keep the review state current before deploy work begins."
        actions={
          <Link
            href={`/admin/clients/${tenant.id}/agents/${agent.id}`}
            className={secondaryButtonClassName}
          >
            View detail
          </Link>
        }
      />
      <AgentBuilderWorkspace agent={agent} mode="edit" tenant={tenant} />
    </div>
  );
}
