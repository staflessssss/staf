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
    include: agentBuilderInclude,
  });

  return NextResponse.json({
    items: items.map((agent) => ({
      ...serializeBuilderAgent(agent),
      promptPreview: buildSystemPrompt({
        ...serializeBuilderAgent(agent).draft,
        channel: agent.channel,
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

  const integrationIds = getToolIntegrationIds(parsed.data);

  try {
    const item = await db.$transaction(async (tx) => {
      const validation = await validateBuilderReferences({
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
          channelConfig: parsed.data.channelConfig as Prisma.InputJsonValue,
          features: {
            create: buildFeatureCreateInput(parsed.data),
          },
        },
        include: agentBuilderInclude,
      });

      return agent;
    });

    return NextResponse.json(
      {
        item: {
          ...serializeBuilderAgent(item),
          promptPreview: buildSystemPrompt({
            ...serializeBuilderAgent(item).draft,
            channel: item.channel,
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
