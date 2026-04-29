import { ConversationStatus, DelayedDeliveryKind, DelayedDeliveryStatus, MessageRole } from "@prisma/client";

import { ControlConfig } from "@/lib/agent-config";
import { db } from "@/lib/db";

export const BUSINESS_MANUAL_MESSAGE_TOOL_NAME = "business_manual_message";
const LEGACY_OPERATOR_MESSAGE_TOOL_NAME = "operator_message";

type ConversationMessage = {
  role: MessageRole | `${MessageRole}`;
  toolName?: string | null;
  content: string;
  toolInput?: unknown;
};

type BusinessReplyContext = {
  contactId: string;
  messageId?: string;
  gmailMessageId?: string;
  threadId?: string;
  subject?: string;
};

export function isBusinessManualMessage(message: ConversationMessage) {
  return (
    message.role === MessageRole.TOOL &&
    (message.toolName === BUSINESS_MANUAL_MESSAGE_TOOL_NAME ||
      message.toolName === LEGACY_OPERATOR_MESSAGE_TOOL_NAME)
  );
}

export function containsBusinessExceptionPhrase(message: string, phrases: string[]) {
  const normalizedMessage = message.toLowerCase();

  return phrases.some((phrase) => {
    const normalizedPhrase = phrase.trim().toLowerCase();
    return normalizedPhrase.length > 0 && normalizedMessage.includes(normalizedPhrase);
  });
}

function readStringField(value: unknown, field: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const raw = (value as Record<string, unknown>)[field];
  return typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
}

export function getLatestCustomerReplyContext(
  messages: ConversationMessage[],
  fallbackContactId: string,
): BusinessReplyContext {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message) {
      continue;
    }

    if (message.role !== MessageRole.USER) {
      continue;
    }

    return {
      contactId: fallbackContactId,
      messageId: readStringField(message.toolInput, "messageId"),
      gmailMessageId: readStringField(message.toolInput, "gmailMessageId"),
      threadId: readStringField(message.toolInput, "threadId"),
      subject: readStringField(message.toolInput, "subject"),
    };
  }

  return { contactId: fallbackContactId };
}

export function shouldPauseAfterBusinessManualMessage(args: {
  control: ControlConfig;
  message: string;
  priorBusinessManualMessageCount: number;
}) {
  if (!args.control.pauseOnBusinessIntervention) {
    return false;
  }

  if (containsBusinessExceptionPhrase(args.message, args.control.businessExceptionPhrases)) {
    return false;
  }

  if (args.control.ignoreFirstBusinessMessage && args.priorBusinessManualMessageCount === 0) {
    return false;
  }

  return true;
}

export function getAutoResumeDueAt(control: ControlConfig, now = new Date()) {
  const amount = Math.max(1, Math.floor(control.autoResumeAfterValue));
  const unitMs =
    control.autoResumeAfterUnit === "days"
      ? 24 * 60 * 60 * 1000
      : control.autoResumeAfterUnit === "hours"
        ? 60 * 60 * 1000
        : 60 * 1000;

  return new Date(now.getTime() + amount * unitMs);
}

export async function scheduleBusinessAutoResumeWithDb(args: {
  database: typeof db;
  agentId: string;
  conversationId: string;
  control: ControlConfig;
  replyContext?: BusinessReplyContext;
  now?: Date;
}) {
  if (!args.control.autoResumeEnabled) {
    return null;
  }

  await args.database.delayedDelivery.updateMany({
    where: {
      conversationId: args.conversationId,
      kind: DelayedDeliveryKind.FOLLOW_UP,
      status: {
        in: [DelayedDeliveryStatus.PENDING, DelayedDeliveryStatus.PROCESSING],
      },
      OR: [
        {
          payload: {
            path: ["kind"],
            equals: "business_auto_resume",
          },
        },
        {
          payload: {
            path: ["kind"],
            equals: "operator_auto_resume",
          },
        },
      ],
    },
    data: {
      status: DelayedDeliveryStatus.CANCELED,
      canceledAt: args.now ?? new Date(),
      error: "business_auto_resume_replaced",
    },
  });

  return args.database.delayedDelivery.create({
    data: {
      agentId: args.agentId,
      conversationId: args.conversationId,
      kind: DelayedDeliveryKind.FOLLOW_UP,
      dueAt: getAutoResumeDueAt(args.control, args.now),
      payload: {
        kind: "business_auto_resume",
        replyContext: args.replyContext,
        resumeMessage:
          args.control.resumeMessageEnabled && args.control.resumeMessage?.trim()
            ? args.control.resumeMessage.trim()
            : null,
      },
    },
  });
}

export async function pauseConversationForBusinessHandoffWithDb(args: {
  database: typeof db;
  conversationId: string;
  agentId: string;
  control: ControlConfig;
  replyContext?: BusinessReplyContext;
  now?: Date;
}) {
  await args.database.conversation.update({
    where: { id: args.conversationId },
    data: {
      status: ConversationStatus.ESCALATED,
    },
  });

  await args.database.delayedDelivery.updateMany({
    where: {
      conversationId: args.conversationId,
      status: {
        in: [DelayedDeliveryStatus.PENDING, DelayedDeliveryStatus.PROCESSING],
      },
      kind: {
        in: [DelayedDeliveryKind.BUFFERED_REPLY, DelayedDeliveryKind.FOLLOW_UP],
      },
    },
    data: {
      status: DelayedDeliveryStatus.CANCELED,
      canceledAt: args.now ?? new Date(),
      error: "business_handoff_pause",
    },
  });

  await scheduleBusinessAutoResumeWithDb({
    database: args.database,
    agentId: args.agentId,
    conversationId: args.conversationId,
    control: args.control,
    replyContext: args.replyContext,
    now: args.now,
  });
}
