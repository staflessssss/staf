"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import {
  ChannelConnection,
  Feature,
  FeatureType,
  IntegrationType,
  IntegrationConnection,
  Step,
} from "@prisma/client";
import {
  Bot,
  Layers3,
  Sparkles,
  Settings2,
} from "lucide-react";

import {
  Checklist,
  EmptyState,
  FormField,
  StatusBadge,
  SurfaceCard,
  inputClassName,
  primaryButtonClassName,
  selectClassName,
  secondaryButtonClassName,
  textareaClassName,
} from "@/components/stafless/foundation";
import { FunctionsSection } from "@/components/stafless/workspace-sections/functions-section";
import { PlaybookSection } from "@/components/stafless/workspace-sections/playbook-section";
import { WorkspacePromptingSection } from "@/components/stafless/workspace-sections/prompting-section";
import { KnowledgeSection } from "@/components/stafless/workspace-sections/knowledge-section";
import {
  ChannelBehaviorConfig,
  ConversationPlaybookConfig,
  ctaStyleOptions,
  discoveryFieldOptions,
  DiscoveryField,
  getChannelBehaviorPresetConfig,
  getConversationPlaybookPreset,
  getDefaultChannelBehaviorConfig,
  messageFormatOptions,
  normalizeChannelBehavior,
  normalizeConversationPlaybook,
  responseLengthOptions,
  tonePaceOptions,
  emojiUsageOptions,
  channelBehaviorPresetOptions,
  ControlConfig,
  functionBlocksToToolBlocks,
  FunctionBlockConfig,
  getDefaultFunctionBlock,
  getDefaultControlConfig,
  normalizeControlConfig,
  normalizeFunctionBlocks,
  normalizePromptingConfig,
  PromptingConfig,
  toolBlockToFunctionBlock,
} from "@/lib/agent-builder";
import {
  getDefaultGoogleCalendarParams,
  getGoogleCalendarValidationErrors,
  GoogleSheetsColumnMappingDraft,
  GoogleSheetsFilterDraft,
  getGoogleCalendarActionForOperation,
  getGoogleCalendarParams,
  getGoogleSheetsActionForOperation,
  getGoogleSheetsParams,
} from "@/lib/function-execution";
import { buildSystemPrompt } from "@/lib/prompt-builder";

type SerializableTenant = {
  id: string;
  name: string;
  slug: string;
  timezone?: string | null;
  channelConnections: ChannelConnection[];
  integrationConnections: IntegrationConnection[];
  agents: Array<{
    id: string;
    name: string;
    channelId: string;
  }>;
};

type SerializableAgent = {
  id: string;
  name: string;
  persona: string;
  tone: string;
  languagePreference?: string | null;
  status: string;
  deployedAt: string | null;
  channelId: string;
  channelConfig?: Record<string, unknown> | null;
  channel: ChannelConnection;
  features: (Feature & {
    steps: (Step & { integration: IntegrationConnection })[];
  })[];
};

type KnowledgeDraft = {
  uiId: string;
  name: string;
  description: string;
  knowledgeContent: string;
};

type ToolStepDraft = {
  uiId: string;
  id?: string;
  integrationId: string;
  action: string;
  params: string;
};

type FunctionParameterDraft = FunctionBlockConfig["parameters"][number] & {
  uiId: string;
};

type FunctionResultTargetDraft = FunctionBlockConfig["resultTargets"][number] & {
  uiId: string;
};

type ChannelConfigDraft = {
  priceAttachmentFileId: string;
  priceAttachmentFileName: string;
  priceAttachmentMimeType: string;
  channelBehavior: ChannelBehaviorConfig;
  conversationPlaybook: ConversationPlaybookConfig;
  prompting: PromptingConfig;
  control: ControlConfig;
  functionBlocks: FunctionDraft[];
};

type FunctionDraft = Omit<FunctionBlockConfig, "parameters" | "resultTargets" | "steps"> & {
  uiId: string;
  parameters: FunctionParameterDraft[];
  resultTargets: FunctionResultTargetDraft[];
  steps: ToolStepDraft[];
};

type SheetInspectionState = {
  isLoading: boolean;
  error: string | null;
  spreadsheetId?: string;
  title?: string;
  sheets: string[];
  headers?: string[];
  selectedSheetName?: string;
  headerRow?: number;
  spreadsheets?: Array<{
    id: string;
    name: string;
  }>;
};

type BuilderDraft = {
  name: string;
  persona: string;
  tone: string;
  languagePreference: string;
  channelId: string;
  channelConfig: ChannelConfigDraft;
  knowledgeBlocks: KnowledgeDraft[];
};

const wizardSteps = [
  { id: "basics", title: "Basics", question: "Who is this agent?" },
  { id: "channel", title: "Channel", question: "Where does it operate?" },
  { id: "playbook", title: "Playbook", question: "How should it lead the conversation?" },
  { id: "knowledge", title: "Knowledge", question: "What should it know?" },
  { id: "functions", title: "Functions", question: "What business actions can it perform?" },
  { id: "review", title: "Review", question: "Is it ready to test and deploy?" },
];

const discoveryFieldLabels: Record<DiscoveryField, string> = {
  customer_name: "Customer name",
  service_needed: "Service needed",
  preferred_date: "Preferred date",
  preferred_time: "Preferred time",
  location_or_branch: "Location or branch",
  budget: "Budget",
  urgency: "Urgency",
  preferred_specialist: "Preferred specialist",
  contact_preference: "Contact preference",
  notes_or_special_request: "Notes or special request",
};

const sampleKnowledge: KnowledgeDraft[] = [
  {
    uiId: "knowledge_sample_service_scope",
    name: "Service scope",
    description:
      "Use this when the customer asks what the business offers, who it serves, or what is outside scope.",
    knowledgeContent:
      "The studio handles wedding videography, highlight edits, and post-event delivery. It does not offer photography-only packages.",
  },
];

function humanizeBuilderToken(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function uniqueDiscoveryFields(fields: DiscoveryField[]) {
  return fields.filter(
    (field, index, items): field is DiscoveryField =>
      discoveryFieldOptions.includes(field) && items.indexOf(field) === index,
  );
}

function safeParseJsonObject(value: string) {
  try {
    const parsed = JSON.parse(value || "{}");

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return {};
  }

  return {};
}

function stringifyJsonObject(value: Record<string, unknown>) {
  return JSON.stringify(value, null, 2);
}

function moveItem<T>(items: T[], index: number, direction: -1 | 1) {
  const nextIndex = index + direction;

  if (nextIndex < 0 || nextIndex >= items.length) {
    return items;
  }

  const copy = [...items];
  const [item] = copy.splice(index, 1);
  copy.splice(nextIndex, 0, item);
  return copy;
}

function createKnowledgeDraft(block?: Partial<Omit<KnowledgeDraft, "uiId">>): KnowledgeDraft {
  return {
    uiId: `knowledge_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
    name: block?.name ?? "",
    description: block?.description ?? "",
    knowledgeContent: block?.knowledgeContent ?? "",
  };
}

function createDraftUiId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function withFunctionUiIds(fn: FunctionBlockConfig): FunctionDraft {
  return {
    ...fn,
    uiId: createDraftUiId("fn"),
    parameters: fn.parameters.map((parameter) => ({
      ...parameter,
      uiId: createDraftUiId("param"),
    })),
    resultTargets: fn.resultTargets.map((target) => ({
      ...target,
      uiId: createDraftUiId("target"),
    })),
    steps: fn.steps.map((step) => ({
      ...step,
      uiId: createDraftUiId("step"),
      params:
        typeof step.params === "string"
          ? step.params
          : JSON.stringify(step.params ?? {}, null, 2),
    })),
  };
}

export function stripFunctionUiIds(functionBlocks: FunctionDraft[]): FunctionBlockConfig[] {
  return functionBlocks.map(({ uiId, parameters, resultTargets, steps, ...fn }) => ({
    ...fn,
    parameters: parameters.map(({ uiId, ...parameter }) => parameter),
    resultTargets: resultTargets.map(({ uiId, ...target }) => target),
    steps: steps.map(({ uiId, ...step }) => step),
  }));
}

function getSheetInspectorKey(step?: ToolStepDraft | null) {
  return step?.uiId ?? "";
}

function getDefaultStepDraftForIntegration(integrationType?: IntegrationType | null) {
  if (integrationType === IntegrationType.GOOGLE_SHEETS) {
    return {
      action: getGoogleSheetsActionForOperation("get_rows"),
      params: stringifyJsonObject({
        operation: "get_rows",
        spreadsheetId: "",
        spreadsheetTitle: "",
        sheetName: "",
        headerRow: 1,
        combineFilters: "AND",
        filters: [
          {
            column: "",
            operator: "equals",
            valueSource: "requested_date",
            value: "",
          },
        ],
        columnMappings: [
          {
            column: "",
            valueSource: "user_message",
            value: "",
          },
        ],
      }),
    };
  }

  if (integrationType === IntegrationType.GOOGLE_CALENDAR) {
    return {
      action: getGoogleCalendarActionForOperation("check_calendar"),
      params: stringifyJsonObject(getDefaultGoogleCalendarParams()),
    };
  }

  return {
    action: "",
    params: "{}",
  };
}

function stripKnowledgeUiIds(knowledgeBlocks: KnowledgeDraft[]) {
  return knowledgeBlocks.map((block) => ({
    name: block.name,
    description: block.description,
    knowledgeContent: block.knowledgeContent,
  }));
}

function createInitialDraft(tenant: SerializableTenant, agent?: SerializableAgent): BuilderDraft {
  const rawChannelConfig =
    agent && "channelConfig" in agent && agent.channelConfig && typeof agent.channelConfig === "object"
      ? (agent.channelConfig as Record<string, unknown>)
      : {};
  const selectedChannelId =
    agent?.channelId ??
    tenant.channelConnections.find((connection) => connection.status === "CONNECTED")?.id ??
    "";
  const selectedChannel =
    tenant.channelConnections.find((connection) => connection.id === selectedChannelId) ?? null;
  const knowledgeBlocks =
    agent?.features
      .filter((feature) => feature.type === FeatureType.KNOWLEDGE)
      .map((feature) =>
        createKnowledgeDraft({
          name: feature.name,
          description: feature.description,
          knowledgeContent: feature.knowledgeContent ?? "",
        }),
      ) ?? [];
  const toolBlocks =
    agent?.features
      .filter((feature) => feature.type === FeatureType.TOOL)
      .map((feature) => ({
        name: feature.name,
        description: feature.description,
        steps: feature.steps.map((step) => ({
          integrationId: step.integrationId,
          action: step.action,
          params: JSON.stringify(step.params ?? {}, null, 2),
        })),
      })) ?? [];
  const functionBlocks = normalizeFunctionBlocks(
    rawChannelConfig.functionBlocks &&
      Array.isArray(rawChannelConfig.functionBlocks)
      ? (rawChannelConfig.functionBlocks as Partial<FunctionDraft>[])
      : toolBlocks.map((tool) =>
          toolBlockToFunctionBlock({
            name: tool.name,
            description: tool.description,
            steps: tool.steps.map((step) => ({
              integrationId: step.integrationId,
              action: step.action,
              params: safeParseJsonObject(step.params),
            })),
          }),
        ),
  ).map(withFunctionUiIds);
  const promptingConfig = normalizePromptingConfig(
    rawChannelConfig.prompting &&
      typeof rawChannelConfig.prompting === "object" &&
      !Array.isArray(rawChannelConfig.prompting)
      ? {
          persona: agent?.persona,
          tone: agent?.tone,
          languagePreference: agent?.languagePreference ?? null,
          ...(rawChannelConfig.prompting as Partial<PromptingConfig>),
        }
      : {
          persona:
            agent?.persona ??
            `A polished front-desk operator for ${tenant.name} who keeps replies accurate, warm, and useful under pressure.`,
          tone: agent?.tone ?? "friendly",
          languagePreference: agent?.languagePreference ?? null,
          instruction: `You are the AI assistant for ${tenant.name}. Reply clearly, politely, and with a practical next step. Understand what the customer needs, avoid inventing confirmed actions, and keep the conversation moving.`,
        },
  );

  return {
    name: agent?.name ?? `${tenant.name} Concierge`,
    persona:
      promptingConfig.persona ??
      agent?.persona ??
      `A polished front-desk operator for ${tenant.name} who keeps replies accurate, warm, and useful under pressure.`,
    tone: promptingConfig.tone ?? agent?.tone ?? "friendly",
    languagePreference: promptingConfig.languagePreference ?? agent?.languagePreference ?? "",
    channelId: selectedChannelId,
    channelConfig: {
      priceAttachmentFileId:
        typeof rawChannelConfig.priceAttachmentFileId === "string"
          ? rawChannelConfig.priceAttachmentFileId
          : "",
      priceAttachmentFileName:
        typeof rawChannelConfig.priceAttachmentFileName === "string"
          ? rawChannelConfig.priceAttachmentFileName
          : "",
      priceAttachmentMimeType:
        typeof rawChannelConfig.priceAttachmentMimeType === "string"
          ? rawChannelConfig.priceAttachmentMimeType
          : "",
      channelBehavior: normalizeChannelBehavior(
        rawChannelConfig.channelBehavior &&
          typeof rawChannelConfig.channelBehavior === "object" &&
          !Array.isArray(rawChannelConfig.channelBehavior)
          ? (rawChannelConfig.channelBehavior as Partial<ChannelBehaviorConfig>)
          : null,
        selectedChannel?.type ?? null,
      ),
      conversationPlaybook: normalizeConversationPlaybook(
        rawChannelConfig.conversationPlaybook &&
          typeof rawChannelConfig.conversationPlaybook === "object" &&
          !Array.isArray(rawChannelConfig.conversationPlaybook)
          ? (rawChannelConfig.conversationPlaybook as Partial<ConversationPlaybookConfig>)
          : getConversationPlaybookPreset("general_lead_capture"),
      ),
      prompting: promptingConfig,
      control: normalizeControlConfig(
        rawChannelConfig.control &&
          typeof rawChannelConfig.control === "object" &&
          !Array.isArray(rawChannelConfig.control)
          ? (rawChannelConfig.control as Partial<ControlConfig>)
          : getDefaultControlConfig(),
      ),
      functionBlocks,
    },
    knowledgeBlocks:
      knowledgeBlocks.length > 0
        ? knowledgeBlocks
        : sampleKnowledge.map((block) => ({ ...block })),
  };
}

function parseFunctionBlocks(
  functionBlocks: FunctionDraft[],
  integrationById: Map<string, IntegrationConnection>,
) {
  const errors: string[] = [];
  const parsedFunctionBlocks = functionBlocks.map((fn) => ({
    ...fn,
    steps: fn.steps.map((step, stepIndex) => {
      const integrationType = integrationById.get(step.integrationId)?.type;

      try {
        if (integrationType === IntegrationType.GOOGLE_CALENDAR) {
          errors.push(...getGoogleCalendarValidationErrors(step).map((error) => `${fn.name || `#${stepIndex + 1}`}: ${error}`));
        }

        return {
          integrationId: step.integrationId,
          action: step.action,
          params: JSON.parse(step.params || "{}"),
        };
      } catch {
        errors.push(`Function "${fn.name || `#${stepIndex + 1}`}" has invalid JSON params.`);
        return {
          integrationId: step.integrationId,
          action: step.action,
          params: {},
        };
      }
    }),
  }));

  return {
    toolBlocks: functionBlocksToToolBlocks(parsedFunctionBlocks),
    errors,
  };
}

export function AgentCreateWizardClient({
  tenant,
  agent,
}: {
  tenant: SerializableTenant;
  agent?: SerializableAgent;
}) {
  const router = useRouter();
  const isReadOnlyMode = false;
  const initialDraft = useMemo(() => createInitialDraft(tenant, agent), [agent, tenant]);
  const [currentStep, setCurrentStep] = useState(0);
  const [draft, setDraft] = useState<BuilderDraft>(initialDraft);
  const [savedDraftSnapshot, setSavedDraftSnapshot] = useState(() => JSON.stringify(initialDraft));
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [sheetInspectors, setSheetInspectors] = useState<Record<string, SheetInspectionState>>({});

  const connectedIntegrations = useMemo(
    () =>
      tenant.integrationConnections.filter(
        (connection) => connection.status === "CONNECTED",
      ),
    [tenant.integrationConnections],
  );

  const integrationById = useMemo(
    () =>
      new Map(
        connectedIntegrations.map((integration) => [integration.id, integration]),
      ),
    [connectedIntegrations],
  );

  const assignedChannels = useMemo(
    () =>
      new Map(
        tenant.agents
          .filter((assignedAgent) => assignedAgent.id !== agent?.id)
          .map((assignedAgent) => [assignedAgent.channelId, assignedAgent.name]),
      ),
    [agent?.id, tenant.agents],
  );

  const selectedChannel =
    tenant.channelConnections.find((connection) => connection.id === draft.channelId) ?? null;
  const parsedFunctionBlocks = useMemo(
    () => parseFunctionBlocks(draft.channelConfig.functionBlocks, integrationById),
    [draft.channelConfig.functionBlocks, integrationById],
  );

  const promptPreview = buildSystemPrompt({
    name: draft.name,
    persona: draft.persona,
    tone: draft.tone,
    languagePreference: draft.languagePreference || null,
    channel: selectedChannel,
    prompting: draft.channelConfig.prompting,
    channelBehavior: draft.channelConfig.channelBehavior,
    conversationPlaybook: draft.channelConfig.conversationPlaybook,
    knowledgeBlocks: draft.knowledgeBlocks,
    functionBlocks: draft.channelConfig.functionBlocks.map((fn) => ({
      name: fn.name,
      description: fn.description,
      active: fn.active,
      parameters: fn.parameters,
      reactionAction: fn.reactionAction,
      postAction: fn.postAction,
      disableDelayedMessages: fn.disableDelayedMessages,
      resultTargets: fn.resultTargets,
      steps: fn.steps.map((step) => ({
        integrationType:
          connectedIntegrations.find((integration) => integration.id === step.integrationId)?.type ??
          undefined,
        action: step.action,
      })),
    })),
    toolBlocks: parsedFunctionBlocks.toolBlocks.map((tool) => ({
      name: tool.name,
      description: tool.description,
      steps: tool.steps.map((step) => ({
        integrationType:
          connectedIntegrations.find((integration) => integration.id === step.integrationId)?.type ??
          undefined,
        action: step.action,
      })),
    })),
  });
  const isDirty = JSON.stringify(draft) !== savedDraftSnapshot;
  const checklistItems = [
    {
      label:
        draft.name.trim() && draft.channelConfig.prompting.instruction?.trim()
          ? "Settings and prompting are defined"
          : "Complete settings and prompting",
      done: Boolean(draft.name.trim() && draft.channelConfig.prompting.instruction?.trim()),
      hint: "Name, instruction, persona, tone, and optional language preference shape the operator-facing brief.",
    },
    {
      label: selectedChannel ? `Channel selected: ${selectedChannel.type}` : "Choose a connected channel",
      done: Boolean(selectedChannel && !assignedChannels.has(selectedChannel.id)),
      hint: selectedChannel
        ? assignedChannels.has(selectedChannel.id)
          ? `This channel is already assigned to ${assignedChannels.get(selectedChannel.id)}.`
          : "This agent will use the selected tenant-scoped channel."
        : "Connect and choose one tenant channel before saving the draft.",
    },
    {
      label: "Playbook behavior defined",
      done: Boolean(
        draft.channelConfig.conversationPlaybook.discoveryFields.length > 0 &&
          draft.channelConfig.conversationPlaybook.discoveryOrder.length > 0,
      ),
      hint: "The playbook controls what the agent asks first, what it needs before checks, and how it moves toward the goal.",
    },
    {
      label: `${draft.knowledgeBlocks.length} knowledge item${draft.knowledgeBlocks.length === 1 ? "" : "s"} ready`,
      done: draft.knowledgeBlocks.every(
        (block) =>
          block.name.trim() && block.description.trim() && block.knowledgeContent.trim(),
      ),
      hint: "Each item should say what it covers, when the agent should use it, and the actual reference content.",
    },
    {
      label: `${draft.channelConfig.functionBlocks.length} function${draft.channelConfig.functionBlocks.length === 1 ? "" : "s"} ready`,
      done:
        draft.channelConfig.functionBlocks.length > 0 &&
        draft.channelConfig.functionBlocks.every(
          (fn) =>
            fn.name.trim() &&
            fn.description.trim() &&
            fn.steps.every((step) => step.integrationId && step.action.trim()),
        ),
      hint: "Functions define what the agent can do; integrations remain the execution layer underneath.",
    },
    {
      label: "Save the agent before full-cycle testing",
      done: Boolean(agent),
      hint: "Full-cycle testing lives on the saved agent workspace page.",
    },
  ];
  const completedChecklistCount = checklistItems.filter((item) => item.done).length;
  const currentStepMeta = wizardSteps[currentStep];
  const isWideWorkbenchStep = currentStep === 1 || currentStep === 2;
  const sectionCardClassName = (stepIndex?: number) => {
    void stepIndex;
    return "border-0 bg-transparent p-0 shadow-none";
  };
  const sectionCanvasClassName =
    "rounded-[30px] bg-[linear-gradient(180deg,#fffdf9_0%,#f7efe2_100%)] p-6 ring-1 ring-[#e6d7c5] shadow-[0_16px_34px_rgba(31,23,40,0.05)]";
  const softInfoPanelClassName =
    "rounded-[18px] bg-[#fff9f1] p-4 ring-1 ring-[#eadccb]";
  const showCreateBasics = currentStep === 0;
  const showCreateChannels = currentStep === 1;
  const showCreatePlaybook = currentStep === 2;
  const showCreateKnowledge = currentStep === 3;
  const showCreateFunctions = currentStep === 4;
  const showCreateReview = currentStep === 5;
  function updateDraft<K extends keyof BuilderDraft>(key: K, value: BuilderDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function applyConversationPlaybookPreset(
    preset: ConversationPlaybookConfig["preset"],
  ) {
    const nextPreset = getConversationPlaybookPreset(preset);
    updateDraft("channelConfig", {
      ...draft.channelConfig,
      conversationPlaybook: nextPreset,
    });
  }

  function applyChannelBehaviorPreset(
    preset: ChannelBehaviorConfig["preset"],
    channelType: ChannelConnection["type"] | null | undefined,
  ) {
    updateDraft("channelConfig", {
      ...draft.channelConfig,
      channelBehavior: getChannelBehaviorPresetConfig(preset, channelType ?? null),
    });
  }

  function updateConversationPlaybook(
    patch: Partial<ConversationPlaybookConfig>,
  ) {
    updateDraft("channelConfig", {
      ...draft.channelConfig,
      conversationPlaybook: normalizeConversationPlaybook({
        ...draft.channelConfig.conversationPlaybook,
        ...patch,
      }),
    });
  }

  function updateChannelBehavior(patch: Partial<ChannelBehaviorConfig>) {
    updateDraft("channelConfig", {
      ...draft.channelConfig,
      channelBehavior: normalizeChannelBehavior(
        {
          ...draft.channelConfig.channelBehavior,
          ...patch,
        },
        selectedChannel?.type ?? null,
      ),
    });
  }

  function updateChannelConfig(patch: Partial<ChannelConfigDraft>) {
    updateDraft("channelConfig", {
      ...draft.channelConfig,
      ...patch,
    });
  }

  function updatePromptingIdentity(
    patch: Partial<Pick<PromptingConfig, "persona" | "tone" | "languagePreference">>,
  ) {
    if (typeof patch.persona === "string") {
      updateDraft("persona", patch.persona);
    }

    if (typeof patch.tone === "string") {
      updateDraft("tone", patch.tone);
    }

    if (typeof patch.languagePreference === "string") {
      updateDraft("languagePreference", patch.languagePreference);
    }

    updateChannelConfig({
      prompting: normalizePromptingConfig({
        ...draft.channelConfig.prompting,
        ...patch,
      }),
    });
  }

  function updateKnowledge(index: number, patch: Partial<KnowledgeDraft>) {
    setDraft((current) => ({
      ...current,
      knowledgeBlocks: current.knowledgeBlocks.map((block, blockIndex) =>
        blockIndex === index ? { ...block, ...patch } : block,
      ),
    }));
  }

  function toggleDiscoveryField(field: DiscoveryField, checked: boolean) {
    const currentPlaybook = draft.channelConfig.conversationPlaybook;
    const nextDiscoveryFields = checked
      ? uniqueDiscoveryFields([...currentPlaybook.discoveryFields, field])
      : currentPlaybook.discoveryFields.filter((item) => item !== field);
    const nextDiscoveryOrder = currentPlaybook.discoveryOrder.filter((item) =>
      nextDiscoveryFields.includes(item),
    );

    if (checked && !nextDiscoveryOrder.includes(field)) {
      nextDiscoveryOrder.push(field);
    }

    updateConversationPlaybook({
      discoveryFields: nextDiscoveryFields,
      discoveryOrder: nextDiscoveryOrder,
      openingFields: currentPlaybook.openingFields.filter((item) =>
        nextDiscoveryFields.includes(item),
      ),
      minInfoBeforeAvailability: currentPlaybook.minInfoBeforeAvailability.filter((item) =>
        nextDiscoveryFields.includes(item),
      ),
      minInfoBeforePricing: currentPlaybook.minInfoBeforePricing.filter((item) =>
        nextDiscoveryFields.includes(item),
      ),
    });
  }

  function togglePlaybookFieldArray(
    key: "openingFields" | "minInfoBeforeAvailability" | "minInfoBeforePricing",
    field: DiscoveryField,
    checked: boolean,
  ) {
    const currentValues = draft.channelConfig.conversationPlaybook[key];
    updateConversationPlaybook({
      [key]: checked
        ? uniqueDiscoveryFields([...currentValues, field])
        : currentValues.filter((item) => item !== field),
    } as Partial<ConversationPlaybookConfig>);
  }

  function moveDiscoveryOrder(field: DiscoveryField, direction: -1 | 1) {
    const currentOrder = draft.channelConfig.conversationPlaybook.discoveryOrder;
    const index = currentOrder.indexOf(field);

    if (index === -1) {
      return;
    }

    updateConversationPlaybook({
      discoveryOrder: moveItem(currentOrder, index, direction),
    });
  }

  function updateFunction(index: number, patch: Partial<FunctionDraft>) {
    setDraft((current) => ({
      ...current,
      channelConfig: {
        ...current.channelConfig,
        functionBlocks: current.channelConfig.functionBlocks.map((fn, functionIndex) =>
          functionIndex === index ? { ...fn, ...patch } : fn,
        ),
      },
    }));
  }

  function addFunctionParameter(functionIndex: number) {
    const current = draft.channelConfig.functionBlocks[functionIndex];

    updateFunction(functionIndex, {
      parameters: [
        ...current.parameters,
        {
          uiId: createDraftUiId("param"),
          name: `parameter_${current.parameters.length + 1}`,
          type: "text",
          instruction: "",
          allowedValues: [],
          required: false,
        },
      ],
    });
  }

  function updateFunctionParameter(
    functionIndex: number,
    parameterIndex: number,
    patch: Partial<FunctionDraft["parameters"][number]>,
  ) {
    const current = draft.channelConfig.functionBlocks[functionIndex];

    updateFunction(functionIndex, {
      parameters: current.parameters.map((parameter, currentIndex) =>
        currentIndex === parameterIndex ? { ...parameter, ...patch } : parameter,
      ),
    });
  }

  function removeFunctionParameter(functionIndex: number, parameterIndex: number) {
    const current = draft.channelConfig.functionBlocks[functionIndex];

    updateFunction(functionIndex, {
      parameters: current.parameters.filter((_, currentIndex) => currentIndex !== parameterIndex),
    });
  }

  function updateFunctionStep(
    functionIndex: number,
    stepIndex: number,
    patch: Partial<ToolStepDraft>,
  ) {
    setDraft((current) => ({
      ...current,
      channelConfig: {
        ...current.channelConfig,
        functionBlocks: current.channelConfig.functionBlocks.map((fn, currentFunctionIndex) =>
          currentFunctionIndex === functionIndex
            ? {
                ...fn,
                steps: fn.steps.map((step, currentStepIndex) =>
                  currentStepIndex === stepIndex ? { ...step, ...patch } : step,
                ),
              }
            : fn,
        ),
      },
    }));
  }

  const getFunctionStepKey = useCallback(
    (functionIndex: number, stepIndex: number) =>
      draft.channelConfig.functionBlocks[functionIndex]?.steps[stepIndex]?.uiId ?? "",
    [draft.channelConfig.functionBlocks],
  );

  function updateFunctionStepParams(
    functionIndex: number,
    stepIndex: number,
    patch: Record<string, unknown>,
  ) {
    const currentParams = safeParseJsonObject(
      draft.channelConfig.functionBlocks[functionIndex]?.steps[stepIndex]?.params ?? "{}",
    );

    updateFunctionStep(functionIndex, stepIndex, {
      params: stringifyJsonObject({
        ...currentParams,
        ...patch,
      }),
    });
  }

  function updateGoogleSheetsFilters(
    functionIndex: number,
    stepIndex: number,
    filters: GoogleSheetsFilterDraft[],
  ) {
    updateFunctionStepParams(functionIndex, stepIndex, { filters });
  }

  function updateGoogleSheetsFilter(
    functionIndex: number,
    stepIndex: number,
    filterIndex: number,
    patch: Partial<GoogleSheetsFilterDraft>,
  ) {
    const currentFilters = getGoogleSheetsParams(
      draft.channelConfig.functionBlocks[functionIndex].steps[stepIndex],
    ).filters;

    updateGoogleSheetsFilters(
      functionIndex,
      stepIndex,
      currentFilters.map((filter, currentFilterIndex) =>
        currentFilterIndex === filterIndex ? { ...filter, ...patch } : filter,
      ),
    );
  }

  function addGoogleSheetsFilter(functionIndex: number, stepIndex: number) {
    const currentFilters = getGoogleSheetsParams(
      draft.channelConfig.functionBlocks[functionIndex].steps[stepIndex],
    ).filters;

    updateGoogleSheetsFilters(functionIndex, stepIndex, [
      ...currentFilters,
      { column: "", operator: "equals", valueSource: "literal", value: "" },
    ]);
  }

  function updateGoogleSheetsColumnMappings(
    functionIndex: number,
    stepIndex: number,
    columnMappings: GoogleSheetsColumnMappingDraft[],
  ) {
    updateFunctionStepParams(functionIndex, stepIndex, { columnMappings });
  }

  function updateGoogleSheetsColumnMapping(
    functionIndex: number,
    stepIndex: number,
    mappingIndex: number,
    patch: Partial<GoogleSheetsColumnMappingDraft>,
  ) {
    const currentMappings = getGoogleSheetsParams(
      draft.channelConfig.functionBlocks[functionIndex].steps[stepIndex],
    ).columnMappings;

    updateGoogleSheetsColumnMappings(
      functionIndex,
      stepIndex,
      currentMappings.map((mapping, currentMappingIndex) =>
        currentMappingIndex === mappingIndex ? { ...mapping, ...patch } : mapping,
      ),
    );
  }

  function addGoogleSheetsColumnMapping(functionIndex: number, stepIndex: number) {
    const currentMappings = getGoogleSheetsParams(
      draft.channelConfig.functionBlocks[functionIndex].steps[stepIndex],
    ).columnMappings;

    updateGoogleSheetsColumnMappings(functionIndex, stepIndex, [
      ...currentMappings,
      { column: "", valueSource: "literal", value: "" },
    ]);
  }

  const inspectGoogleSpreadsheet = useCallback(async (functionIndex: number, stepIndex: number) => {
    const step = draft.channelConfig.functionBlocks[functionIndex]?.steps[stepIndex];
    const integration = step ? integrationById.get(step.integrationId) : null;
    const sheetParams = step ? getGoogleSheetsParams(step) : null;
    const spreadsheetId = sheetParams?.spreadsheetId.trim() ?? "";
    const key = getFunctionStepKey(functionIndex, stepIndex);

    if (!integration || integration.type !== IntegrationType.GOOGLE_SHEETS || !spreadsheetId) {
      return;
    }

    setSheetInspectors((current) => ({
      ...current,
      [key]: {
        ...current[key],
        isLoading: true,
        error: null,
        spreadsheetId,
        sheets: current[key]?.sheets ?? [],
      },
    }));

    try {
      const response = await fetch(
        `/api/admin/tenants/${tenant.id}/integrations/${integration.id}/google-sheets/inspect?spreadsheetId=${encodeURIComponent(spreadsheetId)}&sheetName=${encodeURIComponent(sheetParams?.sheetName ?? "")}&headerRow=${encodeURIComponent(String(sheetParams?.headerRow ?? 1))}`,
      );
      const result = (await response.json().catch(() => null)) as
        | {
            error?: string;
            item?: {
              spreadsheetId: string;
              title: string;
              selectedSheetName: string;
              headerRow: number;
              headers: string[];
              sheets: Array<{ title: string }>;
            };
          }
        | null;

      if (!response.ok || !result?.item) {
        throw new Error(result?.error ?? "Could not inspect this spreadsheet.");
      }

      const item = result.item;

      updateFunctionStep(functionIndex, stepIndex, {
        params: stringifyJsonObject({
          ...safeParseJsonObject(step?.params ?? "{}"),
          spreadsheetId: item.spreadsheetId,
          spreadsheetTitle: item.title,
          sheetName:
            sheetParams?.sheetName && item.sheets.some((sheet) => sheet.title === sheetParams.sheetName)
              ? sheetParams.sheetName
              : item.selectedSheetName || item.sheets[0]?.title || "",
        }),
      });

      setSheetInspectors((current) => ({
        ...current,
        [key]: {
          isLoading: false,
          error: null,
          spreadsheetId: item.spreadsheetId,
          title: item.title,
          selectedSheetName: item.selectedSheetName,
          headerRow: item.headerRow,
          headers: item.headers,
          sheets: item.sheets.map((sheet) => sheet.title),
          spreadsheets: current[key]?.spreadsheets ?? [],
        },
      }));
    } catch (inspectError) {
      setSheetInspectors((current) => ({
        ...current,
        [key]: {
          isLoading: false,
          error:
            inspectError instanceof Error
              ? inspectError.message
              : "Could not inspect this spreadsheet.",
          spreadsheetId,
          sheets: [],
          headers: [],
          spreadsheets: current[key]?.spreadsheets ?? [],
        },
      }));
    }
  }, [draft.channelConfig.functionBlocks, getFunctionStepKey, integrationById, tenant.id]);

  useEffect(() => {
    draft.channelConfig.functionBlocks.forEach((tool, toolIndex) => {
      tool.steps.forEach((step, stepIndex) => {
        const integration = integrationById.get(step.integrationId);
        if (integration?.type !== IntegrationType.GOOGLE_SHEETS) {
          return;
        }

        const sheetParams = getGoogleSheetsParams(step);
        const spreadsheetId = sheetParams.spreadsheetId.trim();
        if (!spreadsheetId) {
          return;
        }

        const key = getFunctionStepKey(toolIndex, stepIndex);
        const inspector = sheetInspectors[key];
        const needsInspection =
          !inspector ||
          inspector.spreadsheetId !== spreadsheetId ||
          inspector.selectedSheetName !== sheetParams.sheetName ||
          inspector.headerRow !== sheetParams.headerRow ||
          !inspector.headers?.length;

        if (needsInspection && !inspector?.isLoading && !inspector?.error) {
          void inspectGoogleSpreadsheet(toolIndex, stepIndex);
        }
      });
    });
  }, [
    draft.channelConfig.functionBlocks,
    getFunctionStepKey,
    inspectGoogleSpreadsheet,
    integrationById,
    sheetInspectors,
  ]);

  async function loadGoogleSpreadsheetCatalog(toolIndex: number, stepIndex: number) {
    const step = draft.channelConfig.functionBlocks[toolIndex]?.steps[stepIndex];
    const integration = step ? integrationById.get(step.integrationId) : null;
    const key = getFunctionStepKey(toolIndex, stepIndex);

    if (!integration || integration.type !== IntegrationType.GOOGLE_SHEETS) {
      return;
    }

    setSheetInspectors((current) => ({
      ...current,
      [key]: {
        ...current[key],
        isLoading: true,
        error: null,
        sheets: current[key]?.sheets ?? [],
        spreadsheets: current[key]?.spreadsheets ?? [],
      },
    }));

    try {
      const response = await fetch(
        `/api/admin/tenants/${tenant.id}/integrations/${integration.id}/google-sheets/catalog`,
      );
      const result = (await response.json().catch(() => null)) as
        | {
            error?: string;
            items?: Array<{ id: string; name: string }>;
          }
        | null;

      if (!response.ok || !result?.items) {
        throw new Error(result?.error ?? "Could not load Google spreadsheets.");
      }

      setSheetInspectors((current) => ({
        ...current,
        [key]: {
          ...current[key],
          isLoading: false,
          error: null,
          sheets: current[key]?.sheets ?? [],
          spreadsheets: result.items,
        },
      }));
    } catch (catalogError) {
      setSheetInspectors((current) => ({
        ...current,
        [key]: {
          ...current[key],
          isLoading: false,
          error:
            catalogError instanceof Error
              ? catalogError.message
              : "Could not load Google spreadsheets.",
          sheets: current[key]?.sheets ?? [],
          spreadsheets: current[key]?.spreadsheets ?? [],
        },
      }));
    }
  }

  function addKnowledgeBlock() {
    updateDraft("knowledgeBlocks", [
      ...draft.knowledgeBlocks,
      createKnowledgeDraft(),
    ]);
  }

  function addFunctionBlock() {
    updateChannelConfig({
      functionBlocks: [
        ...draft.channelConfig.functionBlocks,
        withFunctionUiIds({
          ...getDefaultFunctionBlock(),
          name: "",
          description: "",
          steps: [],
        }),
      ],
    });
  }

  function addFunctionStep(toolIndex: number) {
    const selectedIntegration = integrationById.get(connectedIntegrations[0]?.id ?? "");
    const defaultStep = getDefaultStepDraftForIntegration(selectedIntegration?.type);

    updateFunction(toolIndex, {
      steps: [
        ...draft.channelConfig.functionBlocks[toolIndex].steps,
        {
          uiId: createDraftUiId("step"),
          integrationId: connectedIntegrations[0]?.id ?? "",
          action: defaultStep.action,
          params: defaultStep.params,
        },
      ],
    });
  }

  function moveFunctionBlock(index: number, direction: -1 | 1) {
    updateChannelConfig({
      functionBlocks: moveItem(draft.channelConfig.functionBlocks, index, direction),
    });
  }

  function removeFunctionBlock(index: number) {
    const removedFunction = draft.channelConfig.functionBlocks[index];

    updateChannelConfig({
      functionBlocks: draft.channelConfig.functionBlocks.filter((_, currentIndex) => currentIndex !== index),
    });

    if (removedFunction) {
      setSheetInspectors((current) => {
        const next = { ...current };

        removedFunction.steps.forEach((step) => {
          const key = getSheetInspectorKey(step);
          if (key) {
            delete next[key];
          }
        });

        return next;
      });
    }
  }

  function removeFunctionStep(functionIndex: number, stepIndex: number) {
    const removedStep = draft.channelConfig.functionBlocks[functionIndex]?.steps[stepIndex];

    updateFunction(functionIndex, {
      steps: draft.channelConfig.functionBlocks[functionIndex].steps.filter(
        (_, currentIndex) => currentIndex !== stepIndex,
      ),
    });

    const key = getSheetInspectorKey(removedStep);
    if (key) {
      setSheetInspectors((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
    }
  }

  function handleFunctionStepIntegrationChange(
    functionIndex: number,
    stepIndex: number,
    integrationId: string,
  ) {
    const currentStep = draft.channelConfig.functionBlocks[functionIndex].steps[stepIndex];
    const nextIntegration = integrationById.get(integrationId);
    const integrationChanged = currentStep.integrationId !== integrationId;
    const defaultNextStep = getDefaultStepDraftForIntegration(nextIntegration?.type);

    updateFunctionStep(functionIndex, stepIndex, {
      integrationId,
      action: integrationChanged
        ? defaultNextStep.action
        : currentStep.action.trim() || defaultNextStep.action,
      params: integrationChanged
        ? defaultNextStep.params
        : currentStep.params.trim() === "{}" && defaultNextStep.params !== "{}"
          ? defaultNextStep.params
          : currentStep.params,
    });

    setSheetInspectors((current) => {
      const next = { ...current };
      const key = getSheetInspectorKey(currentStep);
      if (key) {
        delete next[key];
      }
      return next;
    });
  }

  async function saveDraft() {
    if (parsedFunctionBlocks.errors.length > 0) {
      setError("Fix invalid Functions configuration before saving this agent.");
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        name: draft.name,
        persona: draft.persona,
        tone: draft.tone,
        languagePreference: draft.languagePreference || undefined,
        channelId: draft.channelId,
        channelConfig: {
          priceAttachmentFileId: draft.channelConfig.priceAttachmentFileId || undefined,
          priceAttachmentFileName: draft.channelConfig.priceAttachmentFileName || undefined,
          priceAttachmentMimeType: draft.channelConfig.priceAttachmentMimeType || undefined,
          channelBehavior: draft.channelConfig.channelBehavior,
          conversationPlaybook: draft.channelConfig.conversationPlaybook,
          prompting: draft.channelConfig.prompting,
          control: draft.channelConfig.control,
          functionBlocks: stripFunctionUiIds(draft.channelConfig.functionBlocks),
        },
        knowledgeBlocks: stripKnowledgeUiIds(draft.knowledgeBlocks),
      };

      const response = await fetch(
        agent
          ? `/api/admin/tenants/${tenant.id}/agents/${agent.id}`
          : `/api/admin/tenants/${tenant.id}/agents`,
        {
          method: agent ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      const result = (await response.json().catch(() => null)) as
        | { error?: string; item?: { id: string } }
        | null;

      if (!response.ok) {
        setError(result?.error || "Could not save this agent draft.");
        return;
      }

      setSuccess(agent ? "Draft changes saved." : "Agent draft created.");
      setSavedDraftSnapshot(JSON.stringify(draft));

      if (!agent && result?.item?.id) {
        router.push(`/admin/clients/${tenant.id}/agents/${result.item.id}`);
        router.refresh();
        return;
      }

      startTransition(() => {
        router.refresh();
      });
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save this agent draft.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function handleNextStep() {
    setCurrentStep((step) => Math.min(step + 1, wizardSteps.length - 1));
  }

  function handlePreviousStep() {
    setCurrentStep((step) => Math.max(step - 1, 0));
  }

  return (
    <div className="mx-auto max-w-[1480px] space-y-8">
      {error ? (
        <div className="rounded-[20px] border border-[#efc4c1] bg-[#fff0ef] px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-[20px] border border-[#b9dec8] bg-[#eef8f1] px-4 py-3 text-sm text-[#157347]">
          {success}
        </div>
      ) : null}
      <div className="sticky top-4 z-20 flex items-center justify-between gap-4 rounded-[22px] border border-[#e2d4c3] bg-[rgba(255,250,243,0.92)] px-4 py-3 text-[#2d2130] shadow-[0_14px_32px_rgba(31,23,40,0.10)] backdrop-blur">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#201627] text-[#f7efe4] shadow-[0_10px_18px_rgba(31,23,40,0.16)]">
            <Sparkles className="size-3.5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8c745b]">
              Create flow state
            </p>
            <p className="mt-1 text-sm font-semibold text-[#201627]">
              {isDirty ? "Unsaved changes" : "All changes saved"}
            </p>
            <p className="text-xs text-[#6d5b4d]">
              Save before running the saved-agent test flow or deploying the latest behavior.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-[#eadccc] bg-[#fff6ea] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6d5c4d]">
            Step {currentStep + 1} of {wizardSteps.length}
          </span>
          <button
            className={primaryButtonClassName}
            disabled={isSaving || !isDirty}
            onClick={saveDraft}
            type="button"
          >
            {isSaving ? "Saving..." : agent ? "Save changes" : "Save draft"}
          </button>
        </div>
      </div>

      <div className="rounded-[30px] border border-[#e5d3be] bg-[linear-gradient(180deg,#fffaf4_0%,#f5e7d6_100%)] p-5 shadow-[0_16px_36px_rgba(31,23,40,0.05)] sm:p-6">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_220px_220px]">
          <div className="rounded-[24px] bg-white/80 px-5 py-5 ring-1 ring-[#e6d7c5] shadow-[0_14px_28px_rgba(31,23,40,0.05)]">
            <div className="flex items-start gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#201627] text-[#f7efe4] shadow-[0_10px_20px_rgba(31,23,40,0.18)]">
                <Sparkles className="size-4" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8d7762]">
                  Current create-flow step
                </p>
                <h3 className="mt-2 text-[1.55rem] font-semibold tracking-tight text-[#201627]">
                  {currentStepMeta.title}
                </h3>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-[#5d5245]">
                  {currentStepMeta.question}
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-[24px] bg-white/80 p-5 ring-1 ring-[#e6d7c5] shadow-[0_14px_28px_rgba(31,23,40,0.05)]">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8d7762]">
                Build posture
              </p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
                {completedChecklistCount}/{checklistItems.length}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Signals already in place before this agent touches real traffic.
              </p>
            </div>
          <div className="rounded-[24px] bg-white/80 p-5 ring-1 ring-[#e6d7c5] shadow-[0_14px_28px_rgba(31,23,40,0.05)]">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8d7762]">
                Operator scope
              </p>
              <p className="mt-3 text-sm leading-7 text-[#4d4038]">
                One tenant, one assigned channel, one controlled runtime path. Build sharply before testing and deploy.
              </p>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#f7efe2] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6d5c4d] ring-1 ring-[#eadccc]">
                <Bot className="size-3.5" />
                Operator managed
              </div>
          </div>
        </div>
      </div>

      <div
        className={
          isWideWorkbenchStep
            ? "grid gap-8 xl:grid-cols-[220px_minmax(0,1fr)] xl:items-start"
            : "grid gap-8 xl:grid-cols-[220px_minmax(0,1fr)_340px] xl:items-start"
        }
      >
        <aside className="space-y-4 xl:sticky xl:top-24">
          <div className="rounded-[30px] bg-[#1f1728] p-5 text-[#f6efe5] shadow-[0_18px_40px_rgba(31,23,40,0.18)]">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#ccbda8]">
              Create flow
            </p>
            <div className="mt-4 space-y-2">
              {wizardSteps.map((step, index) => {
                const isActive = index === currentStep;
                const isComplete = index < currentStep;

                return (
                  <button
                    key={step.id}
                    className={
                      isActive
                        ? "w-full rounded-[20px] bg-[#f4eadc] px-4 py-4 text-left text-[#1f1728] shadow-[0_10px_22px_rgba(0,0,0,0.10)]"
                        : "w-full rounded-[20px] px-4 py-4 text-left text-[#f6efe5] ring-1 ring-white/10 transition hover:bg-white/6"
                    }
                    onClick={() => setCurrentStep(index)}
                    type="button"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={
                          isActive
                            ? "flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold"
                            : isComplete
                              ? "flex size-8 shrink-0 items-center justify-center rounded-full bg-[#f4c79b] text-[#1f1728] text-xs font-semibold"
                              : "flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-[#f6efe5]"
                        }
                      >
                        {index + 1}
                      </div>
                      <div>
                        <p className={isActive ? "text-sm font-semibold" : "text-sm font-medium"}>
                          {step.title}
                        </p>
                        <p
                          className={
                            isActive
                              ? "mt-1 text-xs leading-5 text-[#5d5245]"
                              : "mt-1 text-xs leading-5 text-[#ccbda8]"
                          }
                        >
                            {step.question}
                          </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <div className="space-y-6">

          {showCreateBasics ? (
            <>
              <SurfaceCard
                className={sectionCardClassName(0)}
                title="Basics"
                description="Name the agent and orient the operator before channel and workflow setup."
              >
                <div className={sectionCanvasClassName}>
                  <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_320px]">
                    <div className="space-y-5">
                      <FormField
                        label="Agent name"
                        hint="Use a business-facing name the operator can scan quickly."
                      >
                        <input
                          className={inputClassName}
                          onChange={(event) => updateDraft("name", event.target.value)}
                          value={draft.name}
                        />
                      </FormField>
                    </div>
                    <div className="space-y-4">
                      <div className={softInfoPanelClassName}>
                        <p className="text-sm font-semibold text-foreground">What belongs here</p>
                        <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                          <li>Agent name and quick operator orientation.</li>
                          <li>Prompt identity now lives in the dedicated Prompting card below.</li>
                          <li>No duplicate persona, tone, or language fields here.</li>
                        </ul>
                      </div>
                      <div className={softInfoPanelClassName}>
                        <p className="text-sm font-semibold text-foreground">Why it changed</p>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          The old builder mixed naming and prompt identity in one block. This step now keeps the setup clean while the Prompting section stays the single place for identity and instruction.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </SurfaceCard>
              <WorkspacePromptingSection
                languagePreference={draft.languagePreference}
                onLanguageChange={(value) =>
                  updatePromptingIdentity({ languagePreference: value })
                }
                onPersonaChange={(value) => updatePromptingIdentity({ persona: value })}
                onPromptingInstructionChange={(value) =>
                  updateChannelConfig({
                    prompting: normalizePromptingConfig({
                      ...draft.channelConfig.prompting,
                      instruction: value,
                    }),
                  })
                }
                onPromptingNotesChange={(value) =>
                  updateChannelConfig({
                    prompting: normalizePromptingConfig({
                      ...draft.channelConfig.prompting,
                      notes: value,
                    }),
                  })
                }
                onShowChannelContextChange={(value) =>
                  updateChannelConfig({
                    prompting: normalizePromptingConfig({
                      ...draft.channelConfig.prompting,
                      showChannelContext: value,
                    }),
                  })
                }
                onShowContactIdentityChange={(value) =>
                  updateChannelConfig({
                    prompting: normalizePromptingConfig({
                      ...draft.channelConfig.prompting,
                      showContactIdentity: value,
                    }),
                  })
                }
                onToneChange={(value) => updatePromptingIdentity({ tone: value })}
                persona={draft.persona}
                promptingInstruction={draft.channelConfig.prompting.instruction ?? ""}
                promptingNotes={draft.channelConfig.prompting.notes ?? ""}
                showChannelContext={draft.channelConfig.prompting.showChannelContext}
                showContactIdentity={draft.channelConfig.prompting.showContactIdentity}
                tone={draft.tone}
              />
            </>
          ) : null}

          {showCreateChannels ? (
            <>
              <SurfaceCard
                className={sectionCardClassName(1)}
                title="Channel"
                description="Bind the agent to one connected tenant channel. Unavailable channels stay visible so the rule is obvious."
              >
            <div className="rounded-[34px] border border-[#ead7c0] bg-[radial-gradient(circle_at_top_left,#fffdf8_0%,#f8eee0_45%,#f4e7d6_100%)] p-6 shadow-[0_24px_54px_rgba(49,31,18,0.08)] sm:p-8">
              <div className="rounded-[26px] bg-white/72 px-5 py-5 ring-1 ring-[#eadccc]">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8d7762]">
                  Channel assignment
                </p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[#201627]">
                  Choose where this agent will live and respond.
                </h3>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-[#5d5245]">
                  A channel is a real runtime boundary. Connected channels stay visible even when blocked, so the operator can see the assignment rule instead of guessing.
                </p>
              </div>
              <div className="mt-5">
              {tenant.channelConnections.length === 0 ? (
                <EmptyState
                  title="No channel available"
                  description="Connect at least one channel in the client portal before turning this draft into a real agent."
                  action={
                    <Link
                      href="/client/connections"
                      className={secondaryButtonClassName}
                    >
                      Open client connections
                    </Link>
                  }
                />
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {tenant.channelConnections.map((connection) => {
                    const assignedAgentName = assignedChannels.get(connection.id);
                    const isUnavailable =
                      connection.status !== "CONNECTED" || Boolean(assignedAgentName);

                    return (
                      <label
                        key={connection.id}
                        className={
                          draft.channelId === connection.id
                            ? "flex cursor-pointer items-start gap-4 rounded-[24px] border border-[#d6a06c] bg-[#fff7ef] p-6 shadow-[0_12px_26px_rgba(199,92,42,0.12)]"
                            : "flex cursor-pointer items-start gap-4 rounded-[24px] border border-[#eadfcf] bg-[#fffcf8] p-6 transition hover:border-[#d8c1aa] hover:bg-white"
                        }
                      >
                        <input
                          checked={draft.channelId === connection.id}
                          className="mt-1 size-4"
                          disabled={isUnavailable}
                          name="channelId"
                          onChange={() => {
                            updateDraft("channelId", connection.id);
                            updateDraft("channelConfig", {
                              ...draft.channelConfig,
                              channelBehavior: getDefaultChannelBehaviorConfig(connection.type),
                            });
                          }}
                          type="radio"
                        />
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-lg font-semibold text-foreground">
                              {connection.type}
                            </p>
                            <StatusBadge status={connection.status} />
                          </div>
                          <p className="text-sm leading-7 text-muted-foreground">
                            {assignedAgentName
                              ? `Already assigned to ${assignedAgentName}.`
                              : connection.status === "CONNECTED"
                                ? "Ready for agent assignment."
                                : "This channel must be connected before it can be assigned."}
                          </p>
                          <div className="pt-2">
                            <span className="rounded-full bg-[#f7efe2] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6d5c4d] ring-1 ring-[#eadccc]">
                              {assignedAgentName ? "Unavailable" : connection.status === "CONNECTED" ? "Available" : "Needs connection"}
                            </span>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
              </div>
            </div>
              </SurfaceCard>

              <SurfaceCard
                className={sectionCardClassName(1)}
                title="Channel behavior"
                description="Shape how the same agent presents itself in this channel before business knowledge and functions add detail."
              >
                  <div className="rounded-[30px] bg-[linear-gradient(180deg,#fffefb_0%,#f8efe3_100%)] p-6 ring-1 ring-[#e6d7c5] shadow-[0_18px_36px_rgba(31,23,40,0.06)] sm:p-7">
                    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_280px]">
                      <FormField
                        label="Behavior preset"
                        hint="Recommended defaults change with the selected channel."
                      >
                        <select
                          className={selectClassName}
                          disabled={!selectedChannel}
                          onChange={(event) =>
                            applyChannelBehaviorPreset(
                              event.target.value as ChannelBehaviorConfig["preset"],
                              selectedChannel?.type,
                            )
                          }
                          value={draft.channelConfig.channelBehavior.preset}
                        >
                          {channelBehaviorPresetOptions.map((option) => (
                            <option key={option} value={option}>
                              {humanizeBuilderToken(option)}
                            </option>
                          ))}
                        </select>
                      </FormField>
                      <div className="rounded-[24px] bg-[#fff8ef] p-5 ring-1 ring-[#eadccc]">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ccbda8]">
                          Channel-aware defaults
                        </p>
                        <p className="mt-3 text-sm leading-7 text-[#655446]">
                          Gmail can stay more polished and formatted. Instagram, Telegram, and web chat should stay lighter and faster by default.
                        </p>
                      </div>
                    </div>
                    <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                      <FormField label="Response length">
                        <select
                          className={selectClassName}
                          disabled={false}
                          onChange={(event) =>
                            updateChannelBehavior({
                              responseLength: event.target.value as ChannelBehaviorConfig["responseLength"],
                            })
                          }
                          value={draft.channelConfig.channelBehavior.responseLength}
                        >
                          {responseLengthOptions.map((option) => (
                            <option key={option} value={option}>
                              {humanizeBuilderToken(option)}
                            </option>
                          ))}
                        </select>
                      </FormField>
                      <FormField label="Message format">
                        <select
                          className={selectClassName}
                          disabled={false}
                          onChange={(event) =>
                            updateChannelBehavior({
                              messageFormat: event.target.value as ChannelBehaviorConfig["messageFormat"],
                            })
                          }
                          value={draft.channelConfig.channelBehavior.messageFormat}
                        >
                          {messageFormatOptions.map((option) => (
                            <option key={option} value={option}>
                              {humanizeBuilderToken(option)}
                            </option>
                          ))}
                        </select>
                      </FormField>
                      <FormField label="Tone pace">
                        <select
                          className={selectClassName}
                          disabled={false}
                          onChange={(event) =>
                            updateChannelBehavior({
                              tonePace: event.target.value as ChannelBehaviorConfig["tonePace"],
                            })
                          }
                          value={draft.channelConfig.channelBehavior.tonePace}
                        >
                          {tonePaceOptions.map((option) => (
                            <option key={option} value={option}>
                              {humanizeBuilderToken(option)}
                            </option>
                          ))}
                        </select>
                      </FormField>
                      <FormField label="CTA style">
                        <select
                          className={selectClassName}
                          disabled={false}
                          onChange={(event) =>
                            updateChannelBehavior({
                              ctaStyle: event.target.value as ChannelBehaviorConfig["ctaStyle"],
                            })
                          }
                          value={draft.channelConfig.channelBehavior.ctaStyle}
                        >
                          {ctaStyleOptions.map((option) => (
                            <option key={option} value={option}>
                              {humanizeBuilderToken(option)}
                            </option>
                          ))}
                        </select>
                      </FormField>
                      <FormField label="Emoji usage">
                        <select
                          className={selectClassName}
                          disabled={false}
                          onChange={(event) =>
                            updateChannelBehavior({
                              emojiUsage: event.target.value as ChannelBehaviorConfig["emojiUsage"],
                            })
                          }
                          value={draft.channelConfig.channelBehavior.emojiUsage}
                        >
                          {emojiUsageOptions.map((option) => (
                            <option key={option} value={option}>
                              {humanizeBuilderToken(option)}
                            </option>
                          ))}
                        </select>
                      </FormField>
                    </div>
                    <div className="mt-6 grid gap-3 md:grid-cols-3">
                      {[
                        {
                          key: "useSignature",
                          label: "Use signature",
                          value: draft.channelConfig.channelBehavior.useSignature,
                        },
                        {
                          key: "useRichFormatting",
                          label: "Use rich formatting",
                          value: draft.channelConfig.channelBehavior.useRichFormatting,
                        },
                        {
                          key: "allowAttachments",
                          label: "Allow attachments",
                          value: draft.channelConfig.channelBehavior.allowAttachments,
                        },
                      ].map((toggle) => (
                        <label
                          key={toggle.key}
                          className="flex items-center gap-3 rounded-[18px] bg-white/80 px-4 py-4 ring-1 ring-[#eadccc]"
                        >
                          <input
                            checked={toggle.value}
                            className="size-4"
                            disabled={false}
                            onChange={(event) =>
                              updateChannelBehavior({
                                [toggle.key]: event.target.checked,
                              } as Partial<ChannelBehaviorConfig>)
                            }
                            type="checkbox"
                          />
                          <span className="text-sm font-medium text-[#2f2330]">{toggle.label}</span>
                        </label>
                      ))}
                    </div>
                    <div className="mt-6">
                      <FormField
                        label="Channel notes"
                        hint="Optional. Add channel-specific delivery rules that should not leak into every other channel."
                      >
                        <textarea
                          className={textareaClassName}
                          onChange={(event) => updateChannelBehavior({ notes: event.target.value })}
                          readOnly={false}
                          placeholder="For example: Keep Instagram replies punchy and avoid a long sign-off."
                          value={draft.channelConfig.channelBehavior.notes ?? ""}
                        />
                      </FormField>
                    </div>
                  </div>
                </SurfaceCard>

              <SurfaceCard
                className={sectionCardClassName(1)}
                title="Sales assets"
                description="Configure optional files the agent can attach when it sends pricing or offer details."
              >
            <div className={sectionCanvasClassName}>
              <div className="grid gap-5 md:grid-cols-2">
                <FormField
                  label="Pricing attachment"
                  hint="Paste a Google Drive file ID or a share link. The runtime will extract the file ID automatically."
                >
                  <input
                    className={inputClassName}
                    onChange={(event) =>
                      updateDraft("channelConfig", {
                        ...draft.channelConfig,
                        priceAttachmentFileId: event.target.value,
                      })
                    }
                    placeholder="Drive file ID or URL"
                    readOnly={false}
                    value={draft.channelConfig.priceAttachmentFileId}
                  />
                </FormField>
                <FormField
                  label="Attachment label"
                  hint="Optional. Helpful if you want the outgoing email attachment to have a nicer file name."
                >
                  <input
                    className={inputClassName}
                    onChange={(event) =>
                      updateDraft("channelConfig", {
                        ...draft.channelConfig,
                        priceAttachmentFileName: event.target.value,
                      })
                    }
                    placeholder="For example: Myndful Films Pricing Guide"
                    readOnly={false}
                    value={draft.channelConfig.priceAttachmentFileName}
                  />
                </FormField>
              </div>
              <div className="mt-5 grid gap-5 md:grid-cols-[minmax(0,1fr)_240px]">
                <FormField
                  label="Mime type"
                  hint="Optional. Leave blank unless you want to force the attachment content type."
                >
                  <input
                    className={inputClassName}
                    onChange={(event) =>
                      updateDraft("channelConfig", {
                        ...draft.channelConfig,
                        priceAttachmentMimeType: event.target.value,
                      })
                    }
                    placeholder="application/pdf or image/png"
                    readOnly={false}
                    value={draft.channelConfig.priceAttachmentMimeType}
                  />
                </FormField>
                <div className={softInfoPanelClassName}>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#636563]">
                    Runtime behavior
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[#433a49]">
                    When a sales reply includes pricing, Gmail can attach this asset automatically without turning the whole flow into a special hardcoded case.
                  </p>
                </div>
              </div>
            </div>
              </SurfaceCard>
            </>
          ) : null}

          {showCreatePlaybook ? (
            <PlaybookSection
              discoveryFieldLabels={discoveryFieldLabels}
              isReadOnlyMode={isReadOnlyMode}
              onApplyPreset={applyConversationPlaybookPreset}
              onMoveDiscoveryOrder={moveDiscoveryOrder}
              onToggleDiscoveryField={toggleDiscoveryField}
              onToggleFieldArray={togglePlaybookFieldArray}
              onUpdatePlaybook={updateConversationPlaybook}
              playbook={draft.channelConfig.conversationPlaybook}
            />
          ) : null}

          {showCreateKnowledge ? (
            <KnowledgeSection
              blocks={draft.knowledgeBlocks}
              isReadOnlyMode={isReadOnlyMode}
              onAddBlock={addKnowledgeBlock}
              onMoveBlock={(index, direction) =>
                updateDraft("knowledgeBlocks", moveItem(draft.knowledgeBlocks, index, direction))
              }
              onRemoveBlock={(index) =>
                updateDraft(
                  "knowledgeBlocks",
                  draft.knowledgeBlocks.filter((_, itemIndex) => itemIndex !== index),
                )
              }
              onUpdateBlock={updateKnowledge}
              sectionCanvasClassName={sectionCanvasClassName}
            />
          ) : null}

          {showCreateFunctions ? (
            <FunctionsSection
              connectedIntegrations={connectedIntegrations}
              functionBlocks={draft.channelConfig.functionBlocks}
              getFunctionStepKey={getFunctionStepKey}
              getGoogleCalendarParams={getGoogleCalendarParams}
              getGoogleSheetsParams={getGoogleSheetsParams}
              integrationById={integrationById}
              isReadOnlyMode={isReadOnlyMode}
              isWorkspaceMode={false}
              onAddFunctionBlock={addFunctionBlock}
              onAddFunctionParameter={addFunctionParameter}
              onAddFunctionStep={addFunctionStep}
                onAddGoogleSheetsColumnMapping={addGoogleSheetsColumnMapping}
                onAddGoogleSheetsFilter={addGoogleSheetsFilter}
                onFunctionStepIntegrationChange={handleFunctionStepIntegrationChange}
                onInspectGoogleSpreadsheet={inspectGoogleSpreadsheet}
                onLoadGoogleSpreadsheetCatalog={loadGoogleSpreadsheetCatalog}
              onMoveFunctionBlock={moveFunctionBlock}
              onRemoveFunctionBlock={removeFunctionBlock}
              onRemoveFunctionParameter={removeFunctionParameter}
              onRemoveFunctionStep={removeFunctionStep}
              onUpdateFunction={updateFunction}
              onUpdateFunctionParameter={updateFunctionParameter}
                onUpdateFunctionStep={updateFunctionStep}
                onUpdateFunctionStepParams={updateFunctionStepParams}
                onUpdateGoogleSheetsColumnMapping={updateGoogleSheetsColumnMapping}
                onUpdateGoogleSheetsFilter={updateGoogleSheetsFilter}
                sectionCanvasClassName={sectionCanvasClassName}
                sheetInspectors={sheetInspectors}
              />
          ) : null}

          {showCreateReview ? (
            <div className="rounded-[32px] bg-[linear-gradient(180deg,#fffdf9_0%,#f7efe2_100%)] p-8 ring-1 ring-[#e6d7c5] shadow-[0_18px_40px_rgba(31,23,40,0.06)]">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Final pass
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
                Review the operator surface, then launch with confidence
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
                This step is intentionally quieter. The detailed checklist, deploy posture, and prompt shape all live in the right rail so the last decision feels focused instead of buried under another form.
              </p>
              <div className="mt-8 grid gap-4 md:grid-cols-3">
                <div className="rounded-[20px] bg-white/78 p-5 ring-1 ring-[#ece0d2]">
                  <p className="text-sm font-semibold text-foreground">
                    Builder status
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {isDirty
                      ? "There are unsaved edits. Save once before moving into full-cycle testing."
                      : "This draft is in sync with the latest saved builder state."}
                  </p>
                </div>
                <div className="rounded-[20px] bg-white/78 p-5 ring-1 ring-[#ece0d2]">
                  <p className="text-sm font-semibold text-foreground">Test path</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Use the saved-agent test chat for a realistic conversation cycle without live outbound side effects.
                  </p>
                </div>
                <div className="rounded-[20px] bg-white/78 p-5 ring-1 ring-[#ece0d2]">
                  <p className="text-sm font-semibold text-foreground">Prompt shape</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Keep the preview readable enough that an operator can sanity-check tone, rules, and function posture quickly.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-border bg-[#fcfaf6] px-5 py-4 shadow-[0_10px_24px_rgba(31,23,40,0.04)]">
            <div>
              <p className="text-sm font-semibold text-foreground">Wizard navigation</p>
              <p className="text-xs leading-5 text-muted-foreground">
                Move step by step, then save before opening the saved-agent test flow.
              </p>
            </div>
            <button
              className={secondaryButtonClassName}
              disabled={currentStep === 0 || isSaving}
              onClick={handlePreviousStep}
              type="button"
            >
              Back
            </button>
            <div className="flex flex-wrap gap-3">
              <button
                className={secondaryButtonClassName}
                disabled={isSaving}
                onClick={saveDraft}
                type="button"
              >
                {isSaving ? "Saving..." : agent ? "Save changes" : "Save draft"}
              </button>
              {currentStep < wizardSteps.length - 1 ? (
                <button
                  className={primaryButtonClassName}
                  disabled={isSaving}
                  onClick={handleNextStep}
                  type="button"
                >
                  Next step
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className={isWideWorkbenchStep ? "space-y-6 xl:col-span-2" : "space-y-6 xl:sticky xl:top-24"}>
          <SurfaceCard
            className="border-[#dccab6] bg-[linear-gradient(180deg,#fffdf9_0%,#f7ede1_100%)]"
            title="Operator review"
            description="Readiness, launch posture, and tenant context stay together so the last pass feels deliberate instead of procedural."
          >
            <Checklist items={checklistItems} />
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                className={primaryButtonClassName}
                onClick={() => setCurrentStep(wizardSteps.length - 1)}
                type="button"
              >
                Continue to review
              </button>
            </div>
            <div className="mt-6 space-y-3">
              <div className="flex items-center gap-3 rounded-[18px] border border-border bg-[#faf6f0] px-4 py-3">
                <Layers3 className="size-4 text-primary" />
                <div>
                  <p className="text-sm font-semibold text-foreground">{tenant.name}</p>
                  <p className="text-xs text-muted-foreground">Tenant slug: {tenant.slug}</p>
                </div>
              </div>
              {agent ? (
                <div className="flex items-center gap-3 rounded-[18px] border border-border bg-[#faf6f0] px-4 py-3">
                  <Settings2 className="size-4 text-primary" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{agent.name}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <StatusBadge status={agent.status} />
                      {agent.deployedAt ? (
                        <span className="text-xs text-muted-foreground">
                          Deployed {new Date(agent.deployedAt).toLocaleString()}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
              <p className="text-xs leading-5 text-muted-foreground">
                Runtime isolation stays one conversation per `(agentId, contactId)`, and this workspace keeps that operating model visible.
              </p>
            </div>
          </SurfaceCard>

          <SurfaceCard
            className="bg-[#fcfaf6]"
            title="Testing flow"
            description="The draft work happens here. The real conversation cycle belongs to the saved agent workspace."
          >
            <div className="rounded-[20px] border border-border bg-[#faf6f0] p-5">
              <p className="text-sm leading-6 text-[#433a49]">
                Full-cycle testing now belongs in the saved agent workspace. Open the test section to use the right-side test chat with persistent memory and tool execution.
              </p>
              {!agent ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  Save the agent first, then continue testing from the workspace.
                </p>
              ) : null}
            </div>
          </SurfaceCard>
        </div>
      </div>

        <SurfaceCard
          className="bg-[#f8f3ea]"
          title="Prompt preview"
          description="Review the composed system prompt in a readable inspection view before testing or deploy."
        >
          {parsedFunctionBlocks.errors.length ? (
            <div className="mb-4 rounded-[18px] border border-[#f0d2c7] bg-[#fff5f1] px-4 py-3 text-sm text-[#7f3f2a]">
              Fix invalid Functions configuration to restore the full prompt preview.
            </div>
          ) : null}
          <div className="rounded-[24px] bg-white p-4 ring-1 ring-[#e7dccd] shadow-[0_12px_24px_rgba(31,23,40,0.04)]">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#eee3d6] px-2 pb-4">
            <div>
              <p className="text-sm font-semibold text-foreground">System prompt</p>
              <p className="text-xs text-muted-foreground">
                Live builder output for this agent configuration
              </p>
            </div>
            <span className="rounded-full bg-[#f6efe5] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6f6458] ring-1 ring-[#eadccc]">
              Read only
            </span>
          </div>
          <pre className="max-h-[520px] overflow-auto rounded-[20px] bg-[#fcfaf7] px-5 py-5 font-mono text-[12px] leading-6 text-[#2d2437]">
            {promptPreview}
          </pre>
        </div>
      </SurfaceCard>
      </div>
  );
}


