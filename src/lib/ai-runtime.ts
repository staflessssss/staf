import { openai } from "@ai-sdk/openai";
import { AgentStatus, ChannelType, FeatureType, MessageRole } from "@prisma/client";
import { generateText, stepCountIs } from "ai";

import { agentBuilderInclude, AgentWithBuilderData } from "@/lib/agent-builder";
import { ensureConversation, loadConversationHistory, saveMessages } from "@/lib/agent-memory";
import { getChannelAdapter } from "@/lib/channels";
import { decrypt } from "@/lib/crypto";
import { db } from "@/lib/db";
import { buildSystemPrompt } from "@/lib/prompt-builder";
import { resolveTools } from "@/lib/tools";

type LightweightKnowledgeBlock = {
  name: string;
  description: string;
  knowledgeContent?: string | null;
};

type LightweightToolBlock = {
  name: string;
  description: string;
  steps?: Array<{
    action: string;
    integrationType?: string;
  }>;
};

type InvokeAgentInput = {
  tenantId: string;
  agentId?: string;
  channel: ChannelType | string;
  contactId: string;
  message: string;
  messageId?: string;
  promptPreview?: string;
  languagePreference?: string | null;
  knowledgeBlocks?: LightweightKnowledgeBlock[];
  toolBlocks?: LightweightToolBlock[];
};

type RuntimeAttachment = {
  source?: "google_drive";
  fileId: string;
  fileName?: string;
  mimeType?: string;
};

export type InvokeAgentResult = {
  message: string;
  promptPreview: string;
  usedTooling: string[];
  conversationId?: string;
  model?: string;
  attachments?: RuntimeAttachment[];
};

function buildFallbackResponse(args: {
  input: InvokeAgentInput;
  usedTools: string[];
}) {
  const knowledgeHighlights = (args.input.knowledgeBlocks ?? [])
    .slice(0, 2)
    .map((block) => block.name)
    .filter(Boolean);
  const opening = args.input.languagePreference
    ? `I will keep the default business voice in ${args.input.languagePreference} when it fits, while staying ready to reply in the customer's language.`
    : "I will stay multilingual-first and match the customer's language while keeping the business voice consistent.";
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

function renderHistory(messages: Awaited<ReturnType<typeof loadConversationHistory>>["messages"]) {
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
  historyMessages: Awaited<ReturnType<typeof loadConversationHistory>>["messages"];
  currentMessage: string;
}) {
  const current = args.currentMessage.toLowerCase();
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
          ? result.suggestedTimes.map((value) => String(value).toLowerCase())
          : [];

      if (status !== "busy" || suggestedTimes.length === 0) {
        continue;
      }

      const matchedSuggestion = suggestedTimes.find((time) => current.includes(time));
      if (matchedSuggestion) {
        return `Scheduling nudge:
- The customer is choosing a previously offered alternative consultation slot (${matchedSuggestion}).
- Call the booking tool now for that selected time instead of replying in prose.`;
      }
    }
  }

  return "";
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

function mapAgentToRuntimeBlocks(agent: AgentWithBuilderData) {
  return {
    promptPreview: buildSystemPrompt({
      name: agent.name,
      persona: agent.persona,
      tone: agent.tone,
      languagePreference: agent.languagePreference,
      channel: agent.channel,
      knowledgeBlocks: agent.features
        .filter((feature) => feature.type === FeatureType.KNOWLEDGE)
        .map((feature) => ({
          name: feature.name,
          description: feature.description,
          knowledgeContent: feature.knowledgeContent,
        })),
      toolBlocks: agent.features
        .filter((feature) => feature.type === FeatureType.TOOL)
        .map((feature) => ({
          name: feature.name,
          description: feature.description,
          steps: feature.steps.map((step) => ({
            action: step.action,
            integrationType: step.integration.type,
          })),
        })),
    }),
    knowledgeBlocks: agent.features
      .filter((feature) => feature.type === FeatureType.KNOWLEDGE)
      .map((feature) => ({
        name: feature.name,
        description: feature.description,
        knowledgeContent: feature.knowledgeContent,
      })),
    toolBlocks: agent.features
      .filter((feature) => feature.type === FeatureType.TOOL)
      .map((feature) => ({
        name: feature.name,
        description: feature.description,
        steps: feature.steps.map((step) => ({
          action: step.action,
          integrationType: step.integration.type,
        })),
      })),
  };
}

async function runModelInvocation(args: {
  agent: AgentWithBuilderData;
  input: InvokeAgentInput;
  promptPreview: string;
  historyText: string;
  historyMessages: Awaited<ReturnType<typeof loadConversationHistory>>["messages"];
}) {
  const toolExecutions: Array<{
    toolName: string;
    toolInput: unknown;
    toolResult: unknown;
    durationMs?: number;
  }> = [];
  const tools = resolveTools({
    agent: args.agent,
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

  const result = await generateText({
    model: openai(modelId),
    system: `${args.promptPreview}

Runtime rules:
- Use configured tools when they materially help answer or act on the customer's request.
- Keep replies concise, operational, and tenant-safe.
- Never invent integration results. Use tool outputs as the source of truth.
- If the user asks for availability, booking, files, or spreadsheet actions, prefer tools before answering.
- When the customer provides a date, preserve the exact day, month, and year. Prefer passing dates to tools in YYYY-MM-DD format.
- If the customer chooses a specific consultation time, or accepts one of the alternatives you just offered, call the booking tool immediately instead of only replying in prose.
- Never say a call is booked, reserved, confirmed, or that an invite is coming unless the booking tool has just succeeded in this turn.
- If a calendar-check tool returned alternative times and the customer later confirms one of those options, treat that as booking intent and use the booking tool.`,
      prompt: `Conversation history:
  ${args.historyText}
  
  Current channel: ${args.input.channel}
  Current contact: ${args.input.contactId}
  Incoming customer message:
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
    const promptPreview =
      input.promptPreview ??
      buildSystemPrompt({
        name: "Sandbox agent",
        persona: "Helpful business assistant",
        tone: "friendly",
        languagePreference: input.languagePreference ?? null,
        channel: { type: input.channel as ChannelType },
        knowledgeBlocks: input.knowledgeBlocks ?? [],
        toolBlocks: input.toolBlocks ?? [],
      });
    const usedTooling =
      input.message.toLowerCase().includes("available") || input.message.toLowerCase().includes("book")
        ? (input.toolBlocks ?? []).map((tool) => tool.name)
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
      status: AgentStatus.ACTIVE,
    },
    include: agentBuilderInclude,
  });

  if (!agent) {
    throw new Error("Active deployed agent not found.");
  }

  const runtimeBlocks = mapAgentToRuntimeBlocks(agent);
  const conversation = await ensureConversation({
    agentId: agent.id,
    contactId: input.contactId,
    channel: agent.channel.type,
  });
  const history = await loadConversationHistory(agent.id, input.contactId);

  await saveMessages(conversation.id, [
    {
      role: MessageRole.USER,
      content: input.message,
      toolInput: input.messageId ? { messageId: input.messageId } : undefined,
    },
  ]);

  const modelResult = await runModelInvocation({
      agent,
      input,
      promptPreview: runtimeBlocks.promptPreview,
      historyText: renderHistory(history.messages),
      historyMessages: history.messages,
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
      content: modelResult.text,
      model: modelResult.modelId,
    },
  ]);

  return {
    message: modelResult.text,
    promptPreview: runtimeBlocks.promptPreview,
    usedTooling: modelResult.toolExecutions.map((execution) => execution.toolName),
    conversationId: conversation.id,
    model: modelResult.modelId,
    attachments: extractAttachments(modelResult.toolExecutions),
  };
}

export async function handleIncomingEvent(args: {
  agentId: string;
  channel: ChannelType;
  payload: unknown;
}) {
  const agent = await db.agent.findFirst({
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

  const adapter = getChannelAdapter(args.channel) as {
    parseIncoming: (payload: unknown) => {
      contactId: string;
      message: string;
      messageId?: string;
      threadId?: string;
      subject?: string;
    };
    formatReply: (text: string, config?: unknown) => unknown;
    sendReply: (params: {
      credentials: string;
      contactId: string;
      message: string | { text: string; html?: string };
      messageId?: string;
      threadId?: string;
      subject?: string;
      attachments?: RuntimeAttachment[];
      channelConfig?: unknown;
    }) => Promise<unknown>;
  };
  const incoming = adapter.parseIncoming(args.payload);

  if (!incoming.contactId || !incoming.message) {
    return {
      ok: false,
      reason: "ignored_empty_payload",
    };
  }

  const result = await invokeAgent({
    tenantId: agent.tenantId,
    agentId: agent.id,
    channel: args.channel,
    contactId: incoming.contactId,
    message: incoming.message,
    messageId: incoming.messageId,
  });
  const formattedReply = adapter.formatReply(result.message, agent.channelConfig);
  const outboundMessage = Array.isArray(formattedReply)
    ? formattedReply.join("\n\n")
    : (formattedReply as string | { text: string; html?: string });

  const delivery = await adapter.sendReply({
    credentials: decrypt(agent.channel.credentialsEnc),
    contactId: incoming.contactId,
    message: outboundMessage,
    messageId: incoming.messageId,
    threadId: incoming.threadId,
    subject: incoming.subject,
    attachments: result.attachments,
    channelConfig: agent.channelConfig,
  });

  return {
    ok: true,
    agentId: agent.id,
    conversationId: result.conversationId,
    delivery,
    reply: result.message,
    usedTooling: result.usedTooling,
  };
}
