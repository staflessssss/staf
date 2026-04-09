import Link from "next/link";
import { notFound } from "next/navigation";

import { AgentBuilderWorkspace } from "@/components/stafless/agent-builder";
import {
  PageHeader,
  secondaryButtonClassName,
} from "@/components/stafless/foundation";
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
    <div className="space-y-8">
      <PageHeader
        eyebrow="Agent builder"
        title="Create agent"
        description={`Build a real operator-managed draft for ${tenant.name}: define the agent, bind its channel, shape knowledge and tools, then review readiness before deployment work begins.`}
        actions={
          <Link
            href={`/admin/clients/${tenant.id}`}
            className={secondaryButtonClassName}
          >
            Back to client
          </Link>
        }
      />
      <AgentBuilderWorkspace mode="create" tenant={tenant} />
    </div>
  );
}
