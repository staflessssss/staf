import { openai } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import { z } from "zod";

import type { ReplyActionContract } from "./reply-contract";
import { validateGeneratedReply } from "./reply-guards";
import type {
  SimpleWeddingSalesResponseKey,
  SimpleWeddingSalesSlots,
  SimpleWeddingSalesState,
} from "./state";
import type { SimpleWeddingKnowledgeContext } from "./knowledge";

const DEFAULT_REPHRASER_MODEL = "gpt-4.1-mini";

const rephraserOutputSchema = z.object({
  text: z.string().trim().min(1),
});

const ACTIVE_REPHRASER_KEYS = new Set<SimpleWeddingSalesResponseKey>([
  "utter_ask_venue",
  "utter_ask_call_time",
  "utter_ask_email",
  "utter_ask_booking_confirmation",
  "utter_booking_confirmed",
  "utter_answer_raw_footage",
  "utter_acknowledgement",
]);

export type ContextualRephraserInput = {
  responseKey: SimpleWeddingSalesResponseKey;
  baseText: string;
  variationId: string;
  agentId?: string;
  contactId?: string;
  latestCustomerMessage: string;
  recentTurns: Array<{
    role: "customer" | "assistant";
    text: string;
  }>;
  slots: SimpleWeddingSalesSlots;
  replyContract: ReplyActionContract;
  forbiddenPhrases: string[];
  allowedEmojis: string[];
  maxEmojis: number;
  state: SimpleWeddingSalesState;
  knowledge: SimpleWeddingKnowledgeContext;
  generateDraft?: (input: ContextualRephraserInput) => Promise<string> | string;
};

export type ContextualRephraserResult = {
  mode: "shadow" | "active";
  eligible: boolean;
  activeAllowed?: boolean;
  baseText: string;
  baseVariationId?: string;
  draftText?: string;
  guardOk?: boolean;
  wouldUse?: boolean;
  usedAsOutbound?: boolean;
  fallbackToCatalog?: boolean;
  fallbackReason?:
    | "response_key_not_allowed"
    | "contact_not_allowlisted"
    | "agent_not_allowlisted"
    | "shadow_disabled"
    | "missing_openai_key"
    | "model_failed"
    | "guard_failed";
  guardErrors?: string[];
};

function compact(value: string, maxLength: number) {
  const trimmed = value.trim();

  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

function parseAllowlist(value?: string) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isAllowlisted(value: string | undefined, allowlist: string[]) {
  return Boolean(value && allowlist.includes(value));
}

function resolveRephraserActivation(input: ContextualRephraserInput) {
  const activeRequested =
    process.env.WEDDING_SALES_SIMPLE_REPHRASER_ACTIVE?.trim() === "true";
  const contactAllowlist = parseAllowlist(
    process.env.WEDDING_SALES_SIMPLE_REPHRASER_ACTIVE_CONTACT_IDS,
  );
  const agentAllowlist = parseAllowlist(
    process.env.WEDDING_SALES_SIMPLE_REPHRASER_ACTIVE_AGENT_IDS,
  );

  if (!activeRequested) {
    return {
      mode: "shadow" as const,
      activeAllowed: false,
      fallbackReason: undefined,
    };
  }

  if (!isAllowlisted(input.contactId, contactAllowlist)) {
    return {
      mode: "shadow" as const,
      activeAllowed: false,
      fallbackReason: "contact_not_allowlisted" as const,
    };
  }

  if (agentAllowlist.length > 0 && !isAllowlisted(input.agentId, agentAllowlist)) {
    return {
      mode: "shadow" as const,
      activeAllowed: false,
      fallbackReason: "agent_not_allowlisted" as const,
    };
  }

  return {
    mode: "active" as const,
    activeAllowed: true,
    fallbackReason: undefined,
  };
}

function extractEmails(text: string) {
  return Array.from(text.matchAll(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi)).map(
    (match) => match[0].toLowerCase(),
  );
}

function extractCallTimes(text: string) {
  return Array.from(text.matchAll(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi)).map(
    (match) => match[0].toLowerCase().replace(/\s+/g, ""),
  );
}

function extractPrices(text: string) {
  return Array.from(text.matchAll(/\$\s?\d[\d,]*(?:\.\d{2})?/g)).map((match) =>
    match[0].replace(/\s+/g, ""),
  );
}

function extractDates(text: string) {
  return Array.from(
    text.matchAll(
      /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?(?:,\s*20\d{2})?\b|\b20\d{2}-\d{2}-\d{2}\b/gi,
    ),
  ).map((match) => match[0].toLowerCase());
}

function countAllowedEmojis(text: string, allowedEmojis: string[]) {
  return allowedEmojis.reduce((count, emoji) => {
    return count + (text.match(new RegExp(emoji, "gu"))?.length ?? 0);
  }, 0);
}

function containsOtherEmoji(text: string, allowedEmojis: string[]) {
  const withoutAllowed = allowedEmojis.reduce(
    (result, emoji) => result.replaceAll(emoji, ""),
    text,
  );

  return /\p{Extended_Pictographic}/u.test(withoutAllowed);
}

function addedMeaning(baseText: string, draftText: string, term: string) {
  return !new RegExp(`\\b${term}\\b`, "i").test(baseText) &&
    new RegExp(`\\b${term}\\b`, "i").test(draftText);
}

function ensureTokensPreserved(args: {
  baseText: string;
  draftText: string;
  extract: (text: string) => string[];
  reason: string;
  errors: string[];
}) {
  const baseValues = args.extract(args.baseText);
  const draftValues = args.extract(args.draftText);

  for (const value of baseValues) {
    if (!draftValues.includes(value)) {
      args.errors.push(args.reason);
      return;
    }
  }
}

export function validateContextualRephrase(args: {
  baseText: string;
  draftText: string;
  replyContract: ReplyActionContract;
  forbiddenPhrases: string[];
  allowedEmojis: string[];
  maxEmojis: number;
  state: SimpleWeddingSalesState;
  knowledge: SimpleWeddingKnowledgeContext;
}) {
  const errors: string[] = [];
  const draftText = args.draftText.trim();
  const replyGuard = validateGeneratedReply({
    reply: draftText,
    contract: args.replyContract,
    knowledge: args.knowledge,
    state: args.state,
  });

  if (!replyGuard.ok) {
    errors.push(...replyGuard.reasons);
  }

  if (/{{[^}]+}}/.test(draftText)) {
    errors.push("unresolved_template_variable");
  }

  for (const phrase of args.forbiddenPhrases) {
    if (draftText.toLowerCase().includes(phrase.toLowerCase())) {
      errors.push(`forbidden_phrase:${phrase}`);
    }
  }

  if (containsOtherEmoji(draftText, args.allowedEmojis)) {
    errors.push("disallowed_emoji");
  }

  if (countAllowedEmojis(draftText, args.allowedEmojis) > args.maxEmojis) {
    errors.push("too_many_emojis");
  }

  ensureTokensPreserved({
    baseText: args.baseText,
    draftText,
    extract: extractEmails,
    reason: "changed_email",
    errors,
  });
  ensureTokensPreserved({
    baseText: args.baseText,
    draftText,
    extract: extractCallTimes,
    reason: "changed_call_time",
    errors,
  });
  ensureTokensPreserved({
    baseText: args.baseText,
    draftText,
    extract: extractPrices,
    reason: "changed_price",
    errors,
  });
  ensureTokensPreserved({
    baseText: args.baseText,
    draftText,
    extract: extractDates,
    reason: "changed_date",
    errors,
  });

  if (addedMeaning(args.baseText, draftText, "booked|confirmed|scheduled")) {
    errors.push("added_booking_confirmation");
  }

  if (addedMeaning(args.baseText, draftText, "available|open")) {
    errors.push("added_availability");
  }

  if (draftText.length > Math.max(args.baseText.length * 2, args.baseText.length + 80)) {
    errors.push("too_long");
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

async function generateRephraseDraft(input: ContextualRephraserInput) {
  const { output } = await generateText({
    model: openai(process.env.WEDDING_SALES_SIMPLE_REPHRASER_MODEL || DEFAULT_REPHRASER_MODEL),
    output: Output.object({
      schema: rephraserOutputSchema,
    }),
    system: [
      "You rewrite a wedding sales assistant message for Instagram.",
      "You must preserve the exact business meaning of the base message.",
      "Do not add new facts.",
      "Do not remove required details.",
      "Do not promise anything not in the base message.",
      "Do not mention being an AI, bot, automation, system, workflow, CRM, or handoff.",
      "Do not change dates, times, prices, email, names, or availability.",
      "Use a warm, concise, natural Instagram DM tone.",
      "Persona: Taras from Myndful Films.",
      `Allowed emojis: ${input.allowedEmojis.join(" ")}.`,
      `Max emojis: ${input.maxEmojis}.`,
      "Return only JSON.",
    ].join("\n"),
    prompt: JSON.stringify(
      {
        responseKey: input.responseKey,
        baseText: input.baseText,
        latestCustomerMessage: compact(input.latestCustomerMessage, 1000),
        recentTurns: input.recentTurns.map((turn) => ({
          role: turn.role,
          text: compact(turn.text, 800),
        })),
        slots: input.slots,
        requiredQuestion: input.replyContract.requiredQuestion,
        replyType: input.replyContract.replyType,
        forbiddenPhrases: input.forbiddenPhrases,
      },
      null,
      2,
    ),
    temperature: 0.4,
    maxOutputTokens: 250,
    timeout: 12_000,
  });

  return output.text;
}

export async function runContextualRephraserShadow(
  input: ContextualRephraserInput,
): Promise<ContextualRephraserResult> {
  const activation = resolveRephraserActivation(input);
  const baseResult = {
    mode: activation.mode,
    activeAllowed: activation.activeAllowed,
    baseText: input.baseText,
    baseVariationId: input.variationId,
  };

  if (!ACTIVE_REPHRASER_KEYS.has(input.responseKey)) {
    return {
      ...baseResult,
      mode: "shadow",
      activeAllowed: false,
      eligible: false,
      wouldUse: false,
      fallbackReason: "response_key_not_allowed",
    };
  }

  if (activation.fallbackReason && !input.generateDraft) {
    return {
      ...baseResult,
      eligible: true,
      wouldUse: false,
      fallbackReason: activation.fallbackReason,
    };
  }

  if (
    activation.mode !== "active" &&
    !input.generateDraft &&
    process.env.WEDDING_SALES_SIMPLE_REPHRASER_SHADOW !== "true"
  ) {
    return {
      ...baseResult,
      eligible: true,
      wouldUse: false,
      fallbackReason: "shadow_disabled",
    };
  }

  if (!input.generateDraft && !process.env.OPENAI_API_KEY) {
    return {
      ...baseResult,
      eligible: true,
      wouldUse: false,
      fallbackReason: "missing_openai_key",
    };
  }

  try {
    const draftText = await (input.generateDraft ?? generateRephraseDraft)(input);
    const guard = validateContextualRephrase({
      baseText: input.baseText,
      draftText,
      replyContract: input.replyContract,
      forbiddenPhrases: input.forbiddenPhrases,
      allowedEmojis: input.allowedEmojis,
      maxEmojis: input.maxEmojis,
      state: input.state,
      knowledge: input.knowledge,
    });

    return {
      ...baseResult,
      eligible: true,
      draftText,
      guardOk: guard.ok,
      wouldUse: guard.ok,
      fallbackReason: guard.ok ? activation.fallbackReason : "guard_failed",
      guardErrors: guard.ok ? undefined : guard.errors,
    };
  } catch (error) {
    return {
      ...baseResult,
      eligible: true,
      wouldUse: false,
      fallbackReason: "model_failed",
      guardErrors: [error instanceof Error ? error.message : "unknown"],
    };
  }
}

export const contextualRephraserTestHelpers = {
  ACTIVE_REPHRASER_KEYS,
  parseAllowlist,
  resolveRephraserActivation,
  rephraserOutputSchema,
  validateContextualRephrase,
};
