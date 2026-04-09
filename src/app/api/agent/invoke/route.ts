import { NextRequest, NextResponse } from "next/server";

import {
  agentBuilderInclude,
  mapAgentToDraft,
  sandboxInvokeSchema,
} from "@/lib/agent-builder";
import { requireAdminApiSession } from "@/lib/admin-api-auth";
import { invokeAgent } from "@/lib/ai-runtime";
import { db } from "@/lib/db";
import { buildSystemPrompt } from "@/lib/prompt-builder";

export async function POST(req: NextRequest) {
  const session = await requireAdminApiSession();

  if (session instanceof NextResponse) {
    return session;
  }

  void session;

  const json = await req.json().catch(() => null);
  const parsed = sandboxInvokeSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid sandbox payload." }, { status: 400 });
  }

  if (parsed.data.agentId) {
    const agent = await db.agent.findFirst({
      where: {
        id: parsed.data.agentId,
        tenantId: parsed.data.tenantId,
      },
      include: agentBuilderInclude,
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found." }, { status: 404 });
    }

    const draft = mapAgentToDraft(agent);
    const response = await invokeAgent({
      tenantId: parsed.data.tenantId,
      agentId: parsed.data.agentId,
      channel: agent.channel.type,
      contactId: "sandbox-contact",
      message: parsed.data.message,
      promptPreview: buildSystemPrompt({
        ...draft,
        channel: agent.channel,
      }),
      languagePreference: draft.languagePreference,
      knowledgeBlocks: draft.knowledgeBlocks,
      toolBlocks: draft.toolBlocks.map((tool) => ({
        name: tool.name,
        description: tool.description,
        steps: tool.steps.map((step) => ({
          action: step.action,
          integrationType: step.integrationType,
        })),
      })),
    });

    return NextResponse.json({ item: response });
  }

  const selectedChannel = await db.channelConnection.findFirst({
    where: {
      id: parsed.data.draft.channelId,
      tenantId: parsed.data.tenantId,
    },
    select: { type: true, id: true },
  });

  if (!selectedChannel) {
    return NextResponse.json(
      { error: "Select a tenant channel before sandbox testing." },
      { status: 400 },
    );
  }

  const integrationMap = new Map(
    (
      await db.integrationConnection.findMany({
        where: {
          tenantId: parsed.data.tenantId,
          id: {
            in: parsed.data.draft.toolBlocks.flatMap((tool) =>
              tool.steps.map((step) => step.integrationId),
            ),
          },
        },
        select: { id: true, type: true },
      })
    ).map((integration) => [integration.id, integration.type]),
  );

  const response = await invokeAgent({
    tenantId: parsed.data.tenantId,
    channel: selectedChannel.type,
    contactId: "sandbox-contact",
    message: parsed.data.message,
    promptPreview: buildSystemPrompt({
      name: parsed.data.draft.name,
      persona: parsed.data.draft.persona,
      tone: parsed.data.draft.tone,
      languagePreference: parsed.data.draft.languagePreference ?? null,
      channel: selectedChannel,
      knowledgeBlocks: parsed.data.draft.knowledgeBlocks,
      toolBlocks: parsed.data.draft.toolBlocks.map((tool) => ({
        name: tool.name,
        description: tool.description,
        steps: tool.steps.map((step) => ({
          action: step.action,
          integrationType: integrationMap.get(step.integrationId),
        })),
      })),
    }),
    languagePreference: parsed.data.draft.languagePreference ?? null,
    knowledgeBlocks: parsed.data.draft.knowledgeBlocks,
    toolBlocks: parsed.data.draft.toolBlocks.map((tool) => ({
      name: tool.name,
      description: tool.description,
      steps: tool.steps.map((step) => ({
        action: step.action,
        integrationType: integrationMap.get(step.integrationId),
      })),
    })),
  });

  return NextResponse.json({ item: response });
}
