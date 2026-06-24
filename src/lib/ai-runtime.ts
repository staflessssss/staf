import { openai } from "@ai-sdk/openai";
import {
  AgentStatus,
  ChannelType,
  ConversationStatus,
  DelayedDeliveryKind,
  FeatureType,
  MessageRole,
} from "@prisma/client";
import { generateText, stepCountIs } from "ai";

import {
  agentConfigInclude,
  AgentSettingsConfig,
  AgentWithConfigData,
  ControlConfig,
  hydrateFunctionBlocksForRuntime,
  FunctionBlockConfig,
  getDefaultControlConfig,
  getDefaultAgentSettingsConfig,
  getChannelConfigObject,
  normalizeAgentSettings,
  normalizeControlConfig,
  normalizeFunctionBlocks,
  normalizePromptingConfig,
  PromptingConfig,
} from "@/lib/agent-config";
import { loadConversationHistory, saveMessages } from "@/lib/agent-memory";
import { getChannelAdapter } from "@/lib/channels";
import { parseInstagramCredentials } from "@/lib/channels/instagram";
import { decrypt } from "@/lib/crypto";
import { db } from "@/lib/db";
import { selectWeddingSalesGuide } from "@/lib/lang/graphs/wedding-sales/config";
import { buildWeddingSalesConfigFromChannelConfig } from "@/lib/lang/graphs/wedding-sales/config-from-agent";
import { invokeWeddingSalesGraph } from "@/lib/lang/graphs/wedding-sales/graph";
import type { WeddingSalesState } from "@/lib/lang/graphs/wedding-sales/state";
import { createWeddingSalesToolContextFromFeatures } from "@/lib/lang/graphs/wedding-sales/tools";
import { traceLangRuntime } from "@/lib/lang/langsmith";
import { buildSystemPrompt } from "@/lib/prompt-composer";
import { resolveTools } from "@/lib/tools";
import { readMessageBehaviorConfig } from "@/lib/channels/message-behavior";
import { findNextAgentScheduleWindowStart, isWithinAgentSchedule } from "@/lib/agent-schedule";
import {
  cancelPendingDelayedDeliveriesWithDb,
  scheduleBufferedReplyWithDb,
  scheduleFollowUpsForReplyWithDb,
} from "@/lib/message-delivery-runtime";
import {
  BUSINESS_MANUAL_MESSAGE_TOOL_NAME,
  getLatestCustomerReplyContext,
  isBusinessManualMessage,
  pauseConversationForBusinessHandoffWithDb,
  shouldPauseAfterBusinessManualMessage,
} from "@/lib/business-handoff";
import { recordInstagramOutboundDeliveries } from "@/lib/instagram-outbound";
import {
  OWNER_HANDOFF_REQUEST_TOOL_NAME,
  hasConnectedOwnerTelegram,
  requestOwnerHandoffWithDb,
  shouldRequestOwnerHandoff,
} from "@/lib/owner-handoff";
import { invokeWeddingSalesSimpleAdapter } from "@/lib/agents/wedding-sales-simple/invoke";
import type {
  NormalizedWeddingSalesIncomingMessage,
  WeddingSalesSimpleSafetyLogEntry,
} from "@/lib/agents/wedding-sales-simple/contracts";
import type { SimpleWeddingSalesState } from "@/lib/lang/graphs/wedding-sales-simple/state";

type LightweightKnowledgeBlock = {
  name: string;
  description: string;
  knowledgeContent?: string | null;
};

type RuntimeBlocks = {
  promptPreview: string;
  knowledgeBlocks: LightweightKnowledgeBlock[];
  toolFeatures: Awaited<ReturnType<typeof hydrateFunctionBlocksForRuntime>>;
  agentSettings: AgentSettingsConfig;
  prompting: PromptingConfig;
  control: ControlConfig;
};

type InvokeAgentInput = {
  tenantId: string;
  agentId?: string;
  allowDraftAgent?: boolean;
  testMode?: boolean;
  skipInboundPersistence?: boolean;
  conversationId?: string;
  channel: ChannelType | string;
  contactId: string;
  message: string;
  messageId?: string;
  gmailMessageId?: string;
  threadId?: string;
  subject?: string;
  contactEmail?: string;
  promptPreview?: string;
  languagePreference?: string | null;
  knowledgeBlocks?: LightweightKnowledgeBlock[];
  functionBlocks?: FunctionBlockConfig[];
  historyMessages?: RuntimeHistoryMessage[];
  runtimeEvent?: {
    type: "follow_up";
    guidance?: string;
  };
};

type RuntimeAttachment = {
  source?: "google_drive";
  fileId: string;
  fileName?: string;
  mimeType?: string;
  publicUrl?: string;
};

function buildPublicGoogleDriveDownloadUrl(fileId?: string) {
  const trimmed = fileId?.trim();

  if (!trimmed) {
    return undefined;
  }

  return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(trimmed)}`;
}

function getWeddingSalesGuideAttachment(args: {
  channel: ChannelType | string;
  message: string;
  config: ReturnType<typeof buildWeddingSalesConfigFromChannelConfig>;
  allowAttachments: boolean;
  state?: Pick<WeddingSalesState, "location" | "venue" | "availabilityRegion">;
}) {
  if (
    (!args.allowAttachments && args.channel !== ChannelType.INSTAGRAM) ||
    !/\bguide\b/i.test(args.message)
  ) {
    return [];
  }

  const guide = selectWeddingSalesGuide(args.config, args.state);
  const publicUrl = guide.imageUrl ?? buildPublicGoogleDriveDownloadUrl(guide.fileId);

  if (!guide.fileId && !publicUrl) {
    return [];
  }

  return [
    {
      source: "google_drive",
      fileId: guide.fileId ?? publicUrl ?? "collections-guide",
      fileName: guide.fileName,
      mimeType: "image/png",
      publicUrl,
    },
  ] satisfies RuntimeAttachment[];
}

type ParsedIncomingMessage = {
  contactId: string;
  contactUsername?: string;
  contactDisplayName?: string;
  contactEmail?: string;
  message: string;
  messageId?: string;
  gmailMessageId?: string;
  threadId?: string;
  subject?: string;
  eventTimestamp?: Date;
  isBusinessManualReply?: boolean;
  businessReplyKind?: "manual" | "system_echo";
};

type RuntimeChannelAdapter = {
  parseIncoming: (payload: unknown) => ParsedIncomingMessage;
  formatReply: (text: string, config?: unknown) => unknown;
  sendReply: (params: {
    credentials: string;
    contactId: string;
    message: string | string[] | { text: string; html?: string };
    messageId?: string;
    threadId?: string;
    subject?: string;
    attachments?: RuntimeAttachment[];
    channelConfig?: unknown;
  }) => Promise<unknown>;
};

function normalizeOptionalText(value?: string) {
  const normalized = value?.trim();
  return normalized || undefined;
}

function buildContactProfileUpdate(args: {
  contactUsername?: string;
  contactDisplayName?: string;
}) {
  const contactUsername = normalizeOptionalText(args.contactUsername);
  const contactDisplayName = normalizeOptionalText(args.contactDisplayName);

  return {
    ...(contactUsername ? { contactUsername } : {}),
    ...(contactDisplayName ? { contactDisplayName } : {}),
  };
}

type GmailClientClassification =
  | {
      kind: "client";
      reason: string;
    }
  | {
      kind: "other";
      reason: string;
    };

type HandleIncomingEventDeps = {
  db: typeof db;
  getChannelAdapter: typeof getChannelAdapter;
  invokeAgent: typeof invokeAgent;
  decrypt: typeof decrypt;
  sleep: (ms: number) => Promise<void>;
  inspectInstagramConversationHistory?: (args: {
    agent: IncomingEventAgent;
    contactId: string;
    messageId?: string;
  }) => Promise<InstagramConversationPreflightResult>;
};

type IncomingEventAgent = Pick<AgentWithConfigData, "id" | "tenantId" | "channelConfig" | "channel">;

type InstagramConversationPreflightResult =
  | {
      status: "prior_history_found";
      conversationId?: string;
      priorMessageCount: number;
    }
  | {
      status: "no_prior_history" | "not_checked" | "error";
      error?: string;
    };

type LangGraphToolObservation = {
  toolName: string;
  result: string;
};

const WEDDING_SALES_TEST_STATE_TOOL_NAME = "__wedding_sales_state";
const WEDDING_SALES_SIMPLE_STATE_TOOL_NAME = "__wedding_sales_simple_state";
const WEDDING_SALES_SIMPLE_SAFETY_LOG_TOOL_NAME = "__wedding_sales_simple_safety_log";

function getWeddingSalesOwnerHandoffReason(state: WeddingSalesState) {
  return (
    state.lastActionPlan?.actions.find(
      (action) => action.type === "recommend_owner_handoff",
    )?.reason ?? null
  );
}

export type InvokeAgentResult = {
  message: string;
  promptPreview: string;
  usedTooling: string[];
  conversationId?: string;
  model?: string;
  attachments?: RuntimeAttachment[];
  historyAppend?: RuntimeHistoryMessage[];
  suppressReply?: boolean;
};

export type RuntimeHistoryMessage = {
  role: MessageRole;
  content: string;
  toolName?: string | null;
  toolResult?: unknown;
  durationMs?: number;
  createdAt?: Date;
  model?: string | null;
};

const ALLOWED_EMOJIS = ["🤍", "✨", "🎥"] as const;
const FALSE_CONFIRMATION_PATTERNS = [
  /\b(?:you(?:'re| are)\s+all\s+set|all\s+set for)\b/i,
  /\b(?:booked|booking is confirmed|confirmed)\b/i,
  /\blet'?s consider it set\b/i,
  /\binvite (?:is|will be) (?:on the way|coming|sent)\b/i,
] as const;

function parseLangGraphToolResult(result: string) {
  try {
    return JSON.parse(result);
  } catch {
    return { raw: result };
  }
}

function summarizeLangGraphToolResult(toolName: string, result: string) {
  const parsed = parseLangGraphToolResult(result);

  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const objectValue = parsed as Record<string, unknown>;
    const summary = typeof objectValue.summary === "string" ? objectValue.summary : null;
    const status = typeof objectValue.status === "string" ? objectValue.status : null;

    if (summary) {
      return summary;
    }

    if (status) {
      return `${toolName}: ${status}`;
    }
  }

  return `${toolName} completed`;
}

async function recordLangGraphToolObservationsWithDb(args: {
  database: typeof db;
  conversationId: string;
  observations: LangGraphToolObservation[];
}) {
  for (const observation of args.observations) {
    await args.database.message.create({
      data: {
        conversationId: args.conversationId,
        role: MessageRole.TOOL,
        content: summarizeLangGraphToolResult(observation.toolName, observation.result),
        toolName: observation.toolName,
        toolResult: parseLangGraphToolResult(observation.result),
        model: "langgraph_wedding_sales",
      },
    });
  }
}

function parseSimpleWeddingSalesState(value: unknown): Partial<SimpleWeddingSalesState> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const maybeState = value as { state?: unknown };
  const state = maybeState.state ?? value;

  return state && typeof state === "object" && !Array.isArray(state)
    ? (state as Partial<SimpleWeddingSalesState>)
    : undefined;
}

async function loadWeddingSalesSimpleStateWithDb(args: {
  database: typeof db;
  conversationId: string;
}) {
  const stateMessage = await args.database.message.findFirst({
    where: {
      conversationId: args.conversationId,
      role: MessageRole.TOOL,
      toolName: WEDDING_SALES_SIMPLE_STATE_TOOL_NAME,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return parseSimpleWeddingSalesState(stateMessage?.toolResult);
}

async function saveWeddingSalesSimpleStateWithDb(args: {
  database: typeof db;
  conversationId: string;
  state: SimpleWeddingSalesState;
}) {
  await args.database.message.create({
    data: {
      conversationId: args.conversationId,
      role: MessageRole.TOOL,
      toolName: WEDDING_SALES_SIMPLE_STATE_TOOL_NAME,
      content: `wedding-sales-simple state: ${args.state.mode}`,
      toolResult: { state: args.state },
      model: "wedding_sales_simple",
    },
  });

  if (args.state.mode === "bot_paused") {
    await args.database.conversation.update({
      where: { id: args.conversationId },
      data: { status: ConversationStatus.ESCALATED },
    });
  }
}

async function recordWeddingSalesSimpleSafetyLogWithDb(args: {
  database: typeof db;
  conversationId: string;
  entry: WeddingSalesSimpleSafetyLogEntry;
}) {
  await args.database.message.create({
    data: {
      conversationId: args.conversationId,
      role: MessageRole.TOOL,
      toolName: WEDDING_SALES_SIMPLE_SAFETY_LOG_TOOL_NAME,
      content: `wedding-sales-simple: ${args.entry.decisionTrace?.replyType ?? "unknown"}`,
      toolResult: args.entry,
      model: "wedding_sales_simple",
    },
  });
}

async function hasProcessedWeddingSalesSimpleIncomingWithDb(args: {
  database: typeof db;
  agentId: string;
  contactId: string;
  messageId?: string;
}) {
  const messageId = args.messageId?.trim();

  if (!messageId) {
    return false;
  }

  const existing = await args.database.message.findFirst({
    where: {
      role: MessageRole.USER,
      conversation: {
        agentId: args.agentId,
        contactId: args.contactId,
      },
      toolInput: {
        path: ["messageId"],
        equals: messageId,
      },
    },
    select: {
      id: true,
    },
  });

  return Boolean(existing);
}

function splitSignature(text: string) {
  const signatureStart = text.search(/\n{2,}[A-Z][A-Za-z .'-]+\nFounder & Creative Director/i);
  if (signatureStart === -1) {
    return { body: text.trim(), signature: "" };
  }

  return {
    body: text.slice(0, signatureStart).trim(),
    signature: text.slice(signatureStart).trim(),
  };
}

function sanitizeAllowedEmojis(text: string) {
  let sanitized = text;
  const placeholders = new Map<string, string>();

  for (const [index, emoji] of ALLOWED_EMOJIS.entries()) {
    const placeholder = `__ALLOWED_EMOJI_${index}__`;
    placeholders.set(placeholder, emoji);
    sanitized = sanitized.split(emoji).join(placeholder);
  }

  sanitized = sanitized.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, "");

  for (const [placeholder, emoji] of placeholders) {
    sanitized = sanitized.split(placeholder).join(emoji);
  }

  return sanitized;
}

function getStepResults(toolResult: unknown) {
  if (!toolResult || typeof toolResult !== "object" || Array.isArray(toolResult)) {
    return [];
  }

  const steps = "steps" in toolResult ? toolResult.steps : undefined;
  if (!Array.isArray(steps)) {
    return [];
  }

  return steps
    .map((step) => {
      if (!step || typeof step !== "object" || !("result" in step)) {
        return null;
      }

      const result = step.result;
      return result && typeof result === "object" && !Array.isArray(result) ? result : null;
    })
    .filter((result): result is Record<string, unknown> => Boolean(result));
}

function hasSuccessfulBookingToolTurn(
  toolExecutions: Array<{
    toolName: string;
    toolResult: unknown;
  }>,
) {
  return toolExecutions.some((execution) => {
    if (!/book/i.test(execution.toolName)) {
      return false;
    }

    return getStepResults(execution.toolResult).some((result) => result.status === "booked");
  });
}

function hasAvailableCalendarCheckTurn(
  toolExecutions: Array<{
    toolName: string;
    toolResult: unknown;
  }>,
) {
  return toolExecutions.some((execution) => {
    if (!/calendar/i.test(execution.toolName)) {
      return false;
    }

    return getStepResults(execution.toolResult).some((result) => result.status === "available");
  });
}

function hasUnavailableWeddingAvailabilityTurn(
  toolExecutions: Array<{
    toolName: string;
    toolResult: unknown;
  }>,
) {
  return toolExecutions.some((execution) => {
    if (!/(wedding|availability)/i.test(execution.toolName)) {
      return false;
    }

    return getStepResults(execution.toolResult).some((result) => result.status === "unavailable");
  });
}

function hasSimulatedBookingToolTurn(
  toolExecutions: Array<{
    toolName: string;
    toolResult: unknown;
  }>,
) {
  return toolExecutions.some((execution) => {
    if (!/book/i.test(execution.toolName)) {
      return false;
    }

    return getStepResults(execution.toolResult).some(
      (result) => result.status === "booked" && result.mode === "test",
    );
  });
}

function softenFalseBookingConfirmation(args: {
  text: string;
  toolExecutions: Array<{
    toolName: string;
    toolResult: unknown;
  }>;
}) {
  if (hasSuccessfulBookingToolTurn(args.toolExecutions)) {
    return args.text;
  }

  if (hasUnavailableWeddingAvailabilityTurn(args.toolExecutions)) {
    return args.text;
  }

  if (!FALSE_CONFIRMATION_PATTERNS.some((pattern) => pattern.test(args.text))) {
    return args.text;
  }

  const { signature } = splitSignature(args.text);
  const guardedBody = [
    hasAvailableCalendarCheckTurn(args.toolExecutions)
      ? "That time looks available on my end, but I do not want to call it confirmed until the calendar invite is actually locked in."
      : "I do not want to call that booked or confirmed until the booking action has actually succeeded on this turn.",
    "If you'd like, I can finalize it properly as soon as the booking step completes successfully.",
  ].join("\n\n");

  return [guardedBody, signature].filter(Boolean).join("\n\n").trim();
}

function convertSimulatedBookingLanguage(args: {
  text: string;
  toolExecutions: Array<{
    toolName: string;
    toolResult: unknown;
  }>;
}) {
  if (!hasSimulatedBookingToolTurn(args.toolExecutions)) {
    return args.text;
  }

  const { signature } = splitSignature(args.text);
  const simulatedBody = [
    "In test mode, this slot looks bookable and the scheduling flow completed successfully.",
    "No real invite was sent and no live calendar event was created from this test run.",
  ].join("\n\n");

  return [simulatedBody, signature].filter(Boolean).join("\n\n").trim();
}

function getRuntimeControlConfig(channelConfig: unknown): ControlConfig {
  if (!channelConfig || typeof channelConfig !== "object" || Array.isArray(channelConfig)) {
    return getDefaultControlConfig();
  }

  const rawChannelConfig = getChannelConfigObject(channelConfig as never);

  return normalizeControlConfig(
    rawChannelConfig.control &&
      typeof rawChannelConfig.control === "object" &&
      !Array.isArray(rawChannelConfig.control)
      ? (rawChannelConfig.control as Partial<ControlConfig>)
      : getDefaultControlConfig(),
  );
}

function getRuntimeAgentSettingsConfig(channelConfig: unknown): AgentSettingsConfig {
  if (!channelConfig || typeof channelConfig !== "object" || Array.isArray(channelConfig)) {
    return getDefaultAgentSettingsConfig();
  }

  const rawChannelConfig = getChannelConfigObject(channelConfig as never);

  return normalizeAgentSettings(
    rawChannelConfig.agentSettings &&
      typeof rawChannelConfig.agentSettings === "object" &&
      !Array.isArray(rawChannelConfig.agentSettings)
      ? (rawChannelConfig.agentSettings as Partial<AgentSettingsConfig>)
      : getDefaultAgentSettingsConfig(),
  );
}

function getRuntimePromptingConfig(channelConfig: unknown): PromptingConfig {
  if (!channelConfig || typeof channelConfig !== "object" || Array.isArray(channelConfig)) {
    return normalizePromptingConfig();
  }

  const rawChannelConfig = getChannelConfigObject(channelConfig as never);

  return normalizePromptingConfig(
    rawChannelConfig.prompting &&
      typeof rawChannelConfig.prompting === "object" &&
      !Array.isArray(rawChannelConfig.prompting)
      ? (rawChannelConfig.prompting as Partial<PromptingConfig>)
      : undefined,
  );
}

function getInboundConversationPolicy(args: {
  agentSettings: AgentSettingsConfig;
  existingConversationStatus?: ConversationStatus | null;
  now?: Date;
}) {
  if (args.existingConversationStatus === ConversationStatus.CLOSED) {
    return "closed_conversation" as const;
  }

  if (args.existingConversationStatus === ConversationStatus.ESCALATED) {
    return "waiting_for_manual_dialog_activation" as const;
  }

  if (!args.agentSettings.defaultChatEnabled) {
    if (!args.existingConversationStatus) {
      return "waiting_for_manual_dialog_activation" as const;
    }
  }

  if (!isWithinAgentSchedule(args.agentSettings, args.now)) {
    return "waiting_for_schedule_window" as const;
  }

  return "auto_reply" as const;
}

type InstagramConversationListItem = {
    id?: string;
    participants?: {
      data?: Array<{
        id?: string;
        username?: string;
      }>;
    };
};

type InstagramConversationListPayload = {
  data?: InstagramConversationListItem[];
  paging?: {
    next?: string;
  };
};

type InstagramConversationDetailPayload = {
  messages?: {
    data?: Array<{
      id?: string;
      from?: {
        id?: string;
        username?: string;
      };
      created_time?: string;
    }>;
  };
};

async function fetchInstagramGraphJson<T>(url: URL, token: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const payload = (await response.json().catch(() => null)) as T | null;

  if (!response.ok || !payload) {
    throw new Error(`Instagram Graph API request failed with ${response.status}.`);
  }

  return payload;
}

async function inspectInstagramConversationHistory(args: {
  agent: IncomingEventAgent;
  contactId: string;
  messageId?: string;
}): Promise<InstagramConversationPreflightResult> {
  if (!args.contactId.trim()) {
    return { status: "not_checked" };
  }

  try {
    const credentials = parseInstagramCredentials(decrypt(args.agent.channel.credentialsEnc));

    if (!credentials.pageAccessToken) {
      return { status: "not_checked" };
    }

    const graphApiVersion = credentials.graphApiVersion || "v25.0";
    const conversationsUrl = new URL(
      `https://graph.instagram.com/${graphApiVersion}/me/conversations`,
    );

    conversationsUrl.searchParams.set("platform", "instagram");
    conversationsUrl.searchParams.set("fields", "id,participants");
    conversationsUrl.searchParams.set("limit", "50");

    let conversation: InstagramConversationListItem | undefined;
    let nextConversationsUrl: URL | null = conversationsUrl;
    let pageCount = 0;
    const maxPages = 5;

    while (nextConversationsUrl && pageCount < maxPages) {
      pageCount += 1;

      const conversations: InstagramConversationListPayload =
        await fetchInstagramGraphJson<InstagramConversationListPayload>(
          nextConversationsUrl,
          credentials.pageAccessToken,
        );

      conversation = conversations.data?.find((item) =>
        item.participants?.data?.some((participant) => participant.id === args.contactId),
      );

      if (conversation) {
        break;
      }

      nextConversationsUrl = conversations.paging?.next
        ? new URL(conversations.paging.next)
        : null;
    }

    if (!conversation && nextConversationsUrl) {
      console.warn("[instagram-preflight] conversation search page limit reached", {
        agentId: args.agent.id,
        tenantId: args.agent.tenantId,
        contactId: args.contactId,
        pagesChecked: pageCount,
      });
    }

    if (!conversation?.id) {
      return { status: "no_prior_history" };
    }

    const conversationUrl = new URL(
      `https://graph.instagram.com/${graphApiVersion}/${encodeURIComponent(conversation.id)}`,
    );

    conversationUrl.searchParams.set(
      "fields",
      "messages.limit(25){id,from,created_time}",
    );

    const detail = await fetchInstagramGraphJson<InstagramConversationDetailPayload>(
      conversationUrl,
      credentials.pageAccessToken,
    );
    const currentMessageId = args.messageId?.trim() ?? "";
    const priorMessages = (detail.messages?.data ?? []).filter((message) => {
      const messageId = message.id?.trim() ?? "";

      return Boolean(messageId && messageId !== currentMessageId);
    });

    if (priorMessages.length > 0) {
      return {
        status: "prior_history_found",
        conversationId: conversation.id,
        priorMessageCount: priorMessages.length,
      };
    }

    return { status: "no_prior_history" };
  } catch (error) {
    console.warn("[instagram-preflight] history check failed", {
      agentId: args.agent.id,
      tenantId: args.agent.tenantId,
      contactId: args.contactId,
      error: error instanceof Error ? error.message : "Instagram preflight failed.",
    });

    return {
      status: "error",
      error: error instanceof Error ? error.message : "Instagram preflight failed.",
    };
  }
}

function applyControlToHistory(args: {
  historyMessages: RuntimeHistoryMessage[];
  control: ControlConfig;
}) {
  let messages = [...args.historyMessages];

  if (
    args.control.historyWindowType === "time_window" ||
    args.control.historyWindowType === "hybrid"
  ) {
    const cutoff = Date.now() - args.control.maxDays * 24 * 60 * 60 * 1000;
    messages = messages.filter(
      (message) => !message.createdAt || message.createdAt.getTime() >= cutoff,
    );
  }

  if (
    args.control.historyWindowType === "message_count" ||
    args.control.historyWindowType === "hybrid"
  ) {
    messages = messages.slice(-args.control.maxMessages);
  }

  return messages;
}

function buildControlRuntimeRules(control: ControlConfig) {
  const lines: string[] = [];

  if (control.historyWindowType === "message_count" || control.historyWindowType === "hybrid") {
    lines.push(`Reason over only the latest ${control.maxMessages} conversation messages.`);
  }

  if (control.historyWindowType === "time_window" || control.historyWindowType === "hybrid") {
    lines.push(`Ignore conversation context older than ${control.maxDays} days unless the user restates it now.`);
  }

  if (control.antiSpamEnabled) {
    lines.push(
      `If the customer sends repeated bursts of messages, avoid escalating tone and keep the reply calm, brief, and reassuring.`,
    );
  }

  if (lines.length === 0) {
    return "";
  }

  return `Control policy:
- ${lines.join("\n- ")}`;
}

function buildRuntimeContextLines(args: {
  prompting: PromptingConfig;
  input: Pick<InvokeAgentInput, "channel" | "contactId" | "contactEmail">;
}) {
  const lines: string[] = [];

  if (args.prompting.showContactIdentity) {
    const knownEmail =
      args.input.contactEmail ??
      (args.input.contactId.includes("@") ? args.input.contactId : null);

    if (knownEmail) {
      lines.push(
        `Known customer email: ${knownEmail}. Use it for booking invites and lead logging; do not ask the customer to repeat it unless they request a different address.`,
      );
    }
  }

  if (args.prompting.showChannelContext) {
    lines.push(`Current channel: ${String(args.input.channel).toLowerCase()}.`);
  }

  return lines.join("\n");
}

type AntiSpamIntercept =
  | {
      kind: "reply";
      message: string;
    }
  | {
      kind: "silent";
    };

function getAntiSpamIntercept(args: {
  historyMessages: RuntimeHistoryMessage[];
  control: ControlConfig;
}): AntiSpamIntercept | null {
  if (!args.control.antiSpamEnabled) {
    return null;
  }

  const now = Date.now();
  const cutoff = now - args.control.antiSpamWindowSeconds * 1000;
  const recentUserMessages = args.historyMessages.filter(
    (message) =>
      message.role === MessageRole.USER &&
      message.createdAt instanceof Date &&
      message.createdAt.getTime() >= cutoff,
  );
  const currentBurstCount = recentUserMessages.length + 1;
  if (currentBurstCount < args.control.antiSpamMessageCount) {
    return null;
  }

  const recentAntiSpamAcknowledgement = args.historyMessages.some(
    (message) =>
      message.role === MessageRole.ASSISTANT &&
      message.model === "control-anti-spam" &&
      message.createdAt instanceof Date &&
      message.createdAt.getTime() >= cutoff,
  );

  if (recentAntiSpamAcknowledgement) {
    return { kind: "silent" };
  }

  const autoReply = args.control.antiSpamAutoReply?.trim();
  if (!autoReply) {
    return { kind: "silent" };
  }

  return {
    kind: "reply",
    message: autoReply,
  };
}

function finalizeAssistantText(args: {
  text: string;
  currentMessage?: string;
  toolExecutions: Array<{
    toolName: string;
    toolResult: unknown;
  }>;
}) {
  const noRogueEmoji = sanitizeAllowedEmojis(args.text);
  const guardedText = softenFalseBookingConfirmation({
    text: noRogueEmoji,
    toolExecutions: args.toolExecutions,
  });
  const simulatedText = convertSimulatedBookingLanguage({
    text: guardedText,
    toolExecutions: args.toolExecutions,
  });

  return rewriteIncompleteWeddingDateReply({
    text: simulatedText,
    currentMessage: args.currentMessage,
  });
}

function buildFallbackResponse(args: {
  input: InvokeAgentInput;
  usedTools: string[];
}) {
  const knowledgeHighlights = (args.input.knowledgeBlocks ?? [])
    .slice(0, 2)
    .map((block) => block.name)
    .filter(Boolean);
  const opening =
    "I will stay multilingual-first and match the customer's language while keeping the business voice consistent.";
  const toolSummary =
    args.usedTools.length > 0
      ? `I used the configured tools: ${args.usedTools.join(", ")}.`
      : "No runtime tool needed to answer this message.";

  return [
    opening,
    `This response is using the ${String(args.input.channel).toLowerCase()} shared runtime configuration for tenant ${args.input.tenantId}.`,
    knowledgeHighlights.length > 0
      ? `I am grounding the reply in these knowledge areas: ${knowledgeHighlights.join(", ")}.`
      : "",
    toolSummary,
    `Customer message received: "${args.input.message}".`,
  ]
    .filter(Boolean)
    .join(" ");
}

function renderHistory(messages: RuntimeHistoryMessage[]) {
  if (messages.length === 0) {
    return "No prior conversation history.";
  }

  return messages
    .slice(-12)
    .map((message) => {
      if (isBusinessManualMessage(message)) {
        return `business: ${message.content}`;
      }

      if (message.role === MessageRole.TOOL) {
        return `tool ${message.toolName ?? "tool"}: ${message.content}`;
      }

      return `${message.role.toLowerCase()}: ${message.content}`;
    })
      .join("\n");
}

function isGmailClientClassifierEnabled(channelConfig: unknown) {
  const rawChannelConfig = getChannelConfigObject(channelConfig as never);
  const classifier =
    rawChannelConfig.gmailClientClassifier &&
    typeof rawChannelConfig.gmailClientClassifier === "object" &&
    !Array.isArray(rawChannelConfig.gmailClientClassifier)
      ? (rawChannelConfig.gmailClientClassifier as Record<string, unknown>)
      : null;

  return classifier?.enabled === true;
}

function getRuntimeType(channelConfig: unknown) {
  const rawChannelConfig = getChannelConfigObject(channelConfig as never);

  if (rawChannelConfig.runtimeType === "langgraph_wedding_sales") {
    return "langgraph_wedding_sales";
  }

  if (rawChannelConfig.runtimeType === "wedding_sales_simple") {
    return "wedding_sales_simple";
  }

  return "legacy";
}

function shouldUseWeddingSalesRuntime(args: {
  channel: ChannelType;
  runtimeType: ReturnType<typeof getRuntimeType>;
}) {
  return (
    (args.channel === ChannelType.GMAIL || args.channel === ChannelType.INSTAGRAM) &&
    args.runtimeType === "langgraph_wedding_sales"
  );
}

function shouldUseWeddingSalesSimpleRuntime(args: {
  channel: ChannelType;
  runtimeType: ReturnType<typeof getRuntimeType>;
}) {
  return (
    process.env.DISABLE_WEDDING_SALES_SIMPLE_INSTAGRAM !== "true" &&
    args.channel === ChannelType.INSTAGRAM &&
    args.runtimeType === "wedding_sales_simple"
  );
}

function getWeddingSalesGraphChannel(channel: ChannelType) {
  return channel === ChannelType.INSTAGRAM ? "instagram" : "gmail";
}

function isValidRuntimeEmail(value?: string) {
  return Boolean(value && /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(value));
}

function resolveWeddingSalesDefaultEmail(args: {
  channel: ChannelType;
  incoming: Pick<ParsedIncomingMessage, "contactEmail" | "contactId">;
}) {
  if (isValidRuntimeEmail(args.incoming.contactEmail)) {
    return args.incoming.contactEmail;
  }

  if (args.channel === ChannelType.GMAIL && isValidRuntimeEmail(args.incoming.contactId)) {
    return args.incoming.contactId;
  }

  return undefined;
}

function classifyGmailClientMessage(args: {
  from?: string;
  subject?: string;
  message: string;
}): GmailClientClassification {
  const subject = (args.subject ?? "").trim();
  const message = args.message.trim();
  const from = (args.from ?? "").trim().toLowerCase();
  const normalizedSubject = subject.toLowerCase();
  const normalizedMessage = message.toLowerCase().replace(/\s+/g, " ");
  const combined = `${normalizedSubject}\n${normalizedMessage}`;

  if (/^\s*re\s*:/i.test(subject)) {
    return {
      kind: "client",
      reason: "reply_thread",
    };
  }

  const wordCount = normalizedMessage.split(/\s+/).filter(Boolean).length;
  const shortClientReply =
    wordCount > 0 &&
    wordCount <= 6 &&
    /^(yes|no|ok|okay|sure|great|perfect|thanks|thank you|tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday|[a-z .'-]+|\d{1,2}([:.\-]\d{2})?\s*(am|pm)?)$/i.test(
      message,
    );

  if (shortClientReply) {
    return {
      kind: "client",
      reason: "short_reply",
    };
  }

  const hardOtherPatterns = [
    /\bcoordinator\b/,
    /\bplanner\b/,
    /\btimeline\b/,
    /\bcoi\b/,
    /\bcertificate of insurance\b/,
    /\bvendor arrivals?\b/,
    /\bvendor list\b/,
    /\bnewsletter\b/,
    /\bunsubscribe\b/,
    /\bno[-\s]?reply\b/,
    /\bautomated\b/,
    /\bnotification\b/,
    /\bdelivery status notification\b/,
    /\bmail delivery subsystem\b/,
    /\bdaemon\b/,
  ];

  if (hardOtherPatterns.some((pattern) => pattern.test(combined)) || from.includes("no-reply")) {
    return {
      kind: "other",
      reason: "non_client_signal",
    };
  }

  return {
    kind: "client",
    reason: "default_when_uncertain",
  };
}

function buildSchedulingNudge(args: {
  historyMessages: RuntimeHistoryMessage[];
  currentMessage: string;
}) {
  const normalizeSelection = (value: string) =>
    value
      .toLowerCase()
      .replace(/\b(\d{1,2})\s*[-.]\s*(\d{2})\b/g, "$1:$2")
      .replace(/\b(\d{1,2})\s+(\d{2})\b/g, "$1:$2");
  const current = normalizeSelection(args.currentMessage);
  const recentToolMessages = [...args.historyMessages]
    .reverse()
    .filter((message) => message.role === MessageRole.TOOL)
    .slice(0, 4);

  for (const message of recentToolMessages) {
    const rawResult = message.toolResult;
    if (!rawResult || typeof rawResult !== "object" || Array.isArray(rawResult)) {
      continue;
    }

    const steps = "steps" in rawResult ? rawResult.steps : undefined;
    if (!Array.isArray(steps)) {
      continue;
    }

    for (const step of steps) {
      if (!step || typeof step !== "object" || !("result" in step)) {
        continue;
      }

      const result = step.result;
      if (!result || typeof result !== "object" || Array.isArray(result)) {
        continue;
      }

      const status = "status" in result ? String(result.status ?? "") : "";
      const suggestedTimes =
        "suggestedTimes" in result && Array.isArray(result.suggestedTimes)
          ? result.suggestedTimes.map((value: unknown) => String(value).toLowerCase())
          : [];

      if (status !== "busy" || suggestedTimes.length === 0) {
        continue;
      }

      const matchedSuggestion = suggestedTimes.find((time: string) =>
        current.includes(normalizeSelection(time)),
      );
      if (matchedSuggestion) {
        return `Scheduling nudge:
- The customer is choosing a previously offered alternative consultation slot (${matchedSuggestion}).
- Call the booking tool now for that selected time instead of replying in prose.`;
      }
    }
  }

  return "";
}

function messageHasWeddingMonthDayWithoutYear(message: string) {
  const withoutQuotedHeader = message
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => !/<[^>\s]+@[^>]+>:\s*$/.test(line.trim()))
    .join("\n")
    .toLowerCase();
  const hasYear = /\b(?:19|20)\d{2}\b/.test(withoutQuotedHeader);
  const monthName =
    "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|sept|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
  const monthDay = new RegExp(`\\b${monthName}\\s+\\d{1,2}(?:st|nd|rd|th)?\\b`, "i");
  const dayMonth = new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+${monthName}\\b`, "i");

  return !hasYear && (monthDay.test(withoutQuotedHeader) || dayMonth.test(withoutQuotedHeader));
}

function buildIncompleteWeddingDateNudge(currentMessage: string) {
  if (!messageHasWeddingMonthDayWithoutYear(currentMessage)) {
    return "";
  }

  return `Wedding date nudge:
- The incoming customer message gives a wedding month/day without a year.
- Ask which year the wedding is before checking availability, pricing availability, or saying the date is available.
- Ignore any year that appears only in quoted Gmail headers or email metadata.`;
}

function extractIncompleteWeddingDateLabel(message: string) {
  const withoutQuotedHeader = message
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => !/<[^>\s]+@[^>]+>:\s*$/.test(line.trim()))
    .join("\n");
  const monthName =
    "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|sept|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
  const monthDay = new RegExp(`\\b(${monthName}\\s+\\d{1,2}(?:st|nd|rd|th)?)\\b`, "i");
  const dayMonth = new RegExp(`\\b(\\d{1,2}(?:st|nd|rd|th)?\\s+${monthName})\\b`, "i");

  return withoutQuotedHeader.match(monthDay)?.[1] ?? withoutQuotedHeader.match(dayMonth)?.[1] ?? "that date";
}

function rewriteIncompleteWeddingDateReply(args: {
  text: string;
  currentMessage?: string;
}) {
  if (!args.currentMessage || !messageHasWeddingMonthDayWithoutYear(args.currentMessage)) {
    return args.text;
  }

  const dateLabel = extractIncompleteWeddingDateLabel(args.currentMessage);

  return [
    "Thank you for sharing that.",
    `Could you confirm which year your wedding is on ${dateLabel}? Once I have the year, I can check availability for you.`,
  ].join("\n\n");
}

function extractDelayedFollowUpGuidance(message: string) {
  const marker = "Follow-up guidance:";
  const markerIndex = message.indexOf(marker);

  if (!message.startsWith("Internal delayed follow-up task.") || markerIndex === -1) {
    return "";
  }

  return message.slice(markerIndex + marker.length).trim();
}

function buildHistoryAppend(args: {
  toolExecutions: Array<{
    toolName: string;
    toolResult: unknown;
    durationMs?: number;
  }>;
  assistantText: string;
}) {
  return [
    ...args.toolExecutions.map(
      (execution): RuntimeHistoryMessage => ({
        role: MessageRole.TOOL,
        content: JSON.stringify(execution.toolResult),
        toolName: execution.toolName,
        toolResult: execution.toolResult,
        durationMs: execution.durationMs,
      }),
    ),
    {
      role: MessageRole.ASSISTANT,
      content: args.assistantText,
    } satisfies RuntimeHistoryMessage,
  ];
}

function parseToolObservationResult(result: string) {
  try {
    return JSON.parse(result) as unknown;
  } catch {
    return result;
  }
}

function extractWeddingSalesTestState(historyMessages?: RuntimeHistoryMessage[]) {
  const stateMessage = [...(historyMessages ?? [])]
    .reverse()
    .find((message) => message.role === MessageRole.TOOL && message.toolName === WEDDING_SALES_TEST_STATE_TOOL_NAME);

  const rawState =
    stateMessage?.toolResult &&
    typeof stateMessage.toolResult === "object" &&
    !Array.isArray(stateMessage.toolResult) &&
    "state" in stateMessage.toolResult
      ? stateMessage.toolResult.state
      : stateMessage?.toolResult;

  return rawState && typeof rawState === "object" && !Array.isArray(rawState)
    ? (rawState as Partial<WeddingSalesState>)
    : undefined;
}

function buildWeddingSalesTestHistoryAppend(args: {
  state: WeddingSalesState;
  assistantText: string;
}) {
  const toolMessages = args.state.turnToolObservations.map((observation): RuntimeHistoryMessage => {
    const parsedResult = parseToolObservationResult(observation.result);

    return {
      role: MessageRole.TOOL,
      content: typeof parsedResult === "string" ? parsedResult : JSON.stringify(parsedResult),
      toolName: observation.toolName,
      toolResult: parsedResult,
    };
  });

  return [
    ...toolMessages,
    {
      role: MessageRole.TOOL,
      content: JSON.stringify({ state: args.state }),
      toolName: WEDDING_SALES_TEST_STATE_TOOL_NAME,
      toolResult: { state: args.state },
      model: "langgraph_wedding_sales_state",
    },
    {
      role: MessageRole.ASSISTANT,
      content: args.assistantText,
      model: "langgraph_wedding_sales",
    },
  ] satisfies RuntimeHistoryMessage[];
}

async function runWeddingSalesTestRuntime(args: {
  agent: IncomingEventAgent;
  input: InvokeAgentInput;
  toolFeatures: RuntimeBlocks["toolFeatures"];
}) {
  const defaultEmail = resolveWeddingSalesDefaultEmail({
    channel: args.agent.channel.type,
    incoming: {
      contactId: args.input.contactId,
      contactEmail: args.input.contactEmail,
    },
  });
  const toolContext = createWeddingSalesToolContextFromFeatures({
    tenantId: args.agent.tenantId,
    toolFeatures: args.toolFeatures,
    testMode: true,
    defaultEmail,
  });
  const config = buildWeddingSalesConfigFromChannelConfig(args.agent.channelConfig);
  const conversationContext = renderHistory(
    (args.input.historyMessages ?? []).filter(
      (message) => message.toolName !== WEDDING_SALES_TEST_STATE_TOOL_NAME,
    ),
  );
  const graphResult = await invokeWeddingSalesGraph({
    tenantId: args.agent.tenantId,
    agentId: args.agent.id,
    contactId: args.input.contactId,
    runtimeMode: "unified_v2",
    channel: getWeddingSalesGraphChannel(args.agent.channel.type),
    message: args.input.message,
    customerEmail: defaultEmail,
    conversationContext,
    previousState: extractWeddingSalesTestState(args.input.historyMessages),
    config,
    toolContext,
    checkpoint: false,
  });
  const message = graphResult.responseDraft ?? "";

  return {
    message,
    promptPreview: "langgraph_wedding_sales",
    usedTooling: graphResult.turnToolObservations.map((observation) => observation.toolName),
    model: "langgraph_wedding_sales",
    attachments: getWeddingSalesGuideAttachment({
      channel: args.agent.channel.type,
      message,
      config,
      allowAttachments: readMessageBehaviorConfig(args.agent.channelConfig).allowAttachments,
      state: graphResult,
    }),
    historyAppend: buildWeddingSalesTestHistoryAppend({
      state: graphResult,
      assistantText: message,
    }),
    suppressReply: !message,
  } satisfies InvokeAgentResult;
}

function isPartialDeliveryResult(
  delivery: unknown,
): delivery is {
  ok: false;
  mode: string;
  deliveredCount: number;
  totalParts: number;
  error?: string;
} {
  if (!delivery || typeof delivery !== "object" || Array.isArray(delivery)) {
    return false;
  }

  return (
    "ok" in delivery &&
    delivery.ok === false &&
    "deliveredCount" in delivery &&
    typeof delivery.deliveredCount === "number" &&
    "totalParts" in delivery &&
    typeof delivery.totalParts === "number"
  );
}

async function recordInboundMessageWithDb(
  database: typeof db,
  args: {
  agentId: string;
  contactId: string;
  contactUsername?: string;
  contactDisplayName?: string;
  channel: ChannelType;
  message: string;
  messageId?: string;
  gmailMessageId?: string;
  threadId?: string;
  subject?: string;
  conversationStatus?: ConversationStatus;
}) {
  return database.$transaction(async (tx) => {
    const contactProfileUpdate = buildContactProfileUpdate(args);
    const existingConversation = await tx.conversation.findUnique({
      where: {
        agentId_contactId: {
          agentId: args.agentId,
          contactId: args.contactId,
        },
      },
    });

    const conversation =
      existingConversation ??
      (await tx.conversation.create({
        data: {
          agentId: args.agentId,
          contactId: args.contactId,
          ...contactProfileUpdate,
          channel: args.channel,
          status: args.conversationStatus ?? ConversationStatus.ACTIVE,
        },
      }));

    if (
      args.conversationStatus &&
      existingConversation &&
      existingConversation.status !== args.conversationStatus
    ) {
      await tx.conversation.update({
        where: { id: existingConversation.id },
        data: { status: args.conversationStatus, ...contactProfileUpdate },
      });
    } else if (existingConversation && Object.keys(contactProfileUpdate).length > 0) {
      await tx.conversation.update({
        where: { id: existingConversation.id },
        data: contactProfileUpdate,
      });
    }

    await tx.message.create({
      data: {
        conversationId: conversation.id,
        role: MessageRole.USER,
        content: args.message,
        toolInput:
          args.messageId || args.gmailMessageId || args.threadId || args.subject
            ? {
                ...(args.messageId ? { messageId: args.messageId } : {}),
                ...(args.gmailMessageId ? { gmailMessageId: args.gmailMessageId } : {}),
                ...(args.threadId ? { threadId: args.threadId } : {}),
                ...(args.subject ? { subject: args.subject } : {}),
              }
            : undefined,
      },
    });

    return existingConversation ?? conversation;
  });
}

async function recordBusinessManualMessageWithDb(
  database: typeof db,
  args: {
  agentId: string;
  contactId: string;
  contactUsername?: string;
  contactDisplayName?: string;
  channel: ChannelType;
  message: string;
  messageId?: string;
  gmailMessageId?: string;
  threadId?: string;
  subject?: string;
}) {
  return database.$transaction(async (tx) => {
    const contactProfileUpdate = buildContactProfileUpdate(args);
    const existingConversation = await tx.conversation.findUnique({
      where: {
        agentId_contactId: {
          agentId: args.agentId,
          contactId: args.contactId,
        },
      },
    });
    const conversation =
      existingConversation ??
      (await tx.conversation.create({
        data: {
          agentId: args.agentId,
          contactId: args.contactId,
          ...contactProfileUpdate,
          channel: args.channel,
        },
      }));

    if (existingConversation && Object.keys(contactProfileUpdate).length > 0) {
      await tx.conversation.update({
        where: { id: existingConversation.id },
        data: contactProfileUpdate,
      });
    }

    await tx.message.create({
      data: {
        conversationId: conversation.id,
        role: MessageRole.TOOL,
        toolName: BUSINESS_MANUAL_MESSAGE_TOOL_NAME,
        content: args.message,
        toolInput:
          args.messageId || args.gmailMessageId || args.threadId || args.subject
            ? {
                ...(args.messageId ? { messageId: args.messageId } : {}),
                ...(args.gmailMessageId ? { gmailMessageId: args.gmailMessageId } : {}),
                ...(args.threadId ? { threadId: args.threadId } : {}),
                ...(args.subject ? { subject: args.subject } : {}),
              }
            : undefined,
      },
    });

    return conversation;
  });
}

async function runWeddingSalesRuntime(args: {
  database: typeof db;
  agent: IncomingEventAgent;
  incoming: ParsedIncomingMessage;
  channel: ChannelType;
  existingConversationStatus?: ConversationStatus;
  skipInboundPersistence?: boolean;
  conversationId?: string;
  runtimeEvent?: InvokeAgentInput["runtimeEvent"];
}): Promise<InvokeAgentResult> {
  const conversation =
    args.skipInboundPersistence && args.conversationId
      ? { id: args.conversationId }
      : await recordInboundMessageWithDb(args.database, {
          agentId: args.agent.id,
          contactId: args.incoming.contactId,
          contactUsername: args.incoming.contactUsername,
          contactDisplayName: args.incoming.contactDisplayName,
          channel: args.agent.channel.type,
          message: args.incoming.message,
          messageId: args.incoming.messageId,
          gmailMessageId: args.incoming.gmailMessageId,
          threadId: args.incoming.threadId,
          subject: args.incoming.subject,
          conversationStatus: args.existingConversationStatus ?? ConversationStatus.ACTIVE,
        });

  if (!args.skipInboundPersistence) {
    await cancelPendingDelayedDeliveriesWithDb({
      database: args.database,
      conversationId: conversation.id,
      kinds: [DelayedDeliveryKind.FOLLOW_UP],
    });
  }

  const delayedFollowUpGuidance =
    args.runtimeEvent?.type === "follow_up"
      ? args.runtimeEvent.guidance ?? ""
      : args.skipInboundPersistence
        ? extractDelayedFollowUpGuidance(args.incoming.message)
        : "";

  if (delayedFollowUpGuidance && args.runtimeEvent?.type !== "follow_up") {
    await args.database.message.create({
      data: {
        conversationId: conversation.id,
        role: MessageRole.ASSISTANT,
        content: delayedFollowUpGuidance,
        model: "langgraph_wedding_sales_follow_up",
      },
    });

    return {
      message: delayedFollowUpGuidance,
      promptPreview: "langgraph_wedding_sales_follow_up",
      usedTooling: [],
      conversationId: conversation.id,
      model: "langgraph_wedding_sales_follow_up",
    };
  }

  const toolFeatures = await hydrateFunctionBlocksForRuntime(
    {
      id: args.agent.id,
      tenantId: args.agent.tenantId,
      channelConfig: args.agent.channelConfig,
    },
    args.database,
  );
  const defaultEmail = resolveWeddingSalesDefaultEmail({
    channel: args.channel,
    incoming: args.incoming,
  });
  const toolContext = createWeddingSalesToolContextFromFeatures({
    tenantId: args.agent.tenantId,
    toolFeatures,
    defaultEmail,
  });
  const config = buildWeddingSalesConfigFromChannelConfig(args.agent.channelConfig);
  const recentConversationMessages =
    typeof args.database.message.findMany === "function"
      ? await args.database.message.findMany({
          where: {
            conversationId: conversation.id,
            OR: [
              {
                role: {
                  in: [MessageRole.USER, MessageRole.ASSISTANT],
                },
              },
              {
                role: MessageRole.TOOL,
                toolName: BUSINESS_MANUAL_MESSAGE_TOOL_NAME,
              },
            ],
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 12,
        })
      : [];
  const conversationContext = renderHistory(
    [...recentConversationMessages].reverse().map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      toolName: message.toolName,
      toolInput: message.toolInput,
      toolResult: message.toolResult,
      model: message.model,
      createdAt: message.createdAt,
    })),
  );

  const graphResult = await invokeWeddingSalesGraph({
    tenantId: args.agent.tenantId,
    agentId: args.agent.id,
    contactId: args.incoming.contactId,
    runtimeMode: "unified_v2",
    channel: getWeddingSalesGraphChannel(args.channel),
    message: args.incoming.message,
    runtimeEvent: args.runtimeEvent,
    customerEmail: defaultEmail,
    conversationContext,
    config,
    toolContext,
    checkpoint: args.database === db,
  });
  const message = graphResult.responseDraft ?? "";
  const ownerHandoffReason = getWeddingSalesOwnerHandoffReason(graphResult);

  if (!message) {
    if (ownerHandoffReason) {
      const handoff = await requestOwnerHandoffWithDb({
        database: args.database,
        agent: args.agent,
        conversationId: conversation.id,
        customerMessage: args.incoming.message,
        reason: ownerHandoffReason,
      });

      if (handoff.status === "owner_handoff_requested") {
        return {
          message: "",
          promptPreview: "langgraph_wedding_sales",
          usedTooling: [OWNER_HANDOFF_REQUEST_TOOL_NAME],
          conversationId: conversation.id,
          model: "langgraph_wedding_sales",
          suppressReply: true,
        };
      }
    }

    return {
      message: "",
      promptPreview: "langgraph_wedding_sales",
      usedTooling: [],
      conversationId: conversation.id,
      model: "langgraph_wedding_sales",
      suppressReply: true,
    };
  }

  await recordLangGraphToolObservationsWithDb({
    database: args.database,
    conversationId: conversation.id,
    observations: graphResult.turnToolObservations,
  });

  await args.database.message.create({
    data: {
      conversationId: conversation.id,
      role: MessageRole.ASSISTANT,
      content: message,
      model: "langgraph_wedding_sales",
    },
  });

  const usedTooling = graphResult.toolObservations.map((observation) => observation.toolName);

  if (ownerHandoffReason) {
    const handoff = await requestOwnerHandoffWithDb({
      database: args.database,
      agent: args.agent,
      conversationId: conversation.id,
      customerMessage: args.incoming.message,
      reason: ownerHandoffReason,
    });

    if (handoff.status === "owner_handoff_requested") {
      usedTooling.push(OWNER_HANDOFF_REQUEST_TOOL_NAME);
    }
  }

  return {
    message,
    promptPreview: "langgraph_wedding_sales",
    usedTooling,
    conversationId: conversation.id,
    model: "langgraph_wedding_sales",
    attachments: getWeddingSalesGuideAttachment({
      channel: args.channel,
      message,
      config,
      allowAttachments: readMessageBehaviorConfig(args.agent.channelConfig).allowAttachments,
      state: graphResult,
    }),
  };
}

async function runWeddingSalesSimpleRuntime(args: {
  database: typeof db;
  agent: IncomingEventAgent;
  incoming: ParsedIncomingMessage;
  channel: ChannelType;
  existingConversationStatus?: ConversationStatus;
  skipInboundPersistence?: boolean;
  conversationId?: string;
}): Promise<InvokeAgentResult> {
  if (args.channel !== ChannelType.INSTAGRAM) {
    throw new Error("wedding-sales-simple runtime is currently enabled only for Instagram.");
  }

  if (
    !args.skipInboundPersistence &&
    (await hasProcessedWeddingSalesSimpleIncomingWithDb({
      database: args.database,
      agentId: args.agent.id,
      contactId: args.incoming.contactId,
      messageId: args.incoming.messageId,
    }))
  ) {
    return {
      message: "",
      promptPreview: "wedding_sales_simple_duplicate",
      usedTooling: [],
      model: "wedding_sales_simple",
      suppressReply: true,
    };
  }

  const conversation =
    args.skipInboundPersistence && args.conversationId
      ? { id: args.conversationId }
      : await recordInboundMessageWithDb(args.database, {
          agentId: args.agent.id,
          contactId: args.incoming.contactId,
          contactUsername: args.incoming.contactUsername,
          contactDisplayName: args.incoming.contactDisplayName,
          channel: args.agent.channel.type,
          message: args.incoming.message,
          messageId: args.incoming.messageId,
          gmailMessageId: args.incoming.gmailMessageId,
          threadId: args.incoming.threadId,
          subject: args.incoming.subject,
          conversationStatus: args.existingConversationStatus ?? ConversationStatus.ACTIVE,
        });

  if (!args.skipInboundPersistence) {
    await cancelPendingDelayedDeliveriesWithDb({
      database: args.database,
      conversationId: conversation.id,
      kinds: [DelayedDeliveryKind.FOLLOW_UP],
    });
  }

  const toolFeatures = await hydrateFunctionBlocksForRuntime(
    {
      id: args.agent.id,
      tenantId: args.agent.tenantId,
      channelConfig: args.agent.channelConfig,
    },
    args.database,
  );
  const defaultEmail = resolveWeddingSalesDefaultEmail({
    channel: args.channel,
    incoming: args.incoming,
  });
  const toolContext = createWeddingSalesToolContextFromFeatures({
    tenantId: args.agent.tenantId,
    toolFeatures,
    defaultEmail,
  });
  const incoming: NormalizedWeddingSalesIncomingMessage = {
    channel: "instagram",
    tenantId: args.agent.tenantId,
    agentId: args.agent.id,
    contactId: args.incoming.contactId,
    conversationId: conversation.id,
    text: args.incoming.message,
    incomingMessageId: args.incoming.messageId,
    senderName: args.incoming.contactDisplayName ?? args.incoming.contactUsername,
    senderEmail: defaultEmail,
    receivedAt: new Date().toISOString(),
  };
  const adapterResult = await invokeWeddingSalesSimpleAdapter({
    incoming,
    toolContext,
    deps: {
      loadState: () =>
        loadWeddingSalesSimpleStateWithDb({
          database: args.database,
          conversationId: conversation.id,
        }),
      saveState: ({ state }) =>
        saveWeddingSalesSimpleStateWithDb({
          database: args.database,
          conversationId: conversation.id,
          state,
        }),
      recordSafetyLog: (entry) =>
        recordWeddingSalesSimpleSafetyLogWithDb({
          database: args.database,
          conversationId: conversation.id,
          entry,
        }),
    },
  });

  if (adapterResult.status === "duplicate") {
    return {
      message: "",
      promptPreview: "wedding_sales_simple_duplicate",
      usedTooling: [],
      conversationId: conversation.id,
      model: "wedding_sales_simple",
      suppressReply: true,
    };
  }

  const message = adapterResult.outbound.text;
  await recordLangGraphToolObservationsWithDb({
    database: args.database,
    conversationId: conversation.id,
    observations: adapterResult.state.toolObservations,
  });

  if (message) {
    await args.database.message.create({
      data: {
        conversationId: conversation.id,
        role: MessageRole.ASSISTANT,
        content: message,
        model: "wedding_sales_simple",
      },
    });
  }

  const usedTooling = adapterResult.state.toolObservations.map(
    (observation) => observation.toolName,
  );

  if (adapterResult.state.mode === "bot_paused") {
    const handoff = await requestOwnerHandoffWithDb({
      database: args.database,
      agent: args.agent,
      conversationId: conversation.id,
      customerMessage: args.incoming.message,
      reason: adapterResult.state.handoffReason ?? "wedding_sales_simple_handoff",
    });

    if (handoff.status === "owner_handoff_requested") {
      usedTooling.push(OWNER_HANDOFF_REQUEST_TOOL_NAME);
    }
  }

  return {
    message,
    promptPreview: "wedding_sales_simple",
    usedTooling,
    conversationId: conversation.id,
    model: "wedding_sales_simple",
  };
}

async function recordInboundMessage(args: {
  agentId: string;
  contactId: string;
  contactUsername?: string;
  contactDisplayName?: string;
  channel: ChannelType;
  message: string;
  messageId?: string;
  gmailMessageId?: string;
  threadId?: string;
  subject?: string;
  conversationStatus?: ConversationStatus;
}) {
  return recordInboundMessageWithDb(db, args);
}

function extractAttachments(
  toolExecutions: Array<{
    toolResult: unknown;
  }>,
) {
  const attachments = new Map<string, RuntimeAttachment>();

  for (const execution of toolExecutions) {
    if (!execution.toolResult || typeof execution.toolResult !== "object" || Array.isArray(execution.toolResult)) {
      continue;
    }

    const steps = "steps" in execution.toolResult ? execution.toolResult.steps : undefined;
    if (!Array.isArray(steps)) {
      continue;
    }

    for (const step of steps) {
      if (!step || typeof step !== "object" || !("result" in step)) {
        continue;
      }

      const result = step.result;
      if (!result || typeof result !== "object" || Array.isArray(result)) {
        continue;
      }

      const attachment = "attachment" in result ? result.attachment : undefined;
      if (!attachment || typeof attachment !== "object" || Array.isArray(attachment)) {
        continue;
      }

      const fileId = "fileId" in attachment ? String(attachment.fileId ?? "") : "";
      if (!fileId) {
        continue;
      }

      attachments.set(fileId, {
        source:
          "source" in attachment && attachment.source === "google_drive"
            ? "google_drive"
            : undefined,
        fileId,
        fileName: "fileName" in attachment ? String(attachment.fileName ?? "") || undefined : undefined,
        mimeType: "mimeType" in attachment ? String(attachment.mimeType ?? "") || undefined : undefined,
      });
    }
  }

  return [...attachments.values()];
}

async function mapAgentToRuntimeBlocks(agent: AgentWithConfigData): Promise<RuntimeBlocks> {
  const rawChannelConfig = getChannelConfigObject(agent.channelConfig);
  const toolFeatures = await hydrateFunctionBlocksForRuntime(agent, db);
  const functionBlocks = normalizeFunctionBlocks(
    Array.isArray(rawChannelConfig.functionBlocks)
      ? (rawChannelConfig.functionBlocks as Partial<FunctionBlockConfig>[])
      : [],
  );
  const knowledgeBlocks = agent.features
    .filter((feature) => feature.type === FeatureType.KNOWLEDGE)
    .map((feature) => ({
      name: feature.name,
      description: feature.description,
      knowledgeContent: feature.knowledgeContent,
    }));
  return {
    promptPreview: buildSystemPrompt({
      name: agent.name,
      persona: agent.persona,
      tone: agent.tone,
      languagePreference: agent.languagePreference,
      channel: agent.channel,
      channelBehavior:
        rawChannelConfig.channelBehavior &&
        typeof rawChannelConfig.channelBehavior === "object" &&
        !Array.isArray(rawChannelConfig.channelBehavior)
          ? (rawChannelConfig.channelBehavior as never)
          : null,
      conversationPlaybook:
        rawChannelConfig.conversationPlaybook &&
        typeof rawChannelConfig.conversationPlaybook === "object" &&
        !Array.isArray(rawChannelConfig.conversationPlaybook)
          ? (rawChannelConfig.conversationPlaybook as never)
          : null,
      prompting:
        rawChannelConfig.prompting &&
        typeof rawChannelConfig.prompting === "object" &&
        !Array.isArray(rawChannelConfig.prompting)
          ? (rawChannelConfig.prompting as never)
          : null,
      knowledgeBlocks,
      functionBlocks,
    }),
    knowledgeBlocks,
    toolFeatures,
    agentSettings: getRuntimeAgentSettingsConfig(agent.channelConfig),
    prompting: getRuntimePromptingConfig(agent.channelConfig),
    control: getRuntimeControlConfig(agent.channelConfig),
  };
}

async function runModelInvocation(args: {
  agent: AgentWithConfigData;
  toolFeatures: Awaited<ReturnType<typeof hydrateFunctionBlocksForRuntime>>;
  input: InvokeAgentInput;
  promptPreview: string;
  historyText: string;
  historyMessages: RuntimeHistoryMessage[];
  prompting: PromptingConfig;
  control: ControlConfig;
}) {
  const toolExecutions: Array<{
    toolName: string;
    toolInput: unknown;
    toolResult: unknown;
    durationMs?: number;
  }> = [];
  const traceMetadata = {
    tenantId: args.agent.tenantId,
    agentId: args.agent.id,
    contactId: args.input.contactId,
    channel: String(args.input.channel),
    testMode: Boolean(args.input.testMode),
    runtimeType: "legacy" as const,
  };
  const tools = resolveTools({
    tenantId: args.agent.tenantId,
    toolFeatures: args.toolFeatures,
    testMode: Boolean(args.input.testMode),
    currentMessage: args.input.message,
    traceMetadata,
    defaultEmail:
      args.input.contactEmail ??
      (String(args.input.channel).toUpperCase() === "GMAIL" && args.input.contactId.includes("@")
        ? args.input.contactId
        : undefined),
    onToolResult: (entry) => {
      toolExecutions.push(entry);
    },
  });
  const hasTools = Object.keys(tools).length > 0;
  const modelId = hasTools
    ? process.env.OPENAI_TOOL_MODEL || "gpt-4.1"
    : process.env.OPENAI_MODEL || "gpt-4.1-mini";

  if (!process.env.OPENAI_API_KEY) {
    return {
      text: buildFallbackResponse({
        input: args.input,
        usedTools: [],
      }),
      modelId: "fallback-no-openai-key",
      toolExecutions,
    };
  }

  const schedulingNudge = buildSchedulingNudge({
    historyMessages: args.historyMessages,
    currentMessage: args.input.message,
  });
  const incompleteWeddingDateNudge = buildIncompleteWeddingDateNudge(args.input.message);

  const controlRuntimeRules = buildControlRuntimeRules(args.control);
  const runtimeContextLines = buildRuntimeContextLines({
    prompting: args.prompting,
    input: args.input,
  });

  const result = await traceLangRuntime("legacy.model.invoke", traceMetadata, () =>
    generateText({
      model: openai(modelId),
      system: `${args.promptPreview}

Runtime application note:
- Respect the runtime execution policy already defined in the composed system prompt.
${controlRuntimeRules ? `\n- ${controlRuntimeRules.replace(/\n/g, "\n")}` : ""}`,
      prompt: `Conversation history:
  ${args.historyText}

  ${runtimeContextLines ? `${runtimeContextLines}\n` : ""}Incoming customer message:
  ${args.input.message}

  ${[schedulingNudge, incompleteWeddingDateNudge].filter(Boolean).join("\n\n")}`.trim(),
    ...(hasTools
      ? {
          tools,
          stopWhen: stepCountIs(5),
        }
      : {}),
    }),
  );

  return {
    text: result.text,
    modelId,
    toolExecutions,
  };
}

export async function invokeAgent(input: InvokeAgentInput): Promise<InvokeAgentResult> {
  if (!input.agentId) {
    const sandboxFunctionBlocks = input.functionBlocks ?? [];
    const promptPreview =
      input.promptPreview ??
      buildSystemPrompt({
        name: "Sandbox agent",
        persona: "Helpful business assistant",
        tone: "friendly",
        languagePreference: input.languagePreference ?? null,
        channel: { type: input.channel as ChannelType },
        knowledgeBlocks: input.knowledgeBlocks ?? [],
        functionBlocks: input.functionBlocks,
      });
    const usedTooling =
      input.message.toLowerCase().includes("available") || input.message.toLowerCase().includes("book")
        ? sandboxFunctionBlocks.map((fn) => fn.name)
        : [];

    return {
      message: buildFallbackResponse({
        input,
        usedTools: usedTooling,
      }),
      promptPreview,
      usedTooling,
      model: "sandbox-fallback",
    };
  }

  const agent = await db.agent.findFirst({
    where: {
      id: input.agentId,
      tenantId: input.tenantId,
      ...(input.allowDraftAgent ? {} : { status: AgentStatus.ACTIVE }),
    },
    include: agentConfigInclude,
  });

  if (!agent) {
    throw new Error(input.allowDraftAgent ? "Saved agent not found." : "Active deployed agent not found.");
  }

  const runtimeType = getRuntimeType(agent.channelConfig);
  if (
    !input.testMode &&
    shouldUseWeddingSalesSimpleRuntime({ channel: agent.channel.type, runtimeType })
  ) {
    return runWeddingSalesSimpleRuntime({
      database: db,
      agent,
      incoming: {
        contactId: input.contactId,
        contactEmail: input.contactEmail,
        message: input.message,
        messageId: input.messageId,
        gmailMessageId: input.gmailMessageId,
        threadId: input.threadId,
        subject: input.subject,
      },
      channel: agent.channel.type,
      skipInboundPersistence: input.skipInboundPersistence,
      conversationId: input.conversationId,
    });
  }

  const runtimeBlocks = await mapAgentToRuntimeBlocks(agent);
  if (
    !input.testMode &&
    shouldUseWeddingSalesRuntime({ channel: agent.channel.type, runtimeType })
  ) {
    return runWeddingSalesRuntime({
      database: db,
      agent,
      incoming: {
        contactId: input.contactId,
        contactEmail: input.contactEmail,
        message: input.message,
        messageId: input.messageId,
        gmailMessageId: input.gmailMessageId,
        threadId: input.threadId,
        subject: input.subject,
      },
      channel: agent.channel.type,
      skipInboundPersistence: input.skipInboundPersistence,
      conversationId: input.conversationId,
      runtimeEvent: input.runtimeEvent,
    });
  }

  if (input.testMode) {
    const historyMessages = applyControlToHistory({
      historyMessages: input.historyMessages ?? [],
      control: runtimeBlocks.control,
    });
    const antiSpamIntercept = getAntiSpamIntercept({
      historyMessages,
      control: runtimeBlocks.control,
    });

    if (antiSpamIntercept) {
      if (antiSpamIntercept.kind === "silent") {
        return {
          message: "",
          promptPreview: runtimeBlocks.promptPreview,
          usedTooling: [],
          model: "control-anti-spam-silent",
          suppressReply: true,
        };
      }

      return {
        message: antiSpamIntercept.message,
        promptPreview: runtimeBlocks.promptPreview,
        usedTooling: [],
        model: "control-anti-spam",
        historyAppend: [
          {
            role: MessageRole.ASSISTANT,
            content: antiSpamIntercept.message,
            model: "control-anti-spam",
          },
        ],
      };
    }

    if (shouldUseWeddingSalesRuntime({ channel: agent.channel.type, runtimeType })) {
      return runWeddingSalesTestRuntime({
        agent,
        input: {
          ...input,
          historyMessages,
        },
        toolFeatures: runtimeBlocks.toolFeatures,
      });
    }

    const modelResult = await runModelInvocation({
      agent,
      toolFeatures: runtimeBlocks.toolFeatures,
      input,
      promptPreview: runtimeBlocks.promptPreview,
      historyText: renderHistory(historyMessages),
      historyMessages,
      prompting: runtimeBlocks.prompting,
      control: runtimeBlocks.control,
    });
    const finalizedText = finalizeAssistantText({
      text: modelResult.text,
      currentMessage: input.message,
      toolExecutions: modelResult.toolExecutions,
    });

    return {
      message: finalizedText,
      promptPreview: runtimeBlocks.promptPreview,
      usedTooling: modelResult.toolExecutions.map((execution) => execution.toolName),
      model: modelResult.modelId,
      attachments: extractAttachments(modelResult.toolExecutions),
      historyAppend: buildHistoryAppend({
        toolExecutions: modelResult.toolExecutions,
        assistantText: finalizedText,
      }),
    };
  }

  const history = await loadConversationHistory(agent.id, input.contactId);
  const historyMessages = applyControlToHistory({
    historyMessages: history.messages,
    control: runtimeBlocks.control,
  });
  const conversation =
    input.skipInboundPersistence && input.conversationId
      ? { id: input.conversationId }
      : await recordInboundMessage({
          agentId: agent.id,
          contactId: input.contactId,
          channel: agent.channel.type,
          message: input.message,
          messageId: input.messageId,
          gmailMessageId: input.gmailMessageId,
          threadId: input.threadId,
          subject: input.subject,
        });

  const antiSpamIntercept = getAntiSpamIntercept({
    historyMessages,
    control: runtimeBlocks.control,
  });

  if (antiSpamIntercept) {
    if (antiSpamIntercept.kind === "silent") {
      return {
        message: "",
        promptPreview: runtimeBlocks.promptPreview,
        usedTooling: [],
        conversationId: conversation.id,
        model: "control-anti-spam-silent",
        suppressReply: true,
      };
    }

    await saveMessages(conversation.id, [
      {
        role: MessageRole.ASSISTANT,
        content: antiSpamIntercept.message,
        model: "control-anti-spam",
      },
    ]);

    return {
      message: antiSpamIntercept.message,
      promptPreview: runtimeBlocks.promptPreview,
      usedTooling: [],
      conversationId: conversation.id,
      model: "control-anti-spam",
      historyAppend: [
        {
          role: MessageRole.ASSISTANT,
          content: antiSpamIntercept.message,
          model: "control-anti-spam",
        },
      ],
    };
  }

  const modelResult = await runModelInvocation({
    agent,
    toolFeatures: runtimeBlocks.toolFeatures,
    input,
    promptPreview: runtimeBlocks.promptPreview,
    historyText: renderHistory(historyMessages),
    historyMessages,
    prompting: runtimeBlocks.prompting,
    control: runtimeBlocks.control,
  });
  const finalizedText = finalizeAssistantText({
    text: modelResult.text,
    currentMessage: input.message,
    toolExecutions: modelResult.toolExecutions,
  });

  if (modelResult.toolExecutions.length > 0) {
    await saveMessages(
      conversation.id,
      modelResult.toolExecutions.map((execution) => ({
        role: MessageRole.TOOL,
        content: JSON.stringify(execution.toolResult),
        toolName: execution.toolName,
        toolInput: execution.toolInput as never,
        toolResult: execution.toolResult as never,
        durationMs: execution.durationMs,
      })),
    );
  }

  await saveMessages(conversation.id, [
    {
      role: MessageRole.ASSISTANT,
      content: finalizedText,
      model: modelResult.modelId,
    },
  ]);

  return {
    message: finalizedText,
    promptPreview: runtimeBlocks.promptPreview,
    usedTooling: modelResult.toolExecutions.map((execution) => execution.toolName),
    conversationId: conversation.id,
    model: modelResult.modelId,
    attachments: extractAttachments(modelResult.toolExecutions),
    historyAppend: buildHistoryAppend({
      toolExecutions: modelResult.toolExecutions,
      assistantText: finalizedText,
    }),
  };
}

export const aiRuntimeTestHelpers = {
  sanitizeAllowedEmojis,
  softenFalseBookingConfirmation,
  extractDelayedFollowUpGuidance,
  finalizeAssistantText,
  getInboundConversationPolicy,
  inspectInstagramConversationHistory,
  getWeddingSalesOwnerHandoffReason,
  handleIncomingEventWithDeps,
  isWithinAgentSchedule,
  buildRuntimeContextLines,
  getAntiSpamIntercept,
  classifyGmailClientMessage,
  getRuntimeType,
  shouldUseWeddingSalesSimpleRuntime,
  shouldUseWeddingSalesRuntime,
};

async function handleIncomingEventWithDeps(
  args: {
  agentId: string;
  channel: ChannelType;
  payload: unknown;
},
  deps: HandleIncomingEventDeps,
) {
  const agent = await deps.db.agent.findFirst({
    where: {
      id: args.agentId,
      status: {
        in: [AgentStatus.ACTIVE, AgentStatus.PAUSED],
      },
      channel: {
        type: args.channel,
      },
    },
    include: {
      channel: true,
    },
  });

  if (!agent) {
    throw new Error("Active agent not found for incoming event.");
  }

  const adapter = deps.getChannelAdapter(args.channel) as RuntimeChannelAdapter;
  const incoming = adapter.parseIncoming(args.payload);

  if (!incoming.contactId || !incoming.message) {
    return {
      ok: false,
      reason: "ignored_empty_payload",
    };
  }

  const normalizedMessageId = incoming.messageId?.trim();
  const normalizedGmailMessageId = incoming.gmailMessageId?.trim();

  if (normalizedMessageId || normalizedGmailMessageId) {
    const existingMessage = await deps.db.message.findFirst({
      where: {
        role: incoming.isBusinessManualReply ? MessageRole.TOOL : MessageRole.USER,
        ...(incoming.isBusinessManualReply
          ? { toolName: BUSINESS_MANUAL_MESSAGE_TOOL_NAME }
          : {}),
        conversation: {
          agentId: agent.id,
          contactId: incoming.contactId,
        },
        OR: [
          ...(normalizedMessageId
            ? [
                {
                  toolInput: {
                    path: ["messageId"],
                    equals: normalizedMessageId,
                  },
                },
              ]
            : []),
          ...(normalizedGmailMessageId
            ? [
                {
                  toolInput: {
                    path: ["gmailMessageId"],
                    equals: normalizedGmailMessageId,
                  },
                },
              ]
            : []),
        ],
      },
      select: {
        id: true,
      },
    });

    if (existingMessage) {
      return {
        ok: true,
        agentId: agent.id,
        status: "ignored_duplicate_inbound_message",
        duplicateMessageId: normalizedMessageId ?? normalizedGmailMessageId,
      };
    }
  }

  if (
    args.channel === ChannelType.GMAIL &&
    !incoming.isBusinessManualReply &&
    isGmailClientClassifierEnabled(agent.channelConfig)
  ) {
    const classification = classifyGmailClientMessage({
      from: incoming.contactEmail ?? incoming.contactId,
      subject: incoming.subject,
      message: incoming.message,
    });

    if (classification.kind === "other") {
      return {
        ok: true,
        agentId: agent.id,
        status: "ignored_gmail_non_client_message",
        classificationReason: classification.reason,
      };
    }
  }

  const existingConversation = await deps.db.conversation.findUnique({
    where: {
      agentId_contactId: {
        agentId: agent.id,
        contactId: incoming.contactId,
      },
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (
    args.channel === ChannelType.INSTAGRAM &&
    !incoming.isBusinessManualReply &&
    !existingConversation &&
    deps.inspectInstagramConversationHistory
  ) {
    const preflight = await deps.inspectInstagramConversationHistory({
      agent,
      contactId: incoming.contactId,
      messageId: incoming.messageId,
    });

    if (preflight.status === "prior_history_found") {
      const conversation = await recordInboundMessageWithDb(deps.db, {
        agentId: agent.id,
        contactId: incoming.contactId,
        contactUsername: incoming.contactUsername,
        contactDisplayName: incoming.contactDisplayName,
        channel: agent.channel.type,
        message: incoming.message,
        messageId: incoming.messageId,
        gmailMessageId: incoming.gmailMessageId,
        threadId: incoming.threadId,
        subject: incoming.subject,
        conversationStatus: ConversationStatus.ESCALATED,
      });

      return {
        ok: true,
        agentId: agent.id,
        conversationId: conversation.id,
        status: "instagram_prior_history_manual_only",
        priorMessageCount: preflight.priorMessageCount,
        instagramConversationId: preflight.conversationId,
      };
    }
  }

  if (agent.status === AgentStatus.PAUSED) {
    const conversation = incoming.isBusinessManualReply
      ? await recordBusinessManualMessageWithDb(deps.db, {
          agentId: agent.id,
          contactId: incoming.contactId,
          contactUsername: incoming.contactUsername,
          contactDisplayName: incoming.contactDisplayName,
          channel: agent.channel.type,
          message: incoming.message,
          messageId: incoming.messageId,
          gmailMessageId: incoming.gmailMessageId,
          threadId: incoming.threadId,
          subject: incoming.subject,
        })
      : await recordInboundMessageWithDb(deps.db, {
          agentId: agent.id,
          contactId: incoming.contactId,
          contactUsername: incoming.contactUsername,
          contactDisplayName: incoming.contactDisplayName,
          channel: agent.channel.type,
          message: incoming.message,
          messageId: incoming.messageId,
          gmailMessageId: incoming.gmailMessageId,
          threadId: incoming.threadId,
          subject: incoming.subject,
          conversationStatus: existingConversation?.status,
        });

    return {
      ok: true,
      agentId: agent.id,
      conversationId: conversation.id,
      status: incoming.isBusinessManualReply
        ? "business_manual_reply_recorded_agent_paused"
        : "inbound_recorded_agent_paused",
    };
  }

  const agentSettings = getRuntimeAgentSettingsConfig(agent.channelConfig);
  const control = getRuntimeControlConfig(agent.channelConfig);
  const messageBehavior = readMessageBehaviorConfig(agent.channelConfig);
  const runtimeType = getRuntimeType(agent.channelConfig);
  const useWeddingSalesSimpleRuntime = shouldUseWeddingSalesSimpleRuntime({
    channel: args.channel,
    runtimeType,
  });
  const replyContext = {
    contactId: incoming.contactId,
    contactEmail: incoming.contactEmail,
    messageId: incoming.messageId,
    gmailMessageId: incoming.gmailMessageId,
    threadId: incoming.threadId,
    subject: incoming.subject,
  };

  if (incoming.isBusinessManualReply) {
    const priorMessages = existingConversation
      ? await deps.db.message.findMany({
          where: {
            conversationId: existingConversation.id,
          },
          orderBy: {
            createdAt: "asc",
          },
        })
      : [];
    const priorBusinessManualMessageCount = priorMessages.filter(
      (message) =>
        message.role === MessageRole.TOOL &&
        message.toolName === BUSINESS_MANUAL_MESSAGE_TOOL_NAME,
    ).length;
    const conversation = await recordBusinessManualMessageWithDb(deps.db, {
      agentId: agent.id,
      contactId: incoming.contactId,
      contactUsername: incoming.contactUsername,
      contactDisplayName: incoming.contactDisplayName,
      channel: agent.channel.type,
      message: incoming.message,
      messageId: incoming.messageId,
      gmailMessageId: incoming.gmailMessageId,
      threadId: incoming.threadId,
      subject: incoming.subject,
    });
    const shouldPause =
      incoming.businessReplyKind === "system_echo"
        ? false
        : shouldPauseAfterBusinessManualMessage({
            control,
            message: incoming.message,
            priorBusinessManualMessageCount,
          });

    if (shouldPause) {
      await pauseConversationForBusinessHandoffWithDb({
        database: deps.db,
        conversationId: conversation.id,
        agentId: agent.id,
        control,
        replyContext: getLatestCustomerReplyContext(priorMessages, incoming.contactId),
        now: incoming.eventTimestamp,
      });
    }

    return {
      ok: true,
      agentId: agent.id,
      conversationId: conversation.id,
      status: shouldPause ? "business_handoff_paused" : "business_manual_reply_recorded",
    };
  }
  const inboundPolicy = getInboundConversationPolicy({
    agentSettings,
    existingConversationStatus: existingConversation?.status,
    now: incoming.eventTimestamp,
  });

  if (inboundPolicy === "waiting_for_manual_dialog_activation") {
    const conversation = await recordInboundMessageWithDb(deps.db, {
      agentId: agent.id,
      contactId: incoming.contactId,
      contactUsername: incoming.contactUsername,
      contactDisplayName: incoming.contactDisplayName,
      channel: agent.channel.type,
      message: incoming.message,
      messageId: incoming.messageId,
      gmailMessageId: incoming.gmailMessageId,
      threadId: incoming.threadId,
      subject: incoming.subject,
      conversationStatus: ConversationStatus.ESCALATED,
    });
    await cancelPendingDelayedDeliveriesWithDb({
      database: deps.db,
      conversationId: conversation.id,
      kinds: [DelayedDeliveryKind.FOLLOW_UP],
      excludeBusinessAutoResume: true,
    });

    return {
      ok: true,
      agentId: agent.id,
      conversationId: conversation.id,
      status: "waiting_for_manual_dialog_activation",
    };
  }

  if (inboundPolicy === "waiting_for_schedule_window") {
    const conversation = await recordInboundMessageWithDb(deps.db, {
      agentId: agent.id,
      contactId: incoming.contactId,
      contactUsername: incoming.contactUsername,
      contactDisplayName: incoming.contactDisplayName,
      channel: agent.channel.type,
      message: incoming.message,
      messageId: incoming.messageId,
      gmailMessageId: incoming.gmailMessageId,
      threadId: incoming.threadId,
      subject: incoming.subject,
      conversationStatus: existingConversation?.status ?? ConversationStatus.ACTIVE,
    });
    await cancelPendingDelayedDeliveriesWithDb({
      database: deps.db,
      conversationId: conversation.id,
      kinds: [DelayedDeliveryKind.FOLLOW_UP],
    });
    const latestInboundMessage = await deps.db.message.findFirst({
      where: {
        conversationId: conversation.id,
        role: MessageRole.USER,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
      },
    });
    const nextWindow = findNextAgentScheduleWindowStart(
      agentSettings,
      incoming.eventTimestamp ?? new Date(),
    );

    if (nextWindow) {
      await scheduleBufferedReplyWithDb({
        database: deps.db,
        agentId: agent.id,
        conversationId: conversation.id,
        dueAt: nextWindow,
        replyContext,
        triggerMessageId: latestInboundMessage?.id,
      });
    }

    return {
      ok: true,
      agentId: agent.id,
      conversationId: conversation.id,
      status: "waiting_for_schedule_window",
    };
  }

  if (inboundPolicy === "closed_conversation") {
    const conversation = await recordInboundMessageWithDb(deps.db, {
      agentId: agent.id,
      contactId: incoming.contactId,
      contactUsername: incoming.contactUsername,
      contactDisplayName: incoming.contactDisplayName,
      channel: agent.channel.type,
      message: incoming.message,
      messageId: incoming.messageId,
      gmailMessageId: incoming.gmailMessageId,
      threadId: incoming.threadId,
      subject: incoming.subject,
      conversationStatus: ConversationStatus.CLOSED,
    });
    await cancelPendingDelayedDeliveriesWithDb({
      database: deps.db,
      conversationId: conversation.id,
      kinds: [DelayedDeliveryKind.FOLLOW_UP],
    });

    return {
      ok: true,
      agentId: agent.id,
      conversationId: conversation.id,
      status: "closed_conversation_requires_review",
    };
  }

  const ownerHandoff = shouldRequestOwnerHandoff(incoming.message);

  if (
    ownerHandoff &&
    (args.channel === ChannelType.GMAIL || args.channel === ChannelType.INSTAGRAM) &&
    (await hasConnectedOwnerTelegram(agent.tenantId, deps.db))
  ) {
    const conversation = await recordInboundMessageWithDb(deps.db, {
      agentId: agent.id,
      contactId: incoming.contactId,
      contactUsername: incoming.contactUsername,
      contactDisplayName: incoming.contactDisplayName,
      channel: agent.channel.type,
      message: incoming.message,
      messageId: incoming.messageId,
      gmailMessageId: incoming.gmailMessageId,
      threadId: incoming.threadId,
      subject: incoming.subject,
      conversationStatus: existingConversation?.status ?? ConversationStatus.ACTIVE,
    });
    const handoff = await requestOwnerHandoffWithDb({
      database: deps.db,
      agent,
      conversationId: conversation.id,
      customerMessage: incoming.message,
      reason: ownerHandoff.reason,
    });

    if (handoff.status === "owner_handoff_requested") {
      return {
        ok: true,
        agentId: agent.id,
        conversationId: conversation.id,
        status: handoff.status,
      };
    }
  }

  if (
    !useWeddingSalesSimpleRuntime &&
    args.channel !== ChannelType.GMAIL &&
    messageBehavior.bufferDelaySeconds > 0
  ) {
    const conversation = await recordInboundMessageWithDb(deps.db, {
      agentId: agent.id,
      contactId: incoming.contactId,
      contactUsername: incoming.contactUsername,
      contactDisplayName: incoming.contactDisplayName,
      channel: agent.channel.type,
      message: incoming.message,
      messageId: incoming.messageId,
      gmailMessageId: incoming.gmailMessageId,
      threadId: incoming.threadId,
      subject: incoming.subject,
      conversationStatus: existingConversation?.status ?? ConversationStatus.ACTIVE,
    });
    await cancelPendingDelayedDeliveriesWithDb({
      database: deps.db,
      conversationId: conversation.id,
      kinds: [DelayedDeliveryKind.FOLLOW_UP],
    });

    const latestInboundMessage = await deps.db.message.findFirst({
      where: {
        conversationId: conversation.id,
        role: MessageRole.USER,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
      },
    });
    const bufferedDueAt = new Date(Date.now() + messageBehavior.bufferDelaySeconds * 1000);
    const bufferedDelivery = await scheduleBufferedReplyWithDb({
      database: deps.db,
      agentId: agent.id,
      conversationId: conversation.id,
      dueAt: bufferedDueAt,
      replyContext,
      triggerMessageId: latestInboundMessage?.id,
    });

    return {
      ok: true,
      agentId: agent.id,
      conversationId: conversation.id,
      bufferedDeliveryId: bufferedDelivery.id,
      bufferedDueAt,
      status: "buffered_reply_scheduled",
    };
  }

  const result =
    useWeddingSalesSimpleRuntime
      ? await runWeddingSalesSimpleRuntime({
          database: deps.db,
          agent,
          incoming,
          channel: args.channel,
          existingConversationStatus: existingConversation?.status,
        })
      : shouldUseWeddingSalesRuntime({ channel: args.channel, runtimeType })
      ? await runWeddingSalesRuntime({
          database: deps.db,
          agent,
          incoming,
          channel: args.channel,
          existingConversationStatus: existingConversation?.status,
        })
      : await deps.invokeAgent({
          tenantId: agent.tenantId,
          agentId: agent.id,
          channel: args.channel,
          contactId: incoming.contactId,
          contactEmail: incoming.contactEmail,
          message: incoming.message,
          messageId: incoming.messageId,
          gmailMessageId: incoming.gmailMessageId,
          threadId: incoming.threadId,
          subject: incoming.subject,
        });

  if (result.suppressReply) {
    if (result.conversationId) {
      await cancelPendingDelayedDeliveriesWithDb({
        database: deps.db,
        conversationId: result.conversationId,
        kinds: [DelayedDeliveryKind.FOLLOW_UP],
      });
    }

    return {
      ok: true,
      agentId: agent.id,
      conversationId: result.conversationId,
      status: "reply_suppressed_by_control",
      usedTooling: result.usedTooling,
    };
  }

  const agentStillActive = await deps.db.agent.findFirst({
    where: {
      id: agent.id,
      status: AgentStatus.ACTIVE,
    },
    select: {
      id: true,
    },
  });

  if (!agentStillActive) {
    if (result.conversationId) {
      await cancelPendingDelayedDeliveriesWithDb({
        database: deps.db,
        conversationId: result.conversationId,
      });
    }

    return {
      ok: true,
      agentId: agent.id,
      conversationId: result.conversationId,
      status: "reply_suppressed_agent_paused",
      usedTooling: result.usedTooling,
    };
  }

  const formattedReply = adapter.formatReply(result.message, agent.channelConfig);
  const outboundMessage = formattedReply as string | string[] | { text: string; html?: string };

  const delivery = await adapter.sendReply({
    credentials:
      args.channel === ChannelType.GMAIL
        ? agent.channel.credentialsEnc
        : deps.decrypt(agent.channel.credentialsEnc),
    contactId: incoming.contactId,
    message: outboundMessage,
    messageId: incoming.messageId,
    threadId: incoming.threadId,
    subject: incoming.subject,
    attachments:
      messageBehavior.allowAttachments || args.channel === ChannelType.INSTAGRAM
        ? result.attachments
        : undefined,
    channelConfig: agent.channelConfig,
  });

  if (args.channel === ChannelType.INSTAGRAM && result.conversationId) {
    await recordInstagramOutboundDeliveries({
      database: deps.db,
      conversationId: result.conversationId,
      delivery,
    });
  }

  if (isPartialDeliveryResult(delivery)) {
    return {
      ok: true,
      agentId: agent.id,
      conversationId: result.conversationId,
      delivery,
      reply: result.message,
      usedTooling: result.usedTooling,
      status: "partial_delivery_requires_review",
    };
  }

  if (result.conversationId) {
    await cancelPendingDelayedDeliveriesWithDb({
      database: deps.db,
      conversationId: result.conversationId,
      kinds: [DelayedDeliveryKind.FOLLOW_UP],
    });

    const agentActiveAfterDelivery = await deps.db.agent.findFirst({
      where: {
        id: agent.id,
        status: AgentStatus.ACTIVE,
      },
      select: {
        id: true,
      },
    });

    if (agentActiveAfterDelivery) {
      await scheduleFollowUpsForReplyWithDb({
        database: deps.db,
        agentId: agent.id,
        conversationId: result.conversationId,
        channelConfig: agent.channelConfig,
        replyContext,
        anchorCreatedAt: new Date(),
        usedTooling: result.usedTooling,
      });
    }
  }

  return {
    ok: true,
    agentId: agent.id,
    conversationId: result.conversationId,
    delivery,
    reply: result.message,
    usedTooling: result.usedTooling,
  };
}

export async function handleIncomingEvent(args: {
  agentId: string;
  channel: ChannelType;
  payload: unknown;
}) {
  return handleIncomingEventWithDeps(args, {
    db,
    getChannelAdapter,
    invokeAgent,
    decrypt,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    inspectInstagramConversationHistory,
  });
}

