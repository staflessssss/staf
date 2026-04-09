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
    "",
    "Knowledge",
    renderKnowledgeSection(knowledgeBlocks),
    "",
    "Tools",
    renderToolSection(toolBlocks),
  ].join("\n");
}
