import { FeatureType, Prisma } from "@prisma/client";

import {
  type AgentDraftInput,
  agentBuilderInclude,
  deriveToolBlocksFromDraft,
  getChannelConfigObject,
} from "@/lib/agent-builder";
import { db } from "@/lib/db";

type NormalizedParams = Prisma.JsonValue;

type NormalizedStep = {
  action: string;
  integrationId: string;
  params: NormalizedParams;
};

type NormalizedTool = {
  description: string;
  name: string;
  steps: NormalizedStep[];
};

type DiffStatus = "MATCH" | "A_ONLY" | "B_ONLY" | "DIFF";

type AgentComparison = {
  agentId: string;
  agentName: string;
  details: string[];
  status: DiffStatus;
  tenantId: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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

  if (isRecord(value)) {
    return Object.keys(value)
      .sort()
      .reduce<Prisma.JsonObject>((acc, key) => {
        acc[key] = normalizeJsonValue(value[key]);
        return acc;
      }, {});
  }

  return String(value);
}

function normalizeStepParams(value: unknown): NormalizedParams {
  if (typeof value === "string") {
    try {
      return normalizeJsonValue(JSON.parse(value));
    } catch {
      return normalizeJsonValue(value);
    }
  }

  return normalizeJsonValue(value);
}

function normalizeTool(tool: {
  name: string;
  description: string;
  steps?: Array<{
    action: string;
    integrationId: string;
    params: unknown;
  }>;
}): NormalizedTool {
  return {
    name: tool.name.trim(),
    description: tool.description.trim(),
    steps: (tool.steps ?? []).map((step) => ({
      action: step.action.trim(),
      integrationId: step.integrationId,
      params: normalizeStepParams(step.params),
    })),
  };
}

function buildFeatureStepPicture(
  agent: Prisma.AgentGetPayload<{ include: typeof agentBuilderInclude }>,
): NormalizedTool[] {
  return agent.features
    .filter((feature) => feature.type === FeatureType.TOOL)
    .map((feature) =>
      normalizeTool({
        name: feature.name,
        description: feature.description,
        steps: feature.steps.map((step) => ({
          action: step.action,
          integrationId: step.integrationId,
          params: step.params,
        })),
      }),
    );
}

function buildFunctionBlockPicture(
  agent: Prisma.AgentGetPayload<{ include: typeof agentBuilderInclude }>,
): NormalizedTool[] {
  const channelConfig = getChannelConfigObject(agent.channelConfig);
  const toolBlocks = deriveToolBlocksFromDraft({
    channelConfig: {
      priceAttachmentFileId: undefined,
      priceAttachmentFileName: undefined,
      priceAttachmentMimeType: undefined,
      functionBlocks: Array.isArray(channelConfig.functionBlocks)
        ? (channelConfig.functionBlocks as AgentDraftInput["channelConfig"]["functionBlocks"])
        : [],
    },
    toolBlocks: [],
  });

  return toolBlocks.map((tool) => normalizeTool(tool));
}

function stableStringify(value: Prisma.JsonValue) {
  return JSON.stringify(value);
}

function compareSteps(
  toolName: string,
  leftSteps: NormalizedStep[],
  rightSteps: NormalizedStep[],
): string[] {
  const details: string[] = [];

  if (leftSteps.length !== rightSteps.length) {
    details.push(
      `function "${toolName}" step count differs (${leftSteps.length} vs ${rightSteps.length})`,
    );
  }

  const stepCount = Math.min(leftSteps.length, rightSteps.length);
  for (let index = 0; index < stepCount; index += 1) {
    const left = leftSteps[index];
    const right = rightSteps[index];

    if (!left || !right) {
      continue;
    }

    if (left.action !== right.action) {
      details.push(`function "${toolName}" steps[${index}].action differs`);
    }

    if (left.integrationId !== right.integrationId) {
      details.push(`function "${toolName}" steps[${index}].integrationId differs`);
    }

    if (stableStringify(left.params) !== stableStringify(right.params)) {
      details.push(`function "${toolName}" steps[${index}].params differs`);
    }
  }

  return details;
}

function compareTools(
  leftTools: NormalizedTool[],
  rightTools: NormalizedTool[],
): Pick<AgentComparison, "details" | "status"> {
  const details: string[] = [];
  const leftOnlyNames = new Set<string>();
  const rightOnlyNames = new Set<string>();

  const leftByName = new Map<string, NormalizedTool[]>();
  const rightByName = new Map<string, NormalizedTool[]>();

  for (const tool of leftTools) {
    const bucket = leftByName.get(tool.name) ?? [];
    bucket.push(tool);
    leftByName.set(tool.name, bucket);
  }

  for (const tool of rightTools) {
    const bucket = rightByName.get(tool.name) ?? [];
    bucket.push(tool);
    rightByName.set(tool.name, bucket);
  }

  for (const [name, leftBucket] of leftByName) {
    const rightBucket = rightByName.get(name);

    if (!rightBucket) {
      leftOnlyNames.add(name);
      details.push(`function "${name}" exists only in Feature/Step`);
      continue;
    }

    const pairCount = Math.min(leftBucket.length, rightBucket.length);
    if (leftBucket.length !== rightBucket.length) {
      details.push(
        `function "${name}" occurrence count differs (${leftBucket.length} vs ${rightBucket.length})`,
      );
    }

    for (let index = 0; index < pairCount; index += 1) {
      const left = leftBucket[index];
      const right = rightBucket[index];

      if (!left || !right) {
        continue;
      }

      if (left.description !== right.description) {
        details.push(`function "${name}" description differs`);
      }

      details.push(...compareSteps(name, left.steps, right.steps));
    }

    if (leftBucket.length > rightBucket.length) {
      leftOnlyNames.add(name);
    }

    if (rightBucket.length > leftBucket.length) {
      rightOnlyNames.add(name);
    }
  }

  for (const [name] of rightByName) {
    if (!leftByName.has(name)) {
      rightOnlyNames.add(name);
      details.push(`function "${name}" exists only in functionBlocks`);
    }
  }

  if (details.length === 0) {
    return { details, status: "MATCH" };
  }

  const hasSharedDiff = details.some(
    (detail) =>
      !detail.includes("exists only in Feature/Step") &&
      !detail.includes("exists only in functionBlocks"),
  );

  if (hasSharedDiff || (leftOnlyNames.size > 0 && rightOnlyNames.size > 0)) {
    return { details, status: "DIFF" };
  }

  if (leftOnlyNames.size > 0) {
    return { details, status: "A_ONLY" };
  }

  if (rightOnlyNames.size > 0) {
    return { details, status: "B_ONLY" };
  }

  return { details, status: "DIFF" };
}

function printReport(results: AgentComparison[]) {
  const counts = results.reduce<Record<DiffStatus, number>>(
    (acc, result) => {
      acc[result.status] += 1;
      return acc;
    },
    {
      MATCH: 0,
      A_ONLY: 0,
      B_ONLY: 0,
      DIFF: 0,
    },
  );

  console.log(`Agents checked: ${results.length}`);
  console.log(`MATCH: ${counts.MATCH}`);
  console.log(`A_ONLY: ${counts.A_ONLY}`);
  console.log(`B_ONLY: ${counts.B_ONLY}`);
  console.log(`DIFF: ${counts.DIFF}`);

  const mismatches = results.filter((result) => result.status !== "MATCH");
  if (mismatches.length === 0) {
    console.log("No tool sync mismatches found.");
    return;
  }

  console.log("");
  console.log("Mismatches:");
  for (const result of mismatches) {
    const summary = result.details[0] ?? "difference detected";
    console.log(
      `${result.tenantId} ${result.agentId} ${JSON.stringify(result.agentName)}: ${result.status} - ${summary}`,
    );
  }
}

async function main() {
  const agents = await db.agent.findMany({
    orderBy: [{ tenantId: "asc" }, { createdAt: "asc" }],
    include: agentBuilderInclude,
  });

  const results = agents.map<AgentComparison>((agent) => {
    const featureTools = buildFeatureStepPicture(agent);
    const functionBlockTools = buildFunctionBlockPicture(agent);
    const comparison = compareTools(featureTools, functionBlockTools);

    return {
      tenantId: agent.tenantId,
      agentId: agent.id,
      agentName: agent.name,
      status: comparison.status,
      details: comparison.details,
    };
  });

  printReport(results);
}

main()
  .catch((error) => {
    console.error(
      error instanceof Error ? error.stack ?? error.message : "Tool sync check failed.",
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
