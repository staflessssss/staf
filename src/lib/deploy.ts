import { randomBytes } from "crypto";

import { AgentStatus, ChannelType, Prisma } from "@prisma/client";

import {
  AgentWithConfigData,
  hydrateFunctionBlocksForRuntime,
  mergeChannelConfig,
} from "@/lib/agent-config";
import { parseTelegramBotToken, registerTelegramWebhook } from "@/lib/channels/telegram";
import { decrypt } from "@/lib/crypto";
import { db } from "@/lib/db";
import { registerGmailWatchForChannel } from "@/lib/gmail-watch";

type ReadinessItem = {
  key: string;
  label: string;
  done: boolean;
  detail: string;
};

export type AgentReadinessReport = {
  ready: boolean;
  status: "ready_for_phase_6" | "needs_changes";
  items: ReadinessItem[];
  summary: string;
};

export type DeployStatusResult = AgentReadinessReport & {
  deployed: boolean;
  nextStatus: AgentStatus;
  message: string;
  webhookSecret?: string | null;
  deployedAt?: Date | null;
  channelConfig?: Prisma.JsonValue | null;
};

function hasValidKnowledge(agent: AgentWithConfigData) {
  const knowledge = agent.features.filter((feature) => feature.type === "KNOWLEDGE");

  return (
    knowledge.length > 0 &&
    knowledge.every(
      (feature) =>
        feature.name.trim() &&
        feature.description.trim() &&
        (feature.knowledgeContent ?? "").trim(),
    )
  );
}

async function hasValidTools(
  agent: AgentWithConfigData,
  database: typeof db,
  toolFeatures?: Awaited<ReturnType<typeof hydrateFunctionBlocksForRuntime>>,
) {
  const tools = toolFeatures ?? (await hydrateFunctionBlocksForRuntime(agent, database));

  if (tools.length === 0) {
    return true;
  }

  return (
    tools.length > 0 &&
    tools.every(
      (feature) =>
        feature.name.trim() &&
        feature.description.trim() &&
        feature.steps.length > 0 &&
        feature.steps.every(
          (step) => step.action.trim() && step.integrationId && step.integration?.tenantId === agent.tenantId,
        ),
    )
  );
}

function buildChannelDeployConfig(
  agent: AgentWithConfigData,
  webhookSecret = randomBytes(24).toString("hex"),
): {
  webhookSecret: string;
  channelConfig: Prisma.JsonObject;
} {
  const publicBaseUrl =
    process.env.APP_BASE_URL?.trim() || process.env.NEXTAUTH_URL?.trim() || "";
  const isPublicHttpsUrl =
    publicBaseUrl.startsWith("https://") && !publicBaseUrl.includes("localhost");
  const gmailPubSubSecret = process.env.GMAIL_PUBSUB_WEBHOOK_SECRET?.trim() || "";
  const instagramWebhookVerifyToken =
    process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN?.trim() ||
    process.env.META_WEBHOOK_VERIFY_TOKEN?.trim() ||
    "";

  switch (agent.channel.type) {
    case ChannelType.TELEGRAM:
      return {
        webhookSecret,
        channelConfig: {
          webhookPath: `/api/webhooks/telegram?agentId=${agent.id}`,
          webhookUrl: isPublicHttpsUrl
            ? `${publicBaseUrl}/api/webhooks/telegram?agentId=${agent.id}`
            : null,
          webhookRegistration: isPublicHttpsUrl ? "ready_to_register" : "pending_public_url",
          outboundMode: "telegram_bot_api",
          channelType: agent.channel.type,
        },
      };
    case ChannelType.INSTAGRAM: {
      const instagramWebhookRegistration = !isPublicHttpsUrl
        ? "pending_public_url"
        : instagramWebhookVerifyToken
          ? "ready_to_register"
          : "pending_verify_token";

      return {
        webhookSecret,
        channelConfig: {
          webhookPath: "/api/webhooks/instagram",
          webhookUrl: isPublicHttpsUrl
            ? `${publicBaseUrl}/api/webhooks/instagram`
            : null,
          webhookRegistration: instagramWebhookRegistration,
          outboundMode: "meta_graph_api",
          channelType: agent.channel.type,
        },
      };
    }
    case ChannelType.GMAIL:
      return {
        webhookSecret,
        channelConfig: {
          webhookPath: `/api/webhooks/gmail?agentId=${agent.id}`,
          webhookAuthHeaderName: "x-stafless-webhook-secret",
          pubsubWebhookPath: gmailPubSubSecret
            ? `/api/webhooks/gmail/pubsub?token=${gmailPubSubSecret}`
            : "/api/webhooks/gmail/pubsub",
          pubsubWebhookUrl: isPublicHttpsUrl
            ? gmailPubSubSecret
              ? `${publicBaseUrl}/api/webhooks/gmail/pubsub?token=${gmailPubSubSecret}`
              : `${publicBaseUrl}/api/webhooks/gmail/pubsub`
            : null,
          outboundMode: "gmail_api",
          channelType: agent.channel.type,
        },
      };
    default:
      return {
        webhookSecret,
        channelConfig: {
          channelType: agent.channel.type,
        },
      };
  }
}

export async function assessAgentReadiness(
  agent: AgentWithConfigData,
  database: typeof db,
): Promise<AgentReadinessReport> {
  const settingsAndPromptingReady = Boolean(
    agent.name.trim() && agent.persona.trim() && agent.tone.trim(),
  );
  const channelReady = agent.channel.status === "CONNECTED";
  const knowledgeReady = hasValidKnowledge(agent);
  const toolFeatures = await hydrateFunctionBlocksForRuntime(agent, database);
  const toolsReady = await hasValidTools(agent, database, toolFeatures);
  const sandboxExpectationReady = settingsAndPromptingReady && channelReady;

  const items: ReadinessItem[] = [
    {
      key: "basics",
      label: "Settings and prompting are complete",
      done: settingsAndPromptingReady,
      detail: settingsAndPromptingReady
        ? "Name, persona, and tone are defined."
        : "Complete the agent name, persona, and tone before handoff.",
    },
    {
      key: "channel",
      label: "A connected channel is assigned",
      done: channelReady,
      detail: channelReady
        ? `Channel ${agent.channel.type} is connected and assigned.`
        : "Reconnect or replace the assigned channel before deployment work begins.",
    },
    {
      key: "knowledge",
      label: "Knowledge blocks are reviewable",
      done: knowledgeReady,
      detail: knowledgeReady
        ? "Knowledge blocks are present and filled."
        : "Add at least one complete knowledge block with real business content.",
    },
    {
      key: "tools",
      label: "Function configuration is valid",
      done: toolsReady,
      detail: toolsReady
        ? toolFeatures.length > 0
          ? "Functions and integration-backed execution steps are configured."
          : "No functions are configured yet, which is acceptable for a reply-only first deployment."
        : "Any configured function must use valid tenant-owned integration steps.",
    },
    {
      key: "testing",
      label: "Agent testing can proceed",
      done: sandboxExpectationReady,
      detail: sandboxExpectationReady
        ? "This draft is structurally ready for internal test-chat verification."
        : "Finish settings, prompting, and channel selection before relying on test-chat feedback.",
    },
  ];

  const ready = items.every((item) => item.done);

  return {
    ready,
    status: ready ? "ready_for_phase_6" : "needs_changes",
    items,
    summary: ready
      ? "This agent draft is ready for Phase 6 deploy and runtime work."
      : "This draft still needs changes before it is ready for live deployment work.",
  };
}

export async function getDeployStatus(
  agent: AgentWithConfigData,
  database: typeof db,
): Promise<DeployStatusResult> {
  const readiness = await assessAgentReadiness(agent, database);
  const deployment = buildChannelDeployConfig(agent, agent.webhookSecret ?? "preview");

  return {
    ...readiness,
    deployed: false,
    nextStatus: readiness.ready ? AgentStatus.ACTIVE : agent.status,
    channelConfig: mergeChannelConfig(agent.channelConfig, deployment.channelConfig),
    message: readiness.ready
      ? "This agent is ready to deploy."
      : "Resolve the readiness gaps before deploying this agent.",
  };
}

export async function deployAgent(
  agent: AgentWithConfigData,
  database: typeof db,
): Promise<DeployStatusResult> {
  const readiness = await assessAgentReadiness(agent, database);

  if (!readiness.ready) {
    return {
      ...readiness,
      deployed: false,
      nextStatus: agent.status,
      message: "Resolve the readiness gaps before handing this agent into Phase 6.",
    };
  }

  const deployment = buildChannelDeployConfig(agent);
  let channelConfig = mergeChannelConfig(agent.channelConfig, deployment.channelConfig);
  const webhookUrl =
    typeof channelConfig.webhookUrl === "string" ? channelConfig.webhookUrl : null;

  if (agent.channel.type === ChannelType.TELEGRAM && webhookUrl) {
    const credentials = decrypt(agent.channel.credentialsEnc);
    const botToken = parseTelegramBotToken(credentials);

    if (!botToken) {
      throw new Error("Telegram deploy requires a valid bot token.");
    }

    await registerTelegramWebhook({
      credentials,
      webhookUrl,
      secretToken: deployment.webhookSecret,
    });

    channelConfig = {
      ...channelConfig,
      webhookRegistration: "registered",
    };
  }

  if (agent.channel.type === ChannelType.GMAIL) {
    const watch = await registerGmailWatchForChannel({
      channelId: agent.channel.id,
      credentialsEnc: agent.channel.credentialsEnc,
    });

    channelConfig = {
      ...channelConfig,
      inboundMode: watch.ok ? "gmail_watch_pubsub" : "gmail_watch_pending",
      gmailWatch: watch,
    };
  }

  const updated = await db.agent.update({
    where: { id: agent.id },
    data: {
      status: AgentStatus.ACTIVE,
      deployedAt: new Date(),
      webhookSecret: deployment.webhookSecret,
      channelConfig,
    },
    select: {
      status: true,
      deployedAt: true,
      webhookSecret: true,
      channelConfig: true,
    },
  });

  return {
    ...readiness,
    deployed: true,
    nextStatus: updated.status,
    deployedAt: updated.deployedAt,
    webhookSecret: updated.webhookSecret,
    channelConfig: updated.channelConfig,
    message: "Agent deployed into the shared runtime and is ready to accept live channel events.",
  };
}
