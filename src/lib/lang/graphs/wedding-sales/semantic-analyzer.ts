import { openai } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import { z } from "zod";

import { traceLangRuntime } from "@/lib/lang/langsmith";

import type { WeddingSalesState } from "./state";

const DEFAULT_SEMANTIC_MODEL = "gpt-4.1-mini";

const semanticAnalysisSchema = z.object({
  messageKind: z.enum([
    "details",
    "correction",
    "question",
    "scheduling",
    "confirmation",
    "rejection",
    "other",
  ]),
  answersRequestedField: z.enum([
    "names",
    "wedding_date",
    "wedding_year",
    "location",
    "venue",
    "call_time",
    "email",
    "none",
  ]),
  names: z.string().max(200).nullable(),
  weddingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  weddingDateText: z.string().max(120).nullable(),
  weddingYear: z.string().regex(/^(?:19|20)\d{2}$/).nullable(),
  location: z.string().max(200).nullable(),
  venue: z.string().max(300).nullable(),
  email: z.string().max(320).nullable(),
  proposedCallTime: z.string().max(200).nullable(),
  weddingDateChange: z.enum(["none", "explicit", "ambiguous"]),
  locationChange: z.enum(["none", "explicit", "ambiguous"]),
  confirmsPendingChange: z.boolean(),
  rejectsPendingChange: z.boolean(),
  asksBusinessQuestion: z.boolean(),
  confidence: z.number().min(0).max(1),
});

export type WeddingSalesSemanticAnalysis = z.infer<typeof semanticAnalysisSchema>;

function shouldUseSemanticAnalyzer() {
  const explicitlyEnabled = process.env.WEDDING_SALES_SEMANTIC_ANALYZER === "true";
  const productionRuntime = process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";

  return (
    Boolean(process.env.OPENAI_API_KEY) &&
    process.env.WEDDING_SALES_SEMANTIC_ANALYZER !== "false" &&
    (explicitlyEnabled || productionRuntime)
  );
}

function compact(value: string | undefined, maxLength: number) {
  const normalized = value?.trim();

  if (!normalized) {
    return undefined;
  }

  return normalized.length > maxLength ? normalized.slice(-maxLength) : normalized;
}

function buildSemanticFacts(state: WeddingSalesState) {
  return {
    currentLeadState: {
      leadStage: state.leadStage,
      names: state.names,
      weddingDate: state.weddingDate,
      weddingDateText: state.weddingDateText,
      weddingYear: state.weddingYear,
      location: state.location,
      venue: state.venue,
      customerEmail: state.customerEmail,
      availability: state.availability,
      proposedCallTime: state.proposedCallTime,
      calendarStatus: state.calendarStatus,
      pendingChangeField: state.pendingChangeField,
      pendingChangeDisplay: state.pendingChangeDisplay,
      lastAssistantIntent: state.lastAssistantIntent,
    },
    recentConversation: compact(state.conversationContext, 5000),
    previousAssistantReply: compact(state.responseDraft, 1200),
    latestCustomerMessage: compact(state.latestCustomerMessage, 2000),
  };
}

const semanticSystemPrompt = `
You are the semantic understanding layer for a wedding videography sales agent.
You do not write a customer reply and you do not choose or call tools.
Your only job is to interpret the latest customer message in its conversation context.

Rules:
- Extract only facts stated, answered, confirmed, or corrected in the latest customer message.
- Use prior state and conversation only to resolve references such as "actually October 17", "yes", "there", or "10 works".
- Never copy an old fact from context into an extracted field unless the latest message confirms or changes it.
- Preserve both people's names exactly as supplied. "Taras and Valerie" is already a valid pair of names; do not demand surnames.
- A location is a city/region. A venue is the specific place or street address.
- weddingDate must be ISO YYYY-MM-DD only when day, month, and year are all known. Otherwise use weddingDateText.
- Mark a changed date/location as explicit when the customer clearly corrects it ("actually", "I mean", "our new date is").
- Mark it ambiguous when a new conflicting date/location appears without making clear whether it replaces the current one.
- A short answer can answer the field requested by the previous assistant even without labels.
- confirmsPendingChange/rejectsPendingChange apply only when the agent has a pending change confirmation.
- asksBusinessQuestion means the customer is asking about services, pricing, logistics, availability, deliverables, or an existing booking.
- Return null for every field not supplied by the latest customer message.
`.trim();

export async function analyzeWeddingSalesSemantics(
  state: WeddingSalesState,
): Promise<WeddingSalesSemanticAnalysis | null> {
  if (!shouldUseSemanticAnalyzer()) {
    return null;
  }

  try {
    return await traceLangRuntime(
      "wedding_sales.semantic_analyzer",
      {
        channel: state.channel,
        runtimeType: "langgraph_wedding_sales",
        semanticModel: process.env.WEDDING_SALES_SEMANTIC_MODEL || DEFAULT_SEMANTIC_MODEL,
      },
      async () => {
        const { output } = await generateText({
          model: openai(process.env.WEDDING_SALES_SEMANTIC_MODEL || DEFAULT_SEMANTIC_MODEL),
          output: Output.object({
            schema: semanticAnalysisSchema,
          }),
          system: semanticSystemPrompt,
          prompt: JSON.stringify(buildSemanticFacts(state), null, 2),
          temperature: 0,
          maxOutputTokens: 700,
          timeout: 12_000,
        });

        return output;
      },
    );
  } catch (error) {
    console.warn("[wedding-sales] Semantic analyzer failed; using deterministic analysis.", error);
    return null;
  }
}

export const weddingSalesSemanticTestHelpers = {
  semanticAnalysisSchema,
};
