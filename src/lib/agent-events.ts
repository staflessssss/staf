import {
  AgentEventSource,
  AgentEventStatus,
  AgentEventType,
  Prisma,
  type ChannelType,
  type PrismaClient,
} from "@prisma/client";

import type { ConversationMemory } from "@/lib/conversation-memory";

type EventDatabase = PrismaClient | Prisma.TransactionClient;

export type RuntimeToolExecution = {
  toolName: string;
  toolInput?: unknown;
  toolResult: unknown;
  durationMs?: number;
};

export type AgentEventInput = {
  type: AgentEventType;
  status?: AgentEventStatus;
  dedupeKey?: string;
  durationMs?: number;
  metadata?: Record<string, unknown>;
  occurredAt?: Date;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function collectResultRecords(value: unknown) {
  const root = asRecord(value);
  if (!root) return [];

  const records = [root];
  const steps = Array.isArray(root.steps) ? root.steps : [];
  for (const step of steps) {
    const result = asRecord(asRecord(step)?.result);
    if (result) records.push(result);
  }

  return records;
}

function normalizeToolName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function getResultStatuses(value: unknown) {
  return collectResultRecords(value)
    .map((record) => record.status)
    .filter((status): status is string => typeof status === "string" && Boolean(status.trim()))
    .map((status) => status.trim().toLowerCase());
}

function getResultStatus(value: unknown) {
  return getResultStatuses(value)[0] ?? "";
}

function getAvailable(value: unknown) {
  for (const record of collectResultRecords(value)) {
    if (typeof record.available === "boolean") return record.available;
    const status = typeof record.status === "string" ? record.status.toLowerCase() : "";
    if (status === "available") return true;
    if (status === "unavailable") return false;
  }
  return undefined;
}

function eventStatusFromToolResult(value: unknown) {
  const statuses = getResultStatuses(value);
  if (
    statuses.some(
      (status) =>
        status.includes("blocked") ||
        status.includes("missing") ||
        status.includes("precondition") ||
        status.startsWith("needs_") ||
        status === "date_weekday_mismatch",
    )
  ) {
    return AgentEventStatus.BLOCKED;
  }
  if (
    statuses.some(
      (status) =>
        status.includes("fail") ||
        status.includes("error") ||
        status.includes("misconfigured") ||
        status.includes("not_configured") ||
        status.includes("unsupported"),
    )
  ) {
    return AgentEventStatus.FAILED;
  }
  return AgentEventStatus.SUCCEEDED;
}

function outcomeStatus(value: unknown, successStatuses: string[]) {
  const statuses = getResultStatuses(value);
  if (statuses.some((status) => successStatuses.includes(status))) {
    return AgentEventStatus.SUCCEEDED;
  }

  const genericStatus = eventStatusFromToolResult(value);
  return genericStatus === AgentEventStatus.SUCCEEDED ? AgentEventStatus.FAILED : genericStatus;
}

function metadataForTool(execution: RuntimeToolExecution) {
  const available = getAvailable(execution.toolResult);
  const resultStatus = getResultStatus(execution.toolResult);

  return {
    toolName: execution.toolName,
    ...(resultStatus ? { resultStatus } : {}),
    ...(available === undefined ? {} : { available }),
  };
}

export function mapToolExecutionToAgentEvents(
  execution: RuntimeToolExecution,
): AgentEventInput[] {
  const toolName = normalizeToolName(execution.toolName);
  const common = {
    durationMs: execution.durationMs,
    metadata: metadataForTool(execution),
  };

  if (toolName === "send_collections_guide" || toolName.includes("send_pricing")) {
    return [{
      type: AgentEventType.PRICING_GUIDE_SENT,
      status: outcomeStatus(execution.toolResult, ["ready_to_attach", "attachment_ready", "sent"]),
      ...common,
    }];
  }

  if (toolName.includes("wedding") && toolName.includes("availability")) {
    return [{
      type: AgentEventType.AVAILABILITY_CHECKED,
      status:
        getAvailable(execution.toolResult) === undefined
          ? outcomeStatus(execution.toolResult, ["available", "unavailable"])
          : AgentEventStatus.SUCCEEDED,
      ...common,
    }];
  }

  if (toolName.includes("book") && (toolName.includes("consultation") || toolName.includes("call"))) {
    const status = outcomeStatus(execution.toolResult, ["booked"]);
    return [
      { type: AgentEventType.CONSULTATION_BOOKED, status, ...common },
      ...(status === AgentEventStatus.SUCCEEDED
        ? [{ type: AgentEventType.LEAD_QUALIFIED, status, ...common }]
        : []),
    ];
  }

  if (
    toolName.includes("consultation") &&
    (toolName.includes("calendar") || toolName.includes("availability"))
  ) {
    return [{
      type: AgentEventType.CONSULTATION_CHECKED,
      status: outcomeStatus(execution.toolResult, ["available", "busy"]),
      ...common,
    }];
  }

  if (toolName.includes("owner_handoff_response")) {
    return [{
      type: AgentEventType.HANDOFF_RESOLVED,
      status: eventStatusFromToolResult(execution.toolResult),
      ...common,
    }];
  }

  if (toolName.includes("owner_handoff_request") || toolName === "handoff_to_human") {
    return [{
      type: AgentEventType.HANDOFF_REQUESTED,
      status: eventStatusFromToolResult(execution.toolResult),
      ...common,
    }];
  }

  return [];
}

export function isQualifiedLeadMemory(memory: ConversationMemory | undefined) {
  return Boolean(
    memory?.weddingDate &&
      memory.location &&
      memory.customerName &&
      memory.partnerName,
  );
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function recordAgentEventsWithDb(args: {
  database: EventDatabase;
  agentId: string;
  conversationId?: string;
  channel: ChannelType;
  source?: AgentEventSource;
  events: AgentEventInput[];
}) {
  if (args.events.length === 0) return;

  await args.database.agentEvent.createMany({
    data: args.events.map((event) => ({
      agentId: args.agentId,
      conversationId: args.conversationId,
      channel: args.channel,
      type: event.type,
      status: event.status ?? AgentEventStatus.SUCCEEDED,
      source: args.source ?? AgentEventSource.LIVE,
      dedupeKey: event.dedupeKey,
      durationMs: event.durationMs,
      metadata: event.metadata ? toJsonValue(event.metadata) : undefined,
      occurredAt: event.occurredAt,
    })),
    skipDuplicates: true,
  });
}

export async function recordAgentEventsBestEffort(
  args: Parameters<typeof recordAgentEventsWithDb>[0],
) {
  try {
    await recordAgentEventsWithDb(args);
  } catch (error) {
    console.warn("[agent-events] failed to record business events", error);
  }
}

export const agentEventTestHelpers = {
  eventStatusFromToolResult,
  getAvailable,
  getResultStatuses,
  normalizeToolName,
};
