import { openai } from "@ai-sdk/openai";
import { generateText, Output } from "ai";

import type { WeddingSalesState } from "../state";
import {
  buildGroundedWeddingPrompt,
  groundedWeddingSystemPrompt,
} from "./prompt";
import {
  groundedWeddingUnderstandingSchema,
  type GroundedWeddingUnderstanding,
} from "./schema";

const DEFAULT_MODEL = "gpt-4.1-mini";
const DEFAULT_TIMEOUT_MS = 25_000;

type GroundedWeddingGenerator = (args: {
  system: string;
  prompt: string;
}) => Promise<unknown>;

function timeoutMs() {
  const configured = Number(process.env.WEDDING_SALES_GROUNDED_V3_TIMEOUT_MS);
  return Number.isFinite(configured) && configured >= 1_000
    ? configured
    : DEFAULT_TIMEOUT_MS;
}

async function generateGroundedWeddingOutput(args: {
  system: string;
  prompt: string;
}) {
  const { output } = await generateText({
    model: openai(process.env.WEDDING_SALES_GROUNDED_V3_MODEL || DEFAULT_MODEL),
    output: Output.object({ schema: groundedWeddingUnderstandingSchema }),
    system: args.system,
    prompt: args.prompt,
    temperature: 0,
    maxOutputTokens: 2200,
    timeout: timeoutMs(),
  });
  return output;
}

export async function analyzeGroundedWeddingTurn(
  state: WeddingSalesState,
  options: { generate?: GroundedWeddingGenerator } = {},
): Promise<GroundedWeddingUnderstanding> {
  const raw = await (options.generate ?? generateGroundedWeddingOutput)({
    system: groundedWeddingSystemPrompt,
    prompt: buildGroundedWeddingPrompt(state),
  });
  return groundedWeddingUnderstandingSchema.parse(raw);
}
