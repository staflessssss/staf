import { openai } from "@ai-sdk/openai";
import { generateText, Output } from "ai";

import type { WeddingSalesState } from "../state";
import { buildSemanticV2Prompt, semanticV2SystemPrompt } from "./prompt";
import { semanticAnalysisV2Schema, type SemanticAnalysisV2 } from "./schema";

const DEFAULT_SEMANTIC_V2_MODEL = "gpt-4.1-mini";
const DEFAULT_SEMANTIC_V2_TIMEOUT_MS = 25_000;

function readSemanticV2Timeout() {
  const configured = Number(process.env.WEDDING_SALES_SEMANTIC_V2_TIMEOUT_MS);

  return Number.isFinite(configured) && configured >= 1_000
    ? configured
    : DEFAULT_SEMANTIC_V2_TIMEOUT_MS;
}

type SemanticV2Generator = (args: {
  system: string;
  prompt: string;
}) => Promise<unknown>;

async function generateSemanticV2Output(args: {
  system: string;
  prompt: string;
}): Promise<unknown> {
  const { output } = await generateText({
    model: openai(process.env.WEDDING_SALES_SEMANTIC_V2_MODEL || DEFAULT_SEMANTIC_V2_MODEL),
    output: Output.object({
      schema: semanticAnalysisV2Schema,
    }),
    system: args.system,
    prompt: args.prompt,
    temperature: 0,
    maxOutputTokens: 1800,
    timeout: readSemanticV2Timeout(),
  });

  return output;
}

export async function analyzeWeddingSalesSemanticsV2(
  state: WeddingSalesState,
  options: {
    generate?: SemanticV2Generator;
  } = {},
): Promise<SemanticAnalysisV2> {
  const rawOutput = await (options.generate ?? generateSemanticV2Output)({
    system: semanticV2SystemPrompt,
    prompt: buildSemanticV2Prompt(state),
  });

  return semanticAnalysisV2Schema.parse(rawOutput);
}
