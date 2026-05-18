import assert from "node:assert/strict";

import { ChannelType } from "@prisma/client";

import { agentConfigInclude, hydrateFunctionBlocksForRuntime } from "@/lib/agent-config";
import { db } from "@/lib/db";
import { getLangGraphPostgresSaver } from "@/lib/lang/checkpointing";
import { buildWeddingSalesConfigFromChannelConfig } from "@/lib/lang/graphs/wedding-sales/config-from-agent";
import { invokeWeddingSalesGraph } from "@/lib/lang/graphs/wedding-sales/graph";
import { createWeddingSalesToolContextFromFeatures } from "@/lib/lang/graphs/wedding-sales/tools";

async function findAgent() {
  const agentId = process.env.WEDDING_SALES_CHECKPOINT_AGENT_ID || process.env.WEDDING_SALES_DRY_RUN_AGENT_ID;

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
  const saver = await getLangGraphPostgresSaver();
  assert.ok(saver, "LANGGRAPH_POSTGRES_URL or DATABASE_URL is required for checkpoint smoke test.");

  const agent = await findAgent();
  assert.ok(agent, "No Myndful Gmail agent found. Set WEDDING_SALES_CHECKPOINT_AGENT_ID to run explicitly.");

  const toolFeatures = await hydrateFunctionBlocksForRuntime(agent, db);
  const toolContext = createWeddingSalesToolContextFromFeatures({
    tenantId: agent.tenantId,
    toolFeatures,
    testMode: true,
    defaultEmail: "checkpoint-smoke@example.com",
  });
  assert.ok(toolContext, "Wedding sales tool context is not ready for checkpoint smoke test.");

  const contactId = process.env.WEDDING_SALES_CHECKPOINT_CONTACT_ID || `checkpoint-smoke-${Date.now()}`;
  const config = buildWeddingSalesConfigFromChannelConfig(agent.channelConfig);
  const baseInput = {
    tenantId: agent.tenantId,
    agentId: agent.id,
    contactId,
    channel: "gmail" as const,
    config,
    toolContext,
    checkpoint: true,
  };

  const first = await invokeWeddingSalesGraph({
    ...baseInput,
    message: "We are Anna and Mark. Our wedding is June 14, 2027 in Charlotte, NC.",
  });

  assert.equal(first.availability, "available");
  assert.equal(first.guideSent, true);
  assert.equal(first.weddingDate, "2027-06-14");

  const second = await invokeWeddingSalesGraph({
    ...baseInput,
    message: "Would Monday at 10 AM Eastern work for a consultation?",
  });

  assert.equal(second.weddingDate, "2027-06-14");
  assert.equal(second.names, "Anna and Mark");
  assert.equal(second.guideSent, true);
  assert.ok(["checking_calendar", "call_proposed"].includes(second.leadStage));
  assert.equal(second.toolObservations.at(-1)?.toolName, "check_consultation_calendar");

  console.log(
    JSON.stringify(
      {
        status: "pass",
        tenantId: agent.tenantId,
        agentId: agent.id,
        contactId,
        first: {
          leadStage: first.leadStage,
          availability: first.availability,
          guideSent: first.guideSent,
          weddingDate: first.weddingDate,
        },
        second: {
          leadStage: second.leadStage,
          calendarStatus: second.calendarStatus,
          guideSent: second.guideSent,
          weddingDate: second.weddingDate,
          names: second.names,
          tools: second.toolObservations.map((observation) => observation.toolName),
        },
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
