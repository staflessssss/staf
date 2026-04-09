import { FeatureType, IntegrationType, Prisma } from "@prisma/client";
import { tool, type ToolSet } from "ai";
import { z } from "zod";

import { AgentWithBuilderData } from "@/lib/agent-builder";
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
  agent: AgentWithBuilderData;
  onToolResult?: (entry: ToolExecutionLog) => void;
};

async function executeIntegrationStep(args: {
  integrationType: IntegrationType;
  action: string;
  params: Prisma.JsonValue;
  request: string;
  metadata?: Prisma.JsonValue | null;
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

function buildToolDescription(feature: AgentWithBuilderData["features"][number]) {
  const stepDescriptions = feature.steps.map((step) => {
    return `${step.integration.type}: ${step.action}`;
  });

  return [feature.description, ...stepDescriptions].filter(Boolean).join(" ");
}

export function resolveTools({ agent, onToolResult }: ResolveToolsArgs) {
  return agent.features
    .filter((feature) => feature.type === FeatureType.TOOL)
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
            .describe("What the tool should help accomplish for the customer."),
        }),
        execute: async ({ request }) => {
          const startedAt = Date.now();
          const steps = [];

          for (const step of feature.steps) {
            const result = await executeIntegrationStep({
              integrationType: step.integration.type,
              action: step.action,
              params: step.params,
              request,
              metadata: step.integration.metadata,
            });

            steps.push({
              integrationId: step.integrationId,
              integrationType: step.integration.type,
              action: step.action,
              result,
            });
          }

          const output = {
            feature: feature.name,
            request,
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
            toolInput: { request },
            toolResult: output,
            durationMs: Date.now() - startedAt,
          });

          return output;
        },
      });

      return acc;
    }, {});
}
