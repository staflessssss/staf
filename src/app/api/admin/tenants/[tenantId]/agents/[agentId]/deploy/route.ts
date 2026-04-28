import { NextResponse } from "next/server";

import { agentConfigInclude } from "@/lib/agent-config";
import { requireAdminApiSession } from "@/lib/admin-api-auth";
import { db } from "@/lib/db";
import { deployAgent, getDeployStatus } from "@/lib/deploy";

type DeployRouteContext = {
  params: Promise<{ tenantId: string; agentId: string }>;
};

async function loadAgent(context: DeployRouteContext) {
  const { tenantId, agentId } = await context.params;

  return db.agent.findFirst({
    where: { id: agentId, tenantId },
    include: agentConfigInclude,
  });
}

export async function GET(_: Request, context: DeployRouteContext) {
  const session = await requireAdminApiSession();

  if (session instanceof NextResponse) {
    return session;
  }

  void session;

  const agent = await loadAgent(context);

  if (!agent) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  }

  const result = await getDeployStatus(agent, db);

  return NextResponse.json(
    {
      item: result,
    },
    { status: result.ready ? 200 : 409 },
  );
}

export async function POST(_: Request, context: DeployRouteContext) {
  const session = await requireAdminApiSession();

  if (session instanceof NextResponse) {
    return session;
  }

  void session;

  const agent = await loadAgent(context);

  if (!agent) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  }

  const result = await deployAgent(agent, db);

  return NextResponse.json(
    {
      item: result,
    },
    { status: result.ready ? 202 : 409 },
  );
}
