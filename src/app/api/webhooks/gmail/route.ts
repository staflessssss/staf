import { NextRequest, NextResponse } from "next/server";

import { handleIncomingEvent } from "@/lib/ai-runtime";
import { db } from "@/lib/db";
import { scheduleDelayedDeliverySweepBackground } from "@/lib/delayed-delivery-background";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get("agentId");
  const headerSecret = req.headers.get("x-stafless-webhook-secret");
  const isLocalDev =
    process.env.NODE_ENV !== "production" &&
    (req.nextUrl.hostname === "localhost" || req.nextUrl.hostname === "127.0.0.1");

  if (!agentId) {
    return NextResponse.json({ error: "Missing agentId." }, { status: 400 });
  }

  const agent = await db.agent.findFirst({
    where: {
      id: agentId,
      status: {
        in: ["ACTIVE", "PAUSED"],
      },
      channel: {
        type: "GMAIL",
      },
    },
    select: {
      id: true,
      webhookSecret: true,
    },
  });

  const hasValidSecret =
    Boolean(agent?.webhookSecret) &&
    headerSecret === agent?.webhookSecret;

  if (!agent || (!isLocalDev && !hasValidSecret)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const webhookLimit = await checkRateLimit({
    scope: "gmail-webhook",
    identifier: agent.id,
    limit: 300,
    windowSeconds: 60,
  });

  if (!webhookLimit.allowed) {
    return rateLimitResponse(webhookLimit);
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
    console.error("[gmail-webhook] processing failed", {
      error: error instanceof Error ? error.message : "unknown",
    });

    return NextResponse.json(
      { error: "Webhook processing failed." },
      { status: 500 },
    );
  }
}
