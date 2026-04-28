import { FeatureType, Prisma } from "@prisma/client";

import {
  type AgentDraftInput,
  agentBuilderInclude,
  deriveFunctionBlocksFromAgent,
  getChannelConfigObject,
  mergeBuilderChannelConfig,
} from "@/lib/agent-builder";
import { db } from "@/lib/db";

type AgentWithBuilderData = Prisma.AgentGetPayload<{
  include: typeof agentBuilderInclude;
}>;

function hasToolFeatures(agent: AgentWithBuilderData) {
  return agent.features.some((feature) => feature.type === FeatureType.TOOL);
}

function normalizeJsonValue(value: unknown): Prisma.JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => normalizeJsonValue(entry));
  }

  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce<Prisma.JsonObject>((acc, key) => {
        acc[key] = normalizeJsonValue((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }

  return String(value);
}

function stableStringify(value: unknown) {
  return JSON.stringify(normalizeJsonValue(value));
}

function getExistingFunctionBlocks(agent: AgentWithBuilderData) {
  const channelConfig = getChannelConfigObject(agent.channelConfig);

  return Array.isArray(channelConfig.functionBlocks) ? channelConfig.functionBlocks : [];
}

function parseApplyFlag(argv: string[]) {
  return argv.includes("--apply");
}

async function main() {
  const apply = parseApplyFlag(process.argv.slice(2));
  const agents = await db.agent.findMany({
    orderBy: [{ tenantId: "asc" }, { createdAt: "asc" }],
    include: agentBuilderInclude,
  });

  let checked = 0;
  let skippedNoTools = 0;
  let skippedInSync = 0;
  let plannedUpdates = 0;
  let appliedUpdates = 0;

  for (const agent of agents) {
    checked += 1;

    if (!hasToolFeatures(agent)) {
      skippedNoTools += 1;
      console.log(
        `${agent.tenantId} ${agent.id} ${JSON.stringify(agent.name)}: SKIP - no TOOL features`,
      );
      continue;
    }

    const recoveredFunctionBlocks = deriveFunctionBlocksFromAgent(agent);
    const existingFunctionBlocks = getExistingFunctionBlocks(agent);

    if (stableStringify(recoveredFunctionBlocks) === stableStringify(existingFunctionBlocks)) {
      skippedInSync += 1;
      console.log(
        `${agent.tenantId} ${agent.id} ${JSON.stringify(agent.name)}: SKIP - functionBlocks already in sync (${recoveredFunctionBlocks.length} functions)`,
      );
      continue;
    }

    plannedUpdates += 1;
    console.log(
      `${agent.tenantId} ${agent.id} ${JSON.stringify(agent.name)}: ${
        apply ? "UPDATE" : "PLAN"
      } - functionBlocks ${existingFunctionBlocks.length} -> ${recoveredFunctionBlocks.length}`,
    );

    if (!apply) {
      continue;
    }

    const nextChannelConfig = mergeBuilderChannelConfig(agent.channelConfig, {
      priceAttachmentFileId: undefined,
      priceAttachmentFileName: undefined,
      priceAttachmentMimeType: undefined,
      functionBlocks: recoveredFunctionBlocks as AgentDraftInput["channelConfig"]["functionBlocks"],
    });

    await db.agent.update({
      where: { id: agent.id },
      data: {
        channelConfig: nextChannelConfig,
      },
    });

    appliedUpdates += 1;
  }

  console.log("");
  console.log(`Agents checked: ${checked}`);
  console.log(`Skipped (no TOOL features): ${skippedNoTools}`);
  console.log(`Skipped (already in sync): ${skippedInSync}`);
  console.log(`Planned updates: ${plannedUpdates}`);

  if (apply) {
    console.log(`Agents updated: ${appliedUpdates}`);
  } else {
    console.log("Dry-run mode: no database changes applied.");
  }
}

main()
  .catch((error) => {
    console.error(
      error instanceof Error ? error.stack ?? error.message : "Function block backfill failed.",
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
