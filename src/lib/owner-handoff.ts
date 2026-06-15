import {
  ChannelType,
  ConnectionStatus,
  ConversationStatus,
  DelayedDeliveryKind,
  DelayedDeliveryStatus,
  MessageRole,
  Prisma,
} from "@prisma/client";

import { getChannelAdapter } from "@/lib/channels";
import { type TelegramReplyMarkup, telegramAdapter } from "@/lib/channels/telegram";
import { decrypt } from "@/lib/crypto";
import { db } from "@/lib/db";
import { BUSINESS_MANUAL_MESSAGE_TOOL_NAME } from "@/lib/business-handoff";
import { recordInstagramOutboundDeliveries } from "@/lib/instagram-outbound";

export const OWNER_HANDOFF_REQUEST_TOOL_NAME = "owner_handoff_request";
export const OWNER_HANDOFF_RESPONSE_TOOL_NAME = "owner_handoff_response";
const OWNER_HANDOFF_CALLBACK_PREFIX = "oh";

type HandoffAgent = {
  id: string;
  tenantId: string;
  channel: {
    type: ChannelType;
    credentialsEnc: string;
  };
};

type ReplyContext = {
  contactId: string;
  messageId?: string;
  gmailMessageId?: string;
  threadId?: string;
  subject?: string;
};

type HandoffChannelAdapter = {
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

type OwnerTelegramResponse = {
  message: string;
  replyMarkup?: TelegramReplyMarkup;
};

const OPERATIONAL_HANDOFF_PATTERNS = [
  /\b(contract|signed|deposit|payment|paid|invoice|refund|balance|extra hour|additional hour)\b/i,
  /\b(already booked|existing client|wedding already happened|after the wedding|day of the wedding)\b/i,
  /\b(did they|were they able|can you confirm|do you know if|has it been)\b/i,
  /\b(?:send|email|share|upload|provide)\b[\s\S]{0,80}\b(?:coi|certificate|insurance)\b/i,
  /\b(?:coi|certificate|insurance)\b[\s\S]{0,80}\b(?:to|for)\b[\s\S]{0,60}\b(?:venue|planner|coordinator)\b/i,
  /\b(?:planner|coordinator|venue|vendor|parent|parents|operator|videographer|photographer)\b[\s\S]{0,100}\b(?:asked|needs?|requested|paid|confirmed|question|dietary|meal|timeline)\b/i,
  /\b(?:gallery|film|teaser|raw footage|deliverable)\b[\s\S]{0,80}\b(?:missing|late|ready|sent|delivered|download|access)\b/i,
];

function readRecord(value: Prisma.JsonValue | null | undefined) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, Prisma.JsonValue>)
    : {};
}

export function readOwnerHandoffConfig(metadata: Prisma.JsonValue | null | undefined) {
  const record = readRecord(metadata);
  const raw = record.ownerHandoff;
  const ownerHandoff =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, Prisma.JsonValue>)
      : {};

  return {
    enabled: ownerHandoff.enabled === true,
    ownerChatId:
      typeof ownerHandoff.ownerChatId === "string" && ownerHandoff.ownerChatId.trim()
        ? ownerHandoff.ownerChatId.trim()
        : "",
    startToken:
      typeof ownerHandoff.startToken === "string" && ownerHandoff.startToken.trim()
        ? ownerHandoff.startToken.trim()
        : "",
  };
}

export function readOwnerHandoffChatId(metadata: Prisma.JsonValue | null | undefined) {
  return readOwnerHandoffConfig(metadata).ownerChatId;
}

async function assertLinkedOwnerTelegramChat(args: {
  tenantId: string;
  ownerChatId: string;
}) {
  const channel = await db.channelConnection.findUnique({
    where: {
      tenantId_type: {
        tenantId: args.tenantId,
        type: ChannelType.TELEGRAM,
      },
    },
    select: { metadata: true },
  });

  const linkedOwnerChatId = readOwnerHandoffChatId(channel?.metadata);

  if (!linkedOwnerChatId || linkedOwnerChatId !== args.ownerChatId) {
    throw new Error("Telegram command does not belong to the linked owner chat.");
  }
}

function readStringField(value: unknown, field: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const raw = (value as Record<string, unknown>)[field];
  return typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
}

function buildLatestReplyContext(args: {
  conversation: {
    contactId: string;
    messages: Array<{
      role: MessageRole;
      toolInput: Prisma.JsonValue | null;
    }>;
  };
}): ReplyContext {
  for (let index = args.conversation.messages.length - 1; index >= 0; index -= 1) {
    const message = args.conversation.messages[index];

    if (!message || message.role !== MessageRole.USER) {
      continue;
    }

    return {
      contactId: args.conversation.contactId,
      messageId: readStringField(message.toolInput, "messageId"),
      gmailMessageId: readStringField(message.toolInput, "gmailMessageId"),
      threadId: readStringField(message.toolInput, "threadId"),
      subject: readStringField(message.toolInput, "subject"),
    };
  }

  return { contactId: args.conversation.contactId };
}

export function shouldRequestOwnerHandoff(message: string) {
  const normalized = message.trim();

  if (!normalized) {
    return null;
  }

  const matched = OPERATIONAL_HANDOFF_PATTERNS.find((pattern) => pattern.test(normalized));

  if (!matched) {
    return null;
  }

  return {
    reason: "operational_or_existing_client_question",
  };
}

export async function hasConnectedOwnerTelegram(tenantId: string, database: typeof db = db) {
  const channel = await database.channelConnection.findUnique({
    where: {
      tenantId_type: {
        tenantId,
        type: ChannelType.TELEGRAM,
      },
    },
    select: {
      status: true,
      metadata: true,
    },
  });

  if (channel?.status !== ConnectionStatus.CONNECTED) {
    return false;
  }

  return readOwnerHandoffConfig(channel.metadata).enabled;
}

function formatOwnerHandoffMessage(args: {
  conversationId: string;
  channel: ChannelType;
  contactLabel: string;
  agentName?: string;
  customerMessage: string;
  reason: string;
}) {
  return [
    "Behalfy needs your help",
    "",
    `Conversation: ${args.conversationId}`,
    `Channel: ${args.channel}`,
    args.agentName ? `Agent: ${args.agentName}` : null,
    `Customer: ${args.contactLabel}`,
    `Reason: ${args.reason}`,
    "",
    "Customer wrote:",
    args.customerMessage,
    "",
    "Fast reply:",
    "Tap Reply on this Telegram message and type the exact answer to send to the customer.",
    "",
    "Commands:",
    `/send ${args.conversationId} <exact message to customer>`,
    `/takeover ${args.conversationId}`,
    `/resume ${args.conversationId}`,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

function buildOwnerHandoffReplyMarkup(conversationId: string): TelegramReplyMarkup {
  return {
    inline_keyboard: [
      [
        {
          text: "Reply",
          callback_data: `${OWNER_HANDOFF_CALLBACK_PREFIX}:reply:${conversationId}`,
        },
        {
          text: "Take over",
          callback_data: `${OWNER_HANDOFF_CALLBACK_PREFIX}:takeover:${conversationId}`,
        },
      ],
    ],
  };
}

function buildOwnerResumeReplyMarkup(conversationId: string): TelegramReplyMarkup {
  return {
    inline_keyboard: [
      [
        {
          text: "Resume agent",
          callback_data: `${OWNER_HANDOFF_CALLBACK_PREFIX}:resume:${conversationId}`,
        },
      ],
    ],
  };
}

function parseOwnerHandoffCallback(data: string) {
  const [prefix, action, ...conversationParts] = data.split(":");
  const conversationId = conversationParts.join(":").trim();

  if (
    prefix !== OWNER_HANDOFF_CALLBACK_PREFIX ||
    !["reply", "takeover", "resume"].includes(action ?? "") ||
    !conversationId
  ) {
    return null;
  }

  return {
    action: action as "reply" | "takeover" | "resume",
    conversationId,
  };
}

function extractTelegramDeliveryMessageId(delivery: unknown) {
  if (!delivery || typeof delivery !== "object" || Array.isArray(delivery)) {
    return "";
  }

  const result = (delivery as Record<string, unknown>).result;
  const messageId =
    result && typeof result === "object" && !Array.isArray(result)
      ? (result as Record<string, unknown>).message_id
      : (delivery as Record<string, unknown>).message_id;

  return typeof messageId === "number" || typeof messageId === "string"
    ? String(messageId)
    : "";
}

export const ownerHandoffTestHelpers = {
  extractTelegramDeliveryMessageId,
};

export async function requestOwnerHandoffWithDb(args: {
  database: typeof db;
  agent: HandoffAgent & { name?: string | null };
  conversationId: string;
  customerMessage: string;
  reason: string;
}) {
  const ownerTelegram = await args.database.channelConnection.findUnique({
    where: {
      tenantId_type: {
        tenantId: args.agent.tenantId,
        type: ChannelType.TELEGRAM,
      },
    },
  });

  if (ownerTelegram?.status !== ConnectionStatus.CONNECTED) {
    return {
      status: "owner_handoff_skipped_no_telegram" as const,
    };
  }

  const ownerConfig = readOwnerHandoffConfig(ownerTelegram.metadata);

  if (!ownerConfig.enabled || !ownerConfig.ownerChatId) {
    return {
      status: ownerConfig.enabled
        ? ("owner_handoff_skipped_missing_owner_chat" as const)
        : ("owner_handoff_skipped_disabled" as const),
    };
  }

  const conversation = await args.database.conversation.findUnique({
    where: { id: args.conversationId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!conversation) {
    return {
      status: "owner_handoff_skipped_missing_conversation" as const,
    };
  }

  const contactLabel =
    conversation.contactUsername ||
    conversation.contactDisplayName ||
    conversation.contactId;
  const replyContext = buildLatestReplyContext({ conversation });
  const message = formatOwnerHandoffMessage({
    conversationId: conversation.id,
    channel: conversation.channel,
    contactLabel,
    agentName: args.agent.name ?? undefined,
    customerMessage: args.customerMessage,
    reason: args.reason,
  });
  let requestMessageId = "";

  await args.database.$transaction(async (tx) => {
    await tx.conversation.update({
      where: { id: conversation.id },
      data: { status: ConversationStatus.ESCALATED },
    });
    await tx.delayedDelivery.updateMany({
      where: {
        conversationId: conversation.id,
        status: {
          in: [DelayedDeliveryStatus.PENDING, DelayedDeliveryStatus.PROCESSING],
        },
        kind: {
          in: [DelayedDeliveryKind.BUFFERED_REPLY, DelayedDeliveryKind.FOLLOW_UP],
        },
      },
      data: {
        status: DelayedDeliveryStatus.CANCELED,
        canceledAt: new Date(),
        error: "owner_handoff_requested",
      },
    });
    const requestMessage = await tx.message.create({
      data: {
        conversationId: conversation.id,
        role: MessageRole.TOOL,
        toolName: OWNER_HANDOFF_REQUEST_TOOL_NAME,
        content: args.customerMessage,
        toolInput: {
          reason: args.reason,
          status: "pending",
          replyContext,
        },
        toolResult: {
          status: "sent_to_owner",
          ownerChatId: ownerConfig.ownerChatId,
        },
      },
    });
    requestMessageId = requestMessage.id;
  });

  const delivery = await telegramAdapter.sendReply({
    credentials: decrypt(ownerTelegram.credentialsEnc),
    contactId: ownerConfig.ownerChatId,
    message,
    replyMarkup: buildOwnerHandoffReplyMarkup(conversation.id),
  });
  const telegramMessageId = extractTelegramDeliveryMessageId(delivery);

  if (requestMessageId && telegramMessageId) {
    await args.database.message.update({
      where: { id: requestMessageId },
      data: {
        toolResult: {
          status: "sent_to_owner",
          ownerChatId: ownerConfig.ownerChatId,
          telegramMessageId,
        },
      },
    });
  }

  return {
    status: "owner_handoff_requested" as const,
  };
}

async function sendReplyThroughConversationChannel(args: {
  tenantId: string;
  conversationId: string;
  text: string;
}) {
  const conversation = await db.conversation.findUnique({
    where: { id: args.conversationId },
    include: {
      agent: {
        include: {
          channel: true,
        },
      },
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!conversation) {
    throw new Error("Conversation not found.");
  }

  if (conversation.agent.tenantId !== args.tenantId) {
    throw new Error("Conversation does not belong to this tenant.");
  }

  const replyContext = buildLatestReplyContext({ conversation });
  const adapter = getChannelAdapter(conversation.agent.channel.type) as HandoffChannelAdapter;
  const formattedReply = adapter.formatReply(args.text, conversation.agent.channelConfig);

  const delivery = await adapter.sendReply({
    credentials:
      conversation.agent.channel.type === ChannelType.GMAIL
        ? conversation.agent.channel.credentialsEnc
        : decrypt(conversation.agent.channel.credentialsEnc),
    contactId: conversation.contactId,
    message: formattedReply as string | string[] | { text: string; html?: string },
    messageId: replyContext.messageId,
    threadId: replyContext.threadId,
    subject: replyContext.subject,
    channelConfig: conversation.agent.channelConfig,
  });

  if (conversation.agent.channel.type === ChannelType.INSTAGRAM) {
    await recordInstagramOutboundDeliveries({
      database: db,
      conversationId: conversation.id,
      delivery,
    });
  }

  await db.message.createMany({
    data: [
      {
        conversationId: conversation.id,
        role: MessageRole.TOOL,
        toolName: OWNER_HANDOFF_RESPONSE_TOOL_NAME,
        content: args.text,
        toolInput: {
          status: "sent",
          source: "telegram_owner",
        },
      },
      {
        conversationId: conversation.id,
        role: MessageRole.TOOL,
        toolName: BUSINESS_MANUAL_MESSAGE_TOOL_NAME,
        content: args.text,
        toolInput: replyContext,
      },
    ],
  });

  return conversation;
}

export async function handleOwnerTelegramReply(args: {
  tenantId: string;
  ownerChatId: string;
  replyToMessageId: string;
  text: string;
}): Promise<OwnerTelegramResponse | null> {
  const text = args.text.trim();

  if (!text || text.startsWith("/")) {
    return null;
  }

  const requestMessage = await db.message.findFirst({
    where: {
      role: MessageRole.TOOL,
      toolName: OWNER_HANDOFF_REQUEST_TOOL_NAME,
      toolResult: {
        path: ["telegramMessageId"],
        equals: args.replyToMessageId,
      },
      conversation: {
        agent: {
          tenantId: args.tenantId,
        },
      },
    },
    select: {
      conversationId: true,
      toolResult: true,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!requestMessage) {
    return null;
  }

  const toolResult = readRecord(requestMessage.toolResult);
  const ownerChatId =
    typeof toolResult.ownerChatId === "string" && toolResult.ownerChatId.trim()
      ? toolResult.ownerChatId.trim()
      : "";

  if (ownerChatId && ownerChatId !== args.ownerChatId) {
    throw new Error("Telegram reply does not belong to the linked owner chat.");
  }

  const conversation = await sendReplyThroughConversationChannel({
    tenantId: args.tenantId,
    conversationId: requestMessage.conversationId,
    text,
  });

  return {
    message: `Sent to customer. Conversation ${conversation.id} remains paused.`,
    replyMarkup: buildOwnerResumeReplyMarkup(conversation.id),
  };
}

export async function handleOwnerTelegramCommand(args: {
  tenantId: string;
  ownerChatId: string;
  text: string;
}): Promise<OwnerTelegramResponse> {
  await assertLinkedOwnerTelegramChat(args);

  const text = args.text.trim();
  const sendMatch = text.match(/^\/send\s+(\S+)\s+([\s\S]+)$/i);
  const takeoverMatch = text.match(/^\/takeover\s+(\S+)$/i);
  const resumeMatch = text.match(/^\/resume\s+(\S+)$/i);

  if (sendMatch?.[1] && sendMatch[2]?.trim()) {
    const conversation = await sendReplyThroughConversationChannel({
      tenantId: args.tenantId,
      conversationId: sendMatch[1],
      text: sendMatch[2].trim(),
    });

    return {
      message: `Sent to customer. Conversation ${conversation.id} remains paused.`,
      replyMarkup: buildOwnerResumeReplyMarkup(conversation.id),
    };
  }

  if (takeoverMatch?.[1]) {
    const conversation = await db.conversation.findUnique({
      where: { id: takeoverMatch[1] },
      include: { agent: true },
    });

    if (!conversation) {
      throw new Error("Conversation not found.");
    }

    if (conversation.agent.tenantId !== args.tenantId) {
      throw new Error("Conversation does not belong to this tenant.");
    }

    await db.conversation.update({
      where: { id: conversation.id },
      data: { status: ConversationStatus.ESCALATED },
    });

    return {
      message: `Manual takeover is active for conversation ${conversation.id}.`,
      replyMarkup: buildOwnerResumeReplyMarkup(conversation.id),
    };
  }

  if (resumeMatch?.[1]) {
    const conversation = await db.conversation.findUnique({
      where: { id: resumeMatch[1] },
      include: { agent: true },
    });

    if (!conversation) {
      throw new Error("Conversation not found.");
    }

    if (conversation.agent.tenantId !== args.tenantId) {
      throw new Error("Conversation does not belong to this tenant.");
    }

    await db.conversation.update({
      where: { id: conversation.id },
      data: { status: ConversationStatus.ACTIVE },
    });

    return {
      message: `Agent resumed for conversation ${conversation.id}.`,
    };
  }

  return {
    message: [
      "I did not recognize that handoff command.",
      "",
      "Use:",
      "/send <conversationId> <exact message>",
      "/takeover <conversationId>",
      "/resume <conversationId>",
    ].join("\n"),
  };
}

export async function handleOwnerTelegramCallback(args: {
  tenantId: string;
  ownerChatId: string;
  data: string;
}): Promise<OwnerTelegramResponse | null> {
  await assertLinkedOwnerTelegramChat(args);

  const callback = parseOwnerHandoffCallback(args.data);

  if (!callback) {
    return null;
  }

  const conversation = await db.conversation.findUnique({
    where: { id: callback.conversationId },
    include: { agent: true },
  });

  if (!conversation) {
    throw new Error("Conversation not found.");
  }

  if (conversation.agent.tenantId !== args.tenantId) {
    throw new Error("Conversation does not belong to this tenant.");
  }

  if (callback.action === "reply") {
    return {
      message:
        "To send an answer, tap Reply on the Behalfy handoff message above and type the exact text for the customer.",
    };
  }

  if (callback.action === "takeover") {
    await db.conversation.update({
      where: { id: conversation.id },
      data: { status: ConversationStatus.ESCALATED },
    });

    return {
      message: `Manual takeover is active for conversation ${conversation.id}.`,
      replyMarkup: buildOwnerResumeReplyMarkup(conversation.id),
    };
  }

  await db.conversation.update({
    where: { id: conversation.id },
    data: { status: ConversationStatus.ACTIVE },
  });

  return {
    message: `Agent resumed for conversation ${conversation.id}.`,
  };
}

export function mergeOwnerHandoffMetadata(args: {
  metadata: Prisma.JsonValue | null | undefined;
  webhookSecret: string;
  webhookUrl: string | null;
  startToken: string;
}) {
  const metadata = readRecord(args.metadata);
  const previous = readOwnerHandoffConfig(args.metadata);

  return {
    ...metadata,
    provider: "telegram",
    source: "botfather",
    ownerHandoff: {
      enabled: true,
      ownerChatId: previous.ownerChatId || null,
      startToken: previous.startToken || args.startToken,
      webhookSecret: args.webhookSecret,
      webhookUrl: args.webhookUrl,
      registeredAt: new Date().toISOString(),
    },
  };
}

export function readOwnerHandoffWebhookSecret(metadata: Prisma.JsonValue | null | undefined) {
  const record = readRecord(metadata);
  const raw = record.ownerHandoff;
  const ownerHandoff =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, Prisma.JsonValue>)
      : {};

  return typeof ownerHandoff.webhookSecret === "string" ? ownerHandoff.webhookSecret : "";
}

export function readOwnerHandoffStartToken(metadata: Prisma.JsonValue | null | undefined) {
  return readOwnerHandoffConfig(metadata).startToken;
}

export function updateOwnerHandoffChatMetadata(args: {
  metadata: Prisma.JsonValue | null | undefined;
  ownerChatId: string;
}) {
  const metadata = readRecord(args.metadata);
  const raw = metadata.ownerHandoff;
  const ownerHandoff =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, Prisma.JsonValue>)
      : {};

  return {
    ...metadata,
    ownerHandoff: {
      ...ownerHandoff,
      enabled: true,
      ownerChatId: args.ownerChatId,
      startToken: null,
      chatLinkedAt: new Date().toISOString(),
    },
  };
}
