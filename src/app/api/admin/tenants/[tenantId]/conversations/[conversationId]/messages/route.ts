import { ConversationStatus, MessageRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getChannelConfigObject, normalizeControlConfig } from "@/lib/agent-config";
import { requireAdminApiSession } from "@/lib/admin-api-auth";
import { db } from "@/lib/db";
import {
  OPERATOR_MESSAGE_TOOL_NAME,
  getLatestCustomerReplyContext,
  isOperatorMessage,
  pauseConversationForOperatorWithDb,
  sendOperatorReplyThroughChannel,
  shouldPauseAfterOperatorMessage,
} from "@/lib/operator-handoff";

const operatorMessageSchema = z.object({
  message: z.string().trim().min(1).max(4000),
});

function getRuntimeControl(channelConfig: unknown) {
  const rawChannelConfig = getChannelConfigObject(channelConfig as never);
  return normalizeControlConfig(
    rawChannelConfig.control &&
      typeof rawChannelConfig.control === "object" &&
      !Array.isArray(rawChannelConfig.control)
      ? (rawChannelConfig.control as never)
      : undefined,
  );
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ tenantId: string; conversationId: string }> },
) {
  const session = await requireAdminApiSession();

  if (session instanceof NextResponse) {
    return session;
  }

  const { tenantId, conversationId } = await context.params;
  const json = await req.json().catch(() => null);
  const parsed = operatorMessageSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid operator message." }, { status: 400 });
  }

  const conversation = await db.conversation.findFirst({
    where: {
      id: conversationId,
      agent: {
        tenantId,
      },
    },
    include: {
      agent: {
        include: {
          channel: true,
        },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          role: true,
          toolName: true,
          content: true,
          toolInput: true,
        },
      },
    },
  });

  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  if (conversation.status === ConversationStatus.CLOSED) {
    return NextResponse.json({ error: "Closed dialogs cannot receive operator replies." }, { status: 400 });
  }

  const control = getRuntimeControl(conversation.agent.channelConfig);
  const replyContext = getLatestCustomerReplyContext(conversation.messages, conversation.contactId);
  const priorOperatorMessageCount = conversation.messages.filter(isOperatorMessage).length;
  const shouldPause = shouldPauseAfterOperatorMessage({
    control,
    message: parsed.data.message,
    priorOperatorMessageCount,
  });

  const operatorMessage = await db.message.create({
    data: {
      conversationId: conversation.id,
      role: MessageRole.TOOL,
      toolName: OPERATOR_MESSAGE_TOOL_NAME,
      content: parsed.data.message,
      model: "operator",
      toolInput: {
        deliveryStatus: "pending",
        replyContext,
      },
    },
    select: {
      id: true,
      content: true,
      createdAt: true,
    },
  });

  if (shouldPause) {
    await pauseConversationForOperatorWithDb({
      database: db,
      conversationId: conversation.id,
      agentId: conversation.agentId,
      control,
      replyContext,
    });
  } else {
    await db.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });
  }

  try {
    await sendOperatorReplyThroughChannel({
      channel: conversation.agent.channel,
      contactId: replyContext.contactId,
      message: parsed.data.message,
      channelConfig: conversation.agent.channelConfig,
      messageId: replyContext.messageId,
      threadId: replyContext.threadId,
      subject: replyContext.subject,
    });
  } catch (error) {
    await db.message.update({
      where: { id: operatorMessage.id },
      data: {
        toolInput: {
          deliveryStatus: "failed",
          error: error instanceof Error ? error.message : "Operator message delivery failed.",
          replyContext,
        },
      },
    });

    return NextResponse.json(
      { error: "Operator message delivery failed." },
      { status: 502 },
    );
  }

  try {
    await db.message.update({
      where: { id: operatorMessage.id },
      data: {
        toolInput: {
          deliveryStatus: "sent",
          replyContext,
        },
      },
    });
  } catch {
    return NextResponse.json(
      {
        item: {
          id: operatorMessage.id,
          content: operatorMessage.content,
          createdAt: operatorMessage.createdAt,
          status: shouldPause ? ConversationStatus.ESCALATED : conversation.status,
          deliveryStatus: "sent_state_sync_failed",
        },
      },
      { status: 202 },
    );
  }

  return NextResponse.json({
    item: {
      id: operatorMessage.id,
      content: operatorMessage.content,
      createdAt: operatorMessage.createdAt,
      status: shouldPause ? ConversationStatus.ESCALATED : conversation.status,
    },
  });
}
