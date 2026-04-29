import { ChannelType, ConversationStatus, DelayedDeliveryKind, DelayedDeliveryStatus, MessageRole } from "@prisma/client";

import { ControlConfig } from "@/lib/agent-config";
import { getChannelAdapter } from "@/lib/channels";
import { decrypt } from "@/lib/crypto";
import { db } from "@/lib/db";

export const OPERATOR_MESSAGE_TOOL_NAME = "operator_message";

type OperatorChannelAdapter = {
  formatReply: (text: string, config?: unknown) => unknown;
  sendReply: (params: {
    credentials: string;
    contactId: string;
    message: string | string[] | { text: string; html?: string };
    messageId?: string;
    threadId?: string;
    subject?: string;
    channelConfig?: unknown;
  }) => Promise<unknown>;
};

type OperatorMessage = {
  role: MessageRole | `${MessageRole}`;
  toolName?: string | null;
  content: string;
  toolInput?: unknown;
};

type OperatorReplyContext = {
  contactId: string;
  messageId?: string;
  gmailMessageId?: string;
  threadId?: string;
  subject?: string;
};

export function isOperatorMessage(message: OperatorMessage) {
  return message.role === MessageRole.TOOL && message.toolName === OPERATOR_MESSAGE_TOOL_NAME;
}

export function containsOperatorExceptionPhrase(message: string, phrases: string[]) {
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
  messages: OperatorMessage[],
  fallbackContactId: string,
): OperatorReplyContext {
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

export function shouldPauseAfterOperatorMessage(args: {
  control: ControlConfig;
  message: string;
  priorOperatorMessageCount: number;
}) {
  if (!args.control.pauseOnOperatorIntervention) {
    return false;
  }

  if (containsOperatorExceptionPhrase(args.message, args.control.operatorExceptionPhrases)) {
    return false;
  }

  if (args.control.ignoreFirstOperatorMessage && args.priorOperatorMessageCount === 0) {
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

export async function scheduleOperatorAutoResumeWithDb(args: {
  database: typeof db;
  agentId: string;
  conversationId: string;
  control: ControlConfig;
  replyContext?: OperatorReplyContext;
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
      payload: {
        path: ["kind"],
        equals: "operator_auto_resume",
      },
    },
    data: {
      status: DelayedDeliveryStatus.CANCELED,
      canceledAt: args.now ?? new Date(),
      error: "operator_auto_resume_replaced",
    },
  });

  return args.database.delayedDelivery.create({
    data: {
      agentId: args.agentId,
      conversationId: args.conversationId,
      kind: DelayedDeliveryKind.FOLLOW_UP,
      dueAt: getAutoResumeDueAt(args.control, args.now),
      payload: {
        kind: "operator_auto_resume",
        replyContext: args.replyContext,
        resumeMessage:
          args.control.resumeMessageEnabled && args.control.resumeMessage?.trim()
            ? args.control.resumeMessage.trim()
            : null,
      },
    },
  });
}

export async function sendOperatorReplyThroughChannel(args: {
  channel: { type: ChannelType; credentialsEnc: string };
  contactId: string;
  message: string;
  channelConfig: unknown;
  messageId?: string;
  threadId?: string;
  subject?: string;
}) {
  const adapter = getChannelAdapter(args.channel.type) as OperatorChannelAdapter;
  const formattedReply = adapter.formatReply(args.message, args.channelConfig);

  return adapter.sendReply({
    credentials:
      args.channel.type === ChannelType.GMAIL
        ? args.channel.credentialsEnc
        : decrypt(args.channel.credentialsEnc),
    contactId: args.contactId,
    message: formattedReply as string | string[] | { text: string; html?: string },
    messageId: args.messageId,
    threadId: args.threadId,
    subject: args.subject,
    channelConfig: args.channelConfig,
  });
}

export async function pauseConversationForOperatorWithDb(args: {
  database: typeof db;
  conversationId: string;
  agentId: string;
  control: ControlConfig;
  replyContext?: OperatorReplyContext;
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
      error: "operator_handoff_pause",
    },
  });

  await scheduleOperatorAutoResumeWithDb({
    database: args.database,
    agentId: args.agentId,
    conversationId: args.conversationId,
    control: args.control,
    replyContext: args.replyContext,
    now: args.now,
  });
}
