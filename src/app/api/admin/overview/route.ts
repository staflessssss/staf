import { NextResponse } from "next/server";

import { requireAdminApiSession } from "@/lib/admin-api-auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await requireAdminApiSession();

  if (session instanceof NextResponse) {
    return session;
  }

  const [tenants, agents, activeAgents, conversationsToday] = await Promise.all([
    db.tenant.count(),
    db.agent.count(),
    db.agent.count({ where: { status: "ACTIVE" } }),
    db.conversation.count(),
  ]);

  return NextResponse.json({
    tenants,
    agents,
    activeAgents,
    conversationsToday,
  });
}
