import { openai } from "@ai-sdk/openai";
import {
  AgentEventType,
  AgentStatus,
  ChannelType,
  ConversationStatus,
  DelayedDeliveryKind,
  FeatureType,
  MessageRole,
  Prisma,
} from "@prisma/client";
import { APICallError, generateText, stepCountIs, tool, type ToolSet } from "ai";
import { z } from "zod";

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
  type RuntimeToolFeature,
} from "@/lib/agent-config";
import { loadConversationHistory, saveMessages } from "@/lib/agent-memory";
import { getChannelAdapter } from "@/lib/channels";
import { parseInstagramCredentials } from "@/lib/channels/instagram";
import { decrypt } from "@/lib/crypto";
import { db } from "@/lib/db";
import { recordAgentEventsBestEffort } from "@/lib/agent-events";
import {
  buildMyndfulGuideConfig,
  getMyndfulGuide,
  normalizeMyndfulServiceRegion,
  type MyndfulServiceRegion,
} from "@/lib/agents/myndful/guide-config";
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
  recordDeliveryFailedWithDb,
  recordSuccessfulRuntimeTurnWithDb,
} from "@/lib/runtime-observability";
import {
  OWNER_HANDOFF_REQUEST_TOOL_NAME,
  hasConnectedOwnerTelegram,
  notifyOwnerOfHandoffUpdateWithDb,
  requestOwnerHandoffWithDb,
  shouldRequestOwnerHandoff,
} from "@/lib/owner-handoff";

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

export type RuntimeHistoryMessage = {
  role: MessageRole;
  content: string;
  toolName?: string | null;
  toolResult?: unknown;
  durationMs?: number;
  createdAt?: Date;
  model?: string | null;
};

export type InvokeAgentResult = {
  message: string;
  promptPreview: string;
  usedTooling: string[];
  toolExecutions?: Array<{
    toolName: string;
    toolInput: unknown;
    toolResult: unknown;
    durationMs?: number;
  }>;
  conversationId?: string;
  model?: string;
  attachments?: RuntimeAttachment[];
  historyAppend?: RuntimeHistoryMessage[];
  suppressReply?: boolean;
};

function buildPublicGoogleDriveDownloadUrl(fileId?: string) {
  const trimmed = fileId?.trim();

  if (!trimmed) {
    return undefined;
  }

  return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(trimmed)}`;
}

function getMyndfulGuideAttachment(args: {
  channel: ChannelType | string;
  message: string;
  config: ReturnType<typeof buildMyndfulGuideConfig>;
  allowAttachments: boolean;
  region: MyndfulServiceRegion;
}) {
  if (
    (!args.allowAttachments && args.channel !== ChannelType.INSTAGRAM) ||
    !/\bguide\b/i.test(args.message)
  ) {
    return [];
  }

  const guide = getMyndfulGuide(args.config, args.region);
  if (!guide) {
    return [];
  }
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

function getConfiguredGuideRegionsFromCustomerMessages(args: {
  agent: AgentWithConfigData;
  customerMessages: string[];
}) {
  const rawChannelConfig = getChannelConfigObject(args.agent.channelConfig as never);
  const functionBlocks = Array.isArray(rawChannelConfig.functionBlocks)
    ? rawChannelConfig.functionBlocks
    : [];
  const availabilityBlock = functionBlocks.find(
    (block) =>
      block &&
      typeof block === "object" &&
      !Array.isArray(block) &&
      "name" in block &&
      String(block.name).trim().toLowerCase() === "check wedding availability",
  );
  const steps =
    availabilityBlock && typeof availabilityBlock === "object" && "steps" in availabilityBlock &&
    Array.isArray(availabilityBlock.steps)
      ? availabilityBlock.steps
      : [];
  const configuredAliases = steps.flatMap((step) => {
    if (!step || typeof step !== "object" || Array.isArray(step) || !("params" in step)) {
      return [];
    }

    const rawParams = step.params;
    if (typeof rawParams !== "string") {
      return [];
    }

    try {
      const parsed = JSON.parse(rawParams) as { capacityRules?: unknown };
      if (!Array.isArray(parsed.capacityRules)) {
        return [];
      }

      return parsed.capacityRules.flatMap((rule) => {
        if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
          return [];
        }

        const record = rule as Record<string, unknown>;
        const region = normalizeMyndfulServiceRegion(
          typeof record.region === "string" ? record.region : undefined,
        );
        const aliases = Array.isArray(record.aliases)
          ? record.aliases.filter((alias): alias is string => typeof alias === "string")
          : [];

        return region ? aliases.map((alias) => ({ region, alias: alias.toLowerCase() })) : [];
      });
    } catch {
      return [];
    }
  });
  const customerText = args.customerMessages.join("\n").toLowerCase();

  return new Set(
    configuredAliases
      .filter(({ alias }) => alias.length > 0 && customerText.includes(alias))
      .map(({ region }) => region),
  );
}

function buildConfiguredCollectionsGuideTool(args: {
  agent: AgentWithConfigData;
  establishedRegions: ReadonlySet<string>;
  onToolResult: (entry: {
    toolName: string;
    toolInput: Prisma.JsonValue;
    toolResult: Prisma.JsonValue;
    durationMs?: number;
  }) => void;
}) {
  const config = buildMyndfulGuideConfig(args.agent.channelConfig);
  const rawChannelConfig = getChannelConfigObject(args.agent.channelConfig as never);
  const configuredRegions = ["FL", "NC_SC_GA"] as const;
  const hasGuide = configuredRegions.some((serviceRegion) =>
    getMyndfulGuideAttachment({
      channel: args.agent.channel.type,
      message: "collections guide",
      config,
      allowAttachments: true,
      region: serviceRegion,
    }).length > 0,
  );

  if (!hasGuide) {
    return null;
  }

  return tool({
    description:
      "Send the configured regional Myndful collections guide as an attachment. Use only when the customer has stated a wedding city/state that establishes this region in the current or recent conversation, or when a successful availability result for this region is present in the current conversation. Never choose a default region or infer one solely because the customer asked for pricing. If region is not established, ask for the wedding city/state instead.",
    inputSchema: z.object({
      serviceRegion: z
        .enum(["FL", "NC_SC_GA"])
        .describe("FL for Florida, or NC_SC_GA for North Carolina, South Carolina, or Georgia."),
    }),
    execute: async ({ serviceRegion }) => {
      const startedAt = Date.now();
      const isEstablishedRegion = args.establishedRegions.has(serviceRegion);
      if (!isEstablishedRegion) {
        const output = {
          status: "blocked_precondition",
          serviceRegion,
          missing: ["wedding city/state or a prior availability result for this region"],
          summary:
            "Do not attach a regional guide yet. The customer has not established this wedding region. Give the approved starting prices and ask naturally for the wedding city/state.",
        };

        args.onToolResult({
          toolName: "send_collections_guide",
          toolInput: { serviceRegion },
          toolResult: output,
          durationMs: Date.now() - startedAt,
        });

        return output;
      }
      const attachment = getMyndfulGuideAttachment({
        channel: args.agent.channel.type,
        message: "collections guide",
        config,
        allowAttachments: true,
        region: serviceRegion,
      })[0];
      const pricing = config.pricingByRegion?.[serviceRegion];
      const rawPricingByRegion =
        rawChannelConfig.pricingByRegion &&
        typeof rawChannelConfig.pricingByRegion === "object" &&
        !Array.isArray(rawChannelConfig.pricingByRegion)
          ? (rawChannelConfig.pricingByRegion as Record<string, unknown>)
          : {};
      const rawRegionalPricing = rawPricingByRegion[serviceRegion];
      const rawPromotionText =
        rawRegionalPricing &&
        typeof rawRegionalPricing === "object" &&
        !Array.isArray(rawRegionalPricing) &&
        "promotionText" in rawRegionalPricing
          ? (rawRegionalPricing as Record<string, unknown>).promotionText
          : undefined;
      const promotionText = typeof rawPromotionText === "string" ? rawPromotionText.trim() : "";
      const output = attachment
        ? {
            status: "ready_to_attach",
            serviceRegion,
            ...(pricing?.startPrice ? { startPrice: pricing.startPrice } : {}),
            ...(promotionText ? { promotionText } : {}),
            attachment,
            summary: "The correct regional collections guide will be attached to this reply.",
          }
        : {
            status: "not_configured",
            serviceRegion,
            summary: "No collections guide is configured for that region.",
          };

      args.onToolResult({
        toolName: "send_collections_guide",
        toolInput: { serviceRegion },
        toolResult: output,
        durationMs: Date.now() - startedAt,
      });

      return output;
    },
  });
}

function mergeRuntimeAttachments(...groups: Array<RuntimeAttachment[] | undefined>) {
  const merged = new Map<string, RuntimeAttachment>();

  for (const group of groups) {
    for (const attachment of group ?? []) {
      const key = attachment.publicUrl ?? attachment.fileId;

      if (key) {
        merged.set(key, attachment);
      }
    }
  }

  return [...merged.values()];
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

type IncomingEventAgent = Pick<
  AgentWithConfigData,
  "id" | "tenantId" | "channelConfig" | "channel"
> & {
  features?: AgentWithConfigData["features"];
};

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

const OWNER_HANDOFF_RUNTIME_TOOL_NAME = "tool_4_owner_handoff_request";
const ALLOWED_EMOJIS = ["🤍", "✨", "🎥"] as const;
const FALSE_CONFIRMATION_PATTERNS = [
  /\b(?:you(?:'re| are)\s+all\s+set|all\s+set for)\b/i,
  /\bbooking is confirmed\b/i,
  /\b(?:call|consultation|meeting|appointment|slot|calendar|invite)\s+(?:is\s+)?booked\b/i,
  /\b(?:call|consultation|meeting|appointment|slot|calendar|invite)\s+(?:is\s+)?confirmed\b/i,
] as const;

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

function stripDecorativeQuestionMarkEmoji(text: string) {
  return text.replace(/([A-Za-z])\s+\?(?=\s{2,}|\s*\n|$)/g, "$1");
}

function stripInternalPlanningPreamble(text: string) {
  return text
    .replace(
      /^\s*(?:we need|need to|we should|should)\b[\s\S]{0,400}?(?=(?:absolutely|of course|sure|hey|hi|got|totally|happy|i\b|what|could|can|once|that|perfect|ah)\b)/i,
      "",
    )
    .trim();
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
      message?: string;
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

function classifyInstagramPriorMessages(args: {
  messages: NonNullable<InstagramConversationDetailPayload["messages"]>["data"];
  currentMessageId?: string;
}) {
  const currentMessageId = args.currentMessageId?.trim() ?? "";
  const priorMessages = (args.messages ?? []).filter((message) => {
    const messageId = message.id?.trim() ?? "";

    if (!messageId || messageId === currentMessageId) {
      return false;
    }

    return Boolean(message.message?.trim());
  });

  return {
    priorMessages,
    ignoredEmptyMessageCount: (args.messages ?? []).filter((message) => {
      const messageId = message.id?.trim() ?? "";
      return Boolean(messageId && messageId !== currentMessageId && !message.message?.trim());
    }).length,
  };
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
      "messages.limit(25){id,from,created_time,message}",
    );

    const detail = await fetchInstagramGraphJson<InstagramConversationDetailPayload>(
      conversationUrl,
      credentials.pageAccessToken,
    );
    const priorClassification = classifyInstagramPriorMessages({
      messages: detail.messages?.data,
      currentMessageId: args.messageId,
    });

    if (priorClassification.priorMessages.length > 0) {
      return {
        status: "prior_history_found",
        conversationId: conversation.id,
        priorMessageCount: priorClassification.priorMessages.length,
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
  historyMessages?: RuntimeHistoryMessage[];
  preserveModelVoice?: boolean;
  toolExecutions: Array<{
    toolName: string;
    toolResult: unknown;
  }>;
}) {
  if (args.preserveModelVoice) {
    return args.text.trim();
  }

  const customerFacingText = stripInternalPlanningPreamble(args.text);
  const noDecorativeQuestionMark = stripDecorativeQuestionMarkEmoji(customerFacingText);
  const noUnexpectedScript = stripUnexpectedScriptFragments(noDecorativeQuestionMark);
  const noRogueEmoji = sanitizeAllowedEmojis(noUnexpectedScript);
  const guardedText = softenFalseBookingConfirmation({
    text: noRogueEmoji,
    toolExecutions: args.toolExecutions,
  });
  const simulatedText = convertSimulatedBookingLanguage({
    text: guardedText,
    toolExecutions: args.toolExecutions,
  });
  const availabilityPronounSafeText = rewriteCustomerOpenAvailabilityPhrase(simulatedText);

  return rewriteIncompleteWeddingDateReply({
    text: availabilityPronounSafeText,
    currentMessage: args.currentMessage,
    historyMessages: args.historyMessages,
    toolExecutions: args.toolExecutions,
  });
}

function stripUnexpectedScriptFragments(text: string) {
  return text
    .replace(/[\u0530-\u058f\u0400-\u04ff\u0590-\u05ff\u0600-\u06ff\u0900-\u097f]+/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+([,.!?])/g, "$1")
    .trim();
}

function rewriteCustomerOpenAvailabilityPhrase(text: string) {
  return text
    .replace(
      /\bYou(?:['’]re| are)\s+open\s+for\s+((?:[A-Z][a-z]+\s+)?[A-Z][a-z]+\s+\d{1,2}(?:,\s*)?\s+\d{4})/g,
      "That date is open for $1",
    )
    .replace(
      /\byou(?:['’]re| are)\s+open\s+for\s+((?:[A-Z][a-z]+\s+)?[A-Z][a-z]+\s+\d{1,2}(?:,\s*)?\s+\d{4})/gi,
      "that date is open for $1",
    );
}

function looksLikeServiceCapabilityQuestion(text: string) {
  return /\b(?:do you|can you|could you|are you able to|do y'all|do you guys)\b[\s\S]{0,80}\b(?:offer|provide|do|film|shoot|capture|include)\b/i.test(
    text,
  );
}

function looksLikeDirectServiceCapabilityDenial(text: string) {
  const normalized = text.replace(/[’]/g, "'");

  return (
    /\b(?:we|i)\s+(?:don'?t|do not)\s+(?:usually\s+|normally\s+|currently\s+)?(?:offer|provide|do|film|shoot|capture|include)\b/i.test(
      normalized,
    ) ||
    /\bi\s+haven'?t\s+done\b[\s\S]{0,120}\b(?:but|though)\b/i.test(normalized) ||
    /\b(?:i'?d|we'?d)\s+love\s+to\b[\s\S]{0,120}\b(?:see|check|double-check|talk)\b[\s\S]{0,120}\b(?:possible|make it happen)\b/i.test(
      normalized,
    )
  );
}

function looksLikeUngroundedServiceDenial(text: string) {
  return /\b(?:we|i)\s+(?:don['’]?t|do not)\s+(?:offer|provide|do|film|shoot|capture|include)\b|\bnot\s+(?:a\s+)?standard\s+service\b|^\s*not\s+[\s\S]{0,120}\bno\b/i.test(
    text,
  );
}

function shouldPostModelHandoffForUnknownFact(args: {
  currentMessage: string;
  assistantText: string;
  toolExecutions: Array<{ toolName: string; toolInput: unknown; toolResult: unknown }>;
}) {
  if (hasOwnerHandoffToolExecution(args.toolExecutions)) {
    return false;
  }

  return (
    looksLikeServiceCapabilityQuestion(args.currentMessage) &&
    (looksLikeDirectServiceCapabilityDenial(args.assistantText) ||
      looksLikeUngroundedServiceDenial(args.assistantText))
  );
}

async function requestPostModelUnknownFactHandoff(args: {
  agent: AgentWithConfigData;
  input: InvokeAgentInput;
  conversationId?: string;
}) {
  const toolInput = {
    reason: "unknown_business_fact",
    question: args.input.message,
    noteForOwner:
      "The model produced an ungrounded service-capability denial. Owner/team should confirm instead.",
  } satisfies Prisma.JsonObject;
  let toolResult: Prisma.JsonObject;

  if (args.input.testMode || !args.conversationId) {
    toolResult = {
      status: "owner_handoff_test_mode",
      reason: "unknown_business_fact",
      question: args.input.message,
      summary: "Owner handoff would be requested and the conversation would pause.",
    };
  } else {
    const handoff = await requestOwnerHandoffWithDb({
      database: db,
      agent: args.agent,
      conversationId: args.conversationId,
      customerMessage: args.input.message,
      reason: "unknown_business_fact",
    });
    toolResult = {
      status: handoff.status,
      reason: "unknown_business_fact",
      question: args.input.message,
      summary:
        handoff.status === "owner_handoff_requested"
          ? "Owner handoff was requested and the conversation was paused."
          : "Owner handoff could not be completed.",
    };
  }

  return {
    toolName: OWNER_HANDOFF_REQUEST_TOOL_NAME,
    toolInput,
    toolResult,
    durationMs: 0,
  };
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

function messageHasWeddingMonthYearWithoutDay(message: string) {
  const withoutQuotedHeader = message
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => !/<[^>\s]+@[^>]+>:\s*$/.test(line.trim()))
    .join("\n")
    .toLowerCase();
  const monthName =
    "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|sept|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
  const monthYear = new RegExp(`\\b${monthName}\\s+(?:19|20)\\d{2}\\b`, "i");
  const yearMonth = new RegExp(`\\b(?:19|20)\\d{2}\\s+${monthName}\\b`, "i");
  const monthDayYear = new RegExp(
    `\\b(?:${monthName}\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,)?\\s+(?:19|20)\\d{2}|\\d{1,2}(?:st|nd|rd|th)?\\s+${monthName}\\s+(?:19|20)\\d{2})\\b`,
    "i",
  );

  return !monthDayYear.test(withoutQuotedHeader) && (monthYear.test(withoutQuotedHeader) || yearMonth.test(withoutQuotedHeader));
}

function messageHasWeddingExactDateWithYear(message: string) {
  const withoutQuotedHeader = message
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => !/<[^>\s]+@[^>]+>:\s*$/.test(line.trim()))
    .join("\n")
    .toLowerCase();
  const monthName =
    "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|sept|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
  const monthDayYear = new RegExp(
    `\\b(?:${monthName}\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,)?\\s+(?:19|20)\\d{2}|\\d{1,2}(?:st|nd|rd|th)?\\s+${monthName}\\s+(?:19|20)\\d{2})\\b`,
    "i",
  );
  const isoDate = /\b(?:19|20)\d{2}-\d{2}-\d{2}\b/;

  return monthDayYear.test(withoutQuotedHeader) || isoDate.test(withoutQuotedHeader);
}

function textHasMyndfulServiceRegion(text: string) {
  return /\b(?:raleigh|charlotte|asheville|north carolina|south carolina|georgia|charleston|greenville|atlanta|nc\b|sc\b|ga\b|florida|tampa|miami|orlando|palm beach|fort lauderdale|\bfl\b)\b/i.test(
    text,
  );
}

function recentHistoryHasMyndfulServiceRegion(historyMessages?: RuntimeHistoryMessage[]) {
  return [...(historyMessages ?? [])]
    .reverse()
    .filter((message) => message.role === MessageRole.USER || message.role === MessageRole.ASSISTANT)
    .slice(0, 10)
    .some((message) => textHasMyndfulServiceRegion(message.content));
}

function messageLooksLikeConsultationTimeSelection(message: string) {
  return (
    /\b(?:consult|consultation|call|zoom|meet|meeting|chat)\b/i.test(message) ||
    /\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i.test(message)
  );
}

function extractWeddingMonthYearPhrase(message: string) {
  const monthName =
    "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|sept|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
  const normalized = message.replace(/\s+/g, " ");
  const monthYear = new RegExp(`\\b${monthName}\\s+((?:19|20)\\d{2})\\b`, "i").exec(normalized);
  if (monthYear?.[1] && monthYear[2]) {
    return `${monthYear[1][0]?.toUpperCase()}${monthYear[1].slice(1)} ${monthYear[2]}`;
  }
  const yearMonth = new RegExp(`\\b((?:19|20)\\d{2})\\s+${monthName}\\b`, "i").exec(normalized);
  if (yearMonth?.[1] && yearMonth[2]) {
    return `${yearMonth[2][0]?.toUpperCase()}${yearMonth[2].slice(1)} ${yearMonth[1]}`;
  }
  return "that month";
}

const weddingMonthNumbers: Record<string, string> = {
  jan: "01",
  january: "01",
  feb: "02",
  february: "02",
  mar: "03",
  march: "03",
  apr: "04",
  april: "04",
  may: "05",
  jun: "06",
  june: "06",
  jul: "07",
  july: "07",
  aug: "08",
  august: "08",
  sep: "09",
  sept: "09",
  september: "09",
  oct: "10",
  october: "10",
  nov: "11",
  november: "11",
  dec: "12",
  december: "12",
};

function extractMonthDayKeysFromText(message: string) {
  const withoutQuotedHeader = message
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => !/<[^>\s]+@[^>]+>:\s*$/.test(line.trim()))
    .join("\n")
    .toLowerCase();
  const monthName =
    "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|sept|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
  const keys = new Set<string>();

  for (const match of withoutQuotedHeader.matchAll(new RegExp(`\\b${monthName}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, "gi"))) {
    const month = weddingMonthNumbers[String(match[1]).toLowerCase()];
    const day = String(match[2]).padStart(2, "0");
    if (month) {
      keys.add(`${month}-${day}`);
    }
  }

  for (const match of withoutQuotedHeader.matchAll(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${monthName}\\b`, "gi"))) {
    const day = String(match[1]).padStart(2, "0");
    const month = weddingMonthNumbers[String(match[2]).toLowerCase()];
    if (month) {
      keys.add(`${month}-${day}`);
    }
  }

  return keys;
}

function getStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function collectSuggestedWeddingDates(value: unknown, dates = new Set<string>()) {
  if (!value || typeof value !== "object") {
    return dates;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      collectSuggestedWeddingDates(entry, dates);
    }
    return dates;
  }

  const record = value as Record<string, unknown>;
  for (const date of getStringArray(record.suggestedDates)) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      dates.add(date);
    }
  }

  if (record.nearestAvailableDates && typeof record.nearestAvailableDates === "object" && !Array.isArray(record.nearestAvailableDates)) {
    const nearest = record.nearestAvailableDates as Record<string, unknown>;
    for (const date of [nearest.before, nearest.after]) {
      if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        dates.add(date);
      }
    }
  }

  for (const entry of Object.values(record)) {
    if (entry && typeof entry === "object") {
      collectSuggestedWeddingDates(entry, dates);
    }
  }

  return dates;
}

function selectedRecentSuggestedWeddingDate(args: {
  historyMessages?: RuntimeHistoryMessage[];
  currentMessage: string;
}) {
  const selectedMonthDays = extractMonthDayKeysFromText(args.currentMessage);
  if (selectedMonthDays.size === 0) {
    return null;
  }

  const recentTools = [...(args.historyMessages ?? [])]
    .reverse()
    .filter((message) => message.role === MessageRole.TOOL)
    .slice(0, 6);

  for (const message of recentTools) {
    const dates = collectSuggestedWeddingDates(message.toolResult);
    const matchedDate = [...dates].find((date) => selectedMonthDays.has(date.slice(5, 10)));

    if (matchedDate) {
      return matchedDate;
    }
  }

  return null;
}

function latestWeddingAvailabilitySnapshot(historyMessages?: RuntimeHistoryMessage[]) {
  const recentTools = [...(historyMessages ?? [])]
    .reverse()
    .filter((message) => message.role === MessageRole.TOOL)
    .slice(0, 8);

  for (const message of recentTools) {
    if (!/(wedding|availability)/i.test(message.toolName ?? "")) {
      continue;
    }

    if (/(calendar|consultation)/i.test(message.toolName ?? "")) {
      continue;
    }

    const toolResult =
      message.toolResult && typeof message.toolResult === "object" && !Array.isArray(message.toolResult)
        ? message.toolResult as Record<string, unknown>
        : {};
    const result = getStepResults(message.toolResult).find((entry) =>
      ["available", "unavailable"].includes(String(entry.status ?? "")),
    );

    if (!result) {
      continue;
    }

    const date = String(result.date ?? result.requestedDate ?? toolResult.weddingDate ?? toolResult.date ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      continue;
    }

    return {
      date,
      status: String(result.status ?? ""),
      location: String(toolResult.location ?? result.location ?? result.requestedRegion ?? result.region ?? ""),
      region: String(result.region ?? result.requestedRegion ?? ""),
      suggestedDates: getStringArray(result.suggestedDates),
    };
  }

  return null;
}

function currentMessageReferencesLatestAvailability(args: {
  currentMessage: string;
  historyMessages?: RuntimeHistoryMessage[];
}) {
  const snapshot = latestWeddingAvailabilitySnapshot(args.historyMessages);
  if (!snapshot) {
    return null;
  }

  const selectedMonthDays = extractMonthDayKeysFromText(args.currentMessage);
  if (!selectedMonthDays.has(snapshot.date.slice(5, 10))) {
    return null;
  }

  return snapshot;
}

function buildRecentWeddingAvailabilityContext(args: {
  currentMessage: string;
  historyMessages?: RuntimeHistoryMessage[];
}) {
  const snapshot = latestWeddingAvailabilitySnapshot(args.historyMessages);
  if (!snapshot) {
    return "";
  }

  const referencesLatest = currentMessageReferencesLatestAvailability(args);
  const lines = [
    "Recent wedding availability context:",
    `- Last checked wedding date: ${snapshot.date}.`,
    snapshot.location ? `- Location/region: ${snapshot.location}.` : "",
    snapshot.region ? `- Capacity region: ${snapshot.region}.` : "",
    `- Last check result: ${snapshot.status}.`,
    snapshot.suggestedDates.length > 0
      ? `- Nearby dates offered by the tool: ${snapshot.suggestedDates.join(", ")}.`
      : "",
    referencesLatest
      ? "- The incoming customer message appears to refer to that same already-checked date."
      : "",
  ].filter(Boolean);

  return lines.join("\n");
}

function buildRequiredWeddingAvailabilityActionNudge(args: {
  currentMessage: string;
  historyMessages?: RuntimeHistoryMessage[];
}) {
  if (!messageHasWeddingExactDateWithYear(args.currentMessage)) {
    return "";
  }

  if (messageLooksLikeConsultationTimeSelection(args.currentMessage)) {
    return "";
  }

  if (
    !textHasMyndfulServiceRegion(args.currentMessage) &&
    !recentHistoryHasMyndfulServiceRegion(args.historyMessages)
  ) {
    return "";
  }

  const latestReference = currentMessageReferencesLatestAvailability(args);
  if (latestReference) {
    return "";
  }

  return `Wedding availability ACTION REQUIRED:
- The customer just provided an exact wedding date and the recent conversation already has a supported wedding city/region.
- Call the wedding availability tool now before asking for names, pricing, or next steps.
- Do not say "I'm checking" or imply availability unless the tool runs and returns a result.`;
}

function buildRequiredConsultationCalendarActionNudge(args: {
  currentMessage: string;
}) {
  if (!messageLooksLikeConsultationTimeSelection(args.currentMessage)) {
    return "";
  }

  if (!/\b(?:consult|consultation|call|zoom|meet|meeting|chat|book|schedule|lock)\b/i.test(args.currentMessage)) {
    return "";
  }

  return `Consultation calendar ACTION REQUIRED:
- The incoming customer message appears to propose or confirm a consultation call time.
- Call the consultation calendar tool before saying the time works or asking for email.
- If the tool says the time is missing or unclear, ask naturally for the exact day/time.`;
}

function getRequiredWeddingAvailabilityToolName(args: {
  requiredActionNudge: string;
  toolFeatures: RuntimeToolFeature[];
}) {
  if (!args.requiredActionNudge) {
    return null;
  }

  return (
    args.toolFeatures.find((feature) => {
      const text = `${feature.name} ${feature.description}`.toLowerCase();

      return text.includes("wedding") && text.includes("availability");
    })?.name ?? null
  );
}

function getRequiredConsultationCalendarToolName(args: {
  requiredActionNudge: string;
  toolFeatures: RuntimeToolFeature[];
}) {
  if (!args.requiredActionNudge) {
    return null;
  }

  return (
    args.toolFeatures.find((feature) => {
      const text = `${feature.name} ${feature.description}`.toLowerCase();

      return text.includes("consultation") && text.includes("calendar");
    })?.name ?? null
  );
}

function getRequiredWeddingAvailabilityToolKey(args: {
  requiredActionNudge: string;
  availableTools: ToolSet;
}) {
  if (!args.requiredActionNudge) {
    return null;
  }

  return (
    Object.keys(args.availableTools).find((toolName) => {
      const normalized = toolName.toLowerCase();
      return normalized.includes("wedding") && normalized.includes("availability");
    }) ?? null
  );
}

function getRequiredConsultationCalendarToolKey(args: {
  requiredActionNudge: string;
  availableTools: ToolSet;
}) {
  if (!args.requiredActionNudge) {
    return null;
  }

  return (
    Object.keys(args.availableTools).find((toolName) => {
      const normalized = toolName.toLowerCase();
      return normalized.includes("consultation") && normalized.includes("calendar");
    }) ?? null
  );
}

function shouldExposeOwnerHandoffTool(input: InvokeAgentInput) {
  const channel = String(input.channel).toUpperCase();
  return channel === ChannelType.INSTAGRAM || channel === ChannelType.GMAIL;
}

function isExplicitHumanRequest(text: string) {
  return /\b(?:real person|human|person|someone|manager|owner|representative|team member)\b/i.test(
    text,
  );
}

function hasOwnerHandoffToolExecution(
  toolExecutions: Array<{ toolName: string; toolInput: unknown; toolResult: unknown }>,
) {
  return toolExecutions.some((execution) => execution.toolName === OWNER_HANDOFF_REQUEST_TOOL_NAME);
}

function ownerHandoffCustomerReply() {
  return "Absolutely — I’ll have Taras/the team step in for you 🤍";
}

function normalizeConfiguredModelId(value: string | undefined) {
  return value?.replace(/(?:\\r|\\n|\r|\n)+/g, "").trim() || undefined;
}

function getFallbackModelId(args: { hasTools: boolean; primaryModelId: string }) {
  const fallbackModelId = normalizeConfiguredModelId(
    args.hasTools
      ? process.env.OPENAI_TOOL_FALLBACK_MODEL || process.env.OPENAI_FALLBACK_MODEL
      : process.env.OPENAI_FALLBACK_MODEL,
  );

  if (!fallbackModelId || fallbackModelId === args.primaryModelId) {
    return null;
  }

  return fallbackModelId;
}

function customerReplyForOwnerHandoff(args: { explicitHumanRequest: boolean }) {
  return args.explicitHumanRequest
    ? "Absolutely - I'll have Taras/the team step in for you."
    : "I want to make sure I give you the right answer, so I'm checking with the team and will get back to you shortly.";
}

function collectErrorValues(error: unknown, seen: Set<unknown> = new Set<unknown>()): unknown[] {
  if (!error || seen.has(error)) {
    return [];
  }

  seen.add(error);
  const values: unknown[] = [error];
  const record = error as { cause?: unknown; errors?: unknown };

  if (record.cause) {
    values.push(...collectErrorValues(record.cause, seen));
  }

  if (Array.isArray(record.errors)) {
    for (const nested of record.errors) {
      values.push(...collectErrorValues(nested, seen));
    }
  }

  return values;
}

function isTechnicalModelFailure(error: unknown) {
  const values = collectErrorValues(error);

  return values.some((value) => {
    const statusCode =
      APICallError.isInstance(value) && typeof value.statusCode === "number"
        ? value.statusCode
        : typeof (value as { statusCode?: unknown })?.statusCode === "number"
          ? ((value as { statusCode: number }).statusCode)
          : null;

    if (statusCode && statusCode >= 500) {
      return true;
    }

    const message = value instanceof Error ? value.message : String(value);
    return /\b(?:server_error|overloaded|timeout|timed out|ECONNRESET|ETIMEDOUT|socket hang up)\b/i.test(
      message,
    );
  });
}

function buildOwnerHandoffTool(args: {
  agent: AgentWithConfigData;
  input: InvokeAgentInput;
  conversationId?: string;
  onToolResult?: (entry: {
    toolName: string;
    toolInput: Prisma.JsonValue;
    toolResult: Prisma.JsonValue;
    durationMs?: number;
  }) => void;
}) {
  if (!shouldExposeOwnerHandoffTool(args.input)) {
    return null;
  }

  return tool({
    description: [
      "Use this when the customer explicitly asks for a real person, human, owner, representative, or team member.",
      "Use this when the customer asks a specific Myndful business fact that is not clearly present in the prompt, knowledge, recent history, or other tools.",
      "Do not use this for normal greetings, pricing, availability, package inclusions, consultation scheduling, thanks, or objections that can be answered from knowledge.",
      "This transfers the conversation to the owner/team with context.",
    ].join(" "),
    inputSchema: z.object({
      reason: z
        .string()
        .trim()
        .min(1)
        .describe("Why the conversation needs owner/team review, for example customer_requests_human or unknown_business_fact."),
      question: z
        .string()
        .trim()
        .min(1)
        .describe("The customer's exact question or request that needs human review."),
      noteForOwner: z
        .string()
        .trim()
        .min(1)
        .optional()
        .describe("Short private context for the owner/team."),
    }),
    execute: async ({ reason, question, noteForOwner }) => {
      const startedAt = Date.now();
      const toolInput = {
        reason,
        question,
        ...(noteForOwner ? { noteForOwner } : {}),
      } satisfies Prisma.JsonObject;
      let output: Prisma.JsonObject;

      if (args.input.testMode || !args.conversationId) {
        output = {
          status: "owner_handoff_test_mode",
          reason,
          question,
          ...(noteForOwner ? { noteForOwner } : {}),
          summary: "Owner handoff would be requested and the conversation would pause.",
        };
      } else {
        const handoff = await requestOwnerHandoffWithDb({
          database: db,
          agent: args.agent,
          conversationId: args.conversationId,
          customerMessage: args.input.message,
          reason,
        });
        output = {
          status: handoff.status,
          reason,
          question,
          ...(noteForOwner ? { noteForOwner } : {}),
          summary:
            handoff.status === "owner_handoff_requested"
              ? "Owner handoff was requested and the conversation was paused."
              : "Owner handoff could not be completed. Do not invent an answer.",
        };
      }

      args.onToolResult?.({
        toolName: OWNER_HANDOFF_REQUEST_TOOL_NAME,
        toolInput,
        toolResult: output,
        durationMs: Date.now() - startedAt,
      });

      return output;
    },
  });
}

function rewriteIncompleteWeddingDateReply(args: {
  text: string;
  currentMessage?: string;
  historyMessages?: RuntimeHistoryMessage[];
  toolExecutions?: Array<{
    toolName: string;
    toolResult: unknown;
  }>;
}) {
  if (!args.currentMessage) {
    return args.text;
  }

  const needsExactDateToolResult = args.toolExecutions?.some((execution) =>
    getStepResults(execution.toolResult).length === 0 &&
    typeof execution.toolResult === "object" &&
    execution.toolResult !== null &&
    !Array.isArray(execution.toolResult) &&
    (execution.toolResult as { status?: unknown }).status === "needs_exact_date",
  );
  const monthDayWithoutYear = messageHasWeddingMonthDayWithoutYear(args.currentMessage);
  const monthYearWithoutDay = messageHasWeddingMonthYearWithoutDay(args.currentMessage) || needsExactDateToolResult;

  if (!monthDayWithoutYear && !monthYearWithoutDay) {
    return args.text;
  }

  const claimsIncompleteDateAvailability =
    /\b(?:works?|could\s+work|works?\s+(?:on\s+my\s+end|for\s+(?:us|me))|is\s+(?:open|available)|looks?\s+(?:open|available))\b/i.test(
      args.text,
    );

  if (monthYearWithoutDay && claimsIncompleteDateAvailability) {
    const monthYear = extractWeddingMonthYearPhrase(args.currentMessage);
    return [
      `${monthYear} is helpful рџ¤Ќ`,
      "I just need the exact wedding date before I can check availability properly.",
      "What day are they looking at?",
    ].join("\n\n");
  }

  const alreadyAsksForMissingDatePart =
    /\b(?:what|which|confirm|share|send|know|need)\b[\s\S]{0,80}\b(?:year|exact\s+(?:wedding\s+)?date|wedding\s+date|day)\b/i.test(
      args.text,
    ) ||
    /\b(?:year|exact\s+(?:wedding\s+)?date|wedding\s+date|day)\b[\s\S]{0,80}\b(?:what|which|confirm|share|send|know|need)\b/i.test(
      args.text,
    ) ||
    /\b(?:this year|next year|or\s+(?:19|20)\d{2})\b/i.test(args.text);

  if (alreadyAsksForMissingDatePart) {
    return args.text;
  }

  if (
    monthDayWithoutYear &&
    selectedRecentSuggestedWeddingDate({
      currentMessage: args.currentMessage,
      historyMessages: args.historyMessages,
    })
  ) {
    return args.text;
  }

  if (monthYearWithoutDay) {
    const monthYear = extractWeddingMonthYearPhrase(args.currentMessage);
    return [
      `${monthYear} is helpful 🤍`,
      "I just need the exact wedding date before I can check availability properly.",
      "What day are they looking at?",
    ].join("\n\n");
  }

  return [
    "That date is helpful 🤍",
    "I just need the wedding year before I can check availability properly.",
    "What year should I use?",
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
  assistantText?: string;
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
    ...(args.assistantText
      ? [
          {
            role: MessageRole.ASSISTANT,
            content: args.assistantText,
          } satisfies RuntimeHistoryMessage,
        ]
      : []),
  ];
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
  },
) {
  const result = await database.$transaction(async (tx) => {
    const existing = await tx.conversation.findUnique({
      where: { agentId_contactId: { agentId: args.agentId, contactId: args.contactId } },
    });
    const conversation =
      existing ??
      (await tx.conversation.create({
        data: {
          agentId: args.agentId,
          contactId: args.contactId,
          contactUsername: args.contactUsername,
          contactDisplayName: args.contactDisplayName,
          channel: args.channel,
          status: args.conversationStatus ?? ConversationStatus.ACTIVE,
        },
      }));

    if (existing && args.conversationStatus && existing.status !== args.conversationStatus) {
      await tx.conversation.update({
        where: { id: existing.id },
        data: { status: args.conversationStatus },
      });
    }

    const inboundMessage = await tx.message.create({
      data: {
        conversationId: conversation.id,
        role: MessageRole.USER,
        content: args.message,
        toolInput: {
          ...(args.messageId ? { messageId: args.messageId } : {}),
          ...(args.gmailMessageId ? { gmailMessageId: args.gmailMessageId } : {}),
          ...(args.threadId ? { threadId: args.threadId } : {}),
          ...(args.subject ? { subject: args.subject } : {}),
        },
      },
    });

    return { conversation, inboundMessage, isNew: !existing };
  });

  await recordAgentEventsBestEffort({
    database,
    agentId: args.agentId,
    conversationId: result.conversation.id,
    channel: args.channel,
    events: [
      ...(result.isNew
        ? [
            {
              type: AgentEventType.CONVERSATION_STARTED,
              dedupeKey: `conversation-started:${result.conversation.id}`,
              occurredAt: result.conversation.createdAt,
            },
          ]
        : []),
      {
        type: AgentEventType.INBOUND_RECEIVED,
        dedupeKey: `inbound:${result.inboundMessage.id}`,
        occurredAt: result.inboundMessage.createdAt,
      },
    ],
  });

  return result.conversation;
}

function isPartialDeliveryResult(delivery: unknown): delivery is {
  ok: false;
  deliveredCount: number;
  totalParts: number;
} {
  return Boolean(
    delivery &&
      typeof delivery === "object" &&
      "ok" in delivery &&
      delivery.ok === false &&
      "deliveredCount" in delivery &&
      "totalParts" in delivery,
  );
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
  },
) {
  return database.$transaction(async (tx) => {
    const existing = await tx.conversation.findUnique({
      where: { agentId_contactId: { agentId: args.agentId, contactId: args.contactId } },
    });
    const conversation =
      existing ??
      (await tx.conversation.create({
        data: {
          agentId: args.agentId,
          contactId: args.contactId,
          contactUsername: args.contactUsername,
          contactDisplayName: args.contactDisplayName,
          channel: args.channel,
        },
      }));
    await tx.message.create({
      data: {
        conversationId: conversation.id,
        role: MessageRole.TOOL,
        content: args.message,
        toolName: BUSINESS_MANUAL_MESSAGE_TOOL_NAME,
        toolInput: {
          ...(args.messageId ? { messageId: args.messageId } : {}),
          ...(args.gmailMessageId ? { gmailMessageId: args.gmailMessageId } : {}),
          ...(args.threadId ? { threadId: args.threadId } : {}),
          ...(args.subject ? { subject: args.subject } : {}),
        },
      },
    });
    return conversation;
  });
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

    const directAttachment = "attachment" in execution.toolResult
      ? execution.toolResult.attachment
      : undefined;
    if (directAttachment && typeof directAttachment === "object" && !Array.isArray(directAttachment)) {
      const fileId = "fileId" in directAttachment ? String(directAttachment.fileId ?? "") : "";

      if (fileId) {
        attachments.set(fileId, {
          source:
            "source" in directAttachment && directAttachment.source === "google_drive"
              ? "google_drive"
              : undefined,
          fileId,
          fileName:
            "fileName" in directAttachment ? String(directAttachment.fileName ?? "") || undefined : undefined,
          mimeType:
            "mimeType" in directAttachment ? String(directAttachment.mimeType ?? "") || undefined : undefined,
          publicUrl:
            "publicUrl" in directAttachment ? String(directAttachment.publicUrl ?? "") || undefined : undefined,
        });
      }
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
        publicUrl: "publicUrl" in attachment ? String(attachment.publicUrl ?? "") || undefined : undefined,
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
  conversationId?: string;
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
    runtimeType: "gpt_agent" as const,
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
  const ownerHandoffTool = buildOwnerHandoffTool({
    agent: args.agent,
    input: args.input,
    conversationId: args.conversationId,
    onToolResult: (entry) => {
      toolExecutions.push(entry);
    },
  });
  const collectionsGuideTool = buildConfiguredCollectionsGuideTool({
    agent: args.agent,
    establishedRegions: getConfiguredGuideRegionsFromCustomerMessages({
      agent: args.agent,
      customerMessages: [
        ...args.historyMessages
          .filter((message) => message.role === MessageRole.USER)
          .map((message) => message.content),
        args.input.message,
      ],
    }),
    onToolResult: (entry) => {
      toolExecutions.push(entry);
    },
  });
  const availableTools: ToolSet = {
    ...tools,
    ...(collectionsGuideTool ? { send_collections_guide: collectionsGuideTool } : {}),
    ...(ownerHandoffTool ? { [OWNER_HANDOFF_RUNTIME_TOOL_NAME]: ownerHandoffTool } : {}),
  };
  const hasTools = Object.keys(availableTools).length > 0;
  const modelId = normalizeConfiguredModelId(
    hasTools
      ? process.env.OPENAI_TOOL_MODEL || "gpt-5.4-mini"
      : process.env.OPENAI_MODEL || "gpt-5.4-mini",
  ) ?? "gpt-5.4-mini";
  const fallbackModelId = getFallbackModelId({ hasTools, primaryModelId: modelId });
  let usedModelId = modelId;

  if (!process.env.OPENAI_API_KEY) {
    return {
      text: "",
      modelId: "unavailable-no-openai-key",
      toolExecutions,
      unavailable: true,
    };
  }

  const schedulingNudge = buildSchedulingNudge({
    historyMessages: args.historyMessages,
    currentMessage: args.input.message,
  });
  const recentWeddingAvailabilityContext = buildRecentWeddingAvailabilityContext({
    historyMessages: args.historyMessages,
    currentMessage: args.input.message,
  });
  const controlRuntimeRules = buildControlRuntimeRules(args.control);
  const runtimeContextLines = buildRuntimeContextLines({
    prompting: args.prompting,
    input: args.input,
  });

  const modelRequest = {
      system: `${args.promptPreview}

Runtime application note:
- Respect the runtime execution policy already defined in the composed system prompt.
- Return only the customer-facing ${args.input.channel === ChannelType.GMAIL ? "email reply" : "Instagram DM text"}. Do not include planning notes, analysis, labels, or internal reasoning before the reply.
- If the customer explicitly asks for a real person/human, use the ${OWNER_HANDOFF_REQUEST_TOOL_NAME} tool.
- If the customer asks a specific Myndful business fact that is not clearly present in the prompt, knowledge, recent history, or tools, use the ${OWNER_HANDOFF_REQUEST_TOOL_NAME} tool instead of guessing or saying no.
${controlRuntimeRules ? `\n- ${controlRuntimeRules.replace(/\n/g, "\n")}` : ""}`,
      prompt: `Conversation history:
  ${args.historyText}

  ${runtimeContextLines ? `${runtimeContextLines}\n` : ""}Incoming customer message:
  ${args.input.message}

  ${[
    recentWeddingAvailabilityContext,
    schedulingNudge,
  ].filter(Boolean).join("\n\n")}`.trim(),
    ...(hasTools
      ? {
          tools: availableTools,
          stopWhen: stepCountIs(5),
        }
      : {}),
    };
  const toolExecutionStartIndex = toolExecutions.length;
  const result = await traceLangRuntime("gpt_agent.model.invoke", traceMetadata, async () => {
    try {
      return await generateText({
        ...modelRequest,
        model: openai.chat(modelId),
      });
    } catch (error) {
      if (!fallbackModelId || !isTechnicalModelFailure(error)) {
        throw error;
      }

      toolExecutions.splice(toolExecutionStartIndex);
      usedModelId = fallbackModelId;
      console.warn(
        `[ai-runtime] primary model ${modelId} failed with a technical error; retrying with ${fallbackModelId}`,
      );

      return generateText({
        ...modelRequest,
        model: openai.chat(fallbackModelId),
      });
    }
  });

  return {
    text: result.text,
    modelId: usedModelId,
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

  const runtimeBlocks = await mapAgentToRuntimeBlocks(agent);

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
    if (modelResult.unavailable) {
      return {
        message: "",
        promptPreview: runtimeBlocks.promptPreview,
        usedTooling: [],
        model: modelResult.modelId,
        suppressReply: true,
      };
    }
    let finalizedText = finalizeAssistantText({
      text: modelResult.text,
      currentMessage: input.message,
      toolExecutions: modelResult.toolExecutions,
      historyMessages,
      preserveModelVoice: runtimeBlocks.prompting.preserveModelVoice,
    });
    const modelInitiatedOwnerHandoff = hasOwnerHandoffToolExecution(modelResult.toolExecutions);
    if (
      shouldPostModelHandoffForUnknownFact({
        currentMessage: input.message,
        assistantText: finalizedText,
        toolExecutions: modelResult.toolExecutions,
      })
    ) {
      modelResult.toolExecutions.push(
        await requestPostModelUnknownFactHandoff({
          agent,
          input,
        }),
      );
    }
    const ownerHandoffRequested = hasOwnerHandoffToolExecution(modelResult.toolExecutions);
    if (
      ownerHandoffRequested &&
      !(runtimeBlocks.prompting.preserveModelVoice && modelInitiatedOwnerHandoff && finalizedText.trim())
    ) {
      finalizedText = customerReplyForOwnerHandoff({
        explicitHumanRequest: isExplicitHumanRequest(input.message),
      });
    }

    return {
      message: finalizedText,
      promptPreview: runtimeBlocks.promptPreview,
      usedTooling: modelResult.toolExecutions.map((execution) => execution.toolName),
      model: modelResult.modelId,
      suppressReply: false,
      attachments: mergeRuntimeAttachments(extractAttachments(modelResult.toolExecutions)),
      historyAppend: buildHistoryAppend({
        toolExecutions: modelResult.toolExecutions,
        assistantText: finalizedText,
      }),
      toolExecutions: modelResult.toolExecutions,
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
    conversationId: conversation.id,
    promptPreview: runtimeBlocks.promptPreview,
    historyText: renderHistory(historyMessages),
    historyMessages,
    prompting: runtimeBlocks.prompting,
    control: runtimeBlocks.control,
  });
  if (modelResult.unavailable) {
    return {
      message: "",
      promptPreview: runtimeBlocks.promptPreview,
      usedTooling: [],
      conversationId: conversation.id,
      model: modelResult.modelId,
      suppressReply: true,
    };
  }
  let finalizedText = finalizeAssistantText({
    text: modelResult.text,
    currentMessage: input.message,
    toolExecutions: modelResult.toolExecutions,
    historyMessages,
    preserveModelVoice: runtimeBlocks.prompting.preserveModelVoice,
  });
  const modelInitiatedOwnerHandoff = hasOwnerHandoffToolExecution(modelResult.toolExecutions);
  if (
    shouldPostModelHandoffForUnknownFact({
      currentMessage: input.message,
      assistantText: finalizedText,
      toolExecutions: modelResult.toolExecutions,
    })
  ) {
    modelResult.toolExecutions.push(
      await requestPostModelUnknownFactHandoff({
        agent,
        input,
        conversationId: conversation.id,
      }),
    );
  }
  const ownerHandoffRequested = hasOwnerHandoffToolExecution(modelResult.toolExecutions);
  if (
    ownerHandoffRequested &&
    !(runtimeBlocks.prompting.preserveModelVoice && modelInitiatedOwnerHandoff && finalizedText.trim())
  ) {
    finalizedText = customerReplyForOwnerHandoff({
      explicitHumanRequest: isExplicitHumanRequest(input.message),
    });
  }

  if (modelResult.toolExecutions.length > 0) {
    const toolExecutionsToPersist = modelResult.toolExecutions.filter(
      (execution) => execution.toolName !== OWNER_HANDOFF_REQUEST_TOOL_NAME,
    );
    if (toolExecutionsToPersist.length > 0) {
      await saveMessages(
        conversation.id,
        toolExecutionsToPersist.map((execution) => ({
          role: MessageRole.TOOL,
          content: JSON.stringify(execution.toolResult),
          toolName: execution.toolName,
          toolInput: execution.toolInput as never,
          toolResult: execution.toolResult as never,
          durationMs: execution.durationMs,
        })),
      );
    }
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
    suppressReply: false,
    attachments: mergeRuntimeAttachments(extractAttachments(modelResult.toolExecutions)),
    historyAppend: buildHistoryAppend({
      toolExecutions: modelResult.toolExecutions,
      assistantText: finalizedText,
    }),
    toolExecutions: modelResult.toolExecutions,
  };
}

export const aiRuntimeTestHelpers = {
  sanitizeAllowedEmojis,
  stripDecorativeQuestionMarkEmoji,
  stripUnexpectedScriptFragments,
  stripInternalPlanningPreamble,
  softenFalseBookingConfirmation,
  extractDelayedFollowUpGuidance,
  finalizeAssistantText,
  getInboundConversationPolicy,
  classifyInstagramPriorMessages,
  inspectInstagramConversationHistory,
  handleIncomingEventWithDeps,
  isWithinAgentSchedule,
  buildRuntimeContextLines,
  getAntiSpamIntercept,
  classifyGmailClientMessage,
  buildRecentWeddingAvailabilityContext,
  buildRequiredWeddingAvailabilityActionNudge,
  buildRequiredConsultationCalendarActionNudge,
  getRequiredWeddingAvailabilityToolName,
  getRequiredConsultationCalendarToolName,
  getRequiredWeddingAvailabilityToolKey,
  getRequiredConsultationCalendarToolKey,
  isTechnicalModelFailure,
  normalizeConfiguredModelId,
  ownerHandoffCustomerReply,
  buildConfiguredCollectionsGuideTool,
  rewriteCustomerOpenAvailabilityPhrase,
  shouldPostModelHandoffForUnknownFact,
};

async function handleIncomingEventWithDeps(
  args: {
  agentId: string;
  channel: ChannelType;
  payload: unknown;
  forceManualReview?: boolean;
  manualReviewReason?: string;
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

  if (args.forceManualReview && !incoming.isBusinessManualReply) {
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
    await notifyOwnerOfHandoffUpdateWithDb({
      database: deps.db,
      agent,
      conversationId: conversation.id,
      customerMessage: incoming.message,
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
      status: "manual_review_required",
      reason: args.manualReviewReason ?? "manual_review_requested",
    };
  }

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
    await notifyOwnerOfHandoffUpdateWithDb({
      database: deps.db,
      agent,
      conversationId: conversation.id,
      customerMessage: incoming.message,
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

  if (args.channel !== ChannelType.GMAIL && messageBehavior.bufferDelaySeconds > 0) {
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

  const result = await deps.invokeAgent({
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

  const outboundChannelConfig = agent.channelConfig;
  const formattedReply = adapter.formatReply(result.message, outboundChannelConfig);
  const outboundMessage = formattedReply as string | string[] | { text: string; html?: string };
  let delivery: unknown;
  try {
    delivery = await adapter.sendReply({
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
      channelConfig: outboundChannelConfig,
    });
  } catch (error) {
    if (result.conversationId) {
      await recordDeliveryFailedWithDb({
        database: deps.db,
        agentId: agent.id,
        conversationId: result.conversationId,
        channel: args.channel,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    throw error;
  }

  if (args.channel === ChannelType.INSTAGRAM && result.conversationId) {
    await recordInstagramOutboundDeliveries({
      database: deps.db,
      conversationId: result.conversationId,
      delivery,
    });
  }

  if (result.conversationId) {
    await recordSuccessfulRuntimeTurnWithDb({
      database: deps.db,
      conversationId: result.conversationId,
      agentId: agent.id,
      channel: args.channel,
      inboundMessage: incoming.message,
      assistantReply: result.message,
      promptPreview: result.promptPreview,
      model: result.model,
      toolExecutions: result.toolExecutions,
      attachments: result.attachments,
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
        outboundText: result.message,
        attachments: result.attachments,
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
  forceManualReview?: boolean;
  manualReviewReason?: string;
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

