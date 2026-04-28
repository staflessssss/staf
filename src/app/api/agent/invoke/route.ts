import { NextRequest, NextResponse } from "next/server";

import {
  agentBuilderInclude,
  functionBlocksToToolBlocks,
  normalizeFunctionBlocks,
  resolvePromptingIdentity,
  type SandboxInvokeInput,
  sandboxInvokeSchema,
} from "@/lib/agent-builder";
import { requireAdminApiSession } from "@/lib/admin-api-auth";
import { invokeAgent } from "@/lib/ai-runtime";
import { db } from "@/lib/db";
import { getOrderedResultTargets } from "@/lib/functions/destination-mapping";
import { buildSystemPrompt } from "@/lib/prompt-builder";

export async function POST(req: NextRequest) {
  const session = await requireAdminApiSession();

  if (session instanceof NextResponse) {
    return session;
  }

  void session;

  const json = await req.json().catch(() => null);
  const parsed = sandboxInvokeSchema.safeParse(json);
  const testMode = true;

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid test chat payload." }, { status: 400 });
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

    const response = await invokeAgent({
      tenantId: parsed.data.tenantId,
      agentId: parsed.data.agentId,
      allowDraftAgent: true,
      testMode,
      channel: agent.channel.type,
      contactId: parsed.data.contactId ?? "test-chat-contact",
      message: parsed.data.message,
      historyMessages: coerceHistoryMessages(parsed.data),
    });

    return NextResponse.json({ item: response });
  }

  if (!parsed.data.draft) {
    return NextResponse.json({ error: "Draft config is required for unsaved testing." }, { status: 400 });
  }

  const functionBlocks = normalizeFunctionBlocks(
    parsed.data.draft.channelConfig.functionBlocks ?? [],
  );
  const derivedToolBlocks = functionBlocksToToolBlocks(functionBlocks);

  const selectedChannel = await db.channelConnection.findFirst({
    where: {
      id: parsed.data.draft.channelId,
      tenantId: parsed.data.tenantId,
    },
    select: { type: true, id: true },
  });

  if (!selectedChannel) {
    return NextResponse.json(
      { error: "Select a tenant channel before test-chat runs." },
      { status: 400 },
    );
  }

  const integrationMap = new Map(
    (
      await db.integrationConnection.findMany({
        where: {
          tenantId: parsed.data.tenantId,
          id: {
            in: derivedToolBlocks.flatMap((tool) =>
              tool.steps.map((step) => step.integrationId),
            ),
          },
        },
        select: { id: true, type: true },
      })
    ).map((integration) => [integration.id, integration.type]),
  );
  const promptingIdentity = resolvePromptingIdentity({
    prompting: parsed.data.draft.channelConfig.prompting,
    persona: parsed.data.draft.persona,
    tone: parsed.data.draft.tone,
    languagePreference: parsed.data.draft.languagePreference ?? null,
  });

  const response = await invokeAgent({
    tenantId: parsed.data.tenantId,
    testMode,
    channel: selectedChannel.type,
    contactId: parsed.data.contactId ?? "test-chat-contact",
    message: parsed.data.message,
    historyMessages: coerceHistoryMessages(parsed.data),
    functionBlocks,
    promptPreview: buildSystemPrompt({
      name: parsed.data.draft.name,
      persona: promptingIdentity.persona,
      tone: promptingIdentity.tone,
      languagePreference: promptingIdentity.languagePreference,
      channel: selectedChannel,
      prompting: parsed.data.draft.channelConfig.prompting,
      knowledgeBlocks: parsed.data.draft.knowledgeBlocks,
      functionBlocks: parsed.data.draft.channelConfig.functionBlocks?.map((fn) => ({
        name: fn.name,
        description: fn.description,
        active: fn.active,
        parameters: fn.parameters,
        reactionAction: fn.reactionAction,
        postAction: fn.postAction,
        disableDelayedMessages: fn.disableDelayedMessages,
        resultTargets: getOrderedResultTargets(fn.resultTargets),
        steps: fn.steps.map((step) => ({
          action: step.action,
          integrationType: integrationMap.get(step.integrationId),
        })),
      })),
    }),
    languagePreference: promptingIdentity.languagePreference,
    knowledgeBlocks: parsed.data.draft.knowledgeBlocks,
  });

  return NextResponse.json({ item: response });
}

function coerceHistoryMessages(input: SandboxInvokeInput) {
  if (!Array.isArray((input as SandboxInvokeInput & { history?: unknown[] }).history)) {
    return [];
  }

  return (input as SandboxInvokeInput & {
    history?: Array<{
      role: "USER" | "ASSISTANT" | "TOOL";
      content: string;
      toolName?: string;
      toolResult?: unknown;
      durationMs?: number;
    }>;
  }).history!.map((message) => ({
    role: message.role,
    content: message.content,
    toolName: message.toolName,
    toolResult: message.toolResult,
    durationMs: message.durationMs,
  }));
}
