import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import {
  agentConfigInclude,
  agentDraftSchema,
  buildFeatureCreateInput,
  getChannelConfigObject,
  getFunctionIntegrationIds,
  mergeAgentChannelConfig,
  serializeAgentConfig,
  validateAgentConfigReferences,
} from "@/lib/agent-config";
import { requireAdminApiSession } from "@/lib/admin-api-auth";
import { db } from "@/lib/db";
import { buildSystemPrompt } from "@/lib/prompt-composer";

type TenantAgentsRouteContext = {
  params: Promise<{ tenantId: string }>;
};

export async function GET(_: Request, context: TenantAgentsRouteContext) {
  const session = await requireAdminApiSession();

  if (session instanceof NextResponse) {
    return session;
  }

  void session;

  const { tenantId } = await context.params;

  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true },
  });

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }

  const items = await db.agent.findMany({
    where: { tenantId },
    orderBy: { updatedAt: "desc" },
    include: agentConfigInclude,
  });

  return NextResponse.json({
    items: items.map((agent) => ({
      ...serializeAgentConfig(agent),
      promptPreview: buildSystemPrompt({
        ...serializeAgentConfig(agent).draft,
        channel: agent.channel,
        channelBehavior: getChannelConfigObject(agent.channelConfig).channelBehavior as never,
        conversationPlaybook: getChannelConfigObject(agent.channelConfig).conversationPlaybook as never,
        prompting: getChannelConfigObject(agent.channelConfig).prompting as never,
      }),
    })),
  });
}

export async function POST(request: Request, context: TenantAgentsRouteContext) {
  const session = await requireAdminApiSession();

  if (session instanceof NextResponse) {
    return session;
  }

  void session;

  const { tenantId } = await context.params;
  const json = await request.json().catch(() => null);
  const parsed = agentDraftSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid agent payload." }, { status: 400 });
  }

  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true },
  });

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }

  const integrationIds = getFunctionIntegrationIds(parsed.data);

  try {
    const item = await db.$transaction(async (tx) => {
      const validation = await validateAgentConfigReferences({
        tx,
        tenantId,
        channelId: parsed.data.channelId,
        integrationIds,
      });

      if ("error" in validation) {
        throw new Error(validation.error);
      }

      const agent = await tx.agent.create({
        data: {
          tenantId,
          channelId: parsed.data.channelId,
          name: parsed.data.name,
          persona: parsed.data.persona,
          tone: parsed.data.tone,
          languagePreference: parsed.data.languagePreference,
          status: parsed.data.status,
          channelConfig: mergeAgentChannelConfig(null, parsed.data.channelConfig),
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

    return NextResponse.json(
      {
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
      },
      { status: 201 },
    );
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
      { error: error instanceof Error ? error.message : "Could not create agent." },
      { status: 400 },
    );
  }
}
