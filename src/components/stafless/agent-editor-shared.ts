import {
  ChannelConnection,
  Feature,
  FeatureType,
  IntegrationConnection,
  Prisma,
  Step,
} from "@prisma/client";

import {
  type FunctionBlockConfig,
  normalizeFunctionBlocks,
  toolBlockToFunctionBlock,
} from "@/lib/agent-builder";

export type SerializableEditorTenant = {
  id: string;
  name: string;
  slug: string;
  timezone?: string | null;
  channelConnections: ChannelConnection[];
  integrationConnections: IntegrationConnection[];
  agents?: Array<{
    id: string;
    name: string;
    channelId: string;
  }>;
};

export type SerializableEditorAgent = {
  id: string;
  name: string;
  persona: string;
  tone: string;
  languagePreference?: string | null;
  status: string;
  deployedAt: Date | null;
  channelId: string;
  channelConfig?: Prisma.JsonValue | null;
  channel: ChannelConnection;
  features: (Feature & {
    steps: (Step & { integration: IntegrationConnection })[];
  })[];
};

function getChannelConfigObject(channelConfig: Prisma.JsonValue | null | undefined) {
  return channelConfig && typeof channelConfig === "object" && !Array.isArray(channelConfig)
    ? (channelConfig as Record<string, unknown>)
    : {};
}

function normalizeLegacyStepParams(params: Prisma.JsonValue): Record<string, unknown> {
  if (params && typeof params === "object" && !Array.isArray(params)) {
    return params as Record<string, unknown>;
  }

  if (typeof params === "string") {
    try {
      const parsed = JSON.parse(params);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }

  return {};
}

function deriveEditorFunctionBlocks(agent: SerializableEditorAgent): FunctionBlockConfig[] {
  const channelConfig = getChannelConfigObject(agent.channelConfig);

  if (Array.isArray(channelConfig.functionBlocks)) {
    return normalizeFunctionBlocks(channelConfig.functionBlocks as Partial<FunctionBlockConfig>[]);
  }

  return normalizeFunctionBlocks(
    agent.features
      .filter((feature) => feature.type === FeatureType.TOOL)
      .map((feature) =>
        toolBlockToFunctionBlock({
          name: feature.name,
          description: feature.description,
          steps: feature.steps.map((step) => ({
            integrationId: step.integrationId,
            action: step.action,
            params: normalizeLegacyStepParams(step.params),
          })),
        }),
      ),
  );
}

function serializeEditorChannelConfig(agent: SerializableEditorAgent) {
  return {
    ...getChannelConfigObject(agent.channelConfig),
    functionBlocks: deriveEditorFunctionBlocks(agent),
  };
}

export function serializeEditorAgent(agent?: SerializableEditorAgent) {
  if (!agent) {
    return undefined;
  }

  return {
    ...agent,
    channelConfig: serializeEditorChannelConfig(agent),
    deployedAt: agent.deployedAt?.toISOString() ?? null,
  };
}
