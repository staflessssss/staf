import {
  ChannelConnection,
  Feature,
  IntegrationConnection,
  Prisma,
} from "@prisma/client";

import {
  type FunctionBlockConfig,
  normalizeFunctionBlocks,
} from "@/lib/agent-config";

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
  features: Feature[];
};

function getChannelConfigObject(channelConfig: Prisma.JsonValue | null | undefined) {
  return channelConfig && typeof channelConfig === "object" && !Array.isArray(channelConfig)
    ? (channelConfig as Record<string, unknown>)
    : {};
}

function deriveEditorFunctionBlocks(agent: SerializableEditorAgent): FunctionBlockConfig[] {
  const channelConfig = getChannelConfigObject(agent.channelConfig);

  if (Array.isArray(channelConfig.functionBlocks)) {
    return normalizeFunctionBlocks(channelConfig.functionBlocks as Partial<FunctionBlockConfig>[]);
  }

  return [];
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
