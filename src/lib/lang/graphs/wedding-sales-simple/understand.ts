import { openai } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import { z } from "zod";

import type { SimpleWeddingSalesState, TurnUnderstanding } from "./state";
import { turnUnderstandingSchema } from "./state";

const DEFAULT_UNDERSTANDING_MODEL = "gpt-4.1-mini";

const llmTurnUnderstandingSchema = z.object({
  customerMessageType: turnUnderstandingSchema.shape.customerMessageType,
  facts: z.object({
    customerName: z.string().trim().min(1).nullable(),
    partnerName: z.string().trim().min(1).nullable(),
    weddingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    weddingDateText: z.string().trim().min(1).nullable(),
    location: z.string().trim().min(1).nullable(),
    venue: z.string().trim().min(1).nullable(),
    email: z.string().trim().email().nullable(),
    proposedCallTime: z.string().trim().min(1).nullable(),
    senderRole: z.enum(["bride", "groom", "mother", "planner", "friend", "unknown"]).nullable(),
  }),
  questionsAskedByCustomer: turnUnderstandingSchema.shape.questionsAskedByCustomer,
  confidence: turnUnderstandingSchema.shape.confidence,
});

export type SimpleWeddingSalesUnderstandTurn = (
  state: SimpleWeddingSalesState,
) => Promise<TurnUnderstanding> | TurnUnderstanding;

function compact(value: string | undefined, maxLength: number) {
  const normalized = value?.trim();

  if (!normalized) {
    return undefined;
  }

  return normalized.length > maxLength ? normalized.slice(-maxLength) : normalized;
}

const understandingSystemPrompt = `
You are the reading layer for a wedding videography sales assistant.
Return JSON only. Do not write a customer reply and do not choose the next step.

Extract only facts and questions from the latest customer message.
Use prior state only to resolve short references.

Rules:
- weddingDate is YYYY-MM-DD only when month, day, and year are known.
- Put a month/day without a year into weddingDateText.
- location is a city or region. venue is the specific place.
- proposedCallTime is the customer's requested consultation call time.
- senderRole is who appears to be writing: bride, groom, mother, planner, friend, or unknown.
- customerMessageType is the main intent of the latest message.
- questionsAskedByCustomer can include multiple topics.
- Use raw_footage for questions about raw footage, raw files, unedited footage, or all footage.
- A request to speak with Taras, the owner, a person, or a human is an identity question because
  this assistant writes as the configured founder. Include identity; do not treat it as a handoff decision.
`.trim();

function extractEmail(message: string) {
  return /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.exec(message)?.[0];
}

function extractIsoDate(message: string) {
  return /\b(20\d{2})-(\d{2})-(\d{2})\b/.exec(message)?.[0];
}

function extractMonthDate(message: string) {
  const match = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(20\d{2}))?\b/i.exec(
    message,
  );

  if (!match) {
    return {};
  }

  const months: Record<string, string> = {
    jan: "01",
    january: "01",
    feb: "02",
    february: "02",
    mar: "03",
    march: "03",
    apr: "04",
    april: "04",
    may: "05",
    jun: "06",
    june: "06",
    jul: "07",
    july: "07",
    aug: "08",
    august: "08",
    sep: "09",
    september: "09",
    oct: "10",
    october: "10",
    nov: "11",
    november: "11",
    dec: "12",
    december: "12",
  };
  const month = months[match[1]?.toLowerCase() ?? ""];
  const day = match[2]?.padStart(2, "0");
  const year = match[3];

  if (month && day && year) {
    return {
      weddingDate: `${year}-${month}-${day}`,
      weddingDateText: match[0],
    };
  }

  return { weddingDateText: match[0] };
}

function extractNames(message: string) {
  const normalizedMessage = message.replace(/^\s*\d+[\).:-]?\s*/, "");
  const introduced = /\b(?:we are|we're|this is|names are|i am|i'm)\s+([A-Z][a-z]+)(?:\s+(?:and|&)\s+([A-Z][a-z]+))?/i.exec(
    normalizedMessage,
  );
  const barePair = /^\s*([A-Z][a-z]+)\s+(?:and|&)\s+([A-Z][a-z]+)[.!]?\s*$/.exec(normalizedMessage);
  const match = introduced ?? barePair;

  return {
    customerName: match?.[1],
    partnerName: match?.[2],
  };
}

function splitCombinedCoupleName(facts: TurnUnderstanding["facts"]) {
  if (!facts.customerName) {
    return facts;
  }

  const match = /^\s*([A-Z][a-z]+)\s+(?:and|&)\s+([A-Z][a-z]+)\s*$/i.exec(
    facts.customerName,
  );

  return match
    ? {
        ...facts,
        customerName: match[1],
        partnerName: facts.partnerName ?? match[2],
      }
    : facts;
}

function normalizeLlmUnderstanding(
  state: SimpleWeddingSalesState,
  output: z.infer<typeof llmTurnUnderstandingSchema>,
) {
  const heuristic = understandTurnHeuristically(state);
  const llmFacts = Object.fromEntries(
    Object.entries(output.facts).filter(([, value]) => value !== null),
  );

  return turnUnderstandingSchema.parse({
    ...output,
    facts: splitCombinedCoupleName({
      ...heuristic.facts,
      ...llmFacts,
    }),
    questionsAskedByCustomer: normalizeQuestionTypes([
      ...new Set([
        ...output.questionsAskedByCustomer,
        ...heuristic.questionsAskedByCustomer,
      ]),
    ], state.latestCustomerMessage),
  });
}

function extractLocation(message: string) {
  const match = /\b(?:in|near|around)\s+([A-Z][A-Za-z .'-]+?)(?:[?.!,]|$|\s+(?:and|for|on|at)\b)/.exec(
    message,
  );

  return match?.[1]?.trim();
}

function normalizeSuggestedTimeLabel(value: string) {
  const match = /^(\d{1,2})(?::(\d{2}))?\s*(?:am|pm)?$/i.exec(value.trim());

  if (!match) {
    return undefined;
  }

  return `${match[1]?.padStart(2, "0")}:${match[2] ?? "00"}`;
}

function resolveSuggestedCallTime(
  state: SimpleWeddingSalesState,
  message: string,
) {
  const normalizedMessage = message.toLowerCase();

  if (!/\b(?:works?|yes|yeah|yep|ok|okay|sure|let'?s do|that one)\b/i.test(message)) {
    return undefined;
  }

  const mentionedTimes = Array.from(
    normalizedMessage.matchAll(/\b(\d{1,2}(?::\d{2})?)\s*(?:am|pm)?\b/g),
  )
    .map((match) => normalizeSuggestedTimeLabel(match[1] ?? ""))
    .filter((value): value is string => Boolean(value));
  const suggestions = state.suggestedCallTimes ?? [];
  const selectedTime = mentionedTimes.find((time) => suggestions.includes(time));
  const calendarDate = state.calendarContextDate ?? state.checkedCallDate;

  if (!selectedTime || !calendarDate) {
    return undefined;
  }

  return `${calendarDate}T${selectedTime}:00`;
}

function extractCallTime(state: SimpleWeddingSalesState, message: string) {
  const match = /\b(?:(?:tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week|next monday|next tuesday|next wednesday|next thursday|next friday)[^?.!,]{0,40})?\b(?:at\s*)?(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i.exec(
    message,
  );

  if (match) {
    return match[0].trim();
  }

  return resolveSuggestedCallTime(state, message);
}

function inferQuestions(message: string): TurnUnderstanding["questionsAskedByCustomer"] {
  const normalized = message.toLowerCase();
  const questions: TurnUnderstanding["questionsAskedByCustomer"] = [];

  if (/\b(price|pricing|cost|package|packages|collection|collections|rate|rates)\b/.test(normalized)) {
    questions.push("pricing");
  }

  if (/\b(available|availability|open|free)\b/.test(normalized)) {
    questions.push("availability");
  }

  if (/\b(portfolio|galler(?:y|ies)|recent films?|sample films?|examples?|full films?)\b/.test(normalized)) {
    questions.push("portfolio");
  }

  if (/\b(travel|destination|travel fee)\b/.test(normalized)) {
    questions.push("travel");
  }

  if (/\b(raw footage|raw files?|unedited footage|all footage|footage files?)\b/.test(normalized)) {
    questions.push("raw_footage");
  }

  if (/\b(include|included|coverage|hours|deliverables)\b/.test(normalized)) {
    questions.push("package_inclusions");
  }

  if (
    /\bwho\s+(?:(?:will|would)\s+)?(?:shoot|film)s?\b/.test(normalized) ||
    /\b(?:shooter|filmmaker|videographer|lead filmmaker|team)\b/.test(normalized) ||
    /\b(?:will\s+you\s+shoot|are\s+you\s+filming|you\s+filming|taras\s+(?:shooting|filming))\b/.test(
      normalized,
    )
  ) {
    questions.push("team");
  }

  if (/\b(book|booking|reserve|lock it in)\b/.test(normalized)) {
    questions.push("booking");
  }

  if (/\b(?:where|how)\b[\s\S]{0,40}\b(?:call|talk|meet|consult)\b/.test(normalized)) {
    questions.push("booking");
  }

  if (
    /\b(?:are you|is this)\s+taras\b/.test(normalized) ||
    /\b(?:speak|talk|chat)\b[\s\S]{0,40}\b(?:taras|human|person|someone real|owner)\b/.test(
      normalized,
    )
  ) {
    questions.push("identity");
  }

  return [...new Set(questions)];
}

function normalizeQuestionTypes(
  types: TurnUnderstanding["questionsAskedByCustomer"],
  text: string,
): TurnUnderstanding["questionsAskedByCustomer"] {
  const normalized = new Set(types);
  const lower = text.toLowerCase();
  const isShooterQuestion =
    /\bwho\b[\s\S]{0,60}\b(?:shoot|shoots|shooter|filming|film|films|filmmaker|videographer)\b/.test(
      lower,
    ) ||
    /\bwho\s+(?:would|will)\s+shoot\b/.test(lower) ||
    /\blead filmmaker\b/.test(lower);

  if (isShooterQuestion) {
    normalized.add("team");
    normalized.delete("identity");
  }

  return [...normalized];
}

function inferSenderRole(message: string): TurnUnderstanding["facts"]["senderRole"] {
  const normalized = message.toLowerCase();

  if (/\bmother of (?:the )?bride\b|\bbride'?s mom\b|\bmom of (?:the )?bride\b/.test(normalized)) {
    return "mother";
  }

  if (/\bplanner|coordinator\b/.test(normalized)) {
    return "planner";
  }

  if (/\bbride\b/.test(normalized)) {
    return "bride";
  }

  if (/\bgroom\b/.test(normalized)) {
    return "groom";
  }

  if (/\bfriend of\b/.test(normalized)) {
    return "friend";
  }

  return undefined;
}

export function understandTurnHeuristically(
  state: SimpleWeddingSalesState,
): TurnUnderstanding {
  const message = state.latestCustomerMessage;
  const normalized = message.toLowerCase();
  const questionsAskedByCustomer = normalizeQuestionTypes(inferQuestions(message), message);
  const isoDate = extractIsoDate(message);
  const monthDate = extractMonthDate(message);
  const email = extractEmail(message);
  const proposedCallTime = extractCallTime(state, message);
  const names = extractNames(message);

  const customerMessageType: TurnUnderstanding["customerMessageType"] = email
    ? "email_provided"
    : proposedCallTime
      ? "call_time_proposed"
      : questionsAskedByCustomer.includes("availability")
        ? "availability_question"
        : questionsAskedByCustomer.length > 0
          ? "business_question"
          : /\b(yes|confirmed|confirm|works|sounds good)\b/.test(normalized)
            ? "booking_confirmation"
            : "answer_to_question";

  return turnUnderstandingSchema.parse({
    customerMessageType,
    facts: {
      ...names,
      weddingDate: isoDate ?? monthDate.weddingDate,
      weddingDateText: monthDate.weddingDateText,
      location: extractLocation(message),
      email,
      proposedCallTime,
      senderRole: inferSenderRole(message),
    },
    questionsAskedByCustomer,
    confidence: 0.7,
  });
}

export async function understandTurn(
  state: SimpleWeddingSalesState,
  extractor?: SimpleWeddingSalesUnderstandTurn,
): Promise<TurnUnderstanding> {
  if (extractor) {
    return turnUnderstandingSchema.parse(await extractor(state));
  }

  if (!process.env.OPENAI_API_KEY) {
    return understandTurnHeuristically(state);
  }

  try {
    const { output } = await generateText({
      model: openai(process.env.WEDDING_SALES_SIMPLE_UNDERSTANDING_MODEL || DEFAULT_UNDERSTANDING_MODEL),
      output: Output.object({
        schema: llmTurnUnderstandingSchema,
      }),
      system: understandingSystemPrompt,
      prompt: JSON.stringify(
        {
          currentState: {
            customerName: state.customerName,
            partnerName: state.partnerName,
            weddingDate: state.weddingDate,
            weddingDateText: state.weddingDateText,
            location: state.location,
            venue: state.venue,
            customerEmail: state.customerEmail,
            availability: state.availability,
            proposedCallTime: state.proposedCallTime,
            calendarStatus: state.calendarStatus,
          },
          latestCustomerMessage: compact(state.latestCustomerMessage, 2000),
        },
        null,
        2,
      ),
      temperature: 0,
      maxOutputTokens: 700,
      timeout: 12_000,
    });

    return normalizeLlmUnderstanding(state, output);
  } catch (error) {
    console.error("[wedding-sales-simple] understanding failed; using heuristic fallback", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return understandTurnHeuristically(state);
  }
}

export const weddingSalesSimpleUnderstandTestHelpers = {
  llmTurnUnderstandingSchema,
  normalizeLlmUnderstanding,
};
