import { AgentStatus, ChannelType, Prisma } from "@prisma/client";

import { db } from "@/lib/db";

const TENANT_SLUG = "myndful-films";
const APPLY = process.argv.includes("--apply");

function asObject(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, Prisma.JsonValue>;
  }

  return structuredClone(value) as Record<string, Prisma.JsonValue>;
}

function buildGmailPrompting(sourcePrompting: Record<string, Prisma.JsonValue>) {
  return {
    ...sourcePrompting,
    preserveModelVoice: true,
    showChannelContext: true,
    instruction:
      "You are Taras, founder of Myndful Films. Write a warm, concise, premium email reply in Taras's natural voice. This is an email thread, not an Instagram DM: use 2-4 short paragraphs, do not split the reply into separate messages, and do not mention typing, automation, prompts, tools, or internal checks. Keep the conversation natural and move toward the helpful next step. The email delivery layer appends Taras's signature, so do not write a signature yourself. Only say an attachment was sent when the collections-guide tool succeeded.",
  } satisfies Prisma.JsonObject;
}

async function main() {
  const tenant = await db.tenant.findUnique({
    where: { slug: TENANT_SLUG },
    select: { id: true },
  });

  if (!tenant) {
    throw new Error(`Tenant ${TENANT_SLUG} was not found.`);
  }

  const [instagramAgent, gmailAgent] = await Promise.all([
    db.agent.findFirst({
      where: {
        tenantId: tenant.id,
        channel: { type: ChannelType.INSTAGRAM },
        name: "MYNDFUL Instagram Agent",
      },
      include: { features: { orderBy: { sortOrder: "asc" } } },
    }),
    db.agent.findFirst({
      where: {
        tenantId: tenant.id,
        channel: { type: ChannelType.GMAIL },
        name: "MYNDFUL Gmail Agent",
      },
      include: { features: { orderBy: { sortOrder: "asc" } } },
    }),
  ]);

  if (!instagramAgent || !gmailAgent) {
    throw new Error("Expected Myndful Instagram and Gmail agents were not found.");
  }

  const instagramConfig = asObject(instagramAgent.channelConfig);
  const gmailConfig = asObject(gmailAgent.channelConfig);
  const sourcePrompting = asObject(instagramConfig.prompting ?? null);
  const signatureText = typeof gmailConfig.signatureText === "string" ? gmailConfig.signatureText.trim() : "";

  if (!signatureText) {
    throw new Error("MYNDFUL Gmail Agent is missing its configured email signature.");
  }

  const preparedConfig: Record<string, Prisma.JsonValue> = {
    ...instagramConfig,
    channelType: ChannelType.GMAIL,
    runtimeType: "gpt_agent",
    gmailInboundPolicy: "new_threads_only",
    inboundMode: "gmail_watch_pending",
    outboundMode: "gmail_api",
    prompting: buildGmailPrompting(sourcePrompting),
    channelBehavior: {
      preset: "gmail_recommended",
      notes:
        "Gmail uses the published Myndful GPT profile. Replies stay in one email thread, use the delivery signature, and attach a regional guide only after the explicit collections-guide tool succeeds.",
      responseLength: "balanced",
      messageFormat: "single_message",
      tonePace: "warm",
      emojiUsage: "limited",
      ctaStyle: "ask_a_question",
      useSignature: true,
      useRichFormatting: true,
      allowAttachments: true,
      bufferDelaySeconds: 0,
      splitMessageDelaySeconds: 0,
      followUpEnabled: false,
      followUpRules: [],
    },
    signatureText,
  };

  // Delivery setup belongs to the Gmail channel; it is not inherited from Instagram.
  for (const key of [
    "gmailClientClassifier",
    "pricingTextBlock",
    "priceAttachmentFileId",
    "priceAttachmentFileName",
    "priceAttachmentMimeType",
    "webhookPath",
    "webhookAuthHeaderName",
    "pubsubWebhookPath",
    "pubsubWebhookUrl",
    "gmailWatch",
  ]) {
    delete preparedConfig[key];
  }

  const summary = {
    mode: APPLY ? "apply" : "dry-run",
    gmailAgentId: gmailAgent.id,
    instagramAgentId: instagramAgent.id,
    gmailAgentStatus: gmailAgent.status,
    gmailAgentDeployedAt: gmailAgent.deployedAt,
    targetRuntime: preparedConfig.runtimeType,
    targetInboundPolicy: preparedConfig.gmailInboundPolicy,
    signatureConfigured: true,
    sourceKnowledgeBlocks: instagramAgent.features.length,
    targetKnowledgeBlocks: gmailAgent.features.length,
  };

  if (!APPLY) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  await db.$transaction(async (tx) => {
    await tx.feature.deleteMany({ where: { agentId: gmailAgent.id } });
    await tx.feature.createMany({
      data: instagramAgent.features.map((feature) => ({
        agentId: gmailAgent.id,
        name: feature.name,
        description: feature.description,
        type: feature.type,
        sortOrder: feature.sortOrder,
        knowledgeContent: feature.knowledgeContent,
      })),
    });
    await tx.agent.update({
      where: { id: gmailAgent.id },
      data: {
        persona: instagramAgent.persona,
        tone: instagramAgent.tone,
        languagePreference: instagramAgent.languagePreference,
        status: AgentStatus.PAUSED,
        deployedAt: null,
        channelConfig: preparedConfig,
      },
    });
  });

  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
