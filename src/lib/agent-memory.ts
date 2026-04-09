import { ChannelType, MessageRole, Prisma } from "@prisma/client";

import { db } from "@/lib/db";

export type RuntimeHistoryMessage = {
  id: string;
  role: MessageRole;
  content: string;
  toolName?: string | null;
  toolInput?: Prisma.JsonValue | null;
  toolResult?: Prisma.JsonValue | null;
  createdAt: Date;
};

type PersistedRuntimeMessage = {
  role: MessageRole | `${MessageRole}`;
  content: string;
  toolName?: string | null;
  toolInput?: Prisma.JsonValue | null;
  toolResult?: Prisma.JsonValue | null;
  durationMs?: number | null;
  model?: string | null;
};

function normalizeRole(role: PersistedRuntimeMessage["role"]) {
  switch (role) {
    case MessageRole.USER:
    case "USER":
      return MessageRole.USER;
    case MessageRole.ASSISTANT:
    case "ASSISTANT":
      return MessageRole.ASSISTANT;
    case MessageRole.TOOL:
    case "TOOL":
      return MessageRole.TOOL;
    default:
      throw new Error(`Unsupported message role: ${String(role)}`);
  }
}

export async function ensureConversation(args: {
  agentId: string;
  contactId: string;
  channel: ChannelType;
}) {
  const existing = await db.conversation.findUnique({
    where: {
      agentId_contactId: {
        agentId: args.agentId,
        contactId: args.contactId,
      },
    },
  });

  if (existing) {
    return existing;
  }

  return db.conversation.create({
    data: {
      agentId: args.agentId,
      contactId: args.contactId,
      channel: args.channel,
    },
  });
}

export async function loadConversationHistory(agentId: string, contactId: string) {
  const conversation = await db.conversation.findUnique({
    where: {
      agentId_contactId: {
        agentId,
        contactId,
      },
    },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  return {
    conversationId: conversation?.id ?? null,
    messages:
      conversation?.messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        toolName: message.toolName,
        toolInput: message.toolInput,
        toolResult: message.toolResult,
        createdAt: message.createdAt,
      })) ?? [],
  };
}

export async function saveMessages(
  conversationId: string,
  messages: PersistedRuntimeMessage[],
) {
  for (const message of messages) {
    await db.message.create({
      data: {
        conversationId,
        role: normalizeRole(message.role),
        content: message.content,
        toolName: message.toolName ?? undefined,
        toolInput: message.toolInput ?? undefined,
        toolResult: message.toolResult ?? undefined,
        durationMs: message.durationMs ?? undefined,
        model: message.model ?? undefined,
      },
    });
  }
}
