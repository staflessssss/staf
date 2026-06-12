import { z } from "zod";

export const weddingSalesFieldSchema = z.enum([
  "customerName",
  "partnerName",
  "names",
  "weddingDate",
  "weddingYear",
  "location",
  "venue",
  "email",
  "callTime",
]);

export type WeddingSalesField = z.infer<typeof weddingSalesFieldSchema>;

export const semanticProvidedValueSchema = z.object({
  value: z.string().min(1).max(500),
  normalizedValue: z.string().min(1).max(500).nullable(),
  confidence: z.number().min(0).max(1),
  evidence: z.string().max(500),
  alternatives: z.array(z.string().max(500)).max(5),
});

export const semanticIntentCategorySchema = z.enum([
  "provide_info",
  "ask_question",
  "request_modification",
  "express_objection",
  "confirm",
  "reject",
  "request_human",
  "greeting",
  "closing",
  "off_topic",
]);

export const semanticAnalysisV2Schema = z.object({
  schemaVersion: z.literal(2),
  intents: z
    .array(
      z.object({
        category: semanticIntentCategorySchema,
        confidence: z.number().min(0).max(1),
        targetField: weddingSalesFieldSchema.nullable(),
        evidence: z.string().max(500),
      }),
    )
    .min(1)
    .max(12),
  primaryIntent: semanticIntentCategorySchema,
  entities: z
    .array(
      z.object({
        field: weddingSalesFieldSchema,
        value: semanticProvidedValueSchema.shape.value,
        normalizedValue: semanticProvidedValueSchema.shape.normalizedValue,
        confidence: semanticProvidedValueSchema.shape.confidence,
        evidence: semanticProvidedValueSchema.shape.evidence,
        alternatives: semanticProvidedValueSchema.shape.alternatives,
      }),
    )
    .max(20),
  providedInfo: z
    .object({
      customerName: semanticProvidedValueSchema.nullable(),
      partnerName: semanticProvidedValueSchema.nullable(),
    })
    .optional(),
  questions: z
    .array(
      z.object({
        topicId: z.string().max(120).nullable(),
        normalizedQuestion: z.string().min(1).max(500),
        confidence: z.number().min(0).max(1),
        evidence: z.string().max(500),
      }),
    )
    .max(10),
  objections: z
    .array(
      z.object({
        type: z.enum([
          "not_ready_to_schedule",
          "not_ready_to_provide_info",
          "needs_more_information",
          "price_concern",
          "wants_to_think",
          "other",
        ]),
        confidence: z.number().min(0).max(1),
        evidence: z.string().max(500),
      }),
    )
    .max(10),
  pendingResolution: z
    .object({
      field: weddingSalesFieldSchema,
      type: z.enum(["confirm", "reject", "correct", "ambiguous"]),
      proposedValue: z.string().max(500).nullable(),
      confidence: z.number().min(0).max(1),
      evidence: z.string().max(500),
    })
    .nullable(),
  clientType: z
    .object({
      value: z.enum([
        "new_lead",
        "existing_client",
        "past_client",
        "planner",
        "vendor",
        "unknown",
      ]),
      confidence: z.number().min(0).max(1),
      evidence: z.string().max(500),
    })
    .nullable(),
  ambiguity: z.array(z.string().max(500)).max(10),
});

export type SemanticAnalysisV2 = z.infer<typeof semanticAnalysisV2Schema>;
export type SemanticEntityV2 = SemanticAnalysisV2["entities"][number];
export type SemanticProvidedValueV2 = z.infer<typeof semanticProvidedValueSchema>;
