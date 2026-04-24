import { createHmac, timingSafeEqual } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { handleIncomingEvent } from "@/lib/ai-runtime";
import {
  ensureBufferedDeliveryExecution,
  scheduleDelayedDeliverySweepBackground,
} from "@/lib/delayed-delivery-background";

function hasValidInstagramSignature(rawBody: string, signatureHeader: string | null) {
  const appSecret = process.env.INSTAGRAM_APP_SECRET?.trim();

  if (!appSecret) {
    return false;
  }

  const received = signatureHeader?.trim();
  if (!received?.startsWith("sha256=")) {
    return false;
  }

  const expected = `sha256=${createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;

  try {
    return timingSafeEqual(Buffer.from(received), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const agentId = searchParams.get("agentId");
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");
  const agent =
    agentId
      ? await db.agent.findFirst({
          where: {
            id: agentId,
            status: "ACTIVE",
            channel: {
              type: "INSTAGRAM",
            },
          },
          select: {
            id: true,
            webhookSecret: true,
          },
        })
      : null;

  if (mode === "subscribe" && agent?.webhookSecret && token === agent.webhookSecret) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get("agentId");
  const isLocalDev = req.nextUrl.hostname === "localhost" || req.nextUrl.hostname === "127.0.0.1";

  if (!agentId) {
    return NextResponse.json({ error: "Missing agentId." }, { status: 400 });
  }

  const agent = await db.agent.findFirst({
    where: {
      id: agentId,
      status: "ACTIVE",
      channel: {
        type: "INSTAGRAM",
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

  const rawBody = await req.text().catch(() => "");

  if (!rawBody) {
    return NextResponse.json({ error: "Invalid Instagram payload." }, { status: 400 });
  }

  const hasValidSignature = hasValidInstagramSignature(
    rawBody,
    req.headers.get("x-hub-signature-256"),
  );

  if (!isLocalDev && !hasValidSignature) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = (() => {
    try {
      return JSON.parse(rawBody) as unknown;
    } catch {
      return null;
    }
  })();

  if (!payload) {
    return NextResponse.json({ error: "Invalid Instagram payload." }, { status: 400 });
  }

  try {
    const result = await handleIncomingEvent({
      agentId: agent.id,
      channel: "INSTAGRAM",
      payload,
    });
    await ensureBufferedDeliveryExecution(result);
    scheduleDelayedDeliverySweepBackground();

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Instagram webhook failed." },
      { status: 500 },
    );
  }
}
