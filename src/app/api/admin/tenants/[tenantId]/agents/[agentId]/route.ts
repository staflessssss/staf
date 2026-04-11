import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import {
  agentBuilderInclude,
  agentDraftSchema,
  buildFeatureCreateInput,
  getToolIntegrationIds,
  serializeBuilderAgent,
  validateBuilderReferences,
} from "@/lib/agent-builder";
import { requireAdminApiSession } from "@/lib/admin-api-auth";
import { db } from "@/lib/db";
import { buildSystemPrompt } from "@/lib/prompt-builder";

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
    include: agentBuilderInclude,
  });

  if (!agent) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  }

  return NextResponse.json({
    item: {
      ...serializeBuilderAgent(agent),
      promptPreview: buildSystemPrompt({
        ...serializeBuilderAgent(agent).draft,
        channel: agent.channel,
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
    return NextResponse.json({ error: "Invalid agent payload." }, { status: 400 });
  }

  const existingAgent = await db.agent.findFirst({
    where: { id: agentId, tenantId },
    select: { id: true },
  });

  if (!existingAgent) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  }

  const integrationIds = getToolIntegrationIds(parsed.data);

  try {
    const item = await db.$transaction(async (tx) => {
      const validation = await validateBuilderReferences({
        tx,
        tenantId,
        channelId: parsed.data.channelId,
        agentId,
        integrationIds,
      });

      if ("error" in validation) {
        throw new Error(validation.error);
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
          channelConfig: parsed.data.channelConfig as Prisma.InputJsonValue,
          features: {
            create: buildFeatureCreateInput(parsed.data),
          },
        },
        include: agentBuilderInclude,
      });

      return agent;
    });

    return NextResponse.json({
      item: {
        ...serializeBuilderAgent(item),
        promptPreview: buildSystemPrompt({
          ...serializeBuilderAgent(item).draft,
          channel: item.channel,
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
