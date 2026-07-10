import { openai } from "@ai-sdk/openai";
import { ChannelType, MessageRole, Prisma, type PrismaClient } from "@prisma/client";
import { generateText, Output } from "ai";
import { z } from "zod";

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

const memoryExtractionSchema = z
  .object({
    memorySet: conversationMemorySchema.partial().default({}),
    memoryClear: z.array(conversationMemoryFieldSchema).default([]),
    confidence: z.number().min(0).max(1).default(0.8),
  })
  .strict();

export type ConversationMemory = z.infer<typeof conversationMemorySchema>;
export type ConversationMemoryExtraction = z.infer<typeof memoryExtractionSchema>;

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
  if (extraction.confidence < 0.45) {
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
  history: Array<{ role: "user" | "assistant" | "tool"; content: string; toolName?: string | null }>;
  currentMemory: ConversationMemory;
  latestUserMessage: string;
  assistantReply: string;
}): Promise<ConversationMemoryExtraction> {
  if (!process.env.OPENAI_API_KEY) {
    return { memorySet: {}, memoryClear: [], confidence: 0 };
  }

  try {
    const { output } = await generateText({
      model: openai(process.env.LEGACY_MEMORY_MODEL || "gpt-4.1-mini"),
      output: Output.object({
        schema: memoryExtractionSchema,
      }),
      system: [
        "You silently extract CRM memory for a wedding videography Instagram sales assistant.",
        "Return structured JSON only.",
        "Extract only facts explicitly supported by the recent conversation.",
        "Null means no update. Use memoryClear only when the user clearly says a known fact is no longer true.",
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

    return output;
  } catch {
    return { memorySet: {}, memoryClear: [], confidence: 0 };
  }
}

export async function extractAndSaveConversationMemoryWithDb(args: {
  database: PrismaClient;
  conversationId: string;
  latestUserMessage: string;
  assistantReply: string;
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
