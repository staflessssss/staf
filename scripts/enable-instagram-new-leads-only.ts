import {
  AgentStatus,
  ChannelType,
  DelayedDeliveryKind,
  DelayedDeliveryStatus,
} from "@prisma/client";

import { conversationAutomationScopes } from "@/lib/instagram-new-lead-policy";
import { db } from "@/lib/db";

function readArg(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1]?.trim() : undefined;
}

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function parseCutoverAt(value?: string) {
  if (!value) {
    return new Date();
  }

  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    throw new Error("--cutover-at must be an ISO-8601 timestamp.");
  }

  return parsed;
}

async function main() {
  const agentId = readArg("--agent-id");
  const activateAfterCutover = hasFlag("--activate");

  if (!agentId) {
    throw new Error("Usage: --agent-id <id> --confirm [--cutover-at <ISO>] [--activate]");
  }
  if (!hasFlag("--confirm")) {
    throw new Error("Refusing to change production state without --confirm.");
  }

  const cutoverAt = parseCutoverAt(readArg("--cutover-at"));
  const agent = await db.agent.findUnique({
    where: { id: agentId },
    select: {
      id: true,
      name: true,
      status: true,
      channel: { select: { type: true } },
      channelConfig: true,
    },
  });

  if (!agent || agent.channel.type !== ChannelType.INSTAGRAM) {
    throw new Error("The requested agent is not an Instagram agent.");
  }
  if (agent.status !== AgentStatus.PAUSED) {
    throw new Error("Pause the agent before running the Instagram cutover.");
  }

  const currentConfig =
    agent.channelConfig && typeof agent.channelConfig === "object" && !Array.isArray(agent.channelConfig)
      ? (agent.channelConfig as Record<string, unknown>)
      : {};

  if (currentConfig.instagramInboundPolicy === "new_leads_only") {
    throw new Error("Instagram new-leads-only mode is already enabled for this agent.");
  }

  const result = await db.$transaction(async (tx) => {
    const conversations = await tx.conversation.updateMany({
      where: { agentId },
      data: {
        manualOnly: true,
        automationScope: conversationAutomationScopes.LEGACY,
      },
    });
    const deliveries = await tx.delayedDelivery.updateMany({
      where: {
        agentId,
        kind: {
          in: [DelayedDeliveryKind.BUFFERED_REPLY, DelayedDeliveryKind.FOLLOW_UP],
        },
        status: {
          in: [DelayedDeliveryStatus.PENDING, DelayedDeliveryStatus.PROCESSING],
        },
      },
      data: {
        status: DelayedDeliveryStatus.CANCELED,
        canceledAt: new Date(),
        error: "instagram_new_leads_only_cutover",
      },
    });
    await tx.agent.update({
      where: { id: agentId },
      data: {
        channelConfig: {
          ...currentConfig,
          instagramInboundPolicy: "new_leads_only",
          instagramNewLeadCutoverAt: cutoverAt.toISOString(),
        },
      },
    });

    return { conversationsLocked: conversations.count, deliveriesCanceled: deliveries.count };
  });

  if (activateAfterCutover) {
    await db.agent.update({
      where: { id: agentId },
      data: { status: AgentStatus.ACTIVE },
    });
  }

  console.log(JSON.stringify({
    agentId,
    cutoverAt: cutoverAt.toISOString(),
    activated: activateAfterCutover,
    ...result,
  }));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
