import { ChannelType, Prisma } from "@prisma/client";

import {
  FunctionBlockConfig,
  getChannelConfigObject,
  normalizeFunctionBlocks,
  normalizePromptingConfig,
} from "@/lib/agent-config";
import { buildMyndfulGuideConfig, getMyndfulGuide } from "@/lib/agents/myndful/guide-config";
import { readOwnerHandoffConfig } from "@/lib/owner-handoff";

export type RuntimeActionSource = "configured" | "system";

export type RuntimeActionProfile = {
  id: string;
  name: string;
  source: RuntimeActionSource;
  active: boolean;
  description: string;
  trigger: string;
  requirements: string[];
  integrationStepCount?: number;
};

export type AgentRuntimeProfile = {
  mode: "voice_first" | "guided";
  conversationConfiguration: "prompting" | "prompting_and_playbook";
  actions: RuntimeActionProfile[];
  configuredActionCount: number;
  systemActionCount: number;
  knowledgeDelivery: "full_prompt";
};

type RuntimeProfileAgent = {
  channelConfig?: Prisma.JsonValue | null;
  channel: {
    type: ChannelType;
  };
};

type RuntimeProfileChannel = {
  type: ChannelType;
  metadata?: Prisma.JsonValue | null;
};

function getConfiguredActions(channelConfig: Prisma.JsonValue | null | undefined) {
  const config = getChannelConfigObject(channelConfig);
  const blocks = normalizeFunctionBlocks(
    Array.isArray(config.functionBlocks)
      ? (config.functionBlocks as Partial<FunctionBlockConfig>[])
      : [],
  );

  return blocks.map<RuntimeActionProfile>((block, index) => ({
    id: `configured:${index}:${block.name}`,
    name: block.name || `Configured action ${index + 1}`,
    source: "configured",
    active: block.active,
    description: block.description || "No operator description has been provided.",
    trigger: "The model chooses this action when its description and inputs fit the customer request.",
    requirements: block.parameters
      .filter((parameter) => parameter.required)
      .map((parameter) => parameter.name),
    integrationStepCount: block.steps.length,
  }));
}

function getSystemActions(args: {
  agent: RuntimeProfileAgent;
  channels: RuntimeProfileChannel[];
}) {
  const config = buildMyndfulGuideConfig(args.agent.channelConfig);
  const configuredRegions = (["FL", "NC_SC_GA"] as const).filter((region) =>
    Boolean(getMyndfulGuide(config, region)),
  );
  const actions: RuntimeActionProfile[] = [];

  if (configuredRegions.length > 0) {
    actions.push({
      id: "system:collections-guide",
      name: "Send collections guide",
      source: "system",
      active: true,
      description: "Attaches the configured regional pricing guide to the customer reply.",
      trigger: "Use after the wedding city/state establishes a supported region, or after availability establishes it.",
      requirements: ["Wedding city/state or established service region"],
    });
  }

  const ownerTelegram = args.channels.find(
    (channel) => channel.type === ChannelType.TELEGRAM && readOwnerHandoffConfig(channel.metadata).enabled,
  );
  const canUseOwnerHandoff =
    (args.agent.channel.type === ChannelType.INSTAGRAM || args.agent.channel.type === ChannelType.GMAIL) &&
    Boolean(ownerTelegram);

  if (canUseOwnerHandoff) {
    actions.push({
      id: "system:owner-handoff",
      name: "Request owner handoff",
      source: "system",
      active: true,
      description: "Pauses the conversation and sends its context to the linked owner in Telegram.",
      trigger: "Use when the customer explicitly requests a person or a business fact cannot be answered safely.",
      requirements: ["Linked owner Telegram chat"],
    });
  }

  return actions;
}

export function buildAgentRuntimeProfile(args: {
  agent: RuntimeProfileAgent;
  channels?: RuntimeProfileChannel[];
}): AgentRuntimeProfile {
  const config = getChannelConfigObject(args.agent.channelConfig);
  const prompting = normalizePromptingConfig(
    config.prompting && typeof config.prompting === "object" && !Array.isArray(config.prompting)
      ? config.prompting
      : undefined,
  );
  const configuredActions = getConfiguredActions(args.agent.channelConfig);
  const systemActions = getSystemActions({
    agent: args.agent,
    channels: args.channels ?? [],
  });

  return {
    mode: prompting.preserveModelVoice ? "voice_first" : "guided",
    conversationConfiguration: prompting.preserveModelVoice
      ? "prompting"
      : "prompting_and_playbook",
    actions: [...configuredActions, ...systemActions],
    configuredActionCount: configuredActions.filter((action) => action.active).length,
    systemActionCount: systemActions.length,
    knowledgeDelivery: "full_prompt",
  };
}
