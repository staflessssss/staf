import { AgentsView } from "./agents-view";
import { getCabinetUserName, getInitials } from "@/components/cabinet/user";
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

  const userLabel = getCabinetUserName(session.user);
  const userInitials = getInitials(userLabel);

  return (
    <AgentsView
      agents={agents}
      tenantId={tenantId}
      userInitials={userInitials}
      userName={userLabel}
    />
  );
}
