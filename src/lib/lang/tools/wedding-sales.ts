import { Prisma } from "@prisma/client";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

import { executeGoogleCalendarStep } from "@/lib/tools/google-calendar";
import { executeGoogleSheetsStep } from "@/lib/tools/google-sheets";

type GoogleStepConfig = {
  action: string;
  params: Prisma.JsonValue;
  metadata?: Prisma.JsonValue | null;
  credentialsEnc?: string;
};

export type WeddingSalesToolContext = {
  tenantId: string;
  testMode?: boolean;
  defaultEmail?: string;
  weddingAvailability: GoogleStepConfig;
  consultationCalendar: GoogleStepConfig;
  bookConsultation: GoogleStepConfig;
};

const sharedLeadFields = {
  request: z.string().trim().min(1),
  coupleName: z.string().trim().min(1).optional(),
  weddingDate: z.string().trim().min(1).optional(),
  location: z.string().trim().min(1).optional(),
  email: z.string().trim().email().optional(),
  channel: z.enum(["gmail", "instagram", "telegram"]).optional(),
} as const;

function stringifyToolResult(result: unknown) {
  return JSON.stringify(result);
}

export function checkWeddingAvailabilityTool(context: WeddingSalesToolContext) {
  return tool(
    async ({ request, date, coupleName, weddingDate, location, email, channel }) => {
      const result = await executeGoogleSheetsStep({
        action: context.weddingAvailability.action,
        params: context.weddingAvailability.params,
        request,
        metadata: context.weddingAvailability.metadata,
        credentialsEnc: context.weddingAvailability.credentialsEnc,
        date,
        coupleName,
        weddingDate,
        location,
        email,
        channel,
      });

      return stringifyToolResult(result);
    },
    {
      name: "check_wedding_availability",
      description:
        "Check whether Myndful can take a wedding date using the configured Google Sheets capacity rules.",
      schema: z.object({
        ...sharedLeadFields,
        date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
    },
  );
}

export function checkConsultationCalendarTool(context: WeddingSalesToolContext) {
  return tool(
    async ({ request, date, timeText, coupleName, weddingDate, location, email, channel }) => {
      const result = await executeGoogleCalendarStep({
        tenantId: context.tenantId,
        action: context.consultationCalendar.action,
        params: context.consultationCalendar.params,
        request,
        metadata: context.consultationCalendar.metadata,
        credentialsEnc: context.consultationCalendar.credentialsEnc,
        date,
        timeText,
        coupleName,
        weddingDate,
        location,
        email,
        channel,
        testMode: context.testMode,
        defaultEmail: context.defaultEmail,
      });

      return stringifyToolResult(result);
    },
    {
      name: "check_consultation_calendar",
      description:
        "Check whether a requested consultation time is available in Google Calendar without booking it.",
      schema: z.object({
        ...sharedLeadFields,
        date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        timeText: z.string().trim().min(1),
      }),
    },
  );
}

export function bookConsultationTool(context: WeddingSalesToolContext) {
  return tool(
    async ({ request, date, timeText, coupleName, weddingDate, location, email, channel }) => {
      const result = await executeGoogleCalendarStep({
        tenantId: context.tenantId,
        action: context.bookConsultation.action,
        params: context.bookConsultation.params,
        request,
        metadata: context.bookConsultation.metadata,
        credentialsEnc: context.bookConsultation.credentialsEnc,
        date,
        timeText,
        coupleName,
        weddingDate,
        location,
        email,
        channel,
        testMode: context.testMode,
        defaultEmail: context.defaultEmail,
      });

      return stringifyToolResult(result);
    },
    {
      name: "book_consultation",
      description:
        "Book a confirmed consultation call in Google Calendar after the customer explicitly agrees to the available time.",
      schema: z.object({
        ...sharedLeadFields,
        date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        timeText: z.string().trim().min(1),
      }),
    },
  );
}

export function createWeddingSalesTools(context: WeddingSalesToolContext) {
  return [
    checkWeddingAvailabilityTool(context),
    checkConsultationCalendarTool(context),
    bookConsultationTool(context),
  ];
}
