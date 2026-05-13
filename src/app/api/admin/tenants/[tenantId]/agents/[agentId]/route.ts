import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import {
  agentConfigInclude,
  agentDraftSchema,
  buildFeatureCreateInput,
  formatAgentDraftValidationError,
  getChannelConfigObject,
  getEnabledIntegrationIds,
  getFunctionExecutionViolation,
  getFunctionIntegrationAllowlistViolation,
  getFunctionIntegrationIds,
  getFunctionStepValidationViolation,
  getUnsupportedFunctionIntegrationViolation,
  mergeAgentChannelConfig,
  serializeAgentConfig,
  validateAgentConfigReferences,
} from "@/lib/agent-config";
import { requireAdminApiSession } from "@/lib/admin-api-auth";
import { db } from "@/lib/db";
import { buildSystemPrompt } from "@/lib/prompt-composer";

type AgentRouteContext = {
  params: Promise<{ tenantId: string; agentId: string }>;
};

export async function GET(_: Request, context: AgentRouteContext) {
  const session = await requireAdminApiSession();

  if (session instanceof NextResponse) {
    return session;
  }

  void session;

  const { tenantId, agentId } = await context.params;

  const agent = await db.agent.findFirst({
    where: { id: agentId, tenantId },
    include: agentConfigInclude,
  });

  if (!agent) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  }

  return NextResponse.json({
    item: {
      ...serializeAgentConfig(agent),
      promptPreview: buildSystemPrompt({
        ...serializeAgentConfig(agent).draft,
        channel: agent.channel,
        channelBehavior: getChannelConfigObject(agent.channelConfig).channelBehavior as never,
        conversationPlaybook: getChannelConfigObject(agent.channelConfig).conversationPlaybook as never,
        prompting: getChannelConfigObject(agent.channelConfig).prompting as never,
      }),
    },
  });
}

export async function PATCH(request: Request, context: AgentRouteContext) {
  const session = await requireAdminApiSession();

  if (session instanceof NextResponse) {
    return session;
  }

  void session;

  const { tenantId, agentId } = await context.params;
  const json = await request.json().catch(() => null);
  const parsed = agentDraftSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: formatAgentDraftValidationError(parsed.error) },
      { status: 400 },
    );
  }

  const existingAgent = await db.agent.findFirst({
    where: { id: agentId, tenantId },
    select: { id: true, channelConfig: true },
  });

  if (!existingAgent) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  }

  const integrationIds = Array.from(
    new Set([
      ...getFunctionIntegrationIds(parsed.data),
      ...getEnabledIntegrationIds(parsed.data),
    ]),
  );
  const executionViolation = getFunctionExecutionViolation(parsed.data);

  if (executionViolation) {
    return NextResponse.json(
      { error: executionViolation.error },
      { status: 400 },
    );
  }

  const allowlistViolation = getFunctionIntegrationAllowlistViolation(parsed.data);

  if (allowlistViolation) {
    return NextResponse.json(
      { error: allowlistViolation.error },
      { status: 400 },
    );
  }

  try {
    const item = await db.$transaction(async (tx) => {
      const validation = await validateAgentConfigReferences({
        tx,
        tenantId,
        channelId: parsed.data.channelId,
        agentId,
        integrationIds,
      });

      if ("error" in validation) {
        throw new Error(validation.error);
      }

      const unsupportedFunctionIntegration = getUnsupportedFunctionIntegrationViolation(
        parsed.data,
        "integrations" in validation && validation.integrations
          ? validation.integrations
          : [],
      );

      if (unsupportedFunctionIntegration) {
        throw new Error(unsupportedFunctionIntegration.error);
      }

      const functionStepViolation = getFunctionStepValidationViolation(
        parsed.data,
        "integrations" in validation && validation.integrations
          ? validation.integrations
          : [],
      );

      if (functionStepViolation) {
        throw new Error(functionStepViolation.error);
      }

      await tx.feature.deleteMany({
        where: { agentId },
      });

      const agent = await tx.agent.update({
        where: { id: agentId },
        data: {
          channelId: parsed.data.channelId,
          name: parsed.data.name,
          persona: parsed.data.persona,
          tone: parsed.data.tone,
          languagePreference: parsed.data.languagePreference,
          status: parsed.data.status,
          channelConfig: mergeAgentChannelConfig(
            existingAgent.channelConfig,
            parsed.data.channelConfig,
          ),
          features: {
            create: buildFeatureCreateInput(parsed.data),
          },
        },
        include: agentConfigInclude,
      });

      return agent;
    }, {
      maxWait: 5_000,
      timeout: 20_000,
    });

    return NextResponse.json({
      item: {
        ...serializeAgentConfig(item),
        promptPreview: buildSystemPrompt({
          ...serializeAgentConfig(item).draft,
          channel: item.channel,
          channelBehavior: getChannelConfigObject(item.channelConfig).channelBehavior as never,
          conversationPlaybook: getChannelConfigObject(item.channelConfig).conversationPlaybook as never,
          prompting: getChannelConfigObject(item.channelConfig).prompting as never,
        }),
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "This channel is already assigned to another agent." },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update agent." },
      { status: 400 },
    );
  }
}
