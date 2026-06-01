import { AgentsView } from "./agents-view";
import { requireClientSession } from "@/lib/client-auth";
import { db } from "@/lib/db";

function getInitials(value: string) {
  const cleaned = value.includes("@") ? value.split("@")[0] : value;
  const parts = cleaned
    .replace(/[^a-zA-Z0-9\s._-]/g, " ")
    .split(/[\s._-]+/)
    .filter(Boolean);

  return (parts[0]?.[0] ?? "C").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase();
}

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

  const userLabel = session.user.name ?? session.user.email ?? "Client";
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
