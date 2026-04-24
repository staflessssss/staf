import { ConversationStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { requireClientApiSession } from "@/lib/client-api-auth";
import { db } from "@/lib/db";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ conversationId: string }> },
) {
  const session = await requireClientApiSession();

  if (session instanceof NextResponse) {
    return session;
  }

  const tenantId = session.user.tenantId;
  const { conversationId } = await context.params;

  if (!tenantId) {
    return NextResponse.json({ error: "Client tenant is missing." }, { status: 403 });
  }

  const conversation = await db.conversation.findFirst({
    where: {
      id: conversationId,
      agent: {
        tenantId,
      },
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  if (conversation.status === ConversationStatus.CLOSED) {
    return NextResponse.json(
      { error: "Closed dialogs cannot be reactivated from the client workspace." },
      { status: 400 },
    );
  }

  const updatedConversation =
    conversation.status === ConversationStatus.ACTIVE
      ? conversation
      : await db.conversation.update({
          where: { id: conversation.id },
          data: { status: ConversationStatus.ACTIVE },
          select: {
            id: true,
            status: true,
          },
        });

  return NextResponse.json({ item: updatedConversation });
}
