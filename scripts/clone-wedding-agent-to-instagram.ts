import { AgentStatus, ChannelType, Prisma } from "@prisma/client";

import { getDefaultChannelBehaviorConfig } from "@/lib/agent-config";
import { db } from "@/lib/db";

const DEFAULT_SOURCE_AGENT_NAME = "MYNDFUL Gmail Agent";
const DEFAULT_TARGET_AGENT_NAME = "MYNDFUL Instagram Agent";

function readEnv(name: string) {
  return process.env[name]?.trim() || "";
}

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asInputJsonObject(value: unknown): Prisma.InputJsonObject {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonObject;
}

function buildInstagramChannelConfig(sourceConfig: unknown): Prisma.InputJsonObject {
  const source = asObject(sourceConfig);
  const sourceBehavior = asObject(source.channelBehavior);
  const instagramBehavior = getDefaultChannelBehaviorConfig(ChannelType.INSTAGRAM);

  return asInputJsonObject({
    ...source,
    runtimeType: "langgraph_wedding_sales",
    channelBehavior: {
      ...instagramBehavior,
      notes:
        "Instagram launch: same wedding sales runtime as Gmail, with plain links, no email signature, no attachments, and short split DM replies.",
      messageFormat: "split_into_2_3_messages",
      splitMessageDelaySeconds:
        typeof sourceBehavior.splitMessageDelaySeconds === "number"
          ? sourceBehavior.splitMessageDelaySeconds
          : instagramBehavior.splitMessageDelaySeconds,
      followUpEnabled:
        typeof sourceBehavior.followUpEnabled === "boolean"
          ? sourceBehavior.followUpEnabled
          : instagramBehavior.followUpEnabled,
      followUpRules: Array.isArray(sourceBehavior.followUpRules)
        ? sourceBehavior.followUpRules
        : instagramBehavior.followUpRules,
      useRichFormatting: false,
      allowAttachments: false,
      useSignature: false,
    },
  });
}

async function main() {
  const tenantId = readEnv("TENANT_ID") || undefined;
  const sourceAgentId = readEnv("SOURCE_AGENT_ID") || undefined;
  const targetName = readEnv("TARGET_AGENT_NAME") || DEFAULT_TARGET_AGENT_NAME;

  const sourceAgent = await db.agent.findFirst({
    where: sourceAgentId
      ? { id: sourceAgentId }
      : {
          ...(tenantId ? { tenantId } : {}),
          name: DEFAULT_SOURCE_AGENT_NAME,
          channel: { type: ChannelType.GMAIL },
        },
    include: {
      features: {
        orderBy: { sortOrder: "asc" },
      },
      channel: true,
    },
  });

  if (!sourceAgent) {
    throw new Error(
      sourceAgentId
        ? `Source agent ${sourceAgentId} was not found.`
        : `Source Gmail agent "${DEFAULT_SOURCE_AGENT_NAME}" was not found.`,
    );
  }

  const instagramChannel = await db.channelConnection.findFirst({
    where: {
      tenantId: sourceAgent.tenantId,
      type: ChannelType.INSTAGRAM,
      status: "CONNECTED",
    },
    include: {
      agents: true,
    },
  });

  if (!instagramChannel) {
    throw new Error(`No connected Instagram channel found for tenant ${sourceAgent.tenantId}.`);
  }

  const channelConfig = buildInstagramChannelConfig(sourceAgent.channelConfig);
  const existingAgent = instagramChannel.agents[0];

  const targetAgent = await db.$transaction(async (tx) => {
    const agent = existingAgent
      ? await tx.agent.update({
          where: { id: existingAgent.id },
          data: {
            name: targetName,
            persona: sourceAgent.persona,
            tone: sourceAgent.tone,
            languagePreference: sourceAgent.languagePreference,
            status: AgentStatus.ACTIVE,
            channelConfig,
            n8nWorkflowId: sourceAgent.n8nWorkflowId,
            webhookSecret: sourceAgent.webhookSecret,
            deployedAt: sourceAgent.deployedAt,
          },
        })
      : await tx.agent.create({
          data: {
            tenantId: sourceAgent.tenantId,
            channelId: instagramChannel.id,
            name: targetName,
            persona: sourceAgent.persona,
            tone: sourceAgent.tone,
            languagePreference: sourceAgent.languagePreference,
            status: AgentStatus.ACTIVE,
            channelConfig,
            n8nWorkflowId: sourceAgent.n8nWorkflowId,
            webhookSecret: sourceAgent.webhookSecret,
            deployedAt: sourceAgent.deployedAt,
          },
        });

    await tx.feature.deleteMany({
      where: { agentId: agent.id },
    });

    if (sourceAgent.features.length > 0) {
      await tx.feature.createMany({
        data: sourceAgent.features.map((feature) => ({
          agentId: agent.id,
          name: feature.name,
          description: feature.description,
          type: feature.type,
          sortOrder: feature.sortOrder,
          knowledgeContent: feature.knowledgeContent,
        })),
      });
    }

    return agent;
  });

  console.log(
    JSON.stringify(
      {
        sourceAgent: {
          id: sourceAgent.id,
          name: sourceAgent.name,
          channel: sourceAgent.channel.type,
        },
        targetAgent: {
          id: targetAgent.id,
          name: targetAgent.name,
          status: targetAgent.status,
          channelId: targetAgent.channelId,
        },
        instagramChannel: {
          id: instagramChannel.id,
          metadata: instagramChannel.metadata,
        },
        copiedFeatures: sourceAgent.features.length,
        runtimeType: "langgraph_wedding_sales",
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
