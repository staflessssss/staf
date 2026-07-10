import { AgentsView } from "./agents-view";
import { requireClientSession } from "@/lib/client-auth";
import { db } from "@/lib/db";

export default async function ClientAgentsPage() {
  const session = await requireClientSession();
  const tenantId = session.user.tenantId;
  const agents = await db.agent.findMany({
    where: { tenantId },
    include: {
      channel: true,
      conversations: {
        where: {
          messages: {
            some: {},
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return <AgentsView agents={agents} tenantId={tenantId} />;
}
