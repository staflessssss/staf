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
import { decrypt } from "@/lib/crypto";
import { db } from "@/lib/db";
import { buildSystemPrompt } from "@/lib/prompt-composer";
import { resolveTools } from "@/lib/tools";
import { readMessageBehaviorConfig } from "@/lib/channels/message-behavior";
import { findNextAgentScheduleWindowStart, isWithinAgentSchedule } from "@/lib/agent-schedule";
import {
  cancelPendingDelayedDeliveriesWithDb,
  scheduleBufferedReplyWithDb,
  scheduleFollowUpsForReplyWithDb,
} from "@/lib/message-delivery-runtime";

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
};

type RuntimeAttachment = {
  source?: "google_drive";
  fileId: string;
  fileName?: string;
  mimeType?: string;
};

type ParsedIncomingMessage = {
  contactId: string;
  contactEmail?: string;
  message: string;
  messageId?: string;
  gmailMessageId?: string;
  threadId?: string;
  subject?: string;
  eventTimestamp?: Date;
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

type HandleIncomingEventDeps = {
  db: typeof db;
  getChannelAdapter: typeof getChannelAdapter;
  invokeAgent: typeof invokeAgent;
  decrypt: typeof decrypt;
  sleep: (ms: number) => Promise<void>;
};

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
  void args;

  return "";
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
  return convertSimulatedBookingLanguage({
    text: guardedText,
    toolExecutions: args.toolExecutions,
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
      if (message.role === MessageRole.TOOL) {
        return `tool ${message.toolName ?? "tool"}: ${message.content}`;
      }

      return `${message.role.toLowerCase()}: ${message.content}`;
    })
      .join("\n");
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
  channel: ChannelType;
  message: string;
  messageId?: string;
  gmailMessageId?: string;
  threadId?: string;
  subject?: string;
  conversationStatus?: ConversationStatus;
}) {
  return database.$transaction(async (tx) => {
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
        data: { status: args.conversationStatus },
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

async function recordInboundMessage(args: {
  agentId: string;
  contactId: string;
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
  const tools = resolveTools({
    tenantId: args.agent.tenantId,
    toolFeatures: args.toolFeatures,
    testMode: Boolean(args.input.testMode),
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

  const controlRuntimeRules = buildControlRuntimeRules(args.control);
  const runtimeContextLines = buildRuntimeContextLines({
    prompting: args.prompting,
    input: args.input,
  });

  const result = await generateText({
    model: openai(modelId),
    system: `${args.promptPreview}

Runtime application note:
- Respect the runtime execution policy already defined in the composed system prompt.
${controlRuntimeRules ? `\n- ${controlRuntimeRules.replace(/\n/g, "\n")}` : ""}`,
      prompt: `Conversation history:
  ${args.historyText}

  ${runtimeContextLines ? `${runtimeContextLines}\n` : ""}Incoming customer message:
  ${args.input.message}

  ${schedulingNudge}`.trim(),
    ...(hasTools
      ? {
          tools,
          stopWhen: stepCountIs(5),
        }
      : {}),
  });

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
    const finalizedText = finalizeAssistantText({
      text: modelResult.text,
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
  finalizeAssistantText,
  getInboundConversationPolicy,
  handleIncomingEventWithDeps,
  isWithinAgentSchedule,
  buildRuntimeContextLines,
  getAntiSpamIntercept,
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
      status: AgentStatus.ACTIVE,
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
        role: MessageRole.USER,
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
  const agentSettings = getRuntimeAgentSettingsConfig(agent.channelConfig);
  const messageBehavior = readMessageBehaviorConfig(agent.channelConfig);
  const replyContext = {
    contactId: incoming.contactId,
    contactEmail: incoming.contactEmail,
    messageId: incoming.messageId,
    gmailMessageId: incoming.gmailMessageId,
    threadId: incoming.threadId,
    subject: incoming.subject,
  };
  const inboundPolicy = getInboundConversationPolicy({
    agentSettings,
    existingConversationStatus: existingConversation?.status,
    now: incoming.eventTimestamp,
  });

  if (inboundPolicy === "waiting_for_manual_dialog_activation") {
    const conversation = await recordInboundMessageWithDb(deps.db, {
      agentId: agent.id,
      contactId: incoming.contactId,
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
      excludeOperatorAutoResume: true,
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

  if (
    args.channel !== ChannelType.GMAIL &&
    messageBehavior.bufferDelaySeconds > 0
  ) {
    const conversation = await recordInboundMessageWithDb(deps.db, {
      agentId: agent.id,
      contactId: incoming.contactId,
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
    attachments: messageBehavior.allowAttachments ? result.attachments : undefined,
    channelConfig: agent.channelConfig,
  });

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
  });
}

