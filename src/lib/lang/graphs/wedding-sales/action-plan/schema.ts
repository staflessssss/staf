import { z } from "zod";

import { weddingSalesFieldSchema } from "../semantic-v2/schema";

export const weddingSalesActionTypeSchema = z.enum([
  "request_confirmation",
  "answer_question",
  "acknowledge_objection",
  "recommend_owner_handoff",
  "request_clarification",
  "check_wedding_availability",
  "check_consultation_calendar",
  "book_consultation",
  "ask_missing_field",
  "continue_conversation",
  "suppress_reply",
]);

export type WeddingSalesActionType = z.infer<typeof weddingSalesActionTypeSchema>;

export const weddingSalesActionPlanSchema = z.object({
  schemaVersion: z.literal(1),
  actions: z
    .array(
      z.object({
        type: weddingSalesActionTypeSchema,
        field: weddingSalesFieldSchema.nullable(),
        topicId: z.string().max(120).nullable(),
        reason: z.string().max(500),
      }),
    )
    .min(1)
    .max(8),
  responseGoal: z.enum([
    "clarify",
    "answer_and_qualify",
    "run_tools_then_reply",
    "handoff",
    "book_call",
    "continue",
  ]),
  guardrailTrace: z
    .array(
      z.object({
        action: weddingSalesActionTypeSchema,
        allowed: z.boolean(),
        reason: z.string().max(500),
      }),
    )
    .max(20),
});

export type WeddingSalesActionPlan = z.infer<typeof weddingSalesActionPlanSchema>;
export type WeddingSalesAction = WeddingSalesActionPlan["actions"][number];
export type WeddingSalesActionGuardrailTrace =
  WeddingSalesActionPlan["guardrailTrace"][number];
