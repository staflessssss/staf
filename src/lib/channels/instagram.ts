import {
  readMessageBehaviorConfig,
  splitOutgoingMessage,
} from "@/lib/channels/message-behavior";

type InstagramCredentials = {
  pageAccessToken: string;
  pageId?: string;
  igUserId?: string;
  igScopedUserId?: string;
  igBusinessAccountId?: string;
  graphApiVersion: string;
};

const DEFAULT_GRAPH_API_VERSION = "v25.0";

type InstagramMessagingEvent = {
  sender?: { id?: string; username?: string; name?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: {
    text?: string;
    mid?: string;
  };
};

type InstagramPayload = {
  contactId?: string;
  contactUsername?: string;
  contactDisplayName?: string;
  text?: string;
  body?: string;
  direction?: string;
  source?: string;
  senderType?: string;
  isBusinessManualReply?: boolean;
  fromBusiness?: boolean;
  entry?: Array<{
    messaging?: InstagramMessagingEvent[];
  }>;
};

type InstagramAttachment = {
  publicUrl?: string;
  fileName?: string;
  mimeType?: string;
};

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function parseInstagramCredentials(credentials: string): InstagramCredentials {
  const trimmed = credentials.trim();

  if (!trimmed) {
    return {
      pageAccessToken: "",
      graphApiVersion: DEFAULT_GRAPH_API_VERSION,
    };
  }

  if (!trimmed.startsWith("{")) {
    return {
      pageAccessToken: trimmed,
      graphApiVersion: DEFAULT_GRAPH_API_VERSION,
    };
  }

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const graphApiVersion = String(
      parsed.graphApiVersion ?? parsed.version ?? DEFAULT_GRAPH_API_VERSION,
    ).trim();
    const accessToken = String(
      parsed.instagramUserAccessToken ??
        parsed.pageAccessToken ??
        parsed.accessToken ??
        parsed.token ??
        "",
    ).trim();
    const igUserId = String(parsed.igUserId ?? "").trim() || undefined;
    const igScopedUserId =
      String(parsed.igScopedUserId ?? parsed.instagramScopedUserId ?? "").trim() || undefined;

    return {
      pageAccessToken: accessToken,
      pageId: String(parsed.pageId ?? "").trim() || undefined,
      igUserId,
      igScopedUserId,
      igBusinessAccountId:
        String(parsed.igBusinessAccountId ?? parsed.instagramBusinessAccountId ?? "").trim() ||
        undefined,
      graphApiVersion: graphApiVersion || DEFAULT_GRAPH_API_VERSION,
    };
  } catch {
    return {
      pageAccessToken: "",
      graphApiVersion: DEFAULT_GRAPH_API_VERSION,
    };
  }
}

export function getInstagramCredentialsValidationError(credentials: string) {
  const parsed = parseInstagramCredentials(credentials);

  if (!parsed.pageAccessToken) {
    return "Instagram credentials must include accessToken.";
  }

  if (!parsed.igUserId && !parsed.igBusinessAccountId && !parsed.pageId) {
    return "Instagram credentials must include igUserId or pageId.";
  }

  return null;
}

function isBusinessManualPayload(payload: InstagramPayload) {
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

function parseInstagramTimestamp(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function getTextPayload(message: string | string[] | { text: string; html?: string }) {
  if (Array.isArray(message)) {
    return message;
  }

  if (typeof message === "object") {
    return [message.text];
  }

  return [message];
}

async function sendInstagramMessage(args: {
  credentials: InstagramCredentials;
  contactId: string;
  message: {
    text?: string;
    attachment?: {
      type: "image";
      payload: {
        url: string;
      };
    };
  };
}) {
  const senderId = args.credentials.igUserId ?? args.credentials.igBusinessAccountId ?? args.credentials.pageId ?? "me";
  const graphHost = args.credentials.igUserId || args.credentials.igBusinessAccountId
    ? "https://graph.instagram.com"
    : "https://graph.facebook.com";
  const response = await fetch(
    `${graphHost}/${args.credentials.graphApiVersion}/${senderId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.credentials.pageAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipient: {
          id: args.contactId,
        },
        messaging_type: "RESPONSE",
        message: args.message,
      }),
    },
  );
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMessage =
      payload && typeof payload === "object" && "error" in payload
        ? JSON.stringify(payload.error)
        : `Meta send failed with ${response.status}.`;

    throw new Error(errorMessage);
  }

  return payload;
}

function getImageAttachments(attachments?: InstagramAttachment[]) {
  return (attachments ?? []).filter((attachment) => {
    const mimeType = attachment.mimeType?.toLowerCase() ?? "";

    return Boolean(attachment.publicUrl?.trim()) && (!mimeType || mimeType.startsWith("image/"));
  });
}

export const instagramAdapter = {
  parseIncoming: (payload: InstagramPayload) => {
    const event = payload.entry?.flatMap((entry) => entry.messaging ?? [])[0];
    const isBusinessManualReply = isBusinessManualPayload(payload);

    return {
      contactId: String(payload.contactId ?? event?.sender?.id ?? ""),
      contactUsername: String(payload.contactUsername ?? event?.sender?.username ?? ""),
      contactDisplayName: String(payload.contactDisplayName ?? event?.sender?.name ?? ""),
      message: String(payload.text ?? payload.body ?? event?.message?.text ?? ""),
      messageId: String(event?.message?.mid ?? ""),
      eventTimestamp: parseInstagramTimestamp(event?.timestamp),
      isBusinessManualReply,
    };
  },
  formatReply: (text: string, config?: unknown) => {
    return splitOutgoingMessage(text, config);
  },
  sendReply: async (params: {
    credentials: string;
    contactId: string;
    message: string | string[] | { text: string; html?: string };
    attachments?: InstagramAttachment[];
    channelConfig?: unknown;
  }) => {
    const credentials = parseInstagramCredentials(params.credentials);

    if (!credentials.pageAccessToken) {
      throw new Error("Instagram connection is missing an access token.");
    }

    const messageParts = getTextPayload(params.message).filter((part) => part.trim());
    const imageAttachments = getImageAttachments(params.attachments);
    const splitDelayMs = readMessageBehaviorConfig(params.channelConfig).splitMessageDelaySeconds * 1000;
    const deliveries = [];
    const totalParts = messageParts.length + imageAttachments.length;

    for (let index = 0; index < messageParts.length; index += 1) {
      const part = messageParts[index];

      try {
        if (index > 0 && splitDelayMs > 0) {
          await wait(splitDelayMs);
        }

        const payload = await sendInstagramMessage({
          credentials,
          contactId: params.contactId,
          message: {
            text: part,
          },
        });
        deliveries.push(payload);
      } catch (error) {
        if (deliveries.length === 0) {
          throw error;
        }

        return {
          ok: false,
          mode: "meta_partial_delivery",
          deliveredCount: deliveries.length,
          totalParts,
          deliveries,
          error: error instanceof Error ? error.message : "meta_partial_delivery_failed",
        };
      }
    }

    for (const attachment of imageAttachments) {
      try {
        if (deliveries.length > 0 && splitDelayMs > 0) {
          await wait(splitDelayMs);
        }

        const payload = await sendInstagramMessage({
          credentials,
          contactId: params.contactId,
          message: {
            attachment: {
              type: "image",
              payload: {
                url: attachment.publicUrl?.trim() ?? "",
              },
            },
          },
        });
        deliveries.push(payload);
      } catch (error) {
        if (deliveries.length === 0) {
          throw error;
        }

        return {
          ok: false,
          mode: "meta_partial_delivery",
          deliveredCount: deliveries.length,
          totalParts,
          deliveries,
          error: error instanceof Error ? error.message : "meta_partial_delivery_failed",
        };
      }
    }

    return deliveries.length === 1 && !Array.isArray(params.message) && imageAttachments.length === 0
      ? deliveries[0]
      : deliveries;
  },
};
