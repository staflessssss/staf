type TelegramMessagePayload = {
  message?: {
    message_id?: number;
    text?: string;
    caption?: string;
    chat?: {
      id?: number | string;
    };
  };
  edited_message?: {
    message_id?: number;
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
    };
  },
  formatReply: (text: string, config?: unknown) => {
    void config;

    return text.trim();
  },
  sendReply: async (params: {
    credentials: string;
    contactId: string;
    message: string;
    channelConfig?: unknown;
  }) => {
    const botToken = parseTelegramBotToken(params.credentials);

    if (!botToken) {
      throw new Error("Telegram connection is missing a bot token.");
    }

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: params.contactId,
        text: params.message,
      }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(`Telegram send failed with ${response.status}.`);
    }

    return payload;
  },
};
