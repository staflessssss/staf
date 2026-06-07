import { ChannelType, ConnectionStatus, Prisma } from "@prisma/client";
import { google } from "googleapis";

import { handleIncomingEvent } from "@/lib/ai-runtime";
import { createGoogleOAuthClientFromEncryptedCredentials } from "@/lib/google-api-client";
import { db } from "@/lib/db";

type GmailWatchMetadata = {
  topicName?: string;
  historyId?: string;
  expiration?: string;
  registeredAt?: string;
  lastRenewalAttemptAt?: string;
  lastNotificationAt?: string;
  lastProcessedAt?: string;
  lastError?: string | null;
};

const GMAIL_WATCH_RENEWAL_WINDOW_MS = 24 * 60 * 60 * 1000;
const GMAIL_WATCH_RENEWAL_RETRY_MS = 60 * 60 * 1000;

type PubSubPushEnvelope = {
  message?: {
    data?: string;
    messageId?: string;
    publishTime?: string;
  };
  subscription?: string;
};

type GmailPushPayload = {
  emailAddress?: string;
  historyId?: string;
};

type ParsedGmailInboundMessage = {
  from: string;
  text: string;
  messageId: string;
  threadId: string;
  subject: string;
  gmailMessageId: string;
  internalDate: number;
};

function getGmailPubSubTopic() {
  return process.env.GMAIL_PUBSUB_TOPIC?.trim() || "";
}

function getPubSubWebhookSecret() {
  return process.env.GMAIL_PUBSUB_WEBHOOK_SECRET?.trim() || "";
}

function asObject(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, Prisma.JsonValue>;
}

function getWatchMetadata(metadata: Prisma.JsonValue | null | undefined): GmailWatchMetadata {
  const parsed = asObject(metadata);
  const watch = parsed?.gmailWatch;

  if (!watch || typeof watch !== "object" || Array.isArray(watch)) {
    return {};
  }

  const value = watch as Record<string, unknown>;

  return {
    topicName: typeof value.topicName === "string" ? value.topicName : undefined,
    historyId:
      typeof value.historyId === "string"
        ? value.historyId
        : typeof value.historyId === "number"
          ? String(value.historyId)
          : undefined,
    expiration:
      typeof value.expiration === "string"
        ? value.expiration
        : typeof value.expiration === "number"
          ? String(value.expiration)
          : undefined,
    registeredAt: typeof value.registeredAt === "string" ? value.registeredAt : undefined,
    lastRenewalAttemptAt:
      typeof value.lastRenewalAttemptAt === "string" ? value.lastRenewalAttemptAt : undefined,
    lastNotificationAt: typeof value.lastNotificationAt === "string" ? value.lastNotificationAt : undefined,
    lastProcessedAt: typeof value.lastProcessedAt === "string" ? value.lastProcessedAt : undefined,
    lastError: typeof value.lastError === "string" ? value.lastError : value.lastError === null ? null : undefined,
  };
}

function parseEpochMs(value?: string) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseIsoMs(value?: string) {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function shouldRenewGmailWatch(metadata: Prisma.JsonValue | null | undefined, now: Date) {
  const watch = getWatchMetadata(metadata);
  const lastAttemptAt = parseIsoMs(watch.lastRenewalAttemptAt);

  if (lastAttemptAt && now.getTime() - lastAttemptAt < GMAIL_WATCH_RENEWAL_RETRY_MS) {
    return false;
  }

  const expiration = parseEpochMs(watch.expiration);

  if (!expiration) {
    return true;
  }

  return expiration - now.getTime() <= GMAIL_WATCH_RENEWAL_WINDOW_MS;
}

function mergeWatchMetadata(
  metadata: Prisma.JsonValue | null | undefined,
  patch: Partial<GmailWatchMetadata>,
): Prisma.InputJsonValue {
  const parsed = asObject(metadata);
  const existingWatch = getWatchMetadata(metadata);

  return {
    ...(parsed ?? {}),
    gmailWatch: {
      ...existingWatch,
      ...patch,
    },
  };
}

function decodePubSubPayload(envelope: PubSubPushEnvelope): GmailPushPayload | null {
  const data = envelope.message?.data;

  if (!data) {
    return null;
  }

  try {
    const decoded = Buffer.from(data, "base64").toString("utf8");
    return JSON.parse(decoded) as GmailPushPayload;
  } catch {
    return null;
  }
}

function compareHistoryIds(left?: string, right?: string) {
  if (!left && !right) return 0;
  if (!left) return -1;
  if (!right) return 1;

  const a = BigInt(left);
  const b = BigInt(right);

  if (a === b) return 0;
  return a > b ? 1 : -1;
}

function getIsoTimestamp(value?: string) {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function normalizeHeaderValue(headers: Array<{ name?: string | null; value?: string | null }> | undefined, name: string) {
  const match = headers?.find((header) => header.name?.toLowerCase() === name.toLowerCase());
  return String(match?.value ?? "").trim();
}

function decodeBase64Url(input?: string | null) {
  if (!input) {
    return "";
  }

  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function stripHtml(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function pickMessageBody(payload?: {
  mimeType?: string | null;
  body?: { data?: string | null };
  parts?: unknown[];
}): string {
  if (!payload) {
    return "";
  }

  if (payload.mimeType === "text/plain") {
    return decodeBase64Url(payload.body?.data);
  }

  if (payload.mimeType === "text/html") {
    return stripHtml(decodeBase64Url(payload.body?.data));
  }

  const parts = Array.isArray(payload.parts) ? payload.parts : [];

  for (const part of parts) {
    if (!part || typeof part !== "object" || Array.isArray(part)) {
      continue;
    }

    const nested = pickMessageBody(part as { mimeType?: string | null; body?: { data?: string | null }; parts?: unknown[] });
    if (nested.trim()) {
      return nested;
    }
  }

  return decodeBase64Url(payload.body?.data);
}

function extractEmailAddress(value: string) {
  const match = value.match(/<([^>]+)>/);
  if (match?.[1]) {
    return match[1].trim().toLowerCase();
  }

  return value.trim().toLowerCase();
}

function isInboundCustomerMessage(args: {
  mailboxEmail: string;
  from: string;
  labelIds?: string[] | null;
}) {
  const labels = args.labelIds ?? [];
  const sender = extractEmailAddress(args.from);
  const mailbox = args.mailboxEmail.trim().toLowerCase();

  if (!sender || !mailbox) {
    return false;
  }

  if (labels.includes("SENT") || labels.includes("DRAFT")) {
    return false;
  }

  if (sender === mailbox) {
    return false;
  }

  return true;
}

async function updateChannelWatchMetadata(channelId: string, patch: Partial<GmailWatchMetadata>) {
  const current = await db.channelConnection.findUnique({
    where: { id: channelId },
    select: { metadata: true },
  });

  await db.channelConnection.update({
    where: { id: channelId },
    data: {
      metadata: mergeWatchMetadata(current?.metadata, patch),
    },
  });
}

async function fetchHistoryMessages(args: {
  credentialsEnc: string;
  mailboxEmail: string;
  startHistoryId: string;
}) {
  const auth = createGoogleOAuthClientFromEncryptedCredentials(args.credentialsEnc);
  const gmail = google.gmail({ version: "v1", auth });
  const ids = new Set<string>();
  let pageToken: string | undefined;

  do {
    const response = await gmail.users.history.list({
      userId: "me",
      startHistoryId: args.startHistoryId,
      historyTypes: ["messageAdded"],
      pageToken,
      maxResults: 100,
    });

    for (const historyRecord of response.data.history ?? []) {
      for (const entry of historyRecord.messagesAdded ?? []) {
        const id = entry.message?.id;
        if (id) {
          ids.add(id);
        }
      }
    }

    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);

  const results: ParsedGmailInboundMessage[] = [];

  for (const id of ids) {
    const response = await gmail.users.messages.get({
      userId: "me",
      id,
      format: "full",
    });

    const data = response.data;
    const headers = data.payload?.headers ?? [];
    const from = normalizeHeaderValue(headers, "From");
    const subject = normalizeHeaderValue(headers, "Subject");
    const rfcMessageId = normalizeHeaderValue(headers, "Message-ID");
    const text = pickMessageBody(data.payload as never) || String(data.snippet ?? "");

    if (
      !isInboundCustomerMessage({
        mailboxEmail: args.mailboxEmail,
        from,
        labelIds: data.labelIds ?? undefined,
      })
    ) {
      continue;
    }

    results.push({
      from: extractEmailAddress(from),
      text,
      messageId: rfcMessageId,
      threadId: String(data.threadId ?? ""),
      subject,
      gmailMessageId: String(data.id ?? id),
      internalDate: Number(data.internalDate ?? 0),
    });
  }

  return results;
}

async function fetchRecentInboxMessages(args: {
  credentialsEnc: string;
  mailboxEmail: string;
  afterIso?: string;
}) {
  const auth = createGoogleOAuthClientFromEncryptedCredentials(args.credentialsEnc);
  const gmail = google.gmail({ version: "v1", auth });
  const afterEpochSeconds = args.afterIso ? Math.max(0, Math.floor(Date.parse(args.afterIso) / 1000) - 120) : 0;
  const query = afterEpochSeconds > 0 ? `in:inbox after:${afterEpochSeconds}` : "in:inbox newer_than:2d";
  const list = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults: 25,
  });

  const results: ParsedGmailInboundMessage[] = [];

  for (const item of list.data.messages ?? []) {
    if (!item.id) {
      continue;
    }

    const response = await gmail.users.messages.get({
      userId: "me",
      id: item.id,
      format: "full",
    });

    const data = response.data;
    const headers = data.payload?.headers ?? [];
    const from = normalizeHeaderValue(headers, "From");
    const subject = normalizeHeaderValue(headers, "Subject");
    const rfcMessageId = normalizeHeaderValue(headers, "Message-ID");
    const text = pickMessageBody(data.payload as never) || String(data.snippet ?? "");
    const internalDate = Number(data.internalDate ?? 0);

    if (
      !isInboundCustomerMessage({
        mailboxEmail: args.mailboxEmail,
        from,
        labelIds: data.labelIds ?? undefined,
      })
    ) {
      continue;
    }

    if (args.afterIso && internalDate > 0 && internalDate < Date.parse(args.afterIso)) {
      continue;
    }

    results.push({
      from: extractEmailAddress(from),
      text,
      messageId: rfcMessageId,
      threadId: String(data.threadId ?? ""),
      subject,
      gmailMessageId: String(data.id ?? item.id),
      internalDate,
    });
  }

  return results.sort((left, right) => left.internalDate - right.internalDate);
}

export async function registerGmailWatchForChannel(args: {
  channelId: string;
  credentialsEnc: string;
}) {
  const topicName = getGmailPubSubTopic();

  if (!topicName) {
    return {
      ok: false,
      mode: "skipped",
      reason: "gmail_pubsub_topic_missing",
    };
  }

  const auth = createGoogleOAuthClientFromEncryptedCredentials(args.credentialsEnc);
  const gmail = google.gmail({ version: "v1", auth });

  try {
    const response = await gmail.users.watch({
      userId: "me",
      requestBody: {
        topicName,
        labelIds: ["INBOX"],
        labelFilterAction: "include",
      },
    });

    const patch: Partial<GmailWatchMetadata> = {
      topicName,
      historyId: String(response.data.historyId ?? ""),
      expiration: response.data.expiration ? String(response.data.expiration) : undefined,
      registeredAt: new Date().toISOString(),
      lastError: null,
    };

    await updateChannelWatchMetadata(args.channelId, patch);

    return {
      ok: true,
      mode: "gmail_watch",
      ...patch,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "gmail_watch_failed";

    await updateChannelWatchMetadata(args.channelId, {
      lastError: message,
    });

    return {
      ok: false,
      mode: "gmail_watch",
      reason: message,
    };
  }
}

export async function renewDueGmailWatches(args: {
  now?: Date;
  limit?: number;
} = {}) {
  const topicName = getGmailPubSubTopic();

  if (!topicName) {
    return {
      ok: false,
      reason: "gmail_pubsub_topic_missing",
      checked: 0,
      due: 0,
      renewed: 0,
      results: [],
    };
  }

  const now = args.now ?? new Date();
  const limit = args.limit && args.limit > 0 ? Math.floor(args.limit) : 10;
  const channels = await db.channelConnection.findMany({
    where: {
      type: ChannelType.GMAIL,
      status: ConnectionStatus.CONNECTED,
    },
    select: {
      id: true,
      credentialsEnc: true,
      metadata: true,
    },
    orderBy: {
      updatedAt: "asc",
    },
  });
  const dueChannels = channels
    .filter((channel) => shouldRenewGmailWatch(channel.metadata, now))
    .slice(0, limit);
  const results: Array<{
    channelId: string;
    ok: boolean;
    mode: string;
    reason?: string;
    expiration?: string;
  }> = [];

  for (const channel of dueChannels) {
    await updateChannelWatchMetadata(channel.id, {
      lastRenewalAttemptAt: now.toISOString(),
    });

    const result = await registerGmailWatchForChannel({
      channelId: channel.id,
      credentialsEnc: channel.credentialsEnc,
    });

    results.push({
      channelId: channel.id,
      ok: Boolean(result.ok),
      mode: result.mode,
      reason: "reason" in result ? result.reason : undefined,
      expiration: "expiration" in result ? result.expiration : undefined,
    });
  }

  return {
    ok: results.every((result) => result.ok),
    checked: channels.length,
    due: dueChannels.length,
    renewed: results.filter((result) => result.ok).length,
    results,
  };
}

export async function processGmailPubSubNotification(args: {
  envelope: PubSubPushEnvelope;
}) {
  const payload = decodePubSubPayload(args.envelope);

  if (!payload?.emailAddress || !payload.historyId) {
    return {
      ok: false,
      reason: "invalid_pubsub_payload",
    };
  }

  const gmailChannels = await db.channelConnection.findMany({
    where: {
      type: ChannelType.GMAIL,
      status: ConnectionStatus.CONNECTED,
    },
    include: {
      agents: {
        where: {
          status: "ACTIVE",
        },
        take: 1,
      },
    },
  });

  const matchingChannels = gmailChannels
    .filter((item) => {
      const metadata = asObject(item.metadata);
      return String(metadata?.email ?? "").trim().toLowerCase() === payload.emailAddress?.trim().toLowerCase();
    })
    .sort((left, right) => {
      const leftWatch = getWatchMetadata(left.metadata);
      const rightWatch = getWatchMetadata(right.metadata);
      const registeredDelta =
        getIsoTimestamp(rightWatch.registeredAt) - getIsoTimestamp(leftWatch.registeredAt);

      if (registeredDelta !== 0) {
        return registeredDelta;
      }

      const processedDelta =
        getIsoTimestamp(rightWatch.lastProcessedAt) - getIsoTimestamp(leftWatch.lastProcessedAt);

      if (processedDelta !== 0) {
        return processedDelta;
      }

      return getIsoTimestamp(String(right.updatedAt)) - getIsoTimestamp(String(left.updatedAt));
    });

  const channel = matchingChannels[0];

  if (!channel) {
    return {
      ok: true,
      status: "ignored_unknown_mailbox",
      emailAddress: payload.emailAddress,
    };
  }

  const watchMetadata = getWatchMetadata(channel.metadata);
  const comparison = compareHistoryIds(payload.historyId, watchMetadata.historyId);

  if (comparison <= 0) {
    return {
      ok: true,
      status: "ignored_stale_notification",
      emailAddress: payload.emailAddress,
      historyId: payload.historyId,
    };
  }

  await updateChannelWatchMetadata(channel.id, {
    lastNotificationAt: new Date().toISOString(),
  });

  const agent = channel.agents[0] ?? null;

  if (!watchMetadata.historyId) {
    const recoveredMessages = await fetchRecentInboxMessages({
      credentialsEnc: channel.credentialsEnc,
      mailboxEmail: payload.emailAddress,
      afterIso: watchMetadata.registeredAt ?? watchMetadata.lastNotificationAt,
    });

    if (agent) {
      for (const message of recoveredMessages) {
        await handleIncomingEvent({
          agentId: agent.id,
          channel: ChannelType.GMAIL,
          payload: {
            from: message.from,
            text: message.text,
            messageId: message.messageId,
            threadId: message.threadId,
            subject: message.subject,
            gmailMessageId: message.gmailMessageId,
          },
        });
      }
    }

    await updateChannelWatchMetadata(channel.id, {
      historyId: payload.historyId,
      lastProcessedAt: new Date().toISOString(),
      lastError: null,
    });

    return {
      ok: true,
      status:
        recoveredMessages.length > 0
          ? agent
            ? "cursor_initialized_with_recovery"
            : "cursor_initialized_recovery_no_active_agent"
          : "cursor_initialized",
      processedCount: recoveredMessages.length,
      emailAddress: payload.emailAddress,
      historyId: payload.historyId,
    };
  }

  try {
    const previousLastProcessedAt = watchMetadata.lastProcessedAt;
    const messages = await fetchHistoryMessages({
      credentialsEnc: channel.credentialsEnc,
      mailboxEmail: payload.emailAddress,
      startHistoryId: watchMetadata.historyId,
    });

    const recoveredMessages =
      messages.length === 0
        ? await fetchRecentInboxMessages({
            credentialsEnc: channel.credentialsEnc,
            mailboxEmail: payload.emailAddress,
            afterIso: previousLastProcessedAt,
          })
        : [];
    const combinedMessages = [...messages, ...recoveredMessages].filter(
      (message, index, all) =>
        all.findIndex(
          (candidate) =>
            candidate.gmailMessageId === message.gmailMessageId ||
            (candidate.messageId && candidate.messageId === message.messageId),
        ) === index,
    );

    if (agent) {
      for (const message of combinedMessages) {
        await handleIncomingEvent({
          agentId: agent.id,
          channel: ChannelType.GMAIL,
          payload: {
            from: message.from,
            text: message.text,
            messageId: message.messageId,
            threadId: message.threadId,
            subject: message.subject,
            gmailMessageId: message.gmailMessageId,
          },
        });
      }
    }

    await updateChannelWatchMetadata(channel.id, {
      historyId: payload.historyId,
      lastProcessedAt: new Date().toISOString(),
      lastError: null,
    });

    return {
      ok: true,
      status: agent ? "processed" : "processed_no_active_agent",
      processedCount: combinedMessages.length,
      emailAddress: payload.emailAddress,
      historyId: payload.historyId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "gmail_pubsub_processing_failed";

    if (message.includes("Requested entity was not found") || message.includes("startHistoryId")) {
      await updateChannelWatchMetadata(channel.id, {
        historyId: payload.historyId,
        lastProcessedAt: new Date().toISOString(),
        lastError: "gmail_history_cursor_reset",
      });

      return {
        ok: true,
        status: "history_cursor_reset",
        emailAddress: payload.emailAddress,
        historyId: payload.historyId,
      };
    }

    await updateChannelWatchMetadata(channel.id, {
      lastError: message,
    });

    throw error;
  }
}

export function assertPubSubWebhookSecret(token?: string | null) {
  const expected = getPubSubWebhookSecret();

  if (!expected) {
    return false;
  }

  return token === expected;
}

export const gmailWatchTestHelpers = {
  shouldRenewGmailWatch,
};
