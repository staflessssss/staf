import { IntegrationType, Prisma } from "@prisma/client";
import { tool, type ToolSet } from "ai";
import { z } from "zod";

import { type RuntimeToolFeature } from "@/lib/agent-config";
import { executeGoogleCalendarStep } from "@/lib/tools/google-calendar";
import { executeGoogleDriveStep } from "@/lib/tools/google-drive";
import { executeGoogleSheetsStep } from "@/lib/tools/google-sheets";

type ToolExecutionLog = {
  toolName: string;
  toolInput: Prisma.JsonValue;
  toolResult: Prisma.JsonValue;
  durationMs?: number;
};

type ResolveToolsArgs = {
  tenantId: string;
  toolFeatures: RuntimeToolFeature[];
  testMode?: boolean;
  defaultEmail?: string;
  currentMessage?: string;
  onToolResult?: (entry: ToolExecutionLog) => void;
};

function toJsonValue(value: unknown): Prisma.JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => toJsonValue(item));
  }

  if (value && typeof value === "object") {
    return Object.entries(value).reduce<Prisma.JsonObject>((acc, [key, entry]) => {
      acc[key] = toJsonValue(entry);
      return acc;
    }, {});
  }

  return String(value);
}

async function executeIntegrationStep(args: {
  integrationType: IntegrationType;
  action: string;
  params: Prisma.JsonValue;
  request: string;
  metadata?: Prisma.JsonValue | null;
  credentialsEnc?: string;
  tenantId: string;
  date?: string;
  timeText?: string;
  coupleName?: string;
  weddingDate?: string;
  location?: string;
  email?: string;
  channel?: string;
  testMode?: boolean;
  defaultEmail?: string;
}) {
  switch (args.integrationType) {
    case IntegrationType.GOOGLE_CALENDAR:
      return executeGoogleCalendarStep(args);
    case IntegrationType.GOOGLE_SHEETS:
      return executeGoogleSheetsStep(args);
    case IntegrationType.GOOGLE_DRIVE:
      return executeGoogleDriveStep(args);
    default:
      return {
        integration: args.integrationType,
        mode: "simulated",
        status: "unsupported",
        action: args.action,
        summary: `No executor is implemented yet for ${args.integrationType}.`,
        request: args.request,
        params: args.params,
      };
  }
}

function buildToolDescription(feature: RuntimeToolFeature) {
  const stepDescriptions = feature.steps.map((step) => {
    return `${step.integration.type}: ${step.action}`;
  });

  return [feature.description, ...stepDescriptions].filter(Boolean).join(" ");
}

function extractCanonicalToolFields(steps: Array<{
  result: unknown;
}>) {
  let canonicalDate: string | undefined;
  let canonicalTime: string | undefined;

  for (const step of steps) {
    const result = step.result;
    if (!result || typeof result !== "object" || Array.isArray(result)) {
      continue;
    }

    const typedResult = result as Record<string, unknown>;

    if (
      !canonicalDate &&
      typeof typedResult.date === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(typedResult.date)
    ) {
      canonicalDate = typedResult.date;
    }

    if (!canonicalTime) {
      if (typeof typedResult.time === "string" && /^\d{2}:\d{2}$/.test(typedResult.time)) {
        canonicalTime = typedResult.time;
      } else if (
        typeof typedResult.requestedTime === "string" &&
        /^\d{2}:\d{2}$/.test(typedResult.requestedTime)
      ) {
        canonicalTime = typedResult.requestedTime;
      }
    }
  }

  return {
    canonicalDate,
    canonicalTime,
  };
}

function stripLikelyQuotedHeader(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => !/<[^>\s]+@[^>]+>:\s*$/.test(line.trim()))
    .join("\n")
    .trim();
}

const monthNamePattern =
  "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|sept|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";

function hasExplicitYear(text: string) {
  return /\b(?:19|20)\d{2}\b/.test(text);
}

function hasMonthDayWithoutYear(text: string) {
  const normalized = stripLikelyQuotedHeader(text).toLowerCase();
  const monthDay = new RegExp(`\\b${monthNamePattern}\\s+\\d{1,2}(?:st|nd|rd|th)?\\b`, "i");
  const dayMonth = new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+${monthNamePattern}\\b`, "i");
  const numericMonthDay = /\b\d{1,2}[/-]\d{1,2}\b/.test(normalized);

  return !hasExplicitYear(normalized) && (monthDay.test(normalized) || dayMonth.test(normalized) || numericMonthDay);
}

function isWeddingAvailabilityFeature(feature: RuntimeToolFeature) {
  const featureName = feature.name.toLowerCase();

  return (
    featureName.includes("wedding availability") ||
    feature.steps.some((step) => step.action.toLowerCase().includes("capacity availability"))
  );
}

function buildMissingWeddingYearToolResult(args: {
  featureName: string;
  request: string;
  date?: string;
  weddingDate?: string;
  location?: string;
  email?: string;
  channel?: string;
}) {
  return {
    feature: args.featureName,
    request: args.request,
    status: "needs_year",
    ...(args.date ? { date: args.date } : {}),
    ...(args.weddingDate ? { weddingDate: args.weddingDate } : {}),
    ...(args.location ? { location: args.location } : {}),
    ...(args.email ? { email: args.email } : {}),
    ...(args.channel ? { channel: args.channel } : {}),
    steps: [],
    summary:
      "The customer gave a wedding month/day without a year. Ask for the wedding year before checking availability.",
  };
}

export function resolveTools({
  tenantId,
  toolFeatures,
  testMode,
  defaultEmail,
  currentMessage,
  onToolResult,
}: ResolveToolsArgs) {
  return toolFeatures
    .reduce<ToolSet>((acc, feature, index) => {
      const toolName = `tool_${index + 1}_${feature.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")}`;

      acc[toolName] = tool({
        description: buildToolDescription(feature),
        inputSchema: z.object({
          request: z
            .string()
            .trim()
            .min(1)
            .describe("What the tool should help accomplish for the customer. Preserve the user's exact date details."),
          date: z
            .string()
            .trim()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional()
            .describe("Exact customer date in YYYY-MM-DD when the request mentions one."),
          timeText: z
            .string()
            .trim()
            .min(1)
            .optional()
            .describe("Natural-language call time text such as 'tomorrow at 10am ET' when scheduling is involved."),
          coupleName: z
            .string()
            .trim()
            .min(1)
            .optional()
            .describe("Couple name when a booking or lead log needs it."),
          weddingDate: z
            .string()
            .trim()
            .optional()
            .describe("Wedding date in the customer's wording or YYYY-MM-DD if known."),
          location: z
            .string()
            .trim()
            .min(1)
            .optional()
            .describe("Wedding location when it matters for logging or confirmation."),
          email: z
            .string()
            .trim()
            .email()
            .optional()
            .describe("Customer email for call booking and calendar invites."),
          channel: z
            .string()
            .trim()
            .min(1)
            .optional()
            .describe("Source channel label for lead logging or notifications."),
        }),
        execute: async ({
          request,
          date,
          timeText,
          coupleName,
          weddingDate,
          location,
          email,
          channel,
        }) => {
          const startedAt = Date.now();
          const steps = [];

          if (
            isWeddingAvailabilityFeature(feature) &&
            currentMessage &&
            hasMonthDayWithoutYear(currentMessage)
          ) {
            const output = buildMissingWeddingYearToolResult({
              featureName: feature.name,
              request,
              date,
              weddingDate,
              location,
              email,
              channel,
            });

            onToolResult?.({
              toolName: feature.name,
              toolInput: {
                request,
                ...(date ? { date } : {}),
                ...(weddingDate ? { weddingDate } : {}),
                ...(location ? { location } : {}),
                ...(email ? { email } : {}),
                ...(channel ? { channel } : {}),
              },
              toolResult: toJsonValue(output),
              durationMs: Date.now() - startedAt,
            });

            return toJsonValue(output);
          }

          for (const step of feature.steps) {
            const result = await executeIntegrationStep({
              tenantId,
              integrationType: step.integration.type,
              action: step.action,
              params: step.params,
              request,
              metadata: step.integration.metadata,
              credentialsEnc: step.integration.credentialsEnc,
              date,
              timeText,
              coupleName,
              weddingDate,
              location,
              email,
              channel,
              defaultEmail,
              testMode,
            });

            steps.push({
              integrationId: step.integrationId,
              integrationType: step.integration.type,
              action: step.action,
              result,
            });
          }

          const { canonicalDate, canonicalTime } = extractCanonicalToolFields(steps);
          const output = {
            feature: feature.name,
            request,
            ...(canonicalDate ? { date: canonicalDate } : date ? { date } : {}),
            ...(canonicalTime
              ? { timeText: timeText ?? canonicalTime, canonicalTime }
              : timeText
                ? { timeText }
                : {}),
            ...(coupleName ? { coupleName } : {}),
            ...(weddingDate ? { weddingDate } : {}),
            ...(location ? { location } : {}),
            ...(email ? { email } : {}),
            ...(channel ? { channel } : {}),
            steps,
            summary: steps
              .map((step) => {
                const stepResult = step.result as { summary?: string };
                return `${step.integrationType}: ${String(stepResult.summary ?? step.action)}`;
              })
              .join(" "),
          };

          onToolResult?.({
            toolName: feature.name,
            toolInput: {
              request,
              ...(canonicalDate ? { date: canonicalDate } : date ? { date } : {}),
              ...(canonicalTime
                ? { timeText: timeText ?? canonicalTime, canonicalTime }
                : timeText
                  ? { timeText }
                  : {}),
              ...(coupleName ? { coupleName } : {}),
              ...(weddingDate ? { weddingDate } : {}),
              ...(location ? { location } : {}),
              ...(email ? { email } : {}),
              ...(channel ? { channel } : {}),
            },
            toolResult: toJsonValue(output),
            durationMs: Date.now() - startedAt,
          });

          return toJsonValue(output);
        },
      });

      return acc;
    }, {});
}

export const toolResolutionTestHelpers = {
  extractCanonicalToolFields,
  hasMonthDayWithoutYear,
  isWeddingAvailabilityFeature,
};
