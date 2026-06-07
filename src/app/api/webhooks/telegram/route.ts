import { NextRequest, NextResponse } from "next/server";

import { handleIncomingEvent } from "@/lib/ai-runtime";
import { db } from "@/lib/db";
import {
  ensureBufferedDeliveryExecution,
  scheduleDelayedDeliverySweepBackground,
} from "@/lib/delayed-delivery-background";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

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

  const secretHeader = req.headers.get("x-telegram-bot-api-secret-token");
  const isLocalDev =
    process.env.NODE_ENV !== "production" &&
    (req.nextUrl.hostname === "localhost" || req.nextUrl.hostname === "127.0.0.1");

  if (!agent || (!isLocalDev && (!agent.webhookSecret || secretHeader !== agent.webhookSecret))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const webhookLimit = await checkRateLimit({
    scope: "telegram-webhook",
    identifier: agent.id,
    limit: 300,
    windowSeconds: 60,
  });

  if (!webhookLimit.allowed) {
    return rateLimitResponse(webhookLimit);
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
    console.error("[telegram-webhook] processing failed", {
      error: error instanceof Error ? error.message : "unknown",
    });

    return NextResponse.json(
      { error: "Webhook processing failed." },
      { status: 500 },
    );
  }
}
