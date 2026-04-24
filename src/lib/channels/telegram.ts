import { splitOutgoingMessage } from "@/lib/channels/message-behavior";

type TelegramMessagePayload = {
  message?: {
    message_id?: number;
    date?: number;
    edit_date?: number;
    text?: string;
    caption?: string;
    chat?: {
      id?: number | string;
    };
  };
  edited_message?: {
    message_id?: number;
    date?: number;
    edit_date?: number;
    text?: string;
    caption?: string;
    chat?: {
      id?: number | string;
    };
  };
};

export function parseTelegramBotToken(credentials: string) {
  const trimmed = credentials.trim();

  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as { botToken?: string; token?: string };
      return parsed.botToken ?? parsed.token ?? "";
    } catch {
      return "";
    }
  }

  return trimmed;
}

function parseTelegramTimestamp(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  const parsed = new Date(value * 1000);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

async function sendTelegramMessage(args: {
  botToken: string;
  contactId: string;
  text: string;
}) {
  const response = await fetch(`https://api.telegram.org/bot${args.botToken}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: args.contactId,
      text: args.text,
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(`Telegram send failed with ${response.status}.`);
  }

  return payload;
}

export async function registerTelegramWebhook(args: {
  credentials: string;
  webhookUrl: string;
  secretToken: string;
}) {
  const botToken = parseTelegramBotToken(args.credentials);

  if (!botToken) {
    throw new Error("Telegram connection is missing a bot token.");
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url: args.webhookUrl,
      secret_token: args.secretToken,
      allowed_updates: ["message", "edited_message"],
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.ok) {
    throw new Error("Telegram webhook registration failed.");
  }

  return payload;
}

export const telegramAdapter = {
  parseIncoming: (payload: TelegramMessagePayload) => {
    const message = payload.message ?? payload.edited_message;

    return {
      contactId: String(message?.chat?.id ?? ""),
      message: String(message?.text ?? message?.caption ?? ""),
      messageId: String(message?.message_id ?? ""),
      eventTimestamp:
        parseTelegramTimestamp(message?.edit_date) ?? parseTelegramTimestamp(message?.date),
    };
  },
  formatReply: (text: string, config?: unknown) => {
    return splitOutgoingMessage(text, config);
  },
  sendReply: async (params: {
    credentials: string;
    contactId: string;
    message: string | string[];
    channelConfig?: unknown;
  }) => {
    const botToken = parseTelegramBotToken(params.credentials);

    if (!botToken) {
      throw new Error("Telegram connection is missing a bot token.");
    }

    const messageParts = Array.isArray(params.message) ? params.message : [params.message];
    const deliveries = [];

    for (let index = 0; index < messageParts.length; index += 1) {
      const part = messageParts[index];

      try {
        const payload = await sendTelegramMessage({
          botToken,
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
          mode: "telegram_partial_delivery",
          deliveredCount: deliveries.length,
          totalParts: messageParts.length,
          deliveries,
          error: error instanceof Error ? error.message : "telegram_partial_delivery_failed",
        };
      }
    }

    return Array.isArray(params.message) ? deliveries : deliveries[0];
  },
};
