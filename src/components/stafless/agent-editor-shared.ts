import {
  ChannelConnection,
  Feature,
  IntegrationConnection,
  Prisma,
  Step,
} from "@prisma/client";

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

export function serializeEditorAgent(agent?: SerializableEditorAgent) {
  if (!agent) {
    return undefined;
  }

  return {
    ...agent,
    channelConfig:
      agent.channelConfig &&
      typeof agent.channelConfig === "object" &&
      !Array.isArray(agent.channelConfig)
        ? agent.channelConfig
        : null,
    deployedAt: agent.deployedAt?.toISOString() ?? null,
  };
}
