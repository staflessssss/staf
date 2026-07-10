import {
  readMessageBehaviorConfig,
  splitOutgoingMessage,
} from "@/lib/channels/message-behavior";

type TelegramMessagePayload = {
  contactId?: string | number;
  text?: string;
  body?: string;
  direction?: string;
  source?: string;
  senderType?: string;
  isBusinessManualReply?: boolean;
  fromBusiness?: boolean;
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

export type TelegramReplyMarkup = {
  inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
};

function isBusinessManualPayload(payload: TelegramMessagePayload) {
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

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

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
  replyMarkup?: TelegramReplyMarkup;
  replyToMessageId?: string;
}) {
  const response = await fetch(`https://api.telegram.org/bot${args.botToken}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: args.contactId,
      text: args.text,
      ...(args.replyToMessageId ? { reply_to_message_id: args.replyToMessageId } : {}),
      ...(args.replyMarkup ? { reply_markup: args.replyMarkup } : {}),
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(`Telegram send failed with ${response.status}.`);
  }

  return payload;
}

export async function answerTelegramCallbackQuery(args: {
  credentials: string;
  callbackQueryId: string;
  text?: string;
}) {
  const botToken = parseTelegramBotToken(args.credentials);

  if (!botToken) {
    throw new Error("Telegram connection is missing a bot token.");
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      callback_query_id: args.callbackQueryId,
      ...(args.text ? { text: args.text } : {}),
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.ok) {
    throw new Error(`Telegram callback answer failed with ${response.status}.`);
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
      allowed_updates: ["message", "edited_message", "callback_query"],
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
    const isBusinessManualReply = isBusinessManualPayload(payload);

    return {
      contactId: String(payload.contactId ?? message?.chat?.id ?? ""),
      message: String(payload.text ?? payload.body ?? message?.text ?? message?.caption ?? ""),
      messageId: String(message?.message_id ?? ""),
      eventTimestamp:
        parseTelegramTimestamp(message?.edit_date) ?? parseTelegramTimestamp(message?.date),
      isBusinessManualReply,
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
    replyMarkup?: TelegramReplyMarkup;
    replyToMessageId?: string;
  }) => {
    const botToken = parseTelegramBotToken(params.credentials);

    if (!botToken) {
      throw new Error("Telegram connection is missing a bot token.");
    }

    const messageParts = Array.isArray(params.message) ? params.message : [params.message];
    const splitDelayMs = readMessageBehaviorConfig(params.channelConfig).splitMessageDelaySeconds * 1000;
    const deliveries = [];

    for (let index = 0; index < messageParts.length; index += 1) {
      const part = messageParts[index];

      try {
        if (index > 0 && splitDelayMs > 0) {
          await wait(splitDelayMs);
        }

        const payload = await sendTelegramMessage({
          botToken,
          contactId: params.contactId,
          text: part,
          replyToMessageId: index === 0 ? params.replyToMessageId : undefined,
          replyMarkup:
            params.replyMarkup && index === messageParts.length - 1
              ? params.replyMarkup
              : undefined,
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
