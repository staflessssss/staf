import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { invokeAgent } from "@/lib/ai-runtime";
import { requireClientApiSession } from "@/lib/client-api-auth";
import { db } from "@/lib/db";

import { sanitizeClientTestChatResponse } from "./redaction";

const clientTestChatSchema = z.object({
  contactId: z.string().trim().min(1).max(120).optional(),
  message: z.string().trim().min(1).max(4_000),
  history: z
    .array(
      z.object({
        role: z.enum(["USER", "ASSISTANT", "TOOL"]),
        content: z.string(),
        toolName: z.string().optional(),
        toolResult: z.unknown().optional(),
        durationMs: z.number().optional(),
        createdAt: z.string().datetime().optional(),
      }),
    )
    .optional(),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ agentId: string }> },
) {
  const session = await requireClientApiSession();

  if (session instanceof NextResponse) {
    return session;
  }

  const { agentId } = await context.params;
  const tenantId = session.user.tenantId;

  if (!tenantId) {
    return NextResponse.json({ error: "Client tenant is missing." }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = clientTestChatSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid client test chat payload." }, { status: 400 });
  }

  const agent = await db.agent.findFirst({
    where: {
      id: agentId,
      tenantId,
      status: "ACTIVE",
    },
    include: {
      channel: {
        select: { type: true },
      },
    },
  });

  if (!agent) {
    return NextResponse.json({ error: "Active agent not found." }, { status: 404 });
  }

  const response = await invokeAgent({
    tenantId,
    agentId: agent.id,
    testMode: true,
    channel: agent.channel.type,
    contactId: parsed.data.contactId ?? "client-test-chat-contact",
    message: parsed.data.message,
    historyMessages: (parsed.data.history ?? []).map((message) => ({
      role: message.role,
      content: message.content,
      toolName: message.toolName,
      toolResult: message.toolResult,
      durationMs: message.durationMs,
      createdAt: message.createdAt ? new Date(message.createdAt) : undefined,
    })),
  });

  return NextResponse.json({ item: sanitizeClientTestChatResponse(response) });
}
