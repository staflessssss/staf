import { MessageRole, type PrismaClient } from "@prisma/client";

export const INSTAGRAM_OUTBOUND_DELIVERY_TOOL_NAME = "instagram_outbound_delivery";

type MessageDatabase = Pick<PrismaClient, "message">;

function readMessageId(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "";
  }

  const record = value as Record<string, unknown>;
  return String(record.message_id ?? record.messageId ?? "").trim();
}

export function extractInstagramDeliveryMessageIds(delivery: unknown) {
  if (Array.isArray(delivery)) {
    return [...new Set(delivery.map(readMessageId).filter(Boolean))];
  }

  if (delivery && typeof delivery === "object" && !Array.isArray(delivery)) {
    const record = delivery as Record<string, unknown>;
    const deliveries = Array.isArray(record.deliveries) ? record.deliveries : [];
    const ids = [readMessageId(record), ...deliveries.map(readMessageId)].filter(Boolean);

    return [...new Set(ids)];
  }

  return [];
}

export async function recordInstagramOutboundDeliveries(args: {
  database: MessageDatabase;
  conversationId: string;
  delivery: unknown;
}) {
  const messageIds = extractInstagramDeliveryMessageIds(args.delivery);

  if (messageIds.length === 0) {
    return;
  }

  await args.database.message.createMany({
    data: messageIds.map((messageId) => ({
      conversationId: args.conversationId,
      role: MessageRole.TOOL,
      toolName: INSTAGRAM_OUTBOUND_DELIVERY_TOOL_NAME,
      content: messageId,
      toolInput: {
        messageId,
      },
    })),
  });
}
