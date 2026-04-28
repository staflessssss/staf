import { AgentStatus } from "@prisma/client";

import { db } from "@/lib/db";

type InvalidStatusRow = {
  id: string;
  name: string;
  status: string | null;
  tenantId: string;
};

const VALID_STATUSES = Object.values(AgentStatus);

async function main() {
  const [totalAgents, groupedStatuses, invalidRows] = await Promise.all([
    db.agent.count(),
    db.agent.groupBy({
      by: ["status"],
      _count: {
        _all: true,
      },
      orderBy: {
        status: "asc",
      },
    }),
    db.$queryRaw<InvalidStatusRow[]>`
      SELECT
        id,
        "tenantId",
        name,
        status::text AS status
      FROM "Agent"
      WHERE status IS NULL
        OR status::text NOT IN (${AgentStatus.DRAFT}, ${AgentStatus.DEPLOYING}, ${AgentStatus.ACTIVE}, ${AgentStatus.PAUSED}, ${AgentStatus.ERROR})
      ORDER BY "tenantId" ASC, id ASC
    `,
  ]);

  const counts = new Map<AgentStatus, number>(
    groupedStatuses.map((entry) => [entry.status, entry._count._all]),
  );

  console.log(`Total agents: ${totalAgents}`);
  console.log("Status distribution:");

  for (const status of VALID_STATUSES) {
    console.log(`- ${status}: ${counts.get(status) ?? 0}`);
  }

  if (invalidRows.length > 0) {
    console.log("");
    console.log("Agents with NULL or unexpected status:");

    for (const row of invalidRows) {
      console.log(
        `- agentId=${row.id} tenantId=${row.tenantId} name=${JSON.stringify(row.name)} status=${JSON.stringify(row.status)}`,
      );
    }
  }

  console.log("");

  if (invalidRows.length === 0) {
    console.log("✓ all agents have valid status");
  } else {
    console.log(`✗ ${invalidRows.length} agents need backfill`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
