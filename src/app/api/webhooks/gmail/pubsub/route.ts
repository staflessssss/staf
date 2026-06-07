import { NextRequest, NextResponse } from "next/server";

import { assertPubSubWebhookSecret, processGmailPubSubNotification } from "@/lib/gmail-watch";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!assertPubSubWebhookSecret(token)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const webhookLimit = await checkRateLimit({
    scope: "gmail-pubsub-webhook",
    identifier: "global",
    limit: 600,
    windowSeconds: 60,
  });

  if (!webhookLimit.allowed) {
    return rateLimitResponse(webhookLimit);
  }

  const envelope = await request.json().catch(() => null);

  if (!envelope) {
    return NextResponse.json({ error: "Invalid Pub/Sub payload." }, { status: 400 });
  }

  try {
    const result = await processGmailPubSubNotification({
      envelope,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[gmail-pubsub-webhook] processing failed", {
      error: error instanceof Error ? error.message : "unknown",
    });

    return NextResponse.json(
      { error: "Webhook processing failed." },
      { status: 500 },
    );
  }
}
