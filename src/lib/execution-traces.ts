import { Prisma, type ChannelType, type PrismaClient } from "@prisma/client";

type DbWithOptionalTrace = PrismaClient & {
  executionTrace?: PrismaClient["executionTrace"];
};

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  if (value === undefined) {
    return JSON.parse("null") as Prisma.InputJsonValue;
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function recordExecutionTraceWithDb(args: {
  database: PrismaClient;
  conversationId: string;
  agentId: string;
  channel: ChannelType;
  inboundMessage: string;
  memoryBefore?: unknown;
  promptPreview?: string;
  toolExecutions?: Array<{
    toolName: string;
    toolInput: unknown;
    toolResult: unknown;
    durationMs?: number;
  }>;
  modelRawText?: string;
  finalMessage?: string;
  attachments?: unknown;
  delivery?: unknown;
  memoryUpdate?: unknown;
}): Promise<void> {
  const delegate = (args.database as DbWithOptionalTrace).executionTrace;

  if (!delegate) {
    return;
  }

  const toolCalls =
    args.toolExecutions?.map((execution) => ({
      toolName: execution.toolName,
      toolInput: execution.toolInput,
      durationMs: execution.durationMs,
    })) ?? [];
  const toolResults =
    args.toolExecutions?.map((execution) => ({
      toolName: execution.toolName,
      toolResult: execution.toolResult,
      durationMs: execution.durationMs,
    })) ?? [];

  await delegate.create({
    data: {
      conversationId: args.conversationId,
      agentId: args.agentId,
      channel: args.channel,
      inboundMessage: args.inboundMessage,
      memoryBefore: args.memoryBefore === undefined ? undefined : toJsonValue(args.memoryBefore),
      promptPreview: args.promptPreview,
      toolCalls: toJsonValue(toolCalls),
      toolResults: toJsonValue(toolResults),
      modelRawText: args.modelRawText,
      finalMessage: args.finalMessage,
      attachments: args.attachments === undefined ? undefined : toJsonValue(args.attachments),
      delivery: args.delivery === undefined ? undefined : toJsonValue(args.delivery),
      memoryUpdate: args.memoryUpdate === undefined ? undefined : toJsonValue(args.memoryUpdate),
    },
  });
}
