import { randomBytes } from "crypto";

import { google } from "googleapis";

import {
  createGoogleOAuthClientFromEncryptedCredentials,
} from "@/lib/google-api-client";
import { readMessageBehaviorConfig } from "@/lib/channels/message-behavior";

type GmailIncomingPayload =
  | {
      from?: string;
      contactId?: string;
      text?: string;
      message?: string;
      body?: string;
      html?: string;
      messageId?: string;
      threadId?: string;
      subject?: string;
      references?: string;
      inReplyTo?: string;
      replyToMessageId?: string;
      gmailMessageId?: string;
      timestamp?: string | number;
      receivedAt?: string | number;
      internalDate?: string | number;
      to?: string;
      direction?: string;
      source?: string;
      senderType?: string;
      isBusinessManualReply?: boolean;
      fromBusiness?: boolean;
    }
  | Record<string, unknown>;

type GmailFormatConfig = {
  signatureText?: string;
};

type GmailAttachmentDescriptor = {
  source?: "google_drive" | "remote_url";
  fileId: string;
  fileName?: string;
  mimeType?: string;
  publicUrl?: string;
};

type GmailSendReplyParams = {
  credentials: string;
  contactId: string;
  message:
    | string
    | string[]
    | {
        text: string;
        html?: string;
      };
  channelConfig?: unknown;
  messageId?: string;
  threadId?: string;
  subject?: string;
  attachments?: GmailAttachmentDescriptor[];
};

type GmailDeliveryAttachment = {
  fileId: string;
  fileName: string;
  mimeType: string;
  content: Buffer;
};

type GmailChannelConfig = {
  signatureText?: string;
};

function asObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function isBusinessManualPayload(payload: Record<string, unknown>) {
  const marker = String(
    payload.direction ?? payload.source ?? payload.senderType ?? "",
  ).toLowerCase();

  return (
    payload.isBusinessManualReply === true ||
    payload.fromBusiness === true ||
    marker === "business" ||
    marker === "business_manual" ||
    marker === "manual_business" ||
    marker === "outbound" ||
    marker === "sent"
  );
}

function parseInboundTimestamp(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const millis = value > 1_000_000_000_000 ? value : value * 1000;
    const parsed = new Date(millis);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  if (typeof value === "string" && value.trim()) {
    const numeric = Number(value.trim());
    if (Number.isFinite(numeric)) {
      const millis = numeric > 1_000_000_000_000 ? numeric : numeric * 1000;
      const parsedNumeric = new Date(millis);
      if (!Number.isNaN(parsedNumeric.getTime())) {
        return parsedNumeric;
      }
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  return undefined;
}

function parseChannelConfig(config: unknown): GmailChannelConfig {
  const parsed = asObject(config);

  return {
    signatureText: typeof parsed?.signatureText === "string" ? parsed.signatureText : undefined,
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeEmailText(value: string) {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

function stripAttachmentPlaceholders(value: string) {
  return normalizeEmailText(value)
    .split("\n")
    .filter((line) => {
      const normalized = line
        .trim()
        .replace(/^\(+/, "")
        .replace(/\)+$/, "")
        .replace(/[.。…]+$/, "")
        .trim()
        .toLowerCase();

      return !(
        /^(attaching|attached|attachment)\b/.test(normalized) &&
        (normalized.includes("collections guide") || normalized.includes("pricing guide"))
      );
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildFlexibleBlockPattern(block: string) {
  return block
    .trim()
    .split(/\r?\n/)
    .map((line) => escapeRegExp(line.trim()))
    .join("\\s*\\n\\s*");
}

function collapseDuplicateSignatureBlocks(value: string, config: GmailFormatConfig) {
  const knownSignatures = [
    config.signatureText?.trim(),
    "Taras Mynd\nFounder & Creative Director / MYNDFUL FILMS LLC\nwww.myndfulfilms.co\ncontact@myndfulfilms.com",
  ].filter((signature): signature is string => Boolean(signature?.trim()));

  let text = normalizeEmailText(value);

  for (const signature of knownSignatures) {
    const pattern = new RegExp(buildFlexibleBlockPattern(signature), "gi");
    const matches = text.match(pattern);

    if (!matches || matches.length <= 1) {
      continue;
    }

    const canonical = matches[matches.length - 1]?.trim() ?? signature.trim();
    text = text.replace(pattern, "").replace(/\n{3,}/g, "\n\n").trim();
    text = `${text}\n\n${canonical}`.trim();
  }

  return text;
}

function cleanGeneratedEmailText(value: string, config: GmailFormatConfig) {
  return collapseDuplicateSignatureBlocks(stripAttachmentPlaceholders(value), config);
}

function convertMarkdownishToHtml(value: string) {
  const anchors: string[] = [];
  const withAnchorTokens = value.trim().replace(
    /<a\s+href=["'](https?:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_match, url: string, label: string) => {
      const token = `__GMAIL_ANCHOR_${anchors.length}__`;
      anchors.push(`<a href="${escapeHtml(url)}">${escapeHtml(label.replace(/<[^>]+>/g, "").trim() || url)}</a>`);
      return token;
    },
  );

  let html = escapeHtml(withAnchorTokens)
    .replace(/\n\n/g, "<br><br>")
    .replace(/\n/g, "<br>");

  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    (_match, label: string, url: string) => `<a href="${url}">${label}</a>`,
  );

  html = html.replace(/(^|[\s>])(https?:\/\/[^\s<]+)/g, (match, prefix: string, url: string) => {
    if (prefix.includes('href="')) {
      return match;
    }

    return `${prefix}<a href="${url}">${url}</a>`;
  });

  anchors.forEach((anchor, index) => {
    html = html.replaceAll(`__GMAIL_ANCHOR_${index}__`, anchor);
  });

  return html;
}

function htmlAnchorsToPlainText(value: string) {
  return normalizeEmailText(value)
    .replace(
      /<a\s+href=["'](https?:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
      (_match, url: string, label: string) => {
        const plainLabel = label.replace(/<[^>]+>/g, "").trim();
        return plainLabel && plainLabel !== url ? `${plainLabel}: ${url}` : url;
      },
    )
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, (_match, label: string, url: string) =>
      label && label !== url ? `${label}: ${url}` : url,
    )
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripQuotedReply(text: string) {
  if (!text) {
    return "";
  }

  const withoutHtmlQuote = text.replace(/<blockquote[\s\S]*$/i, "");
  const normalized = withoutHtmlQuote.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  const kept: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (/^on .+ wrote:$/i.test(trimmed)) {
      break;
    }

    if (/<[^>\s]+@[^>]+>:\s*$/.test(trimmed)) {
      break;
    }

    if (/^from:\s+/i.test(trimmed) || /^sent:\s+/i.test(trimmed) || /^subject:\s+/i.test(trimmed)) {
      break;
    }

    if (trimmed.startsWith(">")) {
      break;
    }

    kept.push(line);
  }

  return kept.join("\n").trim();
}

function looksLikeQuotedReplyOnly(text: string) {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();

  if (!normalized) {
    return false;
  }

  if (/^on .+ wrote:?\s*$/im.test(normalized)) {
    return true;
  }

  if (/^>/.test(normalized) || /\n>/.test(normalized)) {
    return true;
  }

  if (/<blockquote[\s\S]*<\/blockquote>/i.test(normalized)) {
    return true;
  }

  return /^from:\s+/im.test(normalized) || /^sent:\s+/im.test(normalized) || /^subject:\s+/im.test(normalized);
}

function appendSignature(text: string, config: GmailFormatConfig) {
  if (!config.signatureText?.trim()) {
    return text.trim();
  }

  const signaturePattern = new RegExp(buildFlexibleBlockPattern(config.signatureText.trim()), "i");

  if (signaturePattern.test(text)) {
    return text.trim();
  }

  return collapseDuplicateSignatureBlocks(
    `${text.trim()}\n\n${config.signatureText.trim()}`,
    config,
  );
}

function encodeHeaderText(value: string) {
  if (/^[\x20-\x7E]*$/.test(value)) {
    return value;
  }

  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function wrapBase64(value: string) {
  return value.replace(/.{1,76}/g, "$&\r\n").trimEnd();
}

function buildTextPart(text: string) {
  return [
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(Buffer.from(text, "utf8").toString("base64")),
  ].join("\r\n");
}

function buildHtmlPart(html: string) {
  return [
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(Buffer.from(html, "utf8").toString("base64")),
  ].join("\r\n");
}

function buildMimeMessage(args: {
  to: string;
  subject?: string;
  text: string;
  html?: string;
  attachments?: GmailDeliveryAttachment[];
  messageId?: string;
}) {
  const headers = [
    "MIME-Version: 1.0",
    `To: ${args.to}`,
  ];

  if (args.subject?.trim()) {
    headers.push(`Subject: ${encodeHeaderText(args.subject.trim())}`);
  }

  if (args.messageId?.trim()) {
    headers.push(`In-Reply-To: ${args.messageId.trim()}`);
    headers.push(`References: ${args.messageId.trim()}`);
  }

  const attachments = args.attachments ?? [];

  if (attachments.length === 0) {
    const alternativeBoundary = `alt_${randomBytes(8).toString("hex")}`;
    return [
      ...headers,
      `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`,
      "",
      `--${alternativeBoundary}`,
      buildTextPart(args.text),
      ...(args.html
        ? [`--${alternativeBoundary}`, buildHtmlPart(args.html)]
        : []),
      `--${alternativeBoundary}--`,
      "",
    ].join("\r\n");
  }

  const mixedBoundary = `mix_${randomBytes(8).toString("hex")}`;
  const alternativeBoundary = `alt_${randomBytes(8).toString("hex")}`;
  const attachmentParts = attachments.flatMap((attachment) => [
    `--${mixedBoundary}`,
    `Content-Type: ${attachment.mimeType}; name="${attachment.fileName}"`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="${attachment.fileName}"`,
    "",
    wrapBase64(attachment.content.toString("base64")),
  ]);

  return [
    ...headers,
    `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
    "",
    `--${mixedBoundary}`,
    `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`,
    "",
    `--${alternativeBoundary}`,
    buildTextPart(args.text),
    ...(args.html
      ? [`--${alternativeBoundary}`, buildHtmlPart(args.html)]
      : []),
    `--${alternativeBoundary}--`,
    ...attachmentParts,
    `--${mixedBoundary}--`,
    "",
  ].join("\r\n");
}

async function downloadDriveAttachment(credentials: string, descriptor: GmailAttachmentDescriptor) {
  const auth = createGoogleOAuthClientFromEncryptedCredentials(credentials);
  const drive = google.drive({ version: "v3", auth });

  const metadata = await drive.files.get({
    fileId: descriptor.fileId,
    fields: "id,name,mimeType",
    supportsAllDrives: true,
  });
  const response = await drive.files.get(
    {
      fileId: descriptor.fileId,
      alt: "media",
      supportsAllDrives: true,
    },
    {
      responseType: "arraybuffer",
    },
  );

  return {
    fileId: descriptor.fileId,
    fileName:
      descriptor.fileName ??
      metadata.data.name ??
      "attachment",
    mimeType:
      descriptor.mimeType ??
      metadata.data.mimeType ??
      "application/octet-stream",
    content: Buffer.from(response.data as ArrayBuffer),
  } satisfies GmailDeliveryAttachment;
}

async function downloadRemoteAttachment(descriptor: GmailAttachmentDescriptor) {
  const publicUrl = descriptor.publicUrl?.trim();

  if (!publicUrl) {
    throw new Error("Remote attachment is missing a public URL.");
  }

  const url = new URL(publicUrl);
  if (url.protocol !== "https:") {
    throw new Error("Remote attachment URL must use HTTPS.");
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Remote attachment download failed with ${response.status}.`);
  }

  return {
    fileId: descriptor.fileId,
    fileName: descriptor.fileName ?? url.pathname.split("/").pop() ?? "attachment",
    mimeType: descriptor.mimeType ?? response.headers.get("content-type") ?? "application/octet-stream",
    content: Buffer.from(await response.arrayBuffer()),
  } satisfies GmailDeliveryAttachment;
}

function collectAutoAttachments(args: {
  attachments?: GmailAttachmentDescriptor[];
}) {
  const dedupe = new Map<string, GmailAttachmentDescriptor>();

  for (const attachment of args.attachments ?? []) {
    const key = attachment.publicUrl?.trim() || attachment.fileId?.trim();
    if (!key) {
      continue;
    }

    dedupe.set(key, attachment);
  }

  return [...dedupe.values()];
}

function collectDeliveryAttachments(args: {
  text: string;
  attachments?: GmailAttachmentDescriptor[];
  channelConfig?: unknown;
}) {
  const messageBehavior = readMessageBehaviorConfig(args.channelConfig);

  if (!messageBehavior.allowAttachments) {
    return [];
  }

  return collectAutoAttachments(args);
}

function normalizeReplyMessage(message: GmailSendReplyParams["message"], config: GmailChannelConfig) {
  const rawText = Array.isArray(message)
    ? message.join("\n\n")
    : typeof message === "string"
      ? message
      : message.text;
  const html = Array.isArray(message) || typeof message === "string" ? undefined : message.html;
  const cleanText = cleanGeneratedEmailText(rawText, config);
  const withSignature = appendSignature(cleanText, config);

  return {
    text: htmlAnchorsToPlainText(withSignature),
    html: html ?? convertMarkdownishToHtml(withSignature),
  };
}

export const gmailAdapterTestHelpers = {
  convertMarkdownishToHtml,
  cleanGeneratedEmailText,
  htmlAnchorsToPlainText,
  appendSignature,
  collectAutoAttachments,
  collectDeliveryAttachments,
  stripQuotedReply,
  looksLikeQuotedReplyOnly,
};

export const gmailAdapter = {
  parseIncoming: (payload: GmailIncomingPayload) => {
    const isBusinessManualReply = isBusinessManualPayload(payload);
    const contactEmail = String(
      isBusinessManualReply
        ? payload.contactId ?? payload.to ?? payload.from ?? ""
        : payload.from ?? payload.contactId ?? "",
    );
    const rawMessage = String(payload.text ?? payload.message ?? payload.body ?? payload.html ?? "");
    const cleanedMessage = stripQuotedReply(rawMessage);
    const message = cleanedMessage || (looksLikeQuotedReplyOnly(rawMessage) ? "" : rawMessage.trim());

    return {
      contactId: contactEmail,
      contactEmail,
      message,
      messageId: String(payload.messageId ?? payload.inReplyTo ?? payload.replyToMessageId ?? ""),
      gmailMessageId: String(payload.gmailMessageId ?? ""),
      threadId: String(payload.threadId ?? ""),
      subject: String(payload.subject ?? ""),
      eventTimestamp: parseInboundTimestamp(
        payload.timestamp ?? payload.receivedAt ?? payload.internalDate,
      ),
      isBusinessManualReply,
    };
  },
  formatReply: (text: string, config?: unknown) => {
    const parsedConfig = parseChannelConfig(config);
    return normalizeReplyMessage(text, parsedConfig);
  },
  sendReply: async (params: GmailSendReplyParams) => {
    const auth = createGoogleOAuthClientFromEncryptedCredentials(params.credentials);
    const gmail = google.gmail({ version: "v1", auth });
    const parsedConfig = parseChannelConfig(params.channelConfig);
    const reply = normalizeReplyMessage(params.message, parsedConfig);
    const attachmentDescriptors = collectDeliveryAttachments({
      text: reply.text,
      attachments: params.attachments,
      channelConfig: params.channelConfig,
    });
    const attachments = [];
    const skippedAttachments = [];

    for (const descriptor of attachmentDescriptors) {
      try {
        attachments.push(
          descriptor.publicUrl
            ? await downloadRemoteAttachment(descriptor)
            : await downloadDriveAttachment(params.credentials, descriptor),
        );
      } catch (error) {
        skippedAttachments.push({
          fileId: descriptor.fileId,
          fileName: descriptor.fileName ?? null,
          reason: error instanceof Error ? error.message : "attachment_download_failed",
        });
      }
    }

    const raw = buildMimeMessage({
      to: params.contactId,
      subject: params.subject?.trim() || undefined,
      text: reply.text,
      html: reply.html,
      attachments,
      messageId: params.messageId,
    });

    const response = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: Buffer.from(raw, "utf8").toString("base64url"),
        ...(params.threadId?.trim() ? { threadId: params.threadId.trim() } : {}),
      },
    });

    return {
      ok: true,
      mode: "gmail_api",
      id: response.data.id ?? null,
      threadId: response.data.threadId ?? params.threadId ?? null,
      attachments: attachments.map((attachment) => ({
        fileId: attachment.fileId,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
      })),
      skippedAttachments,
    };
  },
};
