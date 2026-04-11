import { randomBytes } from "crypto";

import { google } from "googleapis";

import {
  createGoogleOAuthClientFromEncryptedCredentials,
  parseGoogleDriveFileId,
} from "@/lib/google-api-client";

const DEFAULT_PRICING_ATTACHMENT_FILE_ID = "1m3EBiPTnIVq-8i2qD-3CMMKJ6UfYgZxi";
const DEFAULT_PRICING_ATTACHMENT_FILE_NAME = "Myndful Films Pricing Guide";

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
    }
  | Record<string, unknown>;

type GmailFormatConfig = {
  signatureText?: string;
  pricingTextBlock?: string;
};

type GmailAttachmentDescriptor = {
  source?: "google_drive";
  fileId: string;
  fileName?: string;
  mimeType?: string;
};

type GmailSendReplyParams = {
  credentials: string;
  contactId: string;
  message:
    | string
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
  priceAttachmentFileId?: string;
  priceAttachmentFileName?: string;
  priceAttachmentMimeType?: string;
  signatureText?: string;
  pricingTextBlock?: string;
};

function asObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function parseChannelConfig(config: unknown): GmailChannelConfig {
  const parsed = asObject(config);

  return {
    priceAttachmentFileId:
      typeof parsed?.priceAttachmentFileId === "string"
        ? parseGoogleDriveFileId(parsed.priceAttachmentFileId)
        : undefined,
    priceAttachmentFileName:
      typeof parsed?.priceAttachmentFileName === "string" ? parsed.priceAttachmentFileName : undefined,
    priceAttachmentMimeType:
      typeof parsed?.priceAttachmentMimeType === "string" ? parsed.priceAttachmentMimeType : undefined,
    signatureText: typeof parsed?.signatureText === "string" ? parsed.signatureText : undefined,
    pricingTextBlock:
      typeof parsed?.pricingTextBlock === "string"
        ? parsed.pricingTextBlock
        : typeof parsed?.collectionsGuideTextBlock === "string"
          ? parsed.collectionsGuideTextBlock
          : undefined,
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function convertMarkdownishToHtml(value: string) {
  let html = escapeHtml(value.trim())
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

  return html;
}

function isPricingReply(text: string) {
  const normalized = text.toLowerCase();

  return (
    normalized.includes("collections guide") ||
    normalized.includes("pricing guide") ||
    normalized.includes("pricing") ||
    normalized.includes("starting price") ||
    normalized.includes("starting at") ||
    normalized.includes("$2,750")
  );
}

function appendPricingBlock(text: string, config: GmailFormatConfig) {
  if (!isPricingReply(text)) {
    return text;
  }

  if (text.includes("galleries.vidflow.co")) {
    return text;
  }

  if (config.pricingTextBlock?.trim()) {
    return `${text.trim()}\n\n${config.pricingTextBlock.trim()}`;
  }

  return text;
}

function appendSignature(text: string, config: GmailFormatConfig) {
  if (!config.signatureText?.trim()) {
    return text.trim();
  }

  if (text.includes(config.signatureText.trim())) {
    return text.trim();
  }

  return `${text.trim()}\n\n${config.signatureText.trim()}`;
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
  subject: string;
  text: string;
  html?: string;
  attachments?: GmailDeliveryAttachment[];
  messageId?: string;
}) {
  const headers = [
    "MIME-Version: 1.0",
    `To: ${args.to}`,
    `Subject: ${encodeHeaderText(args.subject)}`,
  ];

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
      DEFAULT_PRICING_ATTACHMENT_FILE_NAME,
    mimeType:
      descriptor.mimeType ??
      metadata.data.mimeType ??
      "application/octet-stream",
    content: Buffer.from(response.data as ArrayBuffer),
  } satisfies GmailDeliveryAttachment;
}

function collectAutoAttachments(args: {
  text: string;
  attachments?: GmailAttachmentDescriptor[];
  channelConfig?: unknown;
}) {
  const config = parseChannelConfig(args.channelConfig);
  const dedupe = new Map<string, GmailAttachmentDescriptor>();

  for (const attachment of args.attachments ?? []) {
    if (!attachment.fileId) {
      continue;
    }

    dedupe.set(attachment.fileId, attachment);
  }

  if (isPricingReply(args.text)) {
    const fileId = config.priceAttachmentFileId ?? DEFAULT_PRICING_ATTACHMENT_FILE_ID;

    dedupe.set(fileId, {
      source: "google_drive",
      fileId,
      fileName: config.priceAttachmentFileName,
      mimeType: config.priceAttachmentMimeType,
    });
  }

  return [...dedupe.values()];
}

function normalizeReplyMessage(message: GmailSendReplyParams["message"], config: GmailChannelConfig) {
  const text = typeof message === "string" ? message : message.text;
  const html = typeof message === "string" ? undefined : message.html;
  const withPricingBlock = appendPricingBlock(text, config);
  const withSignature = appendSignature(withPricingBlock, config);

  return {
    text: withSignature,
    html: html ?? convertMarkdownishToHtml(withSignature),
  };
}

export const gmailAdapterTestHelpers = {
  convertMarkdownishToHtml,
  appendPricingBlock,
  appendSignature,
  collectAutoAttachments,
  isPricingReply,
};

export const gmailAdapter = {
  parseIncoming: (payload: GmailIncomingPayload) => {
    return {
      contactId: String(payload.contactId ?? payload.from ?? ""),
      message: String(payload.text ?? payload.message ?? payload.body ?? payload.html ?? ""),
      messageId: String(payload.messageId ?? payload.inReplyTo ?? payload.replyToMessageId ?? ""),
      threadId: String(payload.threadId ?? ""),
      subject: String(payload.subject ?? ""),
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
    const attachmentDescriptors = collectAutoAttachments({
      text: reply.text,
      attachments: params.attachments,
      channelConfig: params.channelConfig,
    });
    const attachments = [];
    const skippedAttachments = [];

    for (const descriptor of attachmentDescriptors) {
      try {
        attachments.push(await downloadDriveAttachment(params.credentials, descriptor));
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
      subject: params.subject?.trim() || "Re: Your inquiry",
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
