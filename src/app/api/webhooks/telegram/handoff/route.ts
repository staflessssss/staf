import { NextRequest, NextResponse } from "next/server";
import { ChannelType, ConnectionStatus } from "@prisma/client";

import { answerTelegramCallbackQuery, telegramAdapter } from "@/lib/channels/telegram";
import { decrypt } from "@/lib/crypto";
import { db } from "@/lib/db";
import {
  handleOwnerTelegramCallback,
  handleOwnerTelegramCommand,
  handleOwnerTelegramReply,
  readOwnerHandoffStartToken,
  readOwnerHandoffWebhookSecret,
  updateOwnerHandoffChatMetadata,
} from "@/lib/owner-handoff";

type OwnerTelegramWebhookResponse = Awaited<ReturnType<typeof handleOwnerTelegramCommand>>;

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
  const replyToMessage = messageRecord.reply_to_message;
  const chatId =
    chat && typeof chat === "object" && !Array.isArray(chat)
      ? String((chat as Record<string, unknown>).id ?? "")
      : "";
  const replyToMessageId =
    replyToMessage && typeof replyToMessage === "object" && !Array.isArray(replyToMessage)
      ? String((replyToMessage as Record<string, unknown>).message_id ?? "")
      : "";
  const text =
    typeof messageRecord.text === "string"
      ? messageRecord.text
      : typeof messageRecord.caption === "string"
        ? messageRecord.caption
        : "";

  return {
    chatId,
    replyToMessageId,
    text: text.trim(),
  };
}

function extractTelegramCallback(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const callback = record.callback_query;

  if (!callback || typeof callback !== "object" || Array.isArray(callback)) {
    return null;
  }

  const callbackRecord = callback as Record<string, unknown>;
  const message =
    callbackRecord.message && typeof callbackRecord.message === "object" && !Array.isArray(callbackRecord.message)
      ? (callbackRecord.message as Record<string, unknown>)
      : {};
  const chat =
    message.chat && typeof message.chat === "object" && !Array.isArray(message.chat)
      ? (message.chat as Record<string, unknown>)
      : {};

  return {
    callbackQueryId: String(callbackRecord.id ?? ""),
    chatId: String(chat.id ?? ""),
    data: typeof callbackRecord.data === "string" ? callbackRecord.data : "",
  };
}

async function sendOwnerTelegramResponse(args: {
  credentials: string;
  chatId: string;
  response: OwnerTelegramWebhookResponse | null;
}) {
  if (!args.response) {
    return;
  }

  await telegramAdapter.sendReply({
    credentials: args.credentials,
    contactId: args.chatId,
    message: args.response.message,
    replyMarkup: args.response.replyMarkup,
  });
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
  const credentials = decrypt(channel.credentialsEnc);
  const callback = extractTelegramCallback(payload);

  if (callback?.callbackQueryId) {
    await answerTelegramCallbackQuery({
      credentials,
      callbackQueryId: callback.callbackQueryId,
    });

    if (!callback.chatId || !callback.data) {
      return NextResponse.json({ ok: true, status: "ignored_incomplete_callback" });
    }

    const callbackResponse = await handleOwnerTelegramCallback({
      tenantId,
      ownerChatId: callback.chatId,
      data: callback.data,
    });

    await sendOwnerTelegramResponse({
      credentials,
      chatId: callback.chatId,
      response: callbackResponse,
    });

    return NextResponse.json({ ok: true, status: "owner_callback_processed" });
  }

  const message = extractTelegramMessage(payload);

  if (!message?.chatId) {
    return NextResponse.json({ ok: true, status: "ignored_non_message_update" });
  }

  if (message.text === "/start" || message.text.startsWith("/start ")) {
    const expectedStartToken = readOwnerHandoffStartToken(channel.metadata);
    const receivedStartToken = message.text.split(/\s+/)[1]?.trim() ?? "";

    if (expectedStartToken && receivedStartToken !== expectedStartToken) {
      await telegramAdapter.sendReply({
        credentials,
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
      credentials,
      contactId: message.chatId,
      message: "Behalfy handoff is connected. I will send you agent questions here.",
    });

    return NextResponse.json({ ok: true, status: "owner_chat_linked" });
  }

  if (message.replyToMessageId && message.text && !message.text.startsWith("/")) {
    const replyResponseText = await handleOwnerTelegramReply({
      tenantId,
      ownerChatId: message.chatId,
      replyToMessageId: message.replyToMessageId,
      text: message.text,
    });

    if (replyResponseText) {
      await sendOwnerTelegramResponse({
        credentials,
        chatId: message.chatId,
        response: replyResponseText,
      });

      return NextResponse.json({ ok: true, status: "owner_reply_processed" });
    }

    await telegramAdapter.sendReply({
      credentials,
      contactId: message.chatId,
      message:
        "I could not match this Telegram reply to a Behalfy handoff. Tap Reply on the latest Behalfy handoff message, or use /send <conversationId> <message>.",
    });

    return NextResponse.json({ ok: true, status: "owner_reply_not_matched" });
  }

  const responseText = await handleOwnerTelegramCommand({
    tenantId,
    text: message.text,
  });

  await sendOwnerTelegramResponse({
    credentials,
    chatId: message.chatId,
    response: responseText,
  });

  return NextResponse.json({ ok: true, status: "owner_command_processed" });
}
