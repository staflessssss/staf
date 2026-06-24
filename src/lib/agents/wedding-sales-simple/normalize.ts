import type { NormalizedWeddingSalesIncomingMessage } from "./contracts";

type RawInstagramIncoming = {
  tenantId: string;
  agentId: string;
  conversationId?: string;
  contactId?: string;
  contactUsername?: string;
  contactDisplayName?: string;
  text?: string;
  body?: string;
  messageId?: string;
  receivedAt?: string | number | Date;
  entry?: Array<{
    messaging?: Array<{
      sender?: { id?: string; username?: string; name?: string };
      message?: { text?: string; mid?: string };
      timestamp?: number;
    }>;
  }>;
};

type RawGmailIncoming = {
  tenantId: string;
  agentId: string;
  conversationId?: string;
  contactId?: string;
  from?: string;
  senderName?: string;
  senderEmail?: string;
  text?: string;
  message?: string;
  body?: string;
  messageId?: string;
  gmailMessageId?: string;
  threadId?: string;
  receivedAt?: string | number | Date;
  timestamp?: string | number | Date;
  internalDate?: string | number | Date;
};

function normalizeTimestamp(value: string | number | Date | undefined) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const millis = value > 1_000_000_000_000 ? value : value * 1000;
    const parsed = new Date(millis);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  if (typeof value === "string" && value.trim()) {
    const numeric = Number(value.trim());
    const parsed = Number.isFinite(numeric)
      ? new Date(numeric > 1_000_000_000_000 ? numeric : numeric * 1000)
      : new Date(value);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return new Date(0).toISOString();
}

function parseEmailAddress(value: string | undefined) {
  if (!value?.trim()) {
    return undefined;
  }

  const match = /<([^<>@\s]+@[^<>@\s]+\.[^<>@\s]+)>/.exec(value);

  if (match?.[1]) {
    return match[1];
  }

  return /[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+/.exec(value)?.[0];
}

function parseSenderName(value: string | undefined) {
  const normalized = value?.trim();

  if (!normalized) {
    return undefined;
  }

  return normalized.replace(/<[^<>]+>/g, "").replace(/^"|"$/g, "").trim() || undefined;
}

export function normalizeInstagramWeddingSalesIncoming(
  payload: RawInstagramIncoming,
): NormalizedWeddingSalesIncomingMessage {
  const event = payload.entry?.flatMap((entry) => entry.messaging ?? [])[0];
  const contactId = payload.contactId ?? event?.sender?.id ?? "";
  const text = payload.text ?? payload.body ?? event?.message?.text ?? "";
  const incomingMessageId = payload.messageId ?? event?.message?.mid;

  return {
    channel: "instagram",
    tenantId: payload.tenantId,
    agentId: payload.agentId,
    contactId,
    conversationId: payload.conversationId ?? `${payload.agentId}:${contactId}`,
    text,
    incomingMessageId,
    senderName: payload.contactDisplayName ?? event?.sender?.name,
    receivedAt: normalizeTimestamp(payload.receivedAt ?? event?.timestamp),
  };
}

export function normalizeGmailWeddingSalesIncoming(
  payload: RawGmailIncoming,
): NormalizedWeddingSalesIncomingMessage {
  const senderEmail = payload.senderEmail ?? parseEmailAddress(payload.from);
  const contactId = payload.contactId ?? senderEmail ?? "";
  const text = payload.text ?? payload.message ?? payload.body ?? "";
  const incomingMessageId = payload.messageId ?? payload.gmailMessageId;

  return {
    channel: "gmail",
    tenantId: payload.tenantId,
    agentId: payload.agentId,
    contactId,
    conversationId: payload.conversationId ?? payload.threadId ?? `${payload.agentId}:${contactId}`,
    text,
    incomingMessageId,
    senderName: payload.senderName ?? parseSenderName(payload.from),
    senderEmail,
    receivedAt: normalizeTimestamp(payload.receivedAt ?? payload.timestamp ?? payload.internalDate),
  };
}

export const weddingSalesSimpleNormalizeTestHelpers = {
  normalizeTimestamp,
  parseEmailAddress,
  parseSenderName,
};
