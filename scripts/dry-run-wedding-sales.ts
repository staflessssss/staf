import { ChannelType } from "@prisma/client";

import { agentConfigInclude, hydrateFunctionBlocksForRuntime } from "@/lib/agent-config";
import { db } from "@/lib/db";
import { buildWeddingSalesConfigFromChannelConfig } from "@/lib/lang/graphs/wedding-sales/config-from-agent";
import { invokeWeddingSalesGraph } from "@/lib/lang/graphs/wedding-sales/graph";
import { createWeddingSalesToolContextFromFeatures } from "@/lib/lang/graphs/wedding-sales/tools";

const defaultCases = [
  "Hi, we love your films and want more info about wedding video.",
  "We are Anna and Mark. Our wedding is June 14 in Charlotte.",
  "We are Anna and Mark. Our wedding is June 14, 2027 in Charlotte, NC.",
  "Would Monday at 10 AM Eastern work for a consultation?",
  "Yes, please book it.",
  "Hi, I am the wedding coordinator sending the COI and vendor details.",
];

async function findAgent() {
  const agentId = process.env.WEDDING_SALES_DRY_RUN_AGENT_ID;

  if (agentId) {
    return db.agent.findFirst({
      where: {
        id: agentId,
        channel: { type: ChannelType.GMAIL },
      },
      include: agentConfigInclude,
    });
  }

  return db.agent.findFirst({
    where: {
      name: {
        contains: "MYNDFUL Gmail",
        mode: "insensitive",
      },
      channel: { type: ChannelType.GMAIL },
    },
    include: agentConfigInclude,
    orderBy: {
      updatedAt: "desc",
    },
  });
}

async function main() {
  const agent = await findAgent();

  if (!agent) {
    console.log("No Myndful Gmail agent found. Set WEDDING_SALES_DRY_RUN_AGENT_ID to run explicitly.");
    return;
  }

  const toolFeatures = await hydrateFunctionBlocksForRuntime(agent, db);
  const toolContext = createWeddingSalesToolContextFromFeatures({
    tenantId: agent.tenantId,
    toolFeatures,
    testMode: true,
    defaultEmail: "dry-run@example.com",
  });
  const config = buildWeddingSalesConfigFromChannelConfig(agent.channelConfig);

  console.log(
    JSON.stringify(
      {
        tenantId: agent.tenantId,
        agentId: agent.id,
        agentName: agent.name,
        toolContextReady: Boolean(toolContext),
        toolFeatures: toolFeatures.map((feature) => ({
          name: feature.name,
          steps: feature.steps.map((step) => ({
            integrationType: step.integration.type,
            action: step.action,
          })),
        })),
        config: {
          portfolioCount: config.portfolio.length,
          reviews: config.reviews.label,
          guideFileName: config.guide.fileName,
          signatureConfigured: Boolean(config.signature),
          bookingWindow: config.callBookingWindow,
        },
      },
      null,
      2,
    ),
  );

  let previousState = undefined;

  for (const message of defaultCases) {
    const result = await invokeWeddingSalesGraph({
      channel: "gmail",
      message,
      previousState,
      config,
      toolContext,
    });

    previousState = result;

    console.log("");
    console.log(`Customer: ${message}`);
    console.log(`Stage: ${result.leadStage}`);
    console.log(`Tools: ${result.toolObservations.map((entry) => entry.toolName).join(", ") || "none"}`);
    console.log(`Agent: ${result.responseDraft}`);
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
