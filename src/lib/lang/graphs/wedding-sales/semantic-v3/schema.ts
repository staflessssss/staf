import { z } from "zod";

import { weddingSalesFieldSchema } from "../semantic-v2/schema";

export const groundedFactRelationSchema = z.enum([
  "speaker_self",
  "speaker_partner",
  "wedding",
  "third_party",
  "unknown",
]);

export const groundedFactModeSchema = z.enum(["assert", "correct", "confirm"]);

export const groundedWeddingFactSchema = z.object({
  field: weddingSalesFieldSchema.exclude(["names"]),
  value: z.string().min(1).max(500),
  normalizedValue: z.string().min(1).max(500).nullable(),
  evidence: z.string().min(1).max(500),
  relation: groundedFactRelationSchema,
  mode: groundedFactModeSchema,
  confidence: z.number().min(0).max(1),
});

export const groundedWeddingQuestionSchema = z.object({
  topicId: z.string().min(1).max(120).nullable(),
  normalizedQuestion: z.string().min(1).max(500),
  evidence: z.string().min(1).max(500),
  confidence: z.number().min(0).max(1),
});

export const groundedWeddingDecisionSchema = z.object({
  type: z.enum([
    "accept_guide",
    "accept_call",
    "accept_slot",
    "decline_options",
    "not_ready",
    "request_human",
  ]),
  targetField: weddingSalesFieldSchema.nullable(),
  evidence: z.string().min(1).max(500),
  confidence: z.number().min(0).max(1),
});

export const groundedWeddingUnderstandingSchema = z.object({
  schemaVersion: z.literal(3),
  summary: z.string().min(1).max(800),
  facts: z.array(groundedWeddingFactSchema).max(20),
  questions: z.array(groundedWeddingQuestionSchema).max(12),
  decisions: z.array(groundedWeddingDecisionSchema).max(8),
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
      evidence: z.string().min(1).max(500),
      confidence: z.number().min(0).max(1),
    })
    .nullable(),
  unclear: z
    .array(
      z.object({
        field: weddingSalesFieldSchema.nullable(),
        reason: z.string().min(1).max(500),
        evidence: z.string().max(500),
      }),
    )
    .max(10),
});

export type GroundedWeddingUnderstanding = z.infer<
  typeof groundedWeddingUnderstandingSchema
>;
export type GroundedWeddingFact = GroundedWeddingUnderstanding["facts"][number];
