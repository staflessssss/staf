import { NextRequest, NextResponse } from "next/server";

import { handleIncomingEvent } from "@/lib/ai-runtime";
import { db } from "@/lib/db";
import {
  ensureBufferedDeliveryExecution,
  scheduleDelayedDeliverySweepBackground,
} from "@/lib/delayed-delivery-background";

export async function POST(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get("agentId");

  if (!agentId) {
    return NextResponse.json({ error: "Missing agentId." }, { status: 400 });
  }

  const agent = await db.agent.findFirst({
    where: {
      id: agentId,
      status: "ACTIVE",
      channel: {
        type: "TELEGRAM",
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

  const secretHeader = req.headers.get("x-telegram-bot-api-secret-token");
  const isLocalDev = req.nextUrl.hostname === "localhost" || req.nextUrl.hostname === "127.0.0.1";

  if (!isLocalDev && (!agent.webhookSecret || secretHeader !== agent.webhookSecret)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = await req.json().catch(() => null);

  if (!payload) {
    return NextResponse.json({ error: "Invalid Telegram payload." }, { status: 400 });
  }

  try {
    const result = await handleIncomingEvent({
      agentId: agent.id,
      channel: "TELEGRAM",
      payload,
    });
    await ensureBufferedDeliveryExecution(result);
    scheduleDelayedDeliverySweepBackground();

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Telegram webhook failed." },
      { status: 500 },
    );
  }
}
