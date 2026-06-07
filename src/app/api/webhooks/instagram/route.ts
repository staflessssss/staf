import { createHmac, timingSafeEqual } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { handleIncomingEvent } from "@/lib/ai-runtime";
import { decrypt } from "@/lib/crypto";
import { parseInstagramCredentials } from "@/lib/channels/instagram";
import {
  ensureBufferedDeliveryExecution,
  scheduleDelayedDeliverySweepBackground,
} from "@/lib/delayed-delivery-background";
import { splitInstagramMessagingPayloads } from "@/lib/instagram-webhook";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

type InstagramCredentials = ReturnType<typeof parseInstagramCredentials>;
const MAX_INSTAGRAM_WEBHOOK_BYTES = 1_000_000;

type InstagramContactProfile = {
  username?: string;
  name?: string;
};

async function readRequestBodyWithLimit(request: NextRequest, maxBytes: number) {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");

  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return null;
  }

  if (!request.body) {
    return "";
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    totalBytes += value.byteLength;

    if (totalBytes > maxBytes) {
      await reader.cancel();
      return null;
    }

    chunks.push(value);
  }

  return Buffer.concat(chunks).toString("utf8");
}

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

function extractInstagramRecipientId(payload: unknown) {
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

function extractInstagramSenderId(payload: unknown) {
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

      const sender = "sender" in event ? event.sender : null;

      if (sender && typeof sender === "object" && !Array.isArray(sender) && "id" in sender) {
        return String(sender.id ?? "");
      }
    }
  }

  return "";
}

function extractInstagramMessageId(payload: unknown) {
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

      const message = "message" in event ? event.message : null;

      if (message && typeof message === "object" && !Array.isArray(message) && "mid" in message) {
        return String(message.mid ?? "");
      }
    }
  }

  return "";
}

function readMetadataRecord(metadata: Prisma.JsonValue | null) {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? (metadata as Record<string, Prisma.JsonValue>)
    : {};
}

async function recordInstagramWebhookStatus(args: {
  channelId: string;
  metadata: Prisma.JsonValue | null;
  status: string;
  recipientId: string;
  senderId: string;
  messageId: string;
  agentId?: string;
  error?: string;
}) {
  await db.channelConnection.update({
    where: {
      id: args.channelId,
    },
    data: {
      metadata: {
        ...readMetadataRecord(args.metadata),
        webhookLastEventAt: new Date().toISOString(),
        webhookLastStatus: args.status,
        webhookLastRecipientId: args.recipientId || null,
        webhookLastSenderId: args.senderId || null,
        webhookLastMessageId: args.messageId || null,
        webhookLastAgentId: args.agentId ?? null,
        webhookLastError: args.error ?? null,
      },
    },
  });
}

async function safeRecordInstagramWebhookStatus(
  args: Parameters<typeof recordInstagramWebhookStatus>[0],
) {
  await recordInstagramWebhookStatus(args).catch((error) => {
    console.error("[instagram-webhook] failed to record webhook status", {
      error: error instanceof Error ? error.message : "unknown",
    });
  });
}

function readRuntimeResultStatus(result: unknown) {
  if (result && typeof result === "object" && !Array.isArray(result) && "status" in result) {
    const status = result.status;

    if (typeof status === "string" && status.trim()) {
      return status;
    }
  }

  return "processed";
}

async function findInstagramAgentByRecipientId(recipientId: string) {
  if (!recipientId) {
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
    const agent = channel.agents[0];

    if (
      (credentials.igUserId === recipientId ||
        credentials.igScopedUserId === recipientId ||
        credentials.igBusinessAccountId === recipientId ||
        credentials.pageId === recipientId) &&
      agent?.id
    ) {
      return {
        agent,
        channelId: channel.id,
        metadata: channel.metadata,
        credentials,
      };
    }
  }

  return null;
}

async function resolveInstagramContactProfile(
  senderId: string,
  credentials: InstagramCredentials,
): Promise<InstagramContactProfile | null> {
  if (!senderId || !credentials.pageAccessToken) {
    return null;
  }

  const hosts =
    credentials.igUserId || credentials.igBusinessAccountId
      ? ["https://graph.instagram.com", "https://graph.facebook.com"]
      : ["https://graph.facebook.com", "https://graph.instagram.com"];

  for (const host of hosts) {
    try {
      const response = await fetch(
        `${host}/${credentials.graphApiVersion}/${senderId}?fields=username,name,profile_pic`,
        {
          headers: {
            Authorization: `Bearer ${credentials.pageAccessToken}`,
          },
        },
      );
      const payload = (await response.json().catch(() => null)) as unknown;

      if (!response.ok || !payload || typeof payload !== "object" || Array.isArray(payload)) {
        continue;
      }

      const record = payload as Record<string, unknown>;
      const username = typeof record.username === "string" ? record.username.trim() : "";
      const name = typeof record.name === "string" ? record.name.trim() : "";

      if (username || name) {
        return {
          ...(username ? { username } : {}),
          ...(name ? { name } : {}),
        };
      }
    } catch {
      continue;
    }
  }

  return null;
}

function withInstagramContactProfile(
  payload: unknown,
  profile: InstagramContactProfile | null,
) {
  if (!profile || !payload || typeof payload !== "object" || Array.isArray(payload)) {
    return payload;
  }

  return {
    ...payload,
    ...(profile.username ? { contactUsername: profile.username } : {}),
    ...(profile.name ? { contactDisplayName: profile.name } : {}),
  };
}

async function findInstagramChannelByAccountId(accountId: string) {
  if (!accountId) {
    return null;
  }

  const channels = await db.channelConnection.findMany({
    where: {
      type: "INSTAGRAM",
      status: "CONNECTED",
    },
    select: {
      id: true,
      credentialsEnc: true,
      metadata: true,
    },
  });

  for (const channel of channels) {
    const credentials = parseInstagramCredentials(decrypt(channel.credentialsEnc));

    if (
      credentials.igUserId === accountId ||
      credentials.igScopedUserId === accountId ||
      credentials.igBusinessAccountId === accountId ||
      credentials.pageId === accountId
    ) {
      return {
        channelId: channel.id,
        metadata: channel.metadata,
      };
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
  const isLocalDev =
    process.env.NODE_ENV !== "production" &&
    (req.nextUrl.hostname === "localhost" || req.nextUrl.hostname === "127.0.0.1");

  const rawBody = await readRequestBodyWithLimit(req, MAX_INSTAGRAM_WEBHOOK_BYTES).catch(() => "");

  if (rawBody === null) {
    return NextResponse.json({ error: "Payload too large." }, { status: 413 });
  }

  if (!rawBody) {
    return NextResponse.json({ error: "Invalid Instagram payload." }, { status: 400 });
  }

  const hasValidSignature = hasValidInstagramSignature(
    rawBody,
    req.headers.get("x-hub-signature-256"),
  );

  console.log("[instagram-webhook] received", {
    isLocalDev,
    hasSignatureHeader: Boolean(req.headers.get("x-hub-signature-256")),
    hasValidSignature,
    bodyBytes: rawBody.length,
  });

  if (!isLocalDev && !hasValidSignature) {
    console.error("[instagram-webhook] rejected invalid signature", {
      hasSignatureHeader: Boolean(req.headers.get("x-hub-signature-256")),
      bodyBytes: rawBody.length,
    });

    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const webhookLimit = await checkRateLimit({
    scope: "instagram-webhook",
    identifier: "global",
    limit: 600,
    windowSeconds: 60,
  });

  if (!webhookLimit.allowed) {
    return rateLimitResponse(webhookLimit);
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
    const results = [];

    for (const eventPayload of splitInstagramMessagingPayloads(payload)) {
      const recipientId = extractInstagramRecipientId(eventPayload);
      const senderId = extractInstagramSenderId(eventPayload);
      const messageId = extractInstagramMessageId(eventPayload);
      const route = await findInstagramAgentByRecipientId(recipientId);
      const agent = route?.agent ?? null;

      console.log("[instagram-webhook] routing event", {
        hasRecipientId: Boolean(recipientId),
        recipientId,
        agentId: agent?.id ?? null,
      });

      if (!route || !agent) {
        const echoChannel = await findInstagramChannelByAccountId(senderId);

        if (echoChannel) {
          console.log("[instagram-webhook] ignored business message echo", {
            senderId,
            recipientId,
            messageId,
          });

          await safeRecordInstagramWebhookStatus({
            channelId: echoChannel.channelId,
            metadata: echoChannel.metadata,
            status: "ignored_business_echo",
            recipientId,
            senderId,
            messageId,
          });

          results.push({
            ok: true,
            status: "ignored_business_echo",
          });
          continue;
        }

        console.error("[instagram-webhook] agent not found for recipient", {
          recipientId,
        });

        return NextResponse.json({ error: "Agent not found." }, { status: 404 });
      }

      const contactProfile = await resolveInstagramContactProfile(senderId, route.credentials);
      const result = await handleIncomingEvent({
        agentId: agent.id,
        channel: "INSTAGRAM",
        payload: withInstagramContactProfile(eventPayload, contactProfile),
      }).catch(async (error) => {
        await safeRecordInstagramWebhookStatus({
          channelId: route.channelId,
          metadata: route.metadata,
          status: "error",
          recipientId,
          senderId,
          messageId,
          agentId: agent.id,
          error: error instanceof Error ? error.message : "Instagram webhook failed.",
        });

        throw error;
      });

      await ensureBufferedDeliveryExecution(result);
      await safeRecordInstagramWebhookStatus({
        channelId: route.channelId,
        metadata: route.metadata,
        status: readRuntimeResultStatus(result),
        recipientId,
        senderId,
        messageId,
        agentId: agent.id,
      });
      results.push(result);
    }

    scheduleDelayedDeliverySweepBackground();

    return NextResponse.json(results.length === 1 ? results[0] : { results });
  } catch (error) {
    console.error("[instagram-webhook] processing failed", {
      error: error instanceof Error ? error.message : "unknown",
    });

    return NextResponse.json(
      { error: "Webhook processing failed." },
      { status: 500 },
    );
  }
}
