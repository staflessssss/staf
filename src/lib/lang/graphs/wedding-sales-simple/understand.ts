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
  const match = /\b(?:we are|we're|this is|names are|i am|i'm)\s+([A-Z][a-z]+)(?:\s+(?:and|&)\s+([A-Z][a-z]+))?/i.exec(
    message,
  );

  return {
    customerName: match?.[1],
    partnerName: match?.[2],
  };
}

function extractLocation(message: string) {
  const match = /\b(?:in|near|around)\s+([A-Z][A-Za-z .'-]+?)(?:[?.!,]|$|\s+(?:and|for|on|at)\b)/.exec(
    message,
  );

  return match?.[1]?.trim();
}

function extractCallTime(message: string) {
  const match = /\b(?:(?:tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week|next monday|next tuesday|next wednesday|next thursday|next friday)[^?.!,]{0,40})?\b(?:at\s*)?(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i.exec(
    message,
  );

  if (!match) {
    return undefined;
  }

  return match[0].trim();
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

  if (/\b(portfolio|gallery|film|films|sample|samples)\b/.test(normalized)) {
    questions.push("portfolio");
  }

  if (/\b(travel|destination|travel fee)\b/.test(normalized)) {
    questions.push("travel");
  }

  if (/\b(include|included|coverage|hours|deliverables)\b/.test(normalized)) {
    questions.push("package_inclusions");
  }

  if (/\b(shooter|team|you filming|videographer)\b/.test(normalized)) {
    questions.push("team");
  }

  if (/\b(book|booking|reserve|lock it in)\b/.test(normalized)) {
    questions.push("booking");
  }

  return [...new Set(questions)];
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
  const questionsAskedByCustomer = inferQuestions(message);
  const isoDate = extractIsoDate(message);
  const monthDate = extractMonthDate(message);
  const email = extractEmail(message);
  const proposedCallTime = extractCallTime(message);
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

    return turnUnderstandingSchema.parse({
      ...output,
      facts: Object.fromEntries(
        Object.entries(output.facts).filter(([, value]) => value !== null),
      ),
    });
  } catch (error) {
    console.error("[wedding-sales-simple] understanding failed; using heuristic fallback", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return understandTurnHeuristically(state);
  }
}

export const weddingSalesSimpleUnderstandTestHelpers = {
  llmTurnUnderstandingSchema,
};
