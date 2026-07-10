import type { ChannelType, PrismaClient } from "@prisma/client";

import type { RuntimeToolExecution } from "@/lib/agent-events";

type MonitorDatabase = PrismaClient;

type MonitorConfig = {
  botToken: string;
  chatId: string;
};

function getMonitorConfig(): MonitorConfig | null {
  const botToken = process.env.AGENT_MONITOR_TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.AGENT_MONITOR_TELEGRAM_CHAT_ID?.trim();

  return botToken && chatId ? { botToken, chatId } : null;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function truncate(value: string, limit = 1_600) {
  const trimmed = value.trim();
  return trimmed.length > limit ? `${trimmed.slice(0, limit - 3)}...` : trimmed;
}

function customerLabel(conversation: {
  contactUsername: string | null;
  contactDisplayName: string | null;
  contactId: string;
}) {
  if (conversation.contactUsername) return `@${conversation.contactUsername}`;
  return conversation.contactDisplayName || conversation.contactId;
}

function channelLabel(channel: ChannelType) {
  return channel.charAt(0) + channel.slice(1).toLowerCase();
}

async function sendRichMonitorMessage(args: {
  config: MonitorConfig;
  html: string;
  replyToMessageId?: string;
}) {
  const response = await fetch(
    `https://api.telegram.org/bot${args.config.botToken}/sendRichMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: args.config.chatId,
        rich_message: { html: args.html },
        ...(args.replyToMessageId
          ? { reply_parameters: { message_id: Number(args.replyToMessageId) } }
          : {}),
      }),
    },
  );
  const payload = await response.json().catch(() => null) as {
    ok?: boolean;
    result?: { message_id?: number };
  } | null;

  if (!response.ok || !payload?.ok || !payload.result?.message_id) {
    throw new Error(`agent_monitor_telegram_send_failed:${response.status}`);
  }

  return String(payload.result.message_id);
}

async function loadConversationForMonitor(args: {
  database: MonitorDatabase;
  conversationId: string;
}) {
  return args.database.conversation.findUnique({
    where: { id: args.conversationId },
    select: {
      id: true,
      channel: true,
      contactId: true,
      contactUsername: true,
      contactDisplayName: true,
      agent: {
        select: {
          id: true,
          name: true,
          tenant: { select: { id: true, name: true } },
        },
      },
    },
  });
}

function monitorLink(args: { tenantId: string; agentId: string }) {
  const baseUrl = process.env.APP_BASE_URL?.replace(/\/$/, "");
  return baseUrl
    ? `${baseUrl}/admin/tenants/${args.tenantId}/agents/${args.agentId}`
    : null;
}

export async function notifyAgentMonitorInbound(args: {
  database: MonitorDatabase;
  conversationId: string;
  message: string;
}) {
  const config = getMonitorConfig();
  if (!config) return;

  try {
    const conversation = await loadConversationForMonitor(args);
    if (!conversation) return;

    const link = monitorLink({
      tenantId: conversation.agent.tenant.id,
      agentId: conversation.agent.id,
    });
    const telegramMessageId = await sendRichMonitorMessage({
      config,
      html: [
        "<h3>New customer message</h3>",
        `<p><b>Agent:</b> ${escapeHtml(conversation.agent.name)}<br/><b>Client:</b> ${escapeHtml(conversation.agent.tenant.name)}<br/><b>Channel:</b> ${escapeHtml(channelLabel(conversation.channel))}<br/><b>Customer:</b> ${escapeHtml(customerLabel(conversation))}</p>`,
        `<blockquote>${escapeHtml(truncate(args.message))}</blockquote>`,
        link ? `<footer><a href="${escapeHtml(link)}">Open agent workspace</a></footer>` : "",
      ].filter(Boolean).join("\n"),
    });

    await args.database.agentMonitorThread.upsert({
      where: { conversationId: conversation.id },
      create: {
        conversationId: conversation.id,
        telegramChatId: config.chatId,
        latestInboundMessageId: telegramMessageId,
      },
      update: {
        telegramChatId: config.chatId,
        latestInboundMessageId: telegramMessageId,
      },
    });
  } catch (error) {
    console.warn("[agent-monitor] inbound notification failed", error);
  }
}

function toolSummary(toolExecutions: RuntimeToolExecution[]) {
  const tools = toolExecutions.map((execution) => escapeHtml(execution.toolName)).filter(Boolean);
  return tools.length > 0 ? tools.join(", ") : "No tools";
}

export async function notifyAgentMonitorReply(args: {
  database: MonitorDatabase;
  conversationId: string;
  assistantReply: string;
  toolExecutions?: RuntimeToolExecution[];
  attachmentCount?: number;
}) {
  const config = getMonitorConfig();
  if (!config) return;

  try {
    const thread = await args.database.agentMonitorThread.findUnique({
      where: { conversationId: args.conversationId },
    });
    if (!thread || thread.telegramChatId !== config.chatId) return;

    await sendRichMonitorMessage({
      config,
      replyToMessageId: thread.latestInboundMessageId,
      html: [
        "<h3>Agent reply delivered</h3>",
        `<blockquote>${escapeHtml(truncate(args.assistantReply))}</blockquote>`,
        `<p><b>Tools:</b> ${toolSummary(args.toolExecutions ?? [])}<br/><b>Attachments:</b> ${args.attachmentCount ?? 0}</p>`,
      ].join("\n"),
    });
  } catch (error) {
    console.warn("[agent-monitor] reply notification failed", error);
  }
}

export async function notifyAgentMonitorFailure(args: {
  database: MonitorDatabase;
  conversationId: string;
  error: string;
}) {
  const config = getMonitorConfig();
  if (!config) return;

  try {
    const thread = await args.database.agentMonitorThread.findUnique({
      where: { conversationId: args.conversationId },
    });
    if (!thread || thread.telegramChatId !== config.chatId) return;

    await sendRichMonitorMessage({
      config,
      replyToMessageId: thread.latestInboundMessageId,
      html: [
        "<h3>Delivery failed</h3>",
        `<p><b>Status:</b> Needs attention</p>`,
        `<blockquote>${escapeHtml(truncate(args.error, 600))}</blockquote>`,
      ].join("\n"),
    });
  } catch (monitorError) {
    console.warn("[agent-monitor] failure notification failed", monitorError);
  }
}
