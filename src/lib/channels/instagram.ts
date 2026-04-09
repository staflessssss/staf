type InstagramMessagingEvent = {
  sender?: { id?: string };
  recipient?: { id?: string };
  message?: {
    text?: string;
    mid?: string;
  };
};

type InstagramPayload = {
  entry?: Array<{
    messaging?: InstagramMessagingEvent[];
  }>;
};

export const instagramAdapter = {
  parseIncoming: (payload: InstagramPayload) => {
    const event = payload.entry?.flatMap((entry) => entry.messaging ?? [])[0];

    return {
      contactId: String(event?.sender?.id ?? ""),
      message: String(event?.message?.text ?? ""),
      messageId: String(event?.message?.mid ?? ""),
    };
  },
  formatReply: (text: string, config?: unknown) => {
    void config;

    return text
      .split(/\n{2,}/)
      .map((part) => part.trim())
      .filter(Boolean);
  },
  sendReply: async (params: unknown) => {
    return {
      ok: true,
      mode: "meta_send_pending",
      params,
    };
  },
};
