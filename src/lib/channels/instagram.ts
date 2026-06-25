import {
  readMessageBehaviorConfig,
  splitOutgoingMessage,
} from "@/lib/channels/message-behavior";
import type {
  InstagramDeliveryPlan,
  InstagramDeliveryPart,
} from "@/lib/agents/wedding-sales-simple/delivery-plan";
import type { WeddingSalesSimpleDeliveryExecution } from "@/lib/agents/wedding-sales-simple/contracts";

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
  businessReplyKind?: "manual" | "system_echo";
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

const INSTAGRAM_SEMANTIC_DELIVERY_MAX_TOTAL_DELAY_MS = 6_000;

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

async function sendInstagramSenderAction(args: {
  credentials: InstagramCredentials;
  contactId: string;
  action: Extract<InstagramDeliveryPart, { kind: "sender_action" }>["action"];
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
        sender_action: args.action,
      }),
    },
  );
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMessage =
      payload && typeof payload === "object" && "error" in payload
        ? JSON.stringify(payload.error)
        : `Meta sender action failed with ${response.status}.`;

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

function readSemanticDeliveryPlan(value: unknown): InstagramDeliveryPlan | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const plan = value as InstagramDeliveryPlan;

  if (
    plan.channel !== "instagram" ||
    plan.mode !== "semantic_split" ||
    plan.enabled !== true ||
    !Array.isArray(plan.parts)
  ) {
    return null;
  }

  return plan;
}

async function executeInstagramDeliveryPlan(args: {
  credentials: InstagramCredentials;
  contactId: string;
  plan: InstagramDeliveryPlan;
}) {
  const deliveries = [];
  const warnings: string[] = [];
  const plannedTotalDelayMs = args.plan.totalDelayMs;
  const delayScale =
    plannedTotalDelayMs > INSTAGRAM_SEMANTIC_DELIVERY_MAX_TOTAL_DELAY_MS
      ? INSTAGRAM_SEMANTIC_DELIVERY_MAX_TOTAL_DELAY_MS / plannedTotalDelayMs
      : 1;
  let appliedTotalDelayMs = 0;
  let partsSent = 0;
  let senderActionsAttempted = 0;
  let senderActionsFailed = 0;

  const scaledWait = async (delayMs: number) => {
    const scaledDelayMs = Math.max(0, Math.round(delayMs * delayScale));

    if (scaledDelayMs > 0) {
      appliedTotalDelayMs += scaledDelayMs;
      await wait(scaledDelayMs);
    }
  };

  for (const part of args.plan.parts) {
    if (part.kind === "sender_action") {
      senderActionsAttempted += 1;
      await scaledWait(part.delayMsBefore);

      try {
        await sendInstagramSenderAction({
          credentials: args.credentials,
          contactId: args.contactId,
          action: part.action,
        });
      } catch (error) {
        senderActionsFailed += 1;
        warnings.push(error instanceof Error ? error.message : "instagram_sender_action_failed");
      }

      continue;
    }

    if (part.kind === "text") {
      await scaledWait(part.delayMsBefore);

      try {
        senderActionsAttempted += 1;
        await sendInstagramSenderAction({
          credentials: args.credentials,
          contactId: args.contactId,
          action: "typing_on",
        });
      } catch (error) {
        senderActionsFailed += 1;
        warnings.push(error instanceof Error ? error.message : "instagram_typing_action_failed");
      }

      await scaledWait(part.typingMsBefore);

      const payload = await sendInstagramMessage({
        credentials: args.credentials,
        contactId: args.contactId,
        message: {
          text: part.text,
        },
      });
      deliveries.push(payload);
      partsSent += 1;
      continue;
    }

    await scaledWait(part.delayMsBefore);

    if (part.attachment.type !== "image") {
      warnings.push(`unsupported_instagram_attachment:${part.attachment.type}`);
      continue;
    }

    const payload = await sendInstagramMessage({
      credentials: args.credentials,
      contactId: args.contactId,
      message: {
        attachment: {
          type: "image",
          payload: {
            url: part.attachment.url,
          },
        },
      },
    });
    deliveries.push(payload);
    partsSent += 1;
  }

  const deliveryExecution: WeddingSalesSimpleDeliveryExecution = {
    enabled: true,
    executed: true,
    partsAttempted: args.plan.parts.length,
    partsSent,
    senderActionsAttempted,
    senderActionsFailed,
    fallbackToCanonical: false,
    plannedTotalDelayMs,
    appliedTotalDelayMs,
    maxTotalDelayMs: INSTAGRAM_SEMANTIC_DELIVERY_MAX_TOTAL_DELAY_MS,
    ...(warnings.length > 0 ? { warnings } : {}),
  };

  return {
    ok: true,
    mode: "instagram_semantic_delivery_plan",
    deliveries,
    deliveryExecution,
  };
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
      businessReplyKind: isBusinessManualReply
        ? payload.businessReplyKind === "system_echo"
          ? "system_echo"
          : "manual"
        : undefined,
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
    channelDeliveryPlan?: unknown;
  }) => {
    const credentials = parseInstagramCredentials(params.credentials);

    if (!credentials.pageAccessToken) {
      throw new Error("Instagram connection is missing an access token.");
    }

    const semanticPlan = readSemanticDeliveryPlan(params.channelDeliveryPlan);

    if (
      semanticPlan &&
      process.env.DISABLE_INSTAGRAM_SEMANTIC_DELIVERY_PLAN !== "true"
    ) {
      return executeInstagramDeliveryPlan({
        credentials,
        contactId: params.contactId,
        plan: semanticPlan,
      });
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
