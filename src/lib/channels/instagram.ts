import { splitOutgoingMessage } from "@/lib/channels/message-behavior";

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
  sendReply: async (params: unknown) => {
    return {
      ok: true,
      mode: "meta_send_pending",
      params,
    };
  },
};
