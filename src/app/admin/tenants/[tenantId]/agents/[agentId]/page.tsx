import Link from "next/link";
import { notFound } from "next/navigation";

import { AgentBuilderWorkspace } from "@/components/stafless/agent-builder";
import {
  PageHeader,
  StatusBadge,
  secondaryButtonClassName,
} from "@/components/stafless/foundation";
import { requireAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";

type AgentDetailPageProps = {
  params: Promise<{ tenantId: string; agentId: string }>;
};

export default async function AgentDetailPage({
  params,
}: AgentDetailPageProps) {
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
        eyebrow="Agent detail"
        title={agent.name}
        description={`Operator review workspace for ${tenant.name}. Use this page to inspect prompt shape, readiness, and eventual deploy posture.`}
        actions={
          <>
            <StatusBadge status={agent.status} />
            <Link
              href={`/admin/clients/${tenant.id}/agents/${agent.id}/edit`}
              className={secondaryButtonClassName}
            >
              Edit configuration
            </Link>
          </>
        }
      />
      <AgentBuilderWorkspace agent={agent} mode="detail" tenant={tenant} />
    </div>
  );
}
