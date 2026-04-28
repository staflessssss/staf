import {
  AgentPromptInput,
  buildMultilingualGuidance,
  ConversationPlaybookConfig,
  formatEnumLabel,
  normalizeChannelBehavior,
  normalizeConversationPlaybook,
  resolvePromptingIdentity,
} from "@/lib/agent-config";
import {
  getOrderedResultTargets,
  getPrimaryStoredTarget,
} from "@/lib/functions/destination-mapping";

function renderKnowledgeSection(
  knowledgeBlocks: NonNullable<AgentPromptInput["knowledgeBlocks"]>,
) {
  if (knowledgeBlocks.length === 0) {
    return "No knowledge blocks configured yet.";
  }

  return knowledgeBlocks
    .map(
      (block, index) =>
        [
          `${index + 1}. ${block.name}`,
          `When to use: ${block.description}`,
          block.knowledgeContent ? `Knowledge: ${block.knowledgeContent}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
    )
    .join("\n\n");
}

function renderFunctionSection(functionBlocks: NonNullable<AgentPromptInput["functionBlocks"]>) {
  if (functionBlocks.length === 0) {
    return "No functions configured yet. Define explicit business actions before expecting runtime execution.";
  }

  return functionBlocks
    .map((fn, index) => {
      const parameterText =
        fn.parameters && fn.parameters.length > 0
          ? fn.parameters
              .map((parameter) => {
                const parts = [
                  `${parameter.name} (${formatEnumLabel(String(parameter.type))})`,
                  parameter.required ? "required" : "optional",
                ];

                if (parameter.instruction) {
                  parts.push(parameter.instruction);
                }

                if (parameter.allowedValues && parameter.allowedValues.length > 0) {
                  parts.push(`allowed: ${parameter.allowedValues.join(", ")}`);
                }

                return `- ${parts.join(" - ")}`;
              })
              .join("\n")
          : "- No structured inputs configured yet.";
      const primaryResultTarget = fn.resultTargets
        ? getPrimaryStoredTarget(fn.resultTargets)
        : null;
      const orderedResultTargets = fn.resultTargets
        ? getOrderedResultTargets(fn.resultTargets)
        : [];
      const resultTargetText =
        orderedResultTargets.length > 0
          ? orderedResultTargets
              .map((target) => `- ${formatEnumLabel(String(target.type))}: ${target.label}`)
              .join("\n")
          : "- No explicit result targets configured.";
      const stepText =
        fn.steps && fn.steps.length > 0
          ? fn.steps
              .map((step) =>
                `- ${step.integrationType ? `${formatEnumLabel(String(step.integrationType))}: ` : ""}${step.action}`,
              )
              .join("\n")
          : "- No execution steps configured yet.";

      return [
        `${index + 1}. ${fn.name}: ${fn.description}`,
        `Status: ${fn.active === false ? "inactive" : "active"}`,
        "Inputs",
        parameterText,
        `Reaction after execution: ${formatEnumLabel(String(fn.reactionAction ?? "ai_agent_decides"))}`,
        `Post-scenario: ${formatEnumLabel(String(fn.postAction ?? "continue_dialog"))}`,
        `Disable delayed messages after run: ${fn.disableDelayedMessages ? "yes" : "no"}`,
        `Primary destination: ${primaryResultTarget ? `${formatEnumLabel(String(primaryResultTarget.type))}: ${primaryResultTarget.label}` : "none configured"}`,
        "Result delivery",
        resultTargetText,
        "Execution steps",
        stepText,
      ].join("\n");
    })
    .join("\n\n");
}

const discoveryFieldLabels: Record<ConversationPlaybookConfig["discoveryFields"][number], string> = {
  customer_name: "customer name",
  service_needed: "service needed",
  preferred_date: "preferred date",
  preferred_time: "preferred time",
  location_or_branch: "location or branch",
  budget: "budget",
  urgency: "urgency",
  preferred_specialist: "preferred specialist",
  contact_preference: "contact preference",
  notes_or_special_request: "notes or special request",
};

function humanizeFieldList(fields: ConversationPlaybookConfig["discoveryFields"]) {
  return fields.map((field) => discoveryFieldLabels[field]).join(", ");
}

function renderChannelBehaviorSection(agent: AgentPromptInput) {
  const behavior = normalizeChannelBehavior(agent.channelBehavior, agent.channel?.type ?? null);

  return [
    `Preset: ${behavior.preset}`,
    `Response length: ${behavior.responseLength}`,
    `Message format: ${behavior.messageFormat}`,
    `Tone pace: ${behavior.tonePace}`,
    `CTA style: ${behavior.ctaStyle}`,
    `Emoji usage: ${behavior.emojiUsage}`,
    `Message buffer delay (seconds): ${behavior.bufferDelaySeconds}`,
    `Use signature: ${behavior.useSignature ? "yes" : "no"}`,
    `Use rich formatting: ${behavior.useRichFormatting ? "yes" : "no"}`,
    `Allow attachments: ${behavior.allowAttachments ? "yes" : "no"}`,
    `Follow-up enabled: ${behavior.followUpEnabled ? "yes" : "no"}`,
    behavior.followUpRules.length > 0
      ? `Follow-up rules:\n${behavior.followUpRules
          .map(
            (rule, index) =>
              `- ${index + 1}. after ${rule.delayDays}d ${rule.delayHours}h ${rule.delayMinutes}m | ${rule.sendLimit} | ${rule.outOfHoursBehavior} | ${rule.instruction}`,
          )
          .join("\n")}`
      : "Follow-up rules: none configured",
    behavior.notes ? `Notes: ${behavior.notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function renderConversationPlaybookSection(agent: AgentPromptInput) {
  const playbook = normalizeConversationPlaybook(agent.conversationPlaybook);

  return [
    `Preset: ${playbook.preset}`,
    `Primary goal: ${playbook.primaryGoal}`,
    `Success action: ${playbook.successAction}`,
    `Opening strategy: ${playbook.openingStrategy}`,
    `Opening fields: ${humanizeFieldList(playbook.openingFields) || "none selected"}`,
    `Discovery fields: ${humanizeFieldList(playbook.discoveryFields) || "none selected"}`,
    `Discovery order: ${humanizeFieldList(playbook.discoveryOrder) || "none selected"}`,
    `Minimum info before availability check: ${humanizeFieldList(playbook.minInfoBeforeAvailability) || "none selected"}`,
    `Minimum info before pricing: ${humanizeFieldList(playbook.minInfoBeforePricing) || "none selected"}`,
    `Pricing behavior: ${playbook.pricingBehavior}`,
    `If unavailable: ${playbook.unavailableBehavior}`,
    `Booking behavior: ${playbook.bookingBehavior}`,
    `After FAQ: ${playbook.afterFaqBehavior}`,
    `Conversation momentum: ${playbook.conversationMomentum}`,
    `Fallback behavior: ${playbook.fallbackBehavior}`,
    playbook.notes ? `Notes: ${playbook.notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildConversationPlaybookRuntimeGuidance(playbook: ConversationPlaybookConfig) {
  const openingFields = humanizeFieldList(playbook.openingFields) || "the next missing detail";
  const discoveryOrder = humanizeFieldList(playbook.discoveryOrder) || "the next missing detail";
  const minInfoBeforeAvailability =
    humanizeFieldList(playbook.minInfoBeforeAvailability) || "no minimum fields configured";
  const minInfoBeforePricing =
    humanizeFieldList(playbook.minInfoBeforePricing) || "no minimum fields configured";

  return [
    `Opening strategy: ${formatEnumLabel(String(playbook.openingStrategy))}. Start by collecting ${openingFields}.`,
    `Discovery order: Collect missing information in this order when possible: ${discoveryOrder}.`,
    `Availability gate: Do not check availability until you know ${minInfoBeforeAvailability}.`,
    `Pricing gate: ${formatEnumLabel(String(playbook.pricingBehavior))}. Do not send pricing before you know ${minInfoBeforePricing}.`,
    `Unavailable handling: ${formatEnumLabel(String(playbook.unavailableBehavior))}.`,
    `Booking posture: ${formatEnumLabel(String(playbook.bookingBehavior))}.`,
    `After FAQ: ${formatEnumLabel(String(playbook.afterFaqBehavior))}.`,
    `Conversation momentum: ${formatEnumLabel(String(playbook.conversationMomentum))}.`,
    `Fallback: ${formatEnumLabel(String(playbook.fallbackBehavior))}.`,
    playbook.notes ? `Playbook notes: ${playbook.notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function renderPromptingSection(agent: AgentPromptInput) {
  const promptingIdentity = resolvePromptingIdentity({
    prompting: agent.prompting,
    persona: agent.persona,
    tone: agent.tone,
    languagePreference: agent.languagePreference,
  });
  const prompting = promptingIdentity.prompting;

  return [
    `Persona: ${promptingIdentity.persona}`,
    `Tone: ${promptingIdentity.tone}`,
    prompting.instruction ? `Instruction:\n${prompting.instruction}` : "Instruction: none configured",
    prompting.notes ? `Operator notes: ${prompting.notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildRuntimeExecutionPolicy() {
  return [
    "Use configured tools when they materially help answer or act on the customer's request.",
    "Keep replies concise, operational, and tenant-safe.",
    "Never invent integration results. Use tool outputs as the source of truth.",
    "Treat this as an ongoing thread, not a brand-new conversation on every turn.",
    "Use a warm greeting and full introduction only in the first reply of a thread.",
    "After that, continue naturally without restarting the conversation or repeating the customer's identifiers on every message.",
    "If the user asks for availability, booking, files, or spreadsheet actions, prefer tools before answering.",
    "Follow the configured conversation playbook for what to ask first, what minimum information is required before checks, and what next step should happen after each answer.",
    "Before using availability or booking tools, respect the agent's configured minimum-info rules and preserve business dates and times accurately. Prefer structured dates in YYYY-MM-DD format when tools accept them.",
    "If the customer chooses a specific consultation time, or accepts one of the alternatives you just offered, call the booking tool immediately instead of only replying in prose.",
    "Never say a call is booked, reserved, confirmed, or that an invite is coming unless the booking tool has just succeeded in this turn.",
    "In test mode, keep tool usage real but describe bookings, invites, and lead actions as simulations only. Never imply that a real invite was sent or that a live event was created from a test run.",
    "If a calendar-check tool returned alternative times and the customer later confirms one of those options, treat that as booking intent and use the booking tool.",
    "If an availability tool returns nearby replacement dates or slots, proactively offer those alternatives immediately instead of asking the customer to do the tool's work for you.",
    "If the current channel already provides the customer's email, treat it as known contact information and do not ask the customer to repeat it unless they want a different address used.",
  ].join("\n");
}

export function buildSystemPrompt(agent: AgentPromptInput) {
  const knowledgeBlocks = agent.knowledgeBlocks ?? [];
  const playbook = normalizeConversationPlaybook(agent.conversationPlaybook);
  const promptingIdentity = resolvePromptingIdentity({
    prompting: agent.prompting,
    persona: agent.persona,
    tone: agent.tone,
    languagePreference: agent.languagePreference,
  });
  const functionBlocks = agent.functionBlocks ?? [];
  const channelLabel = agent.channel?.type ? formatEnumLabel(agent.channel.type) : "Unassigned";

  return [
    `Agent identity: ${agent.name}`,
    `Channel: ${channelLabel}`,
    `Language behavior: ${buildMultilingualGuidance({
      languagePreference: promptingIdentity.languagePreference,
      channel: agent.channel ?? null,
    })}`,
    "Opening rule: In the first reply of a new conversation, greet the customer naturally, introduce yourself in the configured brand voice, and then follow the playbook's opening strategy.",
    "Continuity rule: After the first reply, continue the same thread naturally. Do not restart the conversation, do not repeat a full introduction every turn, and do not overuse the customer's name.",
    "Tool rule: When a configured tool can verify availability, booking, pricing, or business actions, prefer tool outputs over guesswork.",
    "Safety rule: Never invent tool results. Never claim something is booked, confirmed, reserved, or sent unless the relevant tool has succeeded in this turn.",
    "Emoji rule: Use only these emojis when needed: 🤍 ✨ 🎥. Never use any other emoji. If emoji output is uncertain, use no emoji at all.",
    "",
    "Prompting",
    renderPromptingSection(agent),
    "",
    "Channel behavior",
    renderChannelBehaviorSection(agent),
    "",
    "Conversation playbook",
    renderConversationPlaybookSection(agent),
    "",
    "Playbook runtime guidance",
    buildConversationPlaybookRuntimeGuidance(playbook),
    "",
    "Knowledge",
    renderKnowledgeSection(knowledgeBlocks),
    "",
    "Functions",
    renderFunctionSection(functionBlocks),
    "",
    "Runtime execution policy",
    buildRuntimeExecutionPolicy(),
  ].join("\n");
}
