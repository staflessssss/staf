import { ChannelType, ConnectionStatus } from "@prisma/client";

import { getChannelConfigObject } from "@/lib/agent-config";
import { getInstagramCredentialsValidationError } from "@/lib/channels/instagram";
import { decrypt } from "@/lib/crypto";
import { getDeployStatus } from "@/lib/deploy";
import { db } from "@/lib/db";

type Check = {
  label: string;
  ok: boolean;
  detail: string;
};

function addCheck(checks: Check[], label: string, ok: boolean, detail: string) {
  checks.push({ label, ok, detail });
}

function formatResult(ok: boolean) {
  return ok ? "OK" : "FAIL";
}

async function main() {
  const tenantId = process.env.TENANT_ID?.trim();
  const agentId = process.env.AGENT_ID?.trim();
  const metaAppSecret =
    process.env.INSTAGRAM_APP_SECRET?.trim() || process.env.META_APP_SECRET?.trim();
  const checks: Check[] = [];

  if (!tenantId) {
    throw new Error("TENANT_ID is required.");
  }

  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    include: {
      channelConnections: {
        include: {
          agents: {
            include: {
              channel: true,
              features: true,
            },
          },
        },
      },
      integrationConnections: true,
    },
  });

  if (!tenant) {
    throw new Error(`Tenant ${tenantId} was not found.`);
  }

  const instagramChannel = tenant.channelConnections.find(
    (connection) => connection.type === ChannelType.INSTAGRAM,
  );
  const instagramAgent = agentId
    ? instagramChannel?.agents.find((agent) => agent.id === agentId)
    : instagramChannel?.agents[0];

  addCheck(
    checks,
    "Meta app secret",
    Boolean(metaAppSecret),
    metaAppSecret
      ? "Webhook signatures can be verified."
      : "Set INSTAGRAM_APP_SECRET or META_APP_SECRET in Vercel/env before production webhook POSTs.",
  );

  addCheck(
    checks,
    "Instagram channel exists",
    Boolean(instagramChannel),
    instagramChannel
      ? `Channel id ${instagramChannel.id}; status ${instagramChannel.status}.`
      : "Create an INSTAGRAM ChannelConnection first.",
  );

  if (instagramChannel) {
    const credentials = decrypt(instagramChannel.credentialsEnc);
    const credentialsError = getInstagramCredentialsValidationError(credentials);

    addCheck(
      checks,
      "Instagram channel connected",
      instagramChannel.status === ConnectionStatus.CONNECTED,
      `Current status: ${instagramChannel.status}.`,
    );
    addCheck(
      checks,
      "Instagram credentials shape",
      !credentialsError,
      credentialsError ?? "pageAccessToken, pageId, and igBusinessAccountId are present.",
    );
  }

  addCheck(
    checks,
    "Instagram agent exists",
    Boolean(instagramAgent),
    instagramAgent
      ? `Agent id ${instagramAgent.id}; status ${instagramAgent.status}; name ${instagramAgent.name}.`
      : agentId
        ? `No Instagram agent found for AGENT_ID=${agentId}.`
        : "Create a separate agent assigned to the Instagram channel.",
  );

  if (instagramAgent) {
    const channelConfig = getChannelConfigObject(instagramAgent.channelConfig);
    const channelBehavior =
      channelConfig.channelBehavior &&
      typeof channelConfig.channelBehavior === "object" &&
      !Array.isArray(channelConfig.channelBehavior)
        ? (channelConfig.channelBehavior as Record<string, unknown>)
        : {};
    const deployStatus = await getDeployStatus(instagramAgent, db);
    const deployConfig =
      deployStatus.channelConfig &&
      typeof deployStatus.channelConfig === "object" &&
      !Array.isArray(deployStatus.channelConfig)
        ? (deployStatus.channelConfig as Record<string, unknown>)
        : {};

    addCheck(
      checks,
      "Wedding runtime",
      channelConfig.runtimeType === "langgraph_wedding_sales",
      `runtimeType=${String(channelConfig.runtimeType ?? "legacy")}.`,
    );
    addCheck(
      checks,
      "Plain Instagram formatting",
      channelBehavior.useRichFormatting === false,
      "Set channelBehavior.useRichFormatting=false for Instagram plain links.",
    );
    addCheck(
      checks,
      "Instagram attachments disabled",
      channelBehavior.allowAttachments === false,
      "Set channelBehavior.allowAttachments=false for Instagram launch.",
    );
    addCheck(
      checks,
      "Deploy webhook URL",
      typeof deployConfig.webhookUrl === "string" && deployConfig.webhookUrl.startsWith("https://"),
      typeof deployConfig.webhookUrl === "string"
        ? `webhookUrl=${deployConfig.webhookUrl}`
        : "Set APP_BASE_URL or NEXTAUTH_URL to public HTTPS before deploy.",
    );
    addCheck(
      checks,
      "Deploy outbound mode",
      deployConfig.outboundMode === "meta_graph_api",
      `outboundMode=${String(deployConfig.outboundMode ?? "missing")}.`,
    );
  }

  console.log(`Instagram launch readiness for tenant ${tenant.name} (${tenant.id})`);
  console.log("");

  for (const check of checks) {
    console.log(`[${formatResult(check.ok)}] ${check.label}: ${check.detail}`);
  }

  const failed = checks.filter((check) => !check.ok);
  console.log("");

  if (failed.length === 0) {
    console.log("Ready for Meta webhook registration and live DM smoke test.");
  } else {
    console.log(`${failed.length} checks need attention before Instagram launch.`);
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
