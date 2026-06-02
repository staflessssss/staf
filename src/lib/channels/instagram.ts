import {
  readMessageBehaviorConfig,
  splitOutgoingMessage,
} from "@/lib/channels/message-behavior";

type InstagramCredentials = {
  pageAccessToken: string;
  pageId?: string;
  igBusinessAccountId?: string;
  graphApiVersion: string;
};

type InstagramMessagingEvent = {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: {
    text?: string;
    mid?: string;
  };
};

type InstagramPayload = {
  contactId?: string;
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
      graphApiVersion: "v21.0",
    };
  }

  if (!trimmed.startsWith("{")) {
    return {
      pageAccessToken: trimmed,
      graphApiVersion: "v21.0",
    };
  }

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const graphApiVersion = String(parsed.graphApiVersion ?? parsed.version ?? "v21.0").trim();

    return {
      pageAccessToken: String(parsed.pageAccessToken ?? parsed.accessToken ?? parsed.token ?? "").trim(),
      pageId: String(parsed.pageId ?? "").trim() || undefined,
      igBusinessAccountId: String(parsed.igBusinessAccountId ?? parsed.instagramBusinessAccountId ?? "").trim() || undefined,
      graphApiVersion: graphApiVersion || "v21.0",
    };
  } catch {
    return {
      pageAccessToken: "",
      graphApiVersion: "v21.0",
    };
  }
}

export function getInstagramCredentialsValidationError(credentials: string) {
  const parsed = parseInstagramCredentials(credentials);

  if (!parsed.pageAccessToken) {
    return "Instagram credentials must include pageAccessToken.";
  }

  if (!parsed.pageId) {
    return "Instagram credentials must include pageId.";
  }

  if (!parsed.igBusinessAccountId) {
    return "Instagram credentials must include igBusinessAccountId.";
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
  text: string;
}) {
  const senderId = args.credentials.pageId ?? "me";
  const response = await fetch(
    `https://graph.facebook.com/${args.credentials.graphApiVersion}/${senderId}/messages`,
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
        message: {
          text: args.text,
        },
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

export const instagramAdapter = {
  parseIncoming: (payload: InstagramPayload) => {
    const event = payload.entry?.flatMap((entry) => entry.messaging ?? [])[0];
    const isBusinessManualReply = isBusinessManualPayload(payload);

    return {
      contactId: String(payload.contactId ?? event?.sender?.id ?? ""),
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
    channelConfig?: unknown;
  }) => {
    const credentials = parseInstagramCredentials(params.credentials);

    if (!credentials.pageAccessToken) {
      throw new Error("Instagram connection is missing a Page access token.");
    }

    const messageParts = getTextPayload(params.message).filter((part) => part.trim());
    const splitDelayMs = readMessageBehaviorConfig(params.channelConfig).splitMessageDelaySeconds * 1000;
    const deliveries = [];

    for (let index = 0; index < messageParts.length; index += 1) {
      const part = messageParts[index];

      try {
        if (index > 0 && splitDelayMs > 0) {
          await wait(splitDelayMs);
        }

        const payload = await sendInstagramMessage({
          credentials,
          contactId: params.contactId,
          text: part,
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
          totalParts: messageParts.length,
          deliveries,
          error: error instanceof Error ? error.message : "meta_partial_delivery_failed",
        };
      }
    }

    return Array.isArray(params.message) ? deliveries : deliveries[0];
  },
};
