import {
  AgentStatus,
  ChannelType,
  ConversationStatus,
  DelayedDeliveryKind,
  DelayedDeliveryStatus,
  MessageRole,
} from "@prisma/client";

import { findNextAgentScheduleWindowStart, isWithinAgentSchedule } from "@/lib/agent-schedule";
import {
  AgentSettingsConfig,
  getChannelConfigObject,
  normalizeAgentSettings,
  normalizeFunctionBlocks,
} from "@/lib/agent-config";
import {
  getFollowUpDelayMs,
  getFollowUpSendLimitCount,
  readMessageBehaviorConfig,
} from "@/lib/channels/message-behavior";
import { getChannelAdapter } from "@/lib/channels";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { saveMessages } from "@/lib/agent-memory";
import type { InvokeAgentResult } from "@/lib/ai-runtime";

type RuntimeInvokeAgent = typeof import("@/lib/ai-runtime").invokeAgent;

type RuntimeAttachment = NonNullable<InvokeAgentResult["attachments"]>[number];

type ReplyContext = {
  contactId: string;
  contactEmail?: string;
  messageId?: string;
  gmailMessageId?: string;
  threadId?: string;
  subject?: string;
};

type RuntimeChannelAdapter = {
  formatReply: (text: string, config?: unknown) => unknown;
  sendReply: (params: {
    credentials: string;
    contactId: string;
    message: string | string[] | { text: string; html?: string };
    messageId?: string;
    threadId?: string;
    subject?: string;
    attachments?: RuntimeAttachment[];
    channelConfig?: unknown;
  }) => Promise<unknown>;
};

type RuntimeDeps = {
  db: typeof db;
  decrypt: typeof decrypt;
  getChannelAdapter: typeof getChannelAdapter;
  invokeAgent: RuntimeInvokeAgent;
  saveMessages: typeof saveMessages;
};

async function getDelayedDeliveryWithRelations(database: typeof db, deliveryId: string) {
  return database.delayedDelivery.findUnique({
    where: { id: deliveryId },
    include: {
      agent: {
        include: {
          channel: true,
        },
      },
      conversation: true,
    },
  });
}

type LoadedDelayedDelivery = Awaited<ReturnType<typeof getDelayedDeliveryWithRelations>>;

function getRuntimeAgentSettingsConfig(channelConfig: unknown): AgentSettingsConfig {
  if (!channelConfig || typeof channelConfig !== "object" || Array.isArray(channelConfig)) {
    return normalizeAgentSettings();
  }

  const rawChannelConfig = getChannelConfigObject(channelConfig as never);

  return normalizeAgentSettings(
    rawChannelConfig.agentSettings &&
      typeof rawChannelConfig.agentSettings === "object" &&
      !Array.isArray(rawChannelConfig.agentSettings)
      ? (rawChannelConfig.agentSettings as Partial<AgentSettingsConfig>)
      : undefined,
  );
}

function isPartialDeliveryResult(
  delivery: unknown,
): delivery is {
  ok: false;
  deliveredCount: number;
  totalParts: number;
  error?: string;
} {
  if (!delivery || typeof delivery !== "object" || Array.isArray(delivery)) {
    return false;
  }

  return (
    "ok" in delivery &&
    delivery.ok === false &&
    "deliveredCount" in delivery &&
    typeof delivery.deliveredCount === "number" &&
    "totalParts" in delivery &&
    typeof delivery.totalParts === "number"
  );
}

function parseReplyContext(value: unknown): ReplyContext | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const parsed = value as Record<string, unknown>;
  const contactId = typeof parsed.contactId === "string" ? parsed.contactId : "";

  if (!contactId) {
    return null;
  }

  return {
    contactId,
    contactEmail: typeof parsed.contactEmail === "string" ? parsed.contactEmail : undefined,
    messageId: typeof parsed.messageId === "string" ? parsed.messageId : undefined,
    gmailMessageId: typeof parsed.gmailMessageId === "string" ? parsed.gmailMessageId : undefined,
    threadId: typeof parsed.threadId === "string" ? parsed.threadId : undefined,
    subject: typeof parsed.subject === "string" ? parsed.subject : undefined,
  };
}

function getBufferedReplyContext(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const parsed = value as Record<string, unknown>;
  const replyContext = parseReplyContext(parsed.replyContext);

  if (!replyContext) {
    return null;
  }

  return {
    replyContext,
    triggerMessageId:
      typeof parsed.triggerMessageId === "string" ? parsed.triggerMessageId : undefined,
  };
}

function getFollowUpPayload(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const parsed = value as Record<string, unknown>;
  const replyContext = parseReplyContext(parsed.replyContext);
  const instruction = typeof parsed.instruction === "string" ? parsed.instruction.trim() : "";
  const anchorCreatedAt =
    typeof parsed.anchorCreatedAt === "string" ? new Date(parsed.anchorCreatedAt) : null;
  const outOfHoursBehavior =
    parsed.outOfHoursBehavior === "wait_for_schedule_window" ||
    parsed.outOfHoursBehavior === "skip_follow_up"
      ? parsed.outOfHoursBehavior
      : "send_immediately_ignore_schedule";
  const sendLimit =
    parsed.sendLimit === "up_to_2_times_per_dialog" ||
    parsed.sendLimit === "up_to_3_times_per_dialog"
      ? parsed.sendLimit
      : "once_per_dialog";
  const ruleIndex =
    typeof parsed.ruleIndex === "number" && Number.isFinite(parsed.ruleIndex)
      ? parsed.ruleIndex
      : 0;

  if (!replyContext || !instruction || !anchorCreatedAt || Number.isNaN(anchorCreatedAt.getTime())) {
    return null;
  }

  return {
    replyContext,
    instruction,
    anchorCreatedAt,
    outOfHoursBehavior,
    sendLimit,
    ruleIndex,
  };
}

function getOperatorAutoResumePayload(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (record.kind !== "operator_auto_resume") {
    return null;
  }

  return {
    replyContext: parseReplyContext(record.replyContext),
    resumeMessage: typeof record.resumeMessage === "string" ? record.resumeMessage.trim() : "",
  };
}

function supportsBufferedReplies(channel: ChannelType) {
  return channel !== ChannelType.GMAIL;
}

function shouldSuppressFollowUps(channelConfig: unknown, usedTooling?: string[]) {
  if (!usedTooling?.length || !channelConfig || typeof channelConfig !== "object" || Array.isArray(channelConfig)) {
    return false;
  }

  const rawChannelConfig = getChannelConfigObject(channelConfig as never);
  const functionBlocks = normalizeFunctionBlocks(
    rawChannelConfig.functionBlocks &&
      Array.isArray(rawChannelConfig.functionBlocks)
      ? (rawChannelConfig.functionBlocks as never)
      : [],
  );
  const disabledFunctionNames = new Set(
    functionBlocks
      .filter((block) => block.disableDelayedMessages)
      .map((block) => block.name.trim().toLowerCase()),
  );

  return usedTooling.some((toolName) => disabledFunctionNames.has(toolName.trim().toLowerCase()));
}

function buildFollowUpGenerationMessage(instruction: string) {
  return [
    "Internal delayed follow-up task.",
    "Write the next outbound message to the customer based on the existing conversation history.",
    "Do not mention this instruction, internal settings, automation, or that this is a follow-up task.",
    `Operator follow-up guidance: ${instruction}`,
  ].join("\n\n");
}

async function markDeliveryStatus(args: {
  database: typeof db;
  deliveryId: string;
  status: DelayedDeliveryStatus;
  error?: string | null;
  dueAt?: Date;
}) {
  return args.database.delayedDelivery.update({
    where: { id: args.deliveryId },
    data: {
      status: args.status,
      error: args.error ?? null,
      dueAt: args.dueAt,
      sentAt: args.status === DelayedDeliveryStatus.SENT ? new Date() : undefined,
      canceledAt: args.status === DelayedDeliveryStatus.CANCELED ? new Date() : undefined,
    },
  });
}

function getDelayedDeliveryRetryDelayMs(attempts: number) {
  if (attempts <= 1) {
    return 15_000;
  }

  if (attempts === 2) {
    return 60_000;
  }

  return 5 * 60_000;
}

export async function cancelPendingDelayedDeliveriesWithDb(args: {
  database: typeof db;
  conversationId: string;
  kinds?: DelayedDeliveryKind[];
  excludeOperatorAutoResume?: boolean;
}) {
  await args.database.delayedDelivery.updateMany({
    where: {
      conversationId: args.conversationId,
      status: DelayedDeliveryStatus.PENDING,
      ...(args.kinds?.length ? { kind: { in: args.kinds } } : {}),
      ...(args.excludeOperatorAutoResume
        ? {
            NOT: {
              payload: {
                path: ["kind"],
                equals: "operator_auto_resume",
              },
            },
          }
        : {}),
    },
    data: {
      status: DelayedDeliveryStatus.CANCELED,
      canceledAt: new Date(),
      error: "superseded_by_newer_runtime_state",
    },
  });
}

export async function scheduleBufferedReplyWithDb(args: {
  database: typeof db;
  agentId: string;
  conversationId: string;
  dueAt: Date;
  replyContext: ReplyContext;
  triggerMessageId?: string;
}) {
  await cancelPendingDelayedDeliveriesWithDb({
    database: args.database,
    conversationId: args.conversationId,
    kinds: [DelayedDeliveryKind.BUFFERED_REPLY],
  });

  return args.database.delayedDelivery.create({
    data: {
      agentId: args.agentId,
      conversationId: args.conversationId,
      kind: DelayedDeliveryKind.BUFFERED_REPLY,
      dueAt: args.dueAt,
      payload: {
        replyContext: args.replyContext,
        triggerMessageId: args.triggerMessageId,
      },
    },
  });
}

export async function scheduleFollowUpsForReplyWithDb(args: {
  database: typeof db;
  agentId: string;
  conversationId: string;
  channelConfig: unknown;
  replyContext: ReplyContext;
  anchorCreatedAt: Date;
  usedTooling?: string[];
}) {
  const behavior = readMessageBehaviorConfig(args.channelConfig);

  await cancelPendingDelayedDeliveriesWithDb({
    database: args.database,
    conversationId: args.conversationId,
    kinds: [DelayedDeliveryKind.FOLLOW_UP],
  });

  if (!behavior.followUpEnabled || behavior.followUpRules.length === 0) {
    return [];
  }

  if (shouldSuppressFollowUps(args.channelConfig, args.usedTooling)) {
    return [];
  }

  const created = [];

  for (const [ruleIndex, rule] of behavior.followUpRules.entries()) {
    created.push(
      await args.database.delayedDelivery.create({
        data: {
          agentId: args.agentId,
          conversationId: args.conversationId,
          kind: DelayedDeliveryKind.FOLLOW_UP,
          dueAt: new Date(args.anchorCreatedAt.getTime() + getFollowUpDelayMs(rule)),
          payload: {
            replyContext: args.replyContext,
            instruction: rule.instruction,
            outOfHoursBehavior: rule.outOfHoursBehavior,
            sendLimit: rule.sendLimit,
            ruleIndex,
            anchorCreatedAt: args.anchorCreatedAt.toISOString(),
          },
        },
      }),
    );
  }

  return created;
}

async function deliverThroughChannel(args: {
  agent: {
    channelConfig: unknown;
    channel: { type: ChannelType; credentialsEnc: string };
  };
  decryptValue: typeof decrypt;
  getAdapter: typeof getChannelAdapter;
  replyContext: ReplyContext;
  text: string;
  attachments?: RuntimeAttachment[];
}) {
  const adapter = args.getAdapter(args.agent.channel.type) as RuntimeChannelAdapter;
  const formattedReply = adapter.formatReply(args.text, args.agent.channelConfig);
  const behavior = readMessageBehaviorConfig(args.agent.channelConfig);
  const outboundMessage = formattedReply as string | string[] | { text: string; html?: string };
  const delivery = await adapter.sendReply({
    credentials:
      args.agent.channel.type === ChannelType.GMAIL
        ? args.agent.channel.credentialsEnc
        : args.decryptValue(args.agent.channel.credentialsEnc),
    contactId: args.replyContext.contactId,
    message: outboundMessage,
    messageId: args.replyContext.messageId,
    threadId: args.replyContext.threadId,
    subject: args.replyContext.subject,
    attachments: behavior.allowAttachments ? args.attachments : undefined,
    channelConfig: args.agent.channelConfig,
  });

  if (isPartialDeliveryResult(delivery)) {
    throw new Error(
      delivery.error ??
        `partial delivery after ${delivery.deliveredCount}/${delivery.totalParts} message parts`,
    );
  }

  return delivery;
}

async function processBufferedReply(args: {
  deliveryId: string;
  delivery: LoadedDelayedDelivery;
  deps: RuntimeDeps;
}) {
  if (!args.delivery?.agent || !args.delivery.conversation) {
    await markDeliveryStatus({
      database: args.deps.db,
      deliveryId: args.deliveryId,
      status: DelayedDeliveryStatus.FAILED,
      error: "buffered_delivery_missing_agent_or_conversation",
    });
    return { ok: false, status: "buffered_delivery_missing_context" as const };
  }

  const payload = getBufferedReplyContext(args.delivery.payload);

  if (!payload) {
    await markDeliveryStatus({
      database: args.deps.db,
      deliveryId: args.deliveryId,
      status: DelayedDeliveryStatus.FAILED,
      error: "buffered_delivery_missing_reply_context",
    });
    return { ok: false, status: "buffered_delivery_missing_reply_context" as const };
  }

  if (
    args.delivery.agent.status !== AgentStatus.ACTIVE ||
    args.delivery.conversation.status !== ConversationStatus.ACTIVE
  ) {
    await markDeliveryStatus({
      database: args.deps.db,
      deliveryId: args.deliveryId,
      status: DelayedDeliveryStatus.CANCELED,
      error: "buffered_delivery_no_longer_sendable",
    });
    return { ok: true, status: "buffered_delivery_canceled" as const };
  }

  const messages = await args.deps.db.message.findMany({
    where: {
      conversationId: args.delivery.conversationId,
    },
    orderBy: {
      createdAt: "asc",
    },
  });
  const latestAssistant = [...messages]
    .reverse()
    .find((message) => message.role === MessageRole.ASSISTANT);
  const pendingUserMessages = messages.filter(
    (message) =>
      message.role === MessageRole.USER &&
      (!latestAssistant || message.createdAt > latestAssistant.createdAt),
  );
  const latestUserMessage = pendingUserMessages[pendingUserMessages.length - 1];

  if (!latestUserMessage) {
    await markDeliveryStatus({
      database: args.deps.db,
      deliveryId: args.deliveryId,
      status: DelayedDeliveryStatus.CANCELED,
      error: "buffered_delivery_already_answered",
    });
    return { ok: true, status: "buffered_delivery_already_answered" as const };
  }

  if (payload.triggerMessageId && latestUserMessage.id !== payload.triggerMessageId) {
    await markDeliveryStatus({
      database: args.deps.db,
      deliveryId: args.deliveryId,
      status: DelayedDeliveryStatus.CANCELED,
      error: "buffered_delivery_superseded_by_newer_message",
    });
    return { ok: true, status: "buffered_delivery_superseded" as const };
  }

  const combinedMessage = pendingUserMessages.map((message) => message.content.trim()).join("\n");
  const result = await args.deps.invokeAgent({
    tenantId: args.delivery.agent.tenantId,
    agentId: args.delivery.agentId,
    channel: args.delivery.agent.channel.type,
    contactId: payload.replyContext.contactId,
    contactEmail: payload.replyContext.contactEmail,
    message: combinedMessage,
    conversationId: args.delivery.conversationId,
    skipInboundPersistence: true,
  });

  if (result.suppressReply) {
    await markDeliveryStatus({
      database: args.deps.db,
      deliveryId: args.deliveryId,
      status: DelayedDeliveryStatus.CANCELED,
      error: "buffered_reply_suppressed_by_control",
    });

    return {
      ok: true,
      status: "buffered_reply_suppressed_by_control" as const,
      conversationId: result.conversationId,
    };
  }

  await deliverThroughChannel({
    agent: args.delivery.agent,
    decryptValue: args.deps.decrypt,
    getAdapter: args.deps.getChannelAdapter,
    replyContext: payload.replyContext,
    text: result.message,
    attachments: result.attachments,
  });

  await scheduleFollowUpsForReplyWithDb({
    database: args.deps.db,
    agentId: args.delivery.agentId,
    conversationId: args.delivery.conversationId,
    channelConfig: args.delivery.agent.channelConfig,
    replyContext: payload.replyContext,
    anchorCreatedAt: new Date(),
    usedTooling: result.usedTooling,
  });

  await markDeliveryStatus({
    database: args.deps.db,
    deliveryId: args.deliveryId,
    status: DelayedDeliveryStatus.SENT,
  });

  return {
    ok: true,
    status: "buffered_reply_sent" as const,
    conversationId: result.conversationId,
  };
}

async function processFollowUp(args: {
  deliveryId: string;
  delivery: LoadedDelayedDelivery;
  deps: RuntimeDeps;
  now: Date;
}) {
  if (!args.delivery?.agent || !args.delivery.conversation) {
    await markDeliveryStatus({
      database: args.deps.db,
      deliveryId: args.deliveryId,
      status: DelayedDeliveryStatus.FAILED,
      error: "follow_up_missing_agent_or_conversation",
    });
    return { ok: false, status: "follow_up_missing_context" as const };
  }

  const autoResumePayload = getOperatorAutoResumePayload(args.delivery.payload);
  if (autoResumePayload) {
    let resumeMessageDeliveryFailed = false;

    if (args.delivery.conversation.status !== ConversationStatus.ESCALATED) {
      await markDeliveryStatus({
        database: args.deps.db,
        deliveryId: args.deliveryId,
        status: DelayedDeliveryStatus.CANCELED,
        error: "operator_auto_resume_dialog_not_paused",
      });
      return { ok: true, status: "operator_auto_resume_canceled" as const };
    }

    if (autoResumePayload.resumeMessage) {
      const existingResumeMessage = await args.deps.db.message.findFirst({
        where: {
          conversationId: args.delivery.conversationId,
          role: MessageRole.ASSISTANT,
          model: "control-auto-resume",
          content: autoResumePayload.resumeMessage,
        },
      });

      if (!existingResumeMessage) {
        try {
          await deliverThroughChannel({
            agent: args.delivery.agent,
            decryptValue: args.deps.decrypt,
            getAdapter: args.deps.getChannelAdapter,
            replyContext: autoResumePayload.replyContext ?? {
              contactId: args.delivery.conversation.contactId,
            },
            text: autoResumePayload.resumeMessage,
          });
          await args.deps.saveMessages(args.delivery.conversationId, [
            {
              role: MessageRole.ASSISTANT,
              content: autoResumePayload.resumeMessage,
              model: "control-auto-resume",
            },
          ]);
        } catch {
          resumeMessageDeliveryFailed = true;
        }
      }
    }

    await args.deps.db.conversation.update({
      where: { id: args.delivery.conversationId },
      data: { status: ConversationStatus.ACTIVE },
    });

    await markDeliveryStatus({
      database: args.deps.db,
      deliveryId: args.deliveryId,
      status: DelayedDeliveryStatus.SENT,
    });

    return {
      ok: true,
      status: resumeMessageDeliveryFailed
        ? ("operator_auto_resumed_without_resume_message" as const)
        : ("operator_auto_resumed" as const),
      conversationId: args.delivery.conversationId,
    };
  }

  const payload = getFollowUpPayload(args.delivery.payload);

  if (!payload) {
    await markDeliveryStatus({
      database: args.deps.db,
      deliveryId: args.deliveryId,
      status: DelayedDeliveryStatus.FAILED,
      error: "follow_up_missing_payload",
    });
    return { ok: false, status: "follow_up_missing_payload" as const };
  }

  if (
    args.delivery.agent.status !== AgentStatus.ACTIVE ||
    args.delivery.conversation.status !== ConversationStatus.ACTIVE
  ) {
    await markDeliveryStatus({
      database: args.deps.db,
      deliveryId: args.deliveryId,
      status: DelayedDeliveryStatus.CANCELED,
      error: "follow_up_no_longer_sendable",
    });
    return { ok: true, status: "follow_up_canceled" as const };
  }

  const customerReplied = await args.deps.db.message.findFirst({
    where: {
      conversationId: args.delivery.conversationId,
      role: MessageRole.USER,
      createdAt: {
        gt: payload.anchorCreatedAt,
      },
    },
    select: { id: true },
  });

  if (customerReplied) {
    await markDeliveryStatus({
      database: args.deps.db,
      deliveryId: args.deliveryId,
      status: DelayedDeliveryStatus.CANCELED,
      error: "follow_up_canceled_after_customer_reply",
    });
    return { ok: true, status: "follow_up_canceled_after_customer_reply" as const };
  }

  const sentCount = await args.deps.db.delayedDelivery.count({
    where: {
      conversationId: args.delivery.conversationId,
      kind: DelayedDeliveryKind.FOLLOW_UP,
      status: DelayedDeliveryStatus.SENT,
      payload: {
        path: ["ruleIndex"],
        equals: payload.ruleIndex,
      },
    },
  });

  if (sentCount >= getFollowUpSendLimitCount(payload.sendLimit)) {
    await markDeliveryStatus({
      database: args.deps.db,
      deliveryId: args.deliveryId,
      status: DelayedDeliveryStatus.CANCELED,
      error: "follow_up_send_limit_reached",
    });
    return { ok: true, status: "follow_up_send_limit_reached" as const };
  }

  const agentSettings = getRuntimeAgentSettingsConfig(args.delivery.agent.channelConfig);
  const insideSchedule = isWithinAgentSchedule(agentSettings, args.now);

  if (!insideSchedule && payload.outOfHoursBehavior === "skip_follow_up") {
    await markDeliveryStatus({
      database: args.deps.db,
      deliveryId: args.deliveryId,
      status: DelayedDeliveryStatus.CANCELED,
      error: "follow_up_skipped_outside_schedule",
    });
    return { ok: true, status: "follow_up_skipped_outside_schedule" as const };
  }

  if (!insideSchedule && payload.outOfHoursBehavior === "wait_for_schedule_window") {
    const nextWindow = findNextAgentScheduleWindowStart(agentSettings, args.now);

    if (!nextWindow) {
      await markDeliveryStatus({
        database: args.deps.db,
        deliveryId: args.deliveryId,
        status: DelayedDeliveryStatus.FAILED,
        error: "follow_up_could_not_find_schedule_window",
      });
      return { ok: false, status: "follow_up_missing_schedule_window" as const };
    }

    await markDeliveryStatus({
      database: args.deps.db,
      deliveryId: args.deliveryId,
      status: DelayedDeliveryStatus.PENDING,
      dueAt: nextWindow,
      error: null,
    });
    return { ok: true, status: "follow_up_rescheduled_for_schedule_window" as const };
  }

  const result = await args.deps.invokeAgent({
    tenantId: args.delivery.agent.tenantId,
    agentId: args.delivery.agentId,
    channel: args.delivery.agent.channel.type,
    contactId: payload.replyContext.contactId,
    contactEmail: payload.replyContext.contactEmail,
    message: buildFollowUpGenerationMessage(payload.instruction),
    conversationId: args.delivery.conversationId,
    skipInboundPersistence: true,
  });

  if (result.suppressReply) {
    await markDeliveryStatus({
      database: args.deps.db,
      deliveryId: args.deliveryId,
      status: DelayedDeliveryStatus.CANCELED,
      error: "follow_up_suppressed_by_control",
    });

    return {
      ok: true,
      status: "follow_up_suppressed_by_control" as const,
      conversationId: result.conversationId,
    };
  }

  await deliverThroughChannel({
    agent: args.delivery.agent,
    decryptValue: args.deps.decrypt,
    getAdapter: args.deps.getChannelAdapter,
    replyContext: payload.replyContext,
    text: result.message,
    attachments: result.attachments,
  });

  await markDeliveryStatus({
    database: args.deps.db,
    deliveryId: args.deliveryId,
    status: DelayedDeliveryStatus.SENT,
  });

  return {
    ok: true,
    status: "follow_up_sent" as const,
    conversationId: result.conversationId,
  };
}

export async function processDelayedDeliveryByIdWithDeps(
  deliveryId: string,
  deps: RuntimeDeps,
  now = new Date(),
) {
  const claimed = await deps.db.delayedDelivery.updateMany({
    where: {
      id: deliveryId,
      status: DelayedDeliveryStatus.PENDING,
      dueAt: {
        lte: now,
      },
    },
    data: {
      status: DelayedDeliveryStatus.PROCESSING,
      attempts: {
        increment: 1,
      },
      lastAttemptAt: now,
      error: null,
    },
  });

  if (claimed.count === 0) {
    return { ok: true, status: "delivery_not_claimed" as const };
  }

  const delivery = await getDelayedDeliveryWithRelations(deps.db, deliveryId);

  try {
    if (delivery?.kind === DelayedDeliveryKind.BUFFERED_REPLY) {
      return await processBufferedReply({
        deliveryId,
        delivery,
        deps,
      });
    }

    return await processFollowUp({
      deliveryId,
      delivery,
      deps,
      now,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "delayed_delivery_failed";
    const attemptCount = delivery?.attempts ?? 1;

    if (delivery && attemptCount < 3) {
      const retryAt = new Date(now.getTime() + getDelayedDeliveryRetryDelayMs(attemptCount));

      await markDeliveryStatus({
        database: deps.db,
        deliveryId,
        status: DelayedDeliveryStatus.PENDING,
        dueAt: retryAt,
        error: errorMessage,
      });

      return {
        ok: false,
        status: "delayed_delivery_retry_scheduled" as const,
        error: errorMessage,
        retryAt,
      };
    }

    await markDeliveryStatus({
      database: deps.db,
      deliveryId,
      status: DelayedDeliveryStatus.FAILED,
      error: errorMessage,
    });

    return {
      ok: false,
      status: "delayed_delivery_failed" as const,
      error: errorMessage,
    };
  }
}

export async function processDueDelayedDeliveriesWithDeps(
  deps: RuntimeDeps,
  now = new Date(),
  limit = 25,
) {
  const dueDeliveries = await deps.db.delayedDelivery.findMany({
    where: {
      status: DelayedDeliveryStatus.PENDING,
      dueAt: {
        lte: now,
      },
    },
    orderBy: {
      dueAt: "asc",
    },
    take: limit,
    select: {
      id: true,
    },
  });

  const results = [];

  for (const delivery of dueDeliveries) {
    results.push(await processDelayedDeliveryByIdWithDeps(delivery.id, deps, now));
  }

  return results;
}

export async function runBufferedDeliveryWhenDueWithDeps(args: {
  deliveryId: string;
  dueAt: Date;
  deps: RuntimeDeps;
  sleep?: (ms: number) => Promise<void>;
  now?: () => Date;
}) {
  const getNow = args.now ?? (() => new Date());
  const sleep = args.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const delayMs = args.dueAt.getTime() - getNow().getTime();

  if (delayMs > 0) {
    await sleep(delayMs);
  }

  const result = await processDelayedDeliveryByIdWithDeps(args.deliveryId, args.deps, getNow());

  await processDueDelayedDeliveriesWithDeps(args.deps, getNow(), 10);

  return result;
}

export const messageDeliveryRuntimeTestHelpers = {
  cancelPendingDelayedDeliveriesWithDb,
  scheduleBufferedReplyWithDb,
  scheduleFollowUpsForReplyWithDb,
  processDelayedDeliveryByIdWithDeps,
  processDueDelayedDeliveriesWithDeps,
  runBufferedDeliveryWhenDueWithDeps,
  supportsBufferedReplies,
};
