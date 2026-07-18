import {
  AgentEventStatus,
  AgentEventType,
  type ChannelType,
  type PrismaClient,
} from "@prisma/client";

import {
  isQualifiedLeadMemory,
  mapToolExecutionToAgentEvents,
  recordAgentEventsBestEffort,
  type RuntimeToolExecution,
} from "@/lib/agent-events";
import {
  extractAndSaveConversationMemoryWithDb,
  isConversationMemoryEligibleChannel,
  loadConversationMemoryWithDb,
  type ConversationMemory,
} from "@/lib/conversation-memory";
import { recordExecutionTraceWithDb } from "@/lib/execution-traces";
import {
  notifyAgentMonitorAlert,
  notifyAgentMonitorFailure,
  notifyAgentMonitorReply,
} from "@/lib/agent-monitor";

function readMemoryAfter(value: unknown): ConversationMemory | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const memoryAfter = (value as { memoryAfter?: unknown }).memoryAfter;
  return memoryAfter && typeof memoryAfter === "object" && !Array.isArray(memoryAfter)
    ? (memoryAfter as ConversationMemory)
    : undefined;
}

function readToolFailureStatus(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const status = (value as { status?: unknown }).status;
  if (typeof status !== "string") return null;

  const normalized = status.toLowerCase();
  return /(error|fail|misconfig|unavailable)/.test(normalized) ? status : null;
}

function isPartialDelivery(value: unknown) {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      "ok" in value &&
      value.ok === false &&
      "deliveredCount" in value &&
      "totalParts" in value,
  );
}

export async function recordSuccessfulRuntimeTurnWithDb(args: {
  database: PrismaClient;
  conversationId: string;
  agentId: string;
  channel: ChannelType;
  inboundMessage: string;
  assistantReply: string;
  promptPreview?: string;
  model?: string;
  toolExecutions?: RuntimeToolExecution[];
  attachments?: unknown[];
  delivery?: unknown;
  updateMemory?: boolean;
  referenceTimeZone?: string;
}) {
  const mappedToolEvents = (args.toolExecutions ?? []).flatMap(mapToolExecutionToAgentEvents);
  const toolEvents = mappedToolEvents.filter(
    (event) =>
      event.type !== AgentEventType.HANDOFF_REQUESTED &&
      event.type !== AgentEventType.HANDOFF_RESOLVED,
  );
  const pricingGuideToolSucceeded = mappedToolEvents.some(
    (event) =>
      event.type === AgentEventType.PRICING_GUIDE_SENT &&
      event.status === AgentEventStatus.SUCCEEDED,
  );
  const consultationBookingSucceeded = mappedToolEvents.some(
    (event) =>
      event.type === AgentEventType.CONSULTATION_BOOKED &&
      event.status === AgentEventStatus.SUCCEEDED,
  );
  const shouldUpdateMemory =
    args.updateMemory !== false && isConversationMemoryEligibleChannel(args.channel);
  let memoryBefore: ConversationMemory | undefined;
  let memoryUpdate: unknown;

  if (shouldUpdateMemory) {
    try {
      memoryBefore = await loadConversationMemoryWithDb({
        database: args.database,
        conversationId: args.conversationId,
      });
      memoryUpdate = await extractAndSaveConversationMemoryWithDb({
        database: args.database,
        conversationId: args.conversationId,
        latestUserMessage: args.inboundMessage,
        assistantReply: args.assistantReply,
        operationalEvidence: {
          guideDelivered:
            pricingGuideToolSucceeded &&
            (args.attachments?.length ?? 0) > 0 &&
            !isPartialDelivery(args.delivery),
          consultationBooked: consultationBookingSucceeded,
        },
        referenceTimeZone: args.referenceTimeZone,
      });
    } catch (error) {
      memoryUpdate = {
        status: "error",
        message: error instanceof Error ? error.message : String(error),
      };
      console.warn("[conversation-memory] failed to update memory after reply", error);
    }
  }

  const memoryAfter = readMemoryAfter(memoryUpdate);
  const qualifiesLead = isQualifiedLeadMemory(memoryAfter);
  const events = [
    {
      type: AgentEventType.REPLY_SENT,
      status: AgentEventStatus.SUCCEEDED,
      metadata: {
        ...(args.model ? { model: args.model } : {}),
        attachmentCount: args.attachments?.length ?? 0,
      },
    },
    ...toolEvents.map((event) =>
      event.type === AgentEventType.LEAD_QUALIFIED
        ? { ...event, dedupeKey: `lead-qualified:${args.conversationId}` }
        : event,
    ),
    ...(qualifiesLead
      ? [
          {
            type: AgentEventType.LEAD_QUALIFIED,
            status: AgentEventStatus.SUCCEEDED,
            dedupeKey: `lead-qualified:${args.conversationId}`,
            metadata: { qualification: "wedding_date_location_and_names" },
          },
        ]
      : []),
  ];

  await recordAgentEventsBestEffort({
    database: args.database,
    agentId: args.agentId,
    conversationId: args.conversationId,
    channel: args.channel,
    events,
  });

  try {
    await recordExecutionTraceWithDb({
      database: args.database,
      conversationId: args.conversationId,
      agentId: args.agentId,
      channel: args.channel,
      inboundMessage: args.inboundMessage,
      memoryBefore,
      promptPreview: args.promptPreview,
      toolExecutions: args.toolExecutions?.map((execution) => ({
        ...execution,
        toolInput: execution.toolInput,
      })),
      modelRawText: args.assistantReply,
      finalMessage: args.assistantReply,
      attachments: args.attachments,
      delivery: args.delivery,
      memoryUpdate,
    });
  } catch (error) {
    console.warn("[execution-trace] failed to record runtime trace", error);
  }

  await notifyAgentMonitorReply({
    database: args.database,
    conversationId: args.conversationId,
    assistantReply: args.assistantReply,
    toolExecutions: args.toolExecutions,
    attachmentCount: args.attachments?.length ?? 0,
  });

  if (
    args.toolExecutions?.some(
      (execution) => execution.toolName === "tool_4_owner_handoff_request",
    )
  ) {
    await notifyAgentMonitorAlert({
      database: args.database,
      conversationId: args.conversationId,
      title: "Needs attention: human handoff",
      reason: "The agent requested a human handoff and paused this conversation for the owner/team.",
    });
  }

  const failedTool = args.toolExecutions
    ?.map((execution) => ({
      name: execution.toolName,
      status: readToolFailureStatus(execution.toolResult),
    }))
    .find((execution) => execution.status);
  if (failedTool?.status) {
    await notifyAgentMonitorAlert({
      database: args.database,
      conversationId: args.conversationId,
      title: "Needs attention: tool failed",
      reason: `${failedTool.name} returned ${failedTool.status}. Review the customer reply and the integration.`,
    });
  }

  return { memoryBefore, memoryUpdate };
}

export async function recordFollowUpSentWithDb(args: {
  database: PrismaClient;
  agentId: string;
  conversationId: string;
  channel: ChannelType;
  deliveryId: string;
}) {
  await recordAgentEventsBestEffort({
    database: args.database,
    agentId: args.agentId,
    conversationId: args.conversationId,
    channel: args.channel,
    events: [
      {
        type: AgentEventType.FOLLOW_UP_SENT,
        dedupeKey: `follow-up-sent:${args.deliveryId}`,
      },
      {
        type: AgentEventType.REPLY_SENT,
        dedupeKey: `follow-up-reply:${args.deliveryId}`,
        metadata: { kind: "follow_up" },
      },
    ],
  });

}

export async function recordDeliveryFailedWithDb(args: {
  database: PrismaClient;
  agentId: string;
  conversationId: string;
  channel: ChannelType;
  deliveryId?: string;
  error: string;
}) {
  await recordAgentEventsBestEffort({
    database: args.database,
    agentId: args.agentId,
    conversationId: args.conversationId,
    channel: args.channel,
    events: [
      {
        type: AgentEventType.DELIVERY_FAILED,
        status: AgentEventStatus.FAILED,
        dedupeKey: args.deliveryId ? `delivery-failed:${args.deliveryId}` : undefined,
        metadata: { error: args.error },
      },
    ],
  });

  await notifyAgentMonitorFailure({
    database: args.database,
    conversationId: args.conversationId,
    error: args.error,
  });
}
