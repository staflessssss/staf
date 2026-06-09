import {
  AgentStatus,
  ChannelType,
  ConnectionStatus,
} from "@prisma/client";

import {
  buildIntegrationIdMap,
  getExternalResourceReferences,
  getReferencedIntegrationIds,
  prepareClonedChannelConfig,
} from "@/lib/agent-cloning";
import { db } from "@/lib/db";

const defaultSourceAgentIds = [
  "cmnzpqzkj0001uxl42de8bxiv",
  "cmpxcy3qj0001ux5gxvm3ytli",
];

function readEnv(name: string) {
  return process.env[name]?.trim() || "";
}

function readAgentIds() {
  const configured = readEnv("SOURCE_AGENT_IDS");
  return configured
    ? configured.split(",").map((id) => id.trim()).filter(Boolean)
    : defaultSourceAgentIds;
}

async function main() {
  const targetTenantId = readEnv("TARGET_TENANT_ID");
  const apply = readEnv("APPLY") === "1";
  const forceReplace = readEnv("FORCE_REPLACE") === "1";
  const sharedResourcesConfirmed = readEnv("CONFIRM_SHARED_RESOURCES") === "1";
  const targetSpreadsheetId = readEnv("TARGET_SPREADSHEET_ID");
  const targetCalendarId = readEnv("TARGET_CALENDAR_ID");
  const targetPriceFileId = readEnv("TARGET_PRICE_FILE_ID");
  const sourceAgentIds = readAgentIds();

  if (!targetTenantId) {
    throw new Error("TARGET_TENANT_ID is required.");
  }

  const [targetTenant, sourceAgents, targetChannels, targetIntegrations] = await Promise.all([
    db.tenant.findUnique({
      where: { id: targetTenantId },
      select: { id: true, name: true },
    }),
    db.agent.findMany({
      where: { id: { in: sourceAgentIds } },
      include: {
        channel: true,
        features: { orderBy: { sortOrder: "asc" } },
      },
    }),
    db.channelConnection.findMany({
      where: { tenantId: targetTenantId, status: ConnectionStatus.CONNECTED },
      include: {
        agents: {
          select: { id: true, name: true, status: true },
        },
      },
    }),
    db.integrationConnection.findMany({
      where: { tenantId: targetTenantId, status: ConnectionStatus.CONNECTED },
      select: { id: true, type: true },
    }),
  ]);

  if (!targetTenant) {
    throw new Error(`Target tenant ${targetTenantId} was not found.`);
  }

  if (sourceAgents.length !== sourceAgentIds.length) {
    throw new Error("One or more source agents were not found.");
  }

  const sourceTenantIds = new Set(sourceAgents.map((agent) => agent.tenantId));
  if (sourceTenantIds.size !== 1) {
    throw new Error("All source agents must belong to the same tenant.");
  }

  if (sourceTenantIds.has(targetTenantId)) {
    throw new Error("Source and target tenants must be different.");
  }

  const sourceIntegrations = await db.integrationConnection.findMany({
    where: {
      tenantId: sourceAgents[0]!.tenantId,
      status: ConnectionStatus.CONNECTED,
    },
    select: { id: true, type: true },
  });
  const targetChannelByType = new Map(targetChannels.map((channel) => [channel.type, channel]));
  const prepared = sourceAgents.map((sourceAgent) => {
    const targetChannel = targetChannelByType.get(sourceAgent.channel.type);
    if (!targetChannel) {
      throw new Error(
        `Target tenant needs a connected ${sourceAgent.channel.type} channel before cloning ${sourceAgent.name}.`,
      );
    }

    const referencedIds = getReferencedIntegrationIds(sourceAgent.channelConfig);
    const integrationIdMap = buildIntegrationIdMap({
      source: sourceIntegrations,
      target: targetIntegrations,
      referencedIds,
    });

    return {
      sourceAgent,
      targetChannel,
      channelConfig: prepareClonedChannelConfig(sourceAgent.channelConfig, integrationIdMap, {
        spreadsheetId: targetSpreadsheetId || undefined,
        calendarId: targetCalendarId || undefined,
        priceAttachmentFileId: targetPriceFileId || undefined,
      }),
      externalResources: getExternalResourceReferences(sourceAgent.channelConfig),
    };
  });

  const existingAgents = prepared.flatMap(({ targetChannel }) => targetChannel.agents);
  const externalResources = prepared.flatMap(({ sourceAgent, externalResources }) =>
    externalResources.map((reference) => ({
      agent: sourceAgent.name,
      ...reference,
    })),
  );
  const preview = {
    apply,
    forceReplace,
    sharedResourcesConfirmed,
    resourceOverrides: {
      spreadsheetId: targetSpreadsheetId || null,
      calendarId: targetCalendarId || null,
      priceAttachmentFileId: targetPriceFileId || null,
    },
    targetTenant,
    agents: prepared.map(({ sourceAgent, targetChannel }) => ({
      sourceAgentId: sourceAgent.id,
      name: sourceAgent.name,
      channel: targetChannel.type,
      targetChannelId: targetChannel.id,
      existingTargetAgent: targetChannel.agents[0] ?? null,
      copiedFeatures: sourceAgent.features.length,
      status: AgentStatus.DRAFT,
    })),
    externalResources,
  };

  if (!apply) {
    console.log(JSON.stringify(preview, null, 2));
    console.log("Dry run only. Set APPLY=1 to create or update the agents.");
    return;
  }

  if (existingAgents.length > 0 && !forceReplace) {
    throw new Error(
      "One or more target channels already have an agent. Review the dry run and set FORCE_REPLACE=1 only when replacement is intentional.",
    );
  }

  if (externalResources.length > 0 && !sharedResourcesConfirmed) {
    throw new Error(
      "The clone references shared external files or spreadsheets. Review the dry run and set CONFIRM_SHARED_RESOURCES=1 after verifying target access.",
    );
  }

  if (!targetSpreadsheetId || !targetCalendarId) {
    throw new Error(
      "TARGET_SPREADSHEET_ID and TARGET_CALENDAR_ID are required before applying a cross-tenant clone.",
    );
  }

  const clonedAgents = await db.$transaction(async (tx) => {
    const results = [];

    for (const item of prepared) {
      const existingAgent = await tx.agent.findUnique({
        where: { channelId: item.targetChannel.id },
        select: { id: true, name: true },
      });

      if (existingAgent && !forceReplace) {
        throw new Error(
          `Target channel ${item.targetChannel.type} is already assigned to ${existingAgent.name}. Set FORCE_REPLACE=1 only when replacement is intentional.`,
        );
      }

      const agent = existingAgent
        ? await tx.agent.update({
            where: { id: existingAgent.id },
            data: {
              name: item.sourceAgent.name,
              persona: item.sourceAgent.persona,
              tone: item.sourceAgent.tone,
              languagePreference: item.sourceAgent.languagePreference,
              status: AgentStatus.DRAFT,
              channelConfig: item.channelConfig,
              n8nWorkflowId: null,
              webhookSecret: null,
              deployedAt: null,
            },
          })
        : await tx.agent.create({
            data: {
              tenantId: targetTenantId,
              channelId: item.targetChannel.id,
              name: item.sourceAgent.name,
              persona: item.sourceAgent.persona,
              tone: item.sourceAgent.tone,
              languagePreference: item.sourceAgent.languagePreference,
              status: AgentStatus.DRAFT,
              channelConfig: item.channelConfig,
            },
          });

      await tx.feature.deleteMany({ where: { agentId: agent.id } });
      if (item.sourceAgent.features.length > 0) {
        await tx.feature.createMany({
          data: item.sourceAgent.features.map((feature) => ({
            agentId: agent.id,
            name: feature.name,
            description: feature.description,
            type: feature.type,
            sortOrder: feature.sortOrder,
            knowledgeContent: feature.knowledgeContent,
          })),
        });
      }

      results.push({
        id: agent.id,
        name: agent.name,
        channel: item.targetChannel.type as ChannelType,
        status: agent.status,
        copiedFeatures: item.sourceAgent.features.length,
      });
    }

    return results;
  });

  console.log(JSON.stringify({ ...preview, agents: clonedAgents }, null, 2));
  console.log("Agents are DRAFT. Review and deploy each agent from the admin workspace.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
