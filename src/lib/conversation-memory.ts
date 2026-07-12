import { openai } from "@ai-sdk/openai";
import {
  AgentEventStatus,
  AgentEventType,
  ChannelType,
  MessageRole,
  Prisma,
  type PrismaClient,
} from "@prisma/client";
import { generateText, Output } from "ai";
import { z } from "zod";

import { mapToolExecutionToAgentEvents } from "@/lib/agent-events";

const conversationMemorySchema = z
  .object({
    contactRole: z.enum(["couple", "third_party", "unknown"]).optional(),
    customerName: z.string().trim().min(1).optional(),
    partnerName: z.string().trim().min(1).optional(),
    weddingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    location: z.string().trim().min(1).optional(),
    serviceRegion: z.enum(["FL", "NC_SC_GA", "unknown"]).optional(),
    venue: z.string().trim().min(1).optional(),
    venueStatus: z.enum(["known", "not_finalized", "unknown"]).optional(),
    proposedCallTime: z.string().trim().min(1).optional(),
    customerEmail: z.string().trim().email().optional(),
    bookingConfirmed: z.boolean().optional(),
    pricingShown: z.boolean().optional(),
    guideSent: z.boolean().optional(),
    booked: z.boolean().optional(),
  })
  .strict();

const conversationMemoryFieldSchema = z.enum([
  "contactRole",
  "customerName",
  "partnerName",
  "weddingDate",
  "location",
  "serviceRegion",
  "venue",
  "venueStatus",
  "proposedCallTime",
  "customerEmail",
  "bookingConfirmed",
  "pricingShown",
  "guideSent",
  "booked",
]);

// OpenAI strict structured outputs require every object property to be required.
// Null is the explicit "no update" value for the extractor contract.
const conversationMemorySetOutputSchema = z
  .object({
    contactRole: z.enum(["couple", "third_party", "unknown"]).nullable(),
    customerName: z.string().nullable(),
    partnerName: z.string().nullable(),
    weddingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    location: z.string().nullable(),
    serviceRegion: z.enum(["FL", "NC_SC_GA", "unknown"]).nullable(),
    venue: z.string().nullable(),
    venueStatus: z.enum(["known", "not_finalized", "unknown"]).nullable(),
    proposedCallTime: z.string().nullable(),
    customerEmail: z.string().nullable(),
    bookingConfirmed: z.boolean().nullable(),
    pricingShown: z.boolean().nullable(),
    guideSent: z.boolean().nullable(),
    booked: z.boolean().nullable(),
  })
  .strict();

const memoryExtractionOutputSchema = z
  .object({
    memorySet: conversationMemorySetOutputSchema,
    memoryClear: z.array(conversationMemoryFieldSchema),
    confidence: z.number().min(0).max(1),
  })
  .strict();

export type ConversationMemory = z.infer<typeof conversationMemorySchema>;
type ConversationMemoryField = z.infer<typeof conversationMemoryFieldSchema>;
type MemoryExtractionStatus =
  | "success"
  | "skipped_no_api_key"
  | "schema_error"
  | "timeout"
  | "model_error";

export type ConversationMemoryExtraction = {
  status: MemoryExtractionStatus;
  memorySet: ConversationMemory;
  memoryClear: ConversationMemoryField[];
  confidence: number;
  error?: {
    code: string;
    message: string;
  };
};

type MemoryHistoryMessage = {
  role: "user" | "assistant" | "tool";
  content: string;
  toolName?: string | null;
};

export type OperationalMemoryEvidence = {
  guideDelivered?: boolean;
  consultationBooked?: boolean;
};

type DbWithOptionalMemory = PrismaClient & {
  conversationMemory?: PrismaClient["conversationMemory"];
};

function parseMemory(value: unknown): ConversationMemory {
  const parsed = conversationMemorySchema.safeParse(value);
  return parsed.success ? parsed.data : {};
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  if (value === undefined) {
    return JSON.parse("null") as Prisma.InputJsonValue;
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function emptyMemoryExtraction(
  status: Exclude<MemoryExtractionStatus, "success">,
  error?: ConversationMemoryExtraction["error"],
): ConversationMemoryExtraction {
  return {
    status,
    memorySet: {},
    memoryClear: [],
    confidence: 0,
    ...(error ? { error } : {}),
  };
}

function normalizeMemoryExtractionOutput(
  output: z.infer<typeof memoryExtractionOutputSchema>,
): ConversationMemoryExtraction {
  const memorySetCandidate = Object.fromEntries(
    Object.entries(output.memorySet).filter(([, value]) => value !== null),
  );
  const parsedMemorySet = conversationMemorySchema.safeParse(memorySetCandidate);

  if (!parsedMemorySet.success) {
    const invalidFields = parsedMemorySet.error.issues
      .map((issue) => issue.path.join("."))
      .filter(Boolean)
      .join(",");
    throw new Error(
      invalidFields
        ? `memory_output_validation_failed:${invalidFields}`
        : "memory_output_validation_failed",
    );
  }

  return {
    status: "success",
    memorySet: parsedMemorySet.data,
    memoryClear: output.memoryClear,
    confidence: output.confidence,
  };
}

function classifyMemoryExtractionError(error: unknown): ConversationMemoryExtraction {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const message = rawMessage
    .replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]")
    .slice(0, 500);
  const normalized = message.toLowerCase();
  const status: Exclude<MemoryExtractionStatus, "success" | "skipped_no_api_key"> =
    /(timeout|timed out|abort)/.test(normalized)
      ? "timeout"
      : /(schema|response_format|validation|json)/.test(normalized)
        ? "schema_error"
        : "model_error";

  return emptyMemoryExtraction(status, {
    code: error instanceof Error && error.name ? error.name : "unknown_error",
    message,
  });
}

function parseToolResult(content: string): unknown {
  try {
    return JSON.parse(content) as unknown;
  } catch {
    return null;
  }
}

function groundOperationalMemory(
  extraction: ConversationMemoryExtraction,
  history: MemoryHistoryMessage[],
  evidence?: OperationalMemoryEvidence,
): ConversationMemoryExtraction {
  if (extraction.status !== "success") return extraction;

  const successfulToolEvents = history
    .filter(
      (message): message is MemoryHistoryMessage & { toolName: string } =>
        message.role === "tool" && typeof message.toolName === "string",
    )
    .flatMap((message) =>
      mapToolExecutionToAgentEvents({
        toolName: message.toolName,
        toolResult: parseToolResult(message.content),
      }),
    )
    .filter((event) => event.status === AgentEventStatus.SUCCEEDED);
  const guideToolSucceeded = successfulToolEvents.some(
    (event) => event.type === AgentEventType.PRICING_GUIDE_SENT,
  );
  const bookingToolSucceeded = successfulToolEvents.some(
    (event) => event.type === AgentEventType.CONSULTATION_BOOKED,
  );
  const guideDelivered = evidence?.guideDelivered ?? guideToolSucceeded;
  const consultationBooked = evidence?.consultationBooked ?? bookingToolSucceeded;
  const memorySet = { ...extraction.memorySet };

  if (guideDelivered) {
    memorySet.pricingShown = true;
    memorySet.guideSent = true;
  } else {
    if (memorySet.pricingShown === true) delete memorySet.pricingShown;
    if (memorySet.guideSent === true) delete memorySet.guideSent;
  }

  if (consultationBooked) {
    memorySet.bookingConfirmed = true;
    memorySet.booked = true;
  } else if (memorySet.booked === true) {
    delete memorySet.booked;
  }

  return {
    ...extraction,
    memorySet,
  };
}

export async function loadConversationMemoryWithDb(args: {
  database: PrismaClient;
  conversationId: string;
}): Promise<ConversationMemory> {
  const delegate = (args.database as DbWithOptionalMemory).conversationMemory;

  if (!delegate) {
    return {};
  }

  const row = await delegate.findUnique({
    where: { conversationId: args.conversationId },
    select: { memory: true },
  });

  return parseMemory(row?.memory);
}

export function mergeConversationMemory(
  currentMemory: ConversationMemory,
  extraction: ConversationMemoryExtraction,
): ConversationMemory {
  if (extraction.status !== "success" || extraction.confidence < 0.7) {
    return currentMemory;
  }

  const next: Record<string, unknown> = { ...currentMemory };

  for (const field of extraction.memoryClear) {
    delete next[field];
  }

  for (const [field, value] of Object.entries(extraction.memorySet)) {
    if (value === null || value === undefined) {
      continue;
    }

    next[field] = value;
  }

  return parseMemory(next);
}

export async function saveConversationMemoryWithDb(args: {
  database: PrismaClient;
  conversationId: string;
  memory: ConversationMemory;
}): Promise<void> {
  const delegate = (args.database as DbWithOptionalMemory).conversationMemory;

  if (!delegate) {
    return;
  }

  await delegate.upsert({
    where: { conversationId: args.conversationId },
    create: {
      conversationId: args.conversationId,
      memory: toJsonValue(args.memory),
    },
    update: {
      memory: toJsonValue(args.memory),
    },
  });
}

export async function extractConversationMemory(args: {
  history: MemoryHistoryMessage[];
  currentMemory: ConversationMemory;
  latestUserMessage: string;
  assistantReply: string;
  operationalEvidence?: OperationalMemoryEvidence;
}): Promise<ConversationMemoryExtraction> {
  if (!process.env.OPENAI_API_KEY) {
    return emptyMemoryExtraction("skipped_no_api_key");
  }

  try {
    const { output } = await generateText({
      model: openai(process.env.LEGACY_MEMORY_MODEL || "gpt-4.1-mini"),
      output: Output.object({
        schema: memoryExtractionOutputSchema,
      }),
      system: [
        "You silently extract CRM memory for a wedding videography Instagram sales assistant.",
        "Return structured JSON only.",
        "Extract only facts explicitly supported by the recent conversation.",
        "Every memorySet field is required by the schema. Use null when a field should not be updated.",
        "Normalize weddingDate to YYYY-MM-DD. Use null when the exact date is not known.",
        "Null means no update. Use memoryClear only when the user clearly says a known fact is no longer true.",
        "Do not copy currentMemory into memorySet unless the user explicitly confirms or changes that fact.",
        "If the user says the venue is not finalized, set venueStatus to not_finalized and include venue in memoryClear.",
        "Set pricingShown or guideSent only when a successful pricing-guide tool result is present in recentConversation.",
        "Set booked only when a successful consultation-booking tool result is present in recentConversation.",
        "Assistant reply text alone is not evidence that a guide was delivered or a consultation was booked.",
        "Do not infer the sender is one of the couple if they describe the couple as they/them or say they are helping someone else.",
      ].join("\n"),
      prompt: JSON.stringify(
        {
          recentConversation: args.history.slice(-12),
          latestUserMessage: args.latestUserMessage,
          assistantReply: args.assistantReply,
          currentMemory: args.currentMemory,
        },
        null,
        2,
      ),
      temperature: 0,
      maxOutputTokens: 700,
      timeout: 15_000,
    });

    return groundOperationalMemory(
      normalizeMemoryExtractionOutput(output),
      args.history,
      args.operationalEvidence,
    );
  } catch (error) {
    const failure = classifyMemoryExtractionError(error);
    console.warn("[conversation-memory] extractor failed", {
      status: failure.status,
      error: failure.error,
    });
    return failure;
  }
}

export async function extractAndSaveConversationMemoryWithDb(args: {
  database: PrismaClient;
  conversationId: string;
  latestUserMessage: string;
  assistantReply: string;
  operationalEvidence?: OperationalMemoryEvidence;
}): Promise<{
  status: "saved" | "skipped_no_delegate" | "unchanged";
  memoryBefore?: ConversationMemory;
  memoryAfter?: ConversationMemory;
  extraction?: ConversationMemoryExtraction;
}> {
  const delegate = (args.database as DbWithOptionalMemory).conversationMemory;

  if (!delegate) {
    return { status: "skipped_no_delegate" };
  }

  const currentMemory = await loadConversationMemoryWithDb({
    database: args.database,
    conversationId: args.conversationId,
  });
  const recentMessages = await args.database.message.findMany({
    where: {
      conversationId: args.conversationId,
      role: {
        in: [MessageRole.USER, MessageRole.ASSISTANT, MessageRole.TOOL],
      },
    },
    orderBy: { createdAt: "desc" },
    take: 12,
    select: {
      role: true,
      content: true,
      toolName: true,
    },
  });
  const history = recentMessages
    .reverse()
    .map((message) => ({
      role:
        message.role === MessageRole.USER
          ? ("user" as const)
          : message.role === MessageRole.ASSISTANT
            ? ("assistant" as const)
            : ("tool" as const),
      content: message.content,
      toolName: message.toolName,
    }));

  const extraction = await extractConversationMemory({
    history,
    currentMemory,
    latestUserMessage: args.latestUserMessage,
    assistantReply: args.assistantReply,
    operationalEvidence: args.operationalEvidence,
  });
  const nextMemory = mergeConversationMemory(currentMemory, extraction);

  if (JSON.stringify(nextMemory) === JSON.stringify(currentMemory)) {
    return {
      status: "unchanged",
      memoryBefore: currentMemory,
      memoryAfter: nextMemory,
      extraction,
    };
  }

  await saveConversationMemoryWithDb({
    database: args.database,
    conversationId: args.conversationId,
    memory: nextMemory,
  });

  return {
    status: "saved",
    memoryBefore: currentMemory,
    memoryAfter: nextMemory,
    extraction,
  };
}

export function isConversationMemoryEligibleChannel(channel: ChannelType) {
  return channel === ChannelType.INSTAGRAM;
}

export const conversationMemoryTestHelpers = {
  memoryExtractionOutputSchema,
  normalizeMemoryExtractionOutput,
  classifyMemoryExtractionError,
  groundOperationalMemory,
};
