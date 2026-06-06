import { NextRequest, NextResponse } from "next/server";
import { ChannelType, ConnectionStatus } from "@prisma/client";

import { telegramAdapter } from "@/lib/channels/telegram";
import { decrypt } from "@/lib/crypto";
import { db } from "@/lib/db";
import {
  handleOwnerTelegramCommand,
  readOwnerHandoffStartToken,
  readOwnerHandoffWebhookSecret,
  updateOwnerHandoffChatMetadata,
} from "@/lib/owner-handoff";

function extractTelegramMessage(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const message = record.message ?? record.edited_message;

  if (!message || typeof message !== "object" || Array.isArray(message)) {
    return null;
  }

  const messageRecord = message as Record<string, unknown>;
  const chat = messageRecord.chat;
  const chatId =
    chat && typeof chat === "object" && !Array.isArray(chat)
      ? String((chat as Record<string, unknown>).id ?? "")
      : "";
  const text =
    typeof messageRecord.text === "string"
      ? messageRecord.text
      : typeof messageRecord.caption === "string"
        ? messageRecord.caption
        : "";

  return {
    chatId,
    text: text.trim(),
  };
}

export async function POST(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get("tenantId")?.trim() ?? "";

  if (!tenantId) {
    return NextResponse.json({ error: "Missing tenantId." }, { status: 400 });
  }

  const channel = await db.channelConnection.findUnique({
    where: {
      tenantId_type: {
        tenantId,
        type: ChannelType.TELEGRAM,
      },
    },
  });

  if (!channel || channel.status !== ConnectionStatus.CONNECTED) {
    return NextResponse.json({ error: "Telegram handoff is not connected." }, { status: 404 });
  }

  const expectedSecret = readOwnerHandoffWebhookSecret(channel.metadata);
  const receivedSecret = req.headers.get("x-telegram-bot-api-secret-token")?.trim() ?? "";
  const isLocalDev = req.nextUrl.hostname === "localhost" || req.nextUrl.hostname === "127.0.0.1";

  if (!isLocalDev && (!expectedSecret || receivedSecret !== expectedSecret)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = await req.json().catch(() => null);
  const message = extractTelegramMessage(payload);

  if (!message?.chatId) {
    return NextResponse.json({ ok: true, status: "ignored_non_message_update" });
  }

  if (message.text === "/start" || message.text.startsWith("/start ")) {
    const expectedStartToken = readOwnerHandoffStartToken(channel.metadata);
    const receivedStartToken = message.text.split(/\s+/)[1]?.trim() ?? "";

    if (expectedStartToken && receivedStartToken !== expectedStartToken) {
      await telegramAdapter.sendReply({
        credentials: decrypt(channel.credentialsEnc),
        contactId: message.chatId,
        message: "Use the exact /start command shown in Behalfy to link this handoff chat.",
      });

      return NextResponse.json({ ok: true, status: "invalid_owner_start_token" });
    }

    await db.channelConnection.update({
      where: { id: channel.id },
      data: {
        metadata: updateOwnerHandoffChatMetadata({
          metadata: channel.metadata,
          ownerChatId: message.chatId,
        }),
      },
    });

    await telegramAdapter.sendReply({
      credentials: decrypt(channel.credentialsEnc),
      contactId: message.chatId,
      message: "Behalfy handoff is connected. I will send you agent questions here.",
    });

    return NextResponse.json({ ok: true, status: "owner_chat_linked" });
  }

  const responseText = await handleOwnerTelegramCommand({
    tenantId,
    text: message.text,
  });

  await telegramAdapter.sendReply({
    credentials: decrypt(channel.credentialsEnc),
    contactId: message.chatId,
    message: responseText,
  });

  return NextResponse.json({ ok: true, status: "owner_command_processed" });
}
