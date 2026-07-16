import { MessageRole } from "@prisma/client";

import { isBusinessManualMessage } from "@/lib/business-handoff";
import type { ConversationMemory } from "@/lib/conversation-memory";

export type ConversationContextMessage = {
  role: MessageRole;
  content: string;
  toolName?: string | null;
  toolResult?: unknown;
  durationMs?: number;
  createdAt?: Date;
  model?: string | null;
};

export function renderConversationHistory(messages: ConversationContextMessage[]) {
  if (messages.length === 0) {
    return "No prior conversation history.";
  }

  return messages
    .map((message) => {
      if (isBusinessManualMessage(message)) {
        return `business: ${message.content}`;
      }

      if (message.role === MessageRole.TOOL) {
        return `tool ${message.toolName ?? "tool"}: ${message.content}`;
      }

      return `${message.role.toLowerCase()}: ${message.content}`;
    })
    .join("\n");
}

export function renderConversationMemoryContext(memory: ConversationMemory) {
  const entries = Object.entries(memory).filter(([, value]) => value !== undefined);
  if (entries.length === 0) {
    return "No persisted CRM facts are available for this conversation.";
  }

  return [
    "Persisted CRM facts for this conversation:",
    ...entries.map(([key, value]) => `- ${key}: ${String(value)}`),
    "Use these stable customer facts as conversation context and do not ask the customer to repeat them.",
    "Current tool results remain the source of truth for wedding availability, calendar availability, delivery, and completed booking actions.",
  ].join("\n");
}
