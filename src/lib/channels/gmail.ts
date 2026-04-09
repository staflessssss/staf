type GmailIncomingPayload =
  | {
      from?: string;
      contactId?: string;
      text?: string;
      message?: string;
      body?: string;
      messageId?: string;
      threadId?: string;
    }
  | Record<string, unknown>;

export const gmailAdapter = {
  parseIncoming: (payload: GmailIncomingPayload) => {
    return {
      contactId: String(payload.contactId ?? payload.from ?? ""),
      message: String(payload.text ?? payload.message ?? payload.body ?? ""),
      messageId: String(payload.messageId ?? payload.threadId ?? ""),
    };
  },
  formatReply: (text: string, config?: unknown) => {
    void config;

    return text.trim();
  },
  sendReply: async (params: unknown) => {
    return {
      ok: true,
      mode: "relay_pending",
      params,
    };
  },
};
