import { NextRequest, NextResponse } from "next/server";

import { handleIncomingEvent } from "@/lib/ai-runtime";
import { db } from "@/lib/db";
import { scheduleDelayedDeliverySweepBackground } from "@/lib/delayed-delivery-background";

export async function POST(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get("agentId");
  const headerSecret = req.headers.get("x-stafless-webhook-secret");
  const isLocalDev = req.nextUrl.hostname === "localhost" || req.nextUrl.hostname === "127.0.0.1";

  if (!agentId) {
    return NextResponse.json({ error: "Missing agentId." }, { status: 400 });
  }

  const agent = await db.agent.findFirst({
    where: {
      id: agentId,
      status: "ACTIVE",
      channel: {
        type: "GMAIL",
      },
    },
    select: {
      id: true,
      webhookSecret: true,
    },
  });

  if (!agent) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  }

  const hasValidSecret =
    Boolean(agent.webhookSecret) &&
    headerSecret === agent.webhookSecret;

  if (!isLocalDev && !hasValidSecret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = await req.json().catch(() => null);

  if (!payload) {
    return NextResponse.json({ error: "Invalid Gmail relay payload." }, { status: 400 });
  }

  try {
    const result = await handleIncomingEvent({
      agentId: agent.id,
      channel: "GMAIL",
      payload,
    });
    scheduleDelayedDeliverySweepBackground();

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gmail webhook failed." },
      { status: 500 },
    );
  }
}
