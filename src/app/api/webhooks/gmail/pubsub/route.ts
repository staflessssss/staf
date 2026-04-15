import { NextRequest, NextResponse } from "next/server";

import { assertPubSubWebhookSecret, processGmailPubSubNotification } from "@/lib/gmail-watch";

export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!assertPubSubWebhookSecret(token)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Gmail Pub/Sub webhook failed.",
      },
      { status: 500 },
    );
  }
}
