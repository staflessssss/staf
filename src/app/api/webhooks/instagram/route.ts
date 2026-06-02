import { createHmac, timingSafeEqual } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { handleIncomingEvent } from "@/lib/ai-runtime";
import { decrypt } from "@/lib/crypto";
import { parseInstagramCredentials } from "@/lib/channels/instagram";
import {
  ensureBufferedDeliveryExecution,
  scheduleDelayedDeliverySweepBackground,
} from "@/lib/delayed-delivery-background";

function hasValidInstagramSignature(rawBody: string, signatureHeader: string | null) {
  const appSecret =
    process.env.INSTAGRAM_APP_SECRET?.trim() || process.env.META_APP_SECRET?.trim();

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

function getInstagramWebhookVerifyToken() {
  return (
    process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN?.trim() ||
    process.env.META_WEBHOOK_VERIFY_TOKEN?.trim() ||
    ""
  );
}

function extractInstagramRecipientPageId(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return "";
  }

  const entry = "entry" in payload && Array.isArray(payload.entry) ? payload.entry : [];

  for (const item of entry) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }

    const messaging = "messaging" in item && Array.isArray(item.messaging) ? item.messaging : [];

    for (const event of messaging) {
      if (!event || typeof event !== "object" || Array.isArray(event)) {
        continue;
      }

      const recipient = "recipient" in event ? event.recipient : null;

      if (recipient && typeof recipient === "object" && !Array.isArray(recipient) && "id" in recipient) {
        return String(recipient.id ?? "");
      }
    }
  }

  return "";
}

async function findInstagramAgentByPageId(pageId: string) {
  if (!pageId) {
    return null;
  }

  const channels = await db.channelConnection.findMany({
    where: {
      type: "INSTAGRAM",
      status: "CONNECTED",
    },
    include: {
      agents: {
        where: {
          status: "ACTIVE",
        },
        select: {
          id: true,
        },
        take: 1,
      },
    },
  });

  for (const channel of channels) {
    const credentials = parseInstagramCredentials(decrypt(channel.credentialsEnc));

    if (
      (credentials.pageId === pageId || credentials.igBusinessAccountId === pageId) &&
      channel.agents[0]?.id
    ) {
      return channel.agents[0];
    }
  }

  return null;
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

  const globalVerifyToken = getInstagramWebhookVerifyToken();

  if (
    mode === "subscribe" &&
    ((agent?.webhookSecret && token === agent.webhookSecret) ||
      (globalVerifyToken && token === globalVerifyToken))
  ) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get("agentId");
  const isLocalDev = req.nextUrl.hostname === "localhost" || req.nextUrl.hostname === "127.0.0.1";

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

  const agent = agentId
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
    : await findInstagramAgentByPageId(extractInstagramRecipientPageId(payload));

  if (!agent) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 });
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
