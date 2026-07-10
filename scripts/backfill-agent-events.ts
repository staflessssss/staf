import {
  AgentEventSource,
  AgentEventStatus,
  AgentEventType,
  DelayedDeliveryKind,
  DelayedDeliveryStatus,
  MessageRole,
} from "@prisma/client";

import {
  isQualifiedLeadMemory,
  mapToolExecutionToAgentEvents,
  recordAgentEventsWithDb,
  type AgentEventInput,
} from "@/lib/agent-events";
import { db } from "@/lib/db";

async function main() {
  const conversations = await db.conversation.findMany({
    include: {
      agent: { select: { id: true } },
      memory: true,
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          role: true,
          toolName: true,
          toolInput: true,
          toolResult: true,
          durationMs: true,
          createdAt: true,
        },
      },
      delayedDeliveries: {
        select: {
          id: true,
          kind: true,
          status: true,
          error: true,
          sentAt: true,
          updatedAt: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  let eventCount = 0;
  for (const conversation of conversations) {
    const events: AgentEventInput[] = [
      {
        type: AgentEventType.CONVERSATION_STARTED,
        dedupeKey: `conversation-started:${conversation.id}`,
        occurredAt: conversation.createdAt,
      },
    ];

    for (const message of conversation.messages) {
      if (message.role === MessageRole.USER) {
        events.push({
          type: AgentEventType.INBOUND_RECEIVED,
          dedupeKey: `inbound:${message.id}`,
          occurredAt: message.createdAt,
        });
        continue;
      }

      if (message.role === MessageRole.ASSISTANT) {
        events.push({
          type: AgentEventType.REPLY_SENT,
          dedupeKey: `reply:${message.id}`,
          occurredAt: message.createdAt,
        });
        continue;
      }

      if (!message.toolName) continue;
      const mapped = mapToolExecutionToAgentEvents({
        toolName: message.toolName,
        toolInput: message.toolInput,
        toolResult: message.toolResult,
        durationMs: message.durationMs ?? undefined,
      });
      for (const event of mapped) {
        events.push({
          ...event,
          dedupeKey:
            event.type === AgentEventType.LEAD_QUALIFIED
              ? `lead-qualified:${conversation.id}`
              : event.type === AgentEventType.HANDOFF_RESOLVED
                ? `handoff-resolved:${message.id}`
              : `tool-event:${message.id}:${event.type}`,
          occurredAt: message.createdAt,
        });
      }
    }

    if (isQualifiedLeadMemory(conversation.memory?.memory as never)) {
      events.push({
        type: AgentEventType.LEAD_QUALIFIED,
        dedupeKey: `lead-qualified:${conversation.id}`,
        occurredAt: conversation.memory?.updatedAt ?? conversation.updatedAt,
      });
    }

    for (const delivery of conversation.delayedDeliveries) {
      if (
        delivery.kind === DelayedDeliveryKind.FOLLOW_UP &&
        delivery.status === DelayedDeliveryStatus.SENT
      ) {
        events.push({
          type: AgentEventType.FOLLOW_UP_SENT,
          dedupeKey: `follow-up-sent:${delivery.id}`,
          occurredAt: delivery.sentAt ?? delivery.updatedAt,
        });
      }
      if (delivery.status === DelayedDeliveryStatus.FAILED) {
        events.push({
          type: AgentEventType.DELIVERY_FAILED,
          status: AgentEventStatus.FAILED,
          dedupeKey: `delivery-failed:${delivery.id}`,
          occurredAt: delivery.updatedAt,
          metadata: { error: delivery.error ?? "unknown" },
        });
      }
    }

    await recordAgentEventsWithDb({
      database: db,
      agentId: conversation.agentId,
      conversationId: conversation.id,
      channel: conversation.channel,
      source: AgentEventSource.BACKFILL,
      events,
    });
    eventCount += events.length;
  }

  console.log(
    JSON.stringify({ conversations: conversations.length, eventsProcessed: eventCount }, null, 2),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
