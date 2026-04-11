import {
  AgentStatus,
  ChannelConnection,
  ChannelType,
  ConnectionStatus,
  FeatureType,
  IntegrationConnection,
  Prisma,
} from "@prisma/client";
import { z } from "zod";

export const toolStepSchema = z.object({
  integrationId: z.string().trim().min(1),
  action: z.string().trim().min(1).max(120),
  params: z.record(z.string(), z.unknown()).default({}),
});

export const knowledgeBlockSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(500),
  knowledgeContent: z.string().trim().min(1).max(10_000),
});

export const toolBlockSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(500),
  steps: z.array(toolStepSchema).default([]),
});

export const channelConfigSchema = z
  .object({
    priceAttachmentFileId: z
      .string()
      .trim()
      .max(500)
      .optional()
      .transform((value) => (value ? value : undefined)),
    priceAttachmentFileName: z
      .string()
      .trim()
      .max(240)
      .optional()
      .transform((value) => (value ? value : undefined)),
    priceAttachmentMimeType: z
      .string()
      .trim()
      .max(120)
      .optional()
      .transform((value) => (value ? value : undefined)),
  })
  .default({
    priceAttachmentFileId: undefined,
    priceAttachmentFileName: undefined,
    priceAttachmentMimeType: undefined,
  });

export const agentDraftSchema = z.object({
  name: z.string().trim().min(1).max(120),
  persona: z.string().trim().min(1).max(10_000),
  tone: z.string().trim().min(1).max(120),
  languagePreference: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((value) => (value ? value : null)),
  channelId: z.string().trim().min(1),
  status: z.nativeEnum(AgentStatus).optional().default(AgentStatus.DRAFT),
  channelConfig: channelConfigSchema.optional().default({
    priceAttachmentFileId: undefined,
    priceAttachmentFileName: undefined,
    priceAttachmentMimeType: undefined,
  }),
  knowledgeBlocks: z.array(knowledgeBlockSchema).default([]),
  toolBlocks: z.array(toolBlockSchema).default([]),
});

export type AgentDraftInput = z.infer<typeof agentDraftSchema>;

export const sandboxInvokeSchema = z.object({
  tenantId: z.string().trim().min(1),
  agentId: z.string().trim().min(1).optional(),
  message: z.string().trim().min(1).max(4_000),
  draft: agentDraftSchema,
});

export type SandboxInvokeInput = z.infer<typeof sandboxInvokeSchema>;

export const agentBuilderInclude = {
  channel: true,
  features: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      steps: {
        orderBy: { sortOrder: "asc" as const },
        include: { integration: true },
      },
    },
  },
} satisfies Prisma.AgentInclude;

export type AgentWithBuilderData = Prisma.AgentGetPayload<{
  include: typeof agentBuilderInclude;
}>;

export function mapAgentToDraft(agent: AgentWithBuilderData) {
  return {
    id: agent.id,
    tenantId: agent.tenantId,
    name: agent.name,
    persona: agent.persona,
    tone: agent.tone,
    languagePreference: agent.languagePreference,
    status: agent.status,
    channelId: agent.channelId,
    channelConfig:
      agent.channelConfig && typeof agent.channelConfig === "object" && !Array.isArray(agent.channelConfig)
        ? agent.channelConfig
        : {},
    channel: agent.channel,
    knowledgeBlocks: agent.features
      .filter((feature) => feature.type === FeatureType.KNOWLEDGE)
      .map((feature) => ({
        id: feature.id,
        name: feature.name,
        description: feature.description,
        knowledgeContent: feature.knowledgeContent ?? "",
        sortOrder: feature.sortOrder,
      })),
    toolBlocks: agent.features
      .filter((feature) => feature.type === FeatureType.TOOL)
      .map((feature) => ({
        id: feature.id,
        name: feature.name,
        description: feature.description,
        sortOrder: feature.sortOrder,
        steps: feature.steps.map((step) => ({
          id: step.id,
          integrationId: step.integrationId,
          integrationType: step.integration.type,
          action: step.action,
          params: step.params,
          sortOrder: step.sortOrder,
        })),
      })),
  };
}

export function serializeBuilderAgent(agent: AgentWithBuilderData) {
  return {
    id: agent.id,
    tenantId: agent.tenantId,
    status: agent.status,
    deployedAt: agent.deployedAt,
    createdAt: agent.createdAt,
    updatedAt: agent.updatedAt,
    draft: mapAgentToDraft(agent),
  };
}

export function buildFeatureCreateInput(input: AgentDraftInput): Prisma.FeatureCreateWithoutAgentInput[] {
  const knowledgeFeatures: Prisma.FeatureCreateWithoutAgentInput[] =
    input.knowledgeBlocks.map((block, index) => ({
      name: block.name,
      description: block.description,
      type: FeatureType.KNOWLEDGE,
      sortOrder: index,
      knowledgeContent: block.knowledgeContent,
    }));

  const toolFeatures: Prisma.FeatureCreateWithoutAgentInput[] =
    input.toolBlocks.map((block, featureIndex) => ({
      name: block.name,
      description: block.description,
      type: FeatureType.TOOL,
      sortOrder: input.knowledgeBlocks.length + featureIndex,
      steps: {
        create: block.steps.map((step, stepIndex) => ({
          integration: {
            connect: {
              id: step.integrationId,
            },
          },
          action: step.action,
          params: step.params as Prisma.InputJsonValue,
          sortOrder: stepIndex,
        })),
      },
    }));

  return [...knowledgeFeatures, ...toolFeatures];
}

export function getToolIntegrationIds(input: AgentDraftInput) {
  return Array.from(
    new Set(
      input.toolBlocks.flatMap((block) => block.steps.map((step) => step.integrationId)),
    ),
  );
}

export function buildMultilingualGuidance(input: {
  languagePreference?: string | null;
  channel?: Pick<ChannelConnection, "type"> | null;
}) {
  const parts = [
    "The agent must remain comfortable responding in the customer's language when possible.",
  ];

  if (input.languagePreference) {
    parts.push(
      `Preferred default response language: ${input.languagePreference}. Use it as the default business voice unless the customer clearly uses another language.`,
    );
  } else {
    parts.push(
      "No default response language is pinned. Match the customer's language and keep replies operationally clear.",
    );
  }

  if (input.channel?.type) {
    parts.push(`Primary business channel: ${formatEnumLabel(input.channel.type)}.`);
  }

  return parts.join(" ");
}

export function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export async function validateBuilderReferences(args: {
  tx: Prisma.TransactionClient;
  tenantId: string;
  channelId: string;
  agentId?: string;
  integrationIds: string[];
}) {
  const channel = await args.tx.channelConnection.findFirst({
    where: {
      id: args.channelId,
      tenantId: args.tenantId,
      status: ConnectionStatus.CONNECTED,
    },
  });

  if (!channel) {
    return { error: "Select a connected tenant channel before saving this agent." } as const;
  }

  const conflictingAgent = await args.tx.agent.findFirst({
    where: {
      channelId: args.channelId,
      ...(args.agentId ? { id: { not: args.agentId } } : {}),
    },
    select: { id: true, name: true },
  });

  if (conflictingAgent) {
    return {
      error: `This channel is already assigned to ${conflictingAgent.name}.`,
    } as const;
  }

  if (args.integrationIds.length === 0) {
    return { channel } as const;
  }

  const integrations = await args.tx.integrationConnection.findMany({
    where: {
      id: { in: args.integrationIds },
      tenantId: args.tenantId,
      status: ConnectionStatus.CONNECTED,
    },
  });

  if (integrations.length !== args.integrationIds.length) {
    return {
      error: "Tool steps must reference connected integrations owned by this tenant.",
    } as const;
  }

  return { channel, integrations } as const;
}

export type BuilderPreviewInput = {
  name: string;
  persona: string;
  tone: string;
  languagePreference?: string | null;
  channel?: Pick<ChannelConnection, "type"> | null;
  knowledgeBlocks?: Array<{
    name: string;
    description: string;
    knowledgeContent?: string | null;
  }>;
  toolBlocks?: Array<{
    name: string;
    description: string;
    steps?: Array<{
      integrationType?: IntegrationConnection["type"] | ChannelType | string;
      action: string;
    }>;
  }>;
};
