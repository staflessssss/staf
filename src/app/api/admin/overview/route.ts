import { NextResponse } from "next/server";

import { db } from "@/lib/db";

export async function GET() {
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
