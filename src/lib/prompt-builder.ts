import { BuilderPreviewInput, buildMultilingualGuidance, formatEnumLabel } from "@/lib/agent-builder";

function renderKnowledgeSection(
  knowledgeBlocks: NonNullable<BuilderPreviewInput["knowledgeBlocks"]>,
) {
  if (knowledgeBlocks.length === 0) {
    return "No knowledge blocks configured yet.";
  }

  return knowledgeBlocks
    .map(
      (block, index) =>
        `${index + 1}. ${block.name}: ${block.description}${block.knowledgeContent ? `\n${block.knowledgeContent}` : ""}`,
    )
    .join("\n\n");
}

function renderToolSection(toolBlocks: NonNullable<BuilderPreviewInput["toolBlocks"]>) {
  if (toolBlocks.length === 0) {
    return "No tools configured yet.";
  }

  return toolBlocks
    .map((tool, index) => {
      const stepText =
        tool.steps && tool.steps.length > 0
          ? tool.steps
              .map((step) =>
                `- ${step.integrationType ? `${formatEnumLabel(String(step.integrationType))}: ` : ""}${step.action}`,
              )
              .join("\n")
          : "- No executable integration steps configured yet.";

      return `${index + 1}. ${tool.name}: ${tool.description}\n${stepText}`;
    })
    .join("\n\n");
}

export function buildSystemPrompt(agent: BuilderPreviewInput) {
  const knowledgeBlocks = agent.knowledgeBlocks ?? [];
  const toolBlocks = agent.toolBlocks ?? [];
  const channelLabel = agent.channel?.type ? formatEnumLabel(agent.channel.type) : "Unassigned";

  return [
    `Agent identity: ${agent.name}`,
    `Persona: ${agent.persona}`,
    `Tone: ${agent.tone}`,
    `Channel: ${channelLabel}`,
    `Language behavior: ${buildMultilingualGuidance({
      languagePreference: agent.languagePreference,
      channel: agent.channel ?? null,
    })}`,
    "Opening rule: In the first reply of a new conversation, warmly greet the customer, introduce yourself by name as the person behind this agent, and then ask only for the next missing detail needed to move the conversation forward.",
    "Availability rule: When the customer provides a business date and the configured tools can verify availability, use the availability tool before confirming whether the date is free or unavailable. If the tool returns nearby replacement dates, offer those dates immediately instead of asking the customer to suggest alternatives first.",
    "Emoji rule: Use only these emojis when needed: 🤍 ✨ 🎥. Never use any other emoji. If emoji output is uncertain, use no emoji at all.",
    "",
    "Knowledge",
    renderKnowledgeSection(knowledgeBlocks),
    "",
    "Tools",
    renderToolSection(toolBlocks),
  ].join("\n");
}
