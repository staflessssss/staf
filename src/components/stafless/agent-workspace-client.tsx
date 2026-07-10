"use client";

import { useRouter } from "next/navigation";
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AgentStatus,
  Feature,
  FeatureType,
  IntegrationType,
} from "@prisma/client";
import {
  BookOpen,
  Boxes,
  LayoutDashboard,
  Layers3,
  MessageSquare,
  PenSquare,
  Radio,
  Sparkles,
  Settings2,
  Shield,
  Workflow,
} from "lucide-react";

import {
  EmptyState,
  SurfaceCard,
  primaryButtonClassName,
} from "@/components/stafless/foundation";
import { WorkspaceControlSection } from "@/components/stafless/workspace-sections/control-section";
import { WorkspaceChannelsSection } from "@/components/stafless/workspace-sections/channels-section";
import { FunctionsSection } from "@/components/stafless/workspace-sections/functions-section";
import { IntegrationsSection } from "@/components/stafless/workspace-sections/integrations-section";
import { KnowledgeSection } from "@/components/stafless/workspace-sections/knowledge-section";
import { WorkspaceMessagesSection } from "@/components/stafless/workspace-sections/messages-section";
import { WorkspaceOverviewSection } from "@/components/stafless/workspace-sections/overview-section";
import { PlaybookSection } from "@/components/stafless/workspace-sections/playbook-section";
import { WorkspacePromptingSection } from "@/components/stafless/workspace-sections/prompting-section";
import {
  hasInvalidScheduleWindow,
  WorkspaceSettingsSection,
} from "@/components/stafless/workspace-sections/settings-section";
import {
  AgentSettingsConfig,
  ChannelBehaviorConfig,
  ConversationPlaybookConfig,
  discoveryFieldOptions,
  DiscoveryField,
  getConversationPlaybookPreset,
  getDefaultChannelBehaviorConfig,
  agentDraftSchema,
  formatAgentDraftValidationError,
  normalizeChannelBehavior,
  normalizeConversationPlaybook,
  ControlConfig,
  FunctionBlockConfig,
  getDefaultAgentSettingsConfig,
  getDefaultFunctionBlock,
  getDefaultControlConfig,
  normalizeAgentSettings,
  normalizeControlConfig,
  normalizeFunctionBlocks,
  normalizeIntegrationsConfig,
  normalizePromptingConfig,
  PromptingConfig,
  IntegrationsConfig,
} from "@/lib/agent-config";
import {
  getDefaultGoogleCalendarParams,
  getGoogleCalendarValidationErrors,
  GoogleSheetsColumnMappingDraft,
  GoogleSheetsFilterDraft,
  getGoogleCalendarActionForOperation,
  getGoogleCalendarParams,
  getGoogleSheetsValidationErrors,
  getGoogleSheetsActionForOperation,
  getGoogleSheetsParams,
} from "@/lib/function-execution";
import type {
  SafeChannelConnection,
  SafeIntegrationConnection,
} from "@/components/stafless/agent-editor-shared";
import type { AgentRuntimeProfile } from "@/lib/agent-runtime-profile";

type SerializableTenant = {
  id: string;
  name: string;
  slug: string;
  timezone?: string | null;
  channelConnections: SafeChannelConnection[];
  integrationConnections: SafeIntegrationConnection[];
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
  channel: SafeChannelConnection;
  features: Feature[];
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

type AgentRuntimeType = "gpt_agent";

type ChannelConfigDraft = {
  runtimeType: AgentRuntimeType;
  priceAttachmentFileId: string;
  priceAttachmentFileName: string;
  priceAttachmentMimeType: string;
  priceAttachmentPublicUrl: string;
  agentSettings: AgentSettingsConfig;
  channelBehavior: ChannelBehaviorConfig;
  conversationPlaybook: ConversationPlaybookConfig;
  prompting: PromptingConfig;
  control: ControlConfig;
  integrations: IntegrationsConfig;
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

type WorkspaceDraft = {
  name: string;
  persona: string;
  tone: string;
  languagePreference: string;
  status: AgentStatus;
  channelId: string;
  channelConfig: ChannelConfigDraft;
  knowledgeBlocks: KnowledgeDraft[];
};

type DeployReadinessResult = {
  ready: boolean;
  status: "ready_for_phase_6" | "needs_changes";
  items: Array<{
    key: string;
    label: string;
    done: boolean;
    detail: string;
  }>;
  summary: string;
  nextStatus: string;
  message: string;
  deployed?: boolean;
  webhookSecret?: string | null;
  channelConfig?: {
    webhookPath?: string | null;
    webhookUrl?: string | null;
    webhookRegistration?: "pending_public_url" | "ready_to_register" | "registered" | string;
    outboundMode?: string | null;
    channelType?: string | null;
  } | null;
};

type WorkspaceSectionId =
  | "overview"
  | "settings"
  | "prompting"
  | "channels"
  | "playbook"
  | "messages"
  | "control"
  | "functions"
  | "knowledge"
  | "integrations"
  | "activity";

function isWorkspaceSectionId(value: string): value is WorkspaceSectionId {
  return [
    "overview",
    "settings",
    "prompting",
    "channels",
    "playbook",
    "messages",
    "control",
    "functions",
    "knowledge",
    "integrations",
    "activity",
  ].includes(value);
}

const workspaceSections: Array<{
  id: WorkspaceSectionId;
  title: string;
  description: string;
  kind: "live" | "coming_soon";
  icon: typeof Sparkles;
}> = [
  {
    id: "overview",
    title: "Overview",
    description: "Status, readiness, and the fastest way to orient around this agent.",
    kind: "live",
    icon: LayoutDashboard,
  },
  {
    id: "settings",
    title: "Settings",
    description: "Operational identity, posture, and base agent settings.",
    kind: "live",
    icon: Settings2,
  },
  {
    id: "prompting",
    title: "Prompting",
    description: "Persona, tone, language, and the direct instruction layer.",
    kind: "live",
    icon: PenSquare,
  },
  {
    id: "channels",
    title: "Channels",
    description: "Assignment and channel behavior for the live delivery surface.",
    kind: "live",
    icon: Radio,
  },
  {
    id: "playbook",
    title: "Playbook",
    description: "How the agent leads the conversation toward the business outcome.",
    kind: "live",
    icon: Workflow,
  },
  {
    id: "messages",
    title: "Messages",
    description: "Reply pacing, split-message behavior, and follow-up posture.",
    kind: "live",
    icon: MessageSquare,
  },
  {
    id: "control",
    title: "Control",
    description: "Memory windows, intervention rules, and runtime stop/resume behavior.",
    kind: "live",
    icon: Shield,
  },
  {
    id: "functions",
    title: "Actions",
    description: "Every live business action available to this agent.",
    kind: "live",
    icon: Boxes,
  },
  {
    id: "knowledge",
    title: "Knowledge",
    description: "Business facts, edge cases, and reusable context blocks.",
    kind: "live",
    icon: BookOpen,
  },
  {
    id: "integrations",
    title: "Integrations",
    description: "Connected systems that functions and channels depend on.",
    kind: "live",
    icon: Layers3,
  },
  {
    id: "activity",
    title: "Activity",
    description: "Recent runtime movement, dialogs, and operator-facing diagnostics.",
    kind: "coming_soon",
    icon: Sparkles,
  },
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

function createDraftUiId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function createKnowledgeDraft(block?: Partial<Omit<KnowledgeDraft, "uiId">>): KnowledgeDraft {
  return {
    uiId: createDraftUiId("knowledge"),
    name: block?.name ?? "",
    description: block?.description ?? "",
    knowledgeContent: block?.knowledgeContent ?? "",
  };
}

function stripKnowledgeUiIds(knowledgeBlocks: KnowledgeDraft[]) {
  return knowledgeBlocks.map((block) => ({
    name: block.name,
    description: block.description,
    knowledgeContent: block.knowledgeContent,
  }));
}

function hasIncompleteKnowledgeBlocks(knowledgeBlocks: KnowledgeDraft[]) {
  return knowledgeBlocks.some(
    (block) =>
      !block.name.trim() ||
      !block.description.trim() ||
      !block.knowledgeContent.trim(),
  );
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
  return functionBlocks.map((functionBlock) => {
    const { parameters, resultTargets, steps, ...fn } = stripUiId(functionBlock);

    return {
      ...fn,
      parameters: parameters.map(stripUiId),
      resultTargets: resultTargets.map(stripUiId),
      steps: steps.map(stripUiId),
    };
  });
}

function stripUiId<T extends { uiId?: string }>(item: T): Omit<T, "uiId"> {
  const { uiId, ...rest } = item;
  void uiId;
  return rest;
}

function createInitialDraft(tenant: SerializableTenant, agent?: SerializableAgent): WorkspaceDraft {
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
  const functionBlocks = normalizeFunctionBlocks(
    Array.isArray(rawChannelConfig.functionBlocks)
      ? (rawChannelConfig.functionBlocks as Partial<FunctionDraft>[])
      : [],
  ).map(withFunctionUiIds);
  const usedIntegrationIds = functionBlocks.flatMap((fn) =>
    fn.steps.map((step) => step.integrationId).filter(Boolean),
  );
  const integrationsConfig =
    rawChannelConfig.integrations &&
    typeof rawChannelConfig.integrations === "object" &&
    !Array.isArray(rawChannelConfig.integrations)
      ? normalizeIntegrationsConfig(rawChannelConfig.integrations as Partial<IntegrationsConfig>)
      : normalizeIntegrationsConfig({
          enabledIds: usedIntegrationIds,
        });
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
          persona: agent?.persona,
          tone: agent?.tone,
          languagePreference: agent?.languagePreference ?? null,
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
    status: (agent?.status as AgentStatus) ?? AgentStatus.DRAFT,
    channelId: selectedChannelId,
    channelConfig: {
      runtimeType: "gpt_agent",
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
      priceAttachmentPublicUrl:
        typeof rawChannelConfig.priceAttachmentPublicUrl === "string"
          ? rawChannelConfig.priceAttachmentPublicUrl
          : "",
      agentSettings: normalizeAgentSettings(
        rawChannelConfig.agentSettings &&
          typeof rawChannelConfig.agentSettings === "object" &&
          !Array.isArray(rawChannelConfig.agentSettings)
          ? (rawChannelConfig.agentSettings as Partial<AgentSettingsConfig>)
          : getDefaultAgentSettingsConfig(tenant.timezone),
        tenant.timezone,
      ),
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
      integrations: integrationsConfig,
      functionBlocks,
    },
    knowledgeBlocks,
  };
}

function parseFunctionBlocks(
  functionBlocks: FunctionDraft[],
  integrationById: Map<string, SafeIntegrationConnection>,
) {
  const errors: string[] = [];
  stripFunctionUiIds(functionBlocks).forEach((fn) => {
    if (fn.active && fn.steps.length === 0) {
      errors.push(`${fn.name || "Function"}: choose a result delivery backend before keeping it active.`);
    }

    fn.steps.forEach((step, stepIndex) => {
      const integrationType = integrationById.get(step.integrationId)?.type;

      try {
        if (!integrationType) {
          errors.push(`${fn.name || `#${stepIndex + 1}`}: select an enabled integration.`);
          return;
        }

        if (integrationType === IntegrationType.GOOGLE_CALENDAR) {
          errors.push(...getGoogleCalendarValidationErrors(step).map((error) => `${fn.name || `#${stepIndex + 1}`}: ${error}`));
        }

        if (integrationType === IntegrationType.GOOGLE_SHEETS) {
          errors.push(...getGoogleSheetsValidationErrors(step).map((error) => `${fn.name || `#${stepIndex + 1}`}: ${error}`));
        }

        return {
          integrationId: step.integrationId,
          action: step.action,
          params:
            typeof step.params === "string"
              ? JSON.parse(step.params || "{}")
              : step.params,
        };
      } catch {
        errors.push(`Function "${fn.name || `#${stepIndex + 1}`}" has invalid JSON params.`);
        return {
          integrationId: step.integrationId,
          action: step.action,
          params: {},
        };
      }
    });
  });

  return { errors };
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

function findFunctionStepPosition(functionBlocks: FunctionDraft[], stepUiId: string) {
  for (let functionIndex = 0; functionIndex < functionBlocks.length; functionIndex += 1) {
    const stepIndex = functionBlocks[functionIndex]?.steps.findIndex((step) => step.uiId === stepUiId) ?? -1;

    if (stepIndex >= 0) {
      return {
        functionIndex,
        stepIndex,
        step: functionBlocks[functionIndex].steps[stepIndex],
      };
    }
  }

  return null;
}

export function AgentWorkspaceClient({
  tenant,
  agent,
  initialWorkspaceSection,
  runtimeProfile,
}: {
  tenant: SerializableTenant;
  agent?: SerializableAgent;
  initialWorkspaceSection?: string;
  runtimeProfile: AgentRuntimeProfile;
}) {
  const router = useRouter();
  const isReadOnlyMode = false;
  const [workspaceSection, setWorkspaceSection] = useState<WorkspaceSectionId>(
    initialWorkspaceSection && isWorkspaceSectionId(initialWorkspaceSection)
      ? initialWorkspaceSection
      : "overview",
  );
  const [draft, setDraft] = useState<WorkspaceDraft>(() => createInitialDraft(tenant, agent));
  const [savedDraftSnapshot, setSavedDraftSnapshot] = useState(() =>
    JSON.stringify(createInitialDraft(tenant, agent)),
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isCheckingDeploy, setIsCheckingDeploy] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [sheetInspectors, setSheetInspectors] = useState<Record<string, SheetInspectionState>>({});
  const [selectedKnowledgeIndex, setSelectedKnowledgeIndex] = useState<number | null>(null);

  useEffect(() => {
    if (initialWorkspaceSection && isWorkspaceSectionId(initialWorkspaceSection)) {
      setWorkspaceSection(initialWorkspaceSection);
    }
  }, [initialWorkspaceSection]);
  const draftRef = useRef(draft);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    if (selectedKnowledgeIndex === null) {
      return;
    }

    if (selectedKnowledgeIndex >= draft.knowledgeBlocks.length) {
      setSelectedKnowledgeIndex(
        draft.knowledgeBlocks.length > 0 ? draft.knowledgeBlocks.length - 1 : null,
      );
    }
  }, [draft.knowledgeBlocks.length, selectedKnowledgeIndex]);

  useEffect(() => {
    if (selectedKnowledgeIndex === null) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectedKnowledgeIndex(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedKnowledgeIndex]);

  const tenantConnectedIntegrations = useMemo(
    () =>
      tenant.integrationConnections.filter(
        (connection) => connection.status === "CONNECTED",
      ),
    [tenant.integrationConnections],
  );

  const connectedIntegrations = useMemo(() => {
    const enabledIds = new Set(draft.channelConfig.integrations.enabledIds);

    return tenantConnectedIntegrations.filter((connection) => enabledIds.has(connection.id));
  }, [draft.channelConfig.integrations.enabledIds, tenantConnectedIntegrations]);

  const integrationById = useMemo(
    () =>
      new Map(
        connectedIntegrations.map((integration) => [integration.id, integration]),
      ),
    [connectedIntegrations],
  );

  const functionDependenciesByIntegration = useMemo(() => {
    const dependencies = new Map<
      string,
      {
        functionNames: string[];
        stepCount: number;
      }
    >();

    draft.channelConfig.functionBlocks.forEach((fn) => {
      if (!fn.active) {
        return;
      }

      fn.steps.forEach((step) => {
        if (!step.integrationId) {
          return;
        }

        const current = dependencies.get(step.integrationId) ?? {
          functionNames: [],
          stepCount: 0,
        };

        current.stepCount += 1;

        if (fn.name.trim() && !current.functionNames.includes(fn.name.trim())) {
          current.functionNames.push(fn.name.trim());
        }

        dependencies.set(step.integrationId, current);
      });
    });

    return dependencies;
  }, [draft.channelConfig.functionBlocks]);

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

  const isDirty = JSON.stringify(draft) !== savedDraftSnapshot;
  const selectedWorkspaceSection = workspaceSections.find(
    (section) => section.id === workspaceSection,
  ) ?? workspaceSections[0];
  const sectionCanvasClassName =
    "rounded-[16px] border border-[#e6ebf2] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]";
  const softInfoPanelClassName =
    "rounded-[14px] border border-[#e6ebf2] bg-[#fafcff] p-4";
  const liveWorkspaceSections = new Set<WorkspaceSectionId>([
    "settings",
    "prompting",
    "channels",
    "playbook",
    "messages",
    "control",
    "functions",
    "knowledge",
    "integrations",
  ]);
  const shouldShowWorkspaceOverview = workspaceSection === "overview";
  const shouldShowWorkspaceSettings = workspaceSection === "settings";
  const shouldShowWorkspacePrompting = workspaceSection === "prompting";
  const shouldShowWorkspaceMessages = workspaceSection === "messages";
  const shouldShowWorkspaceControl = workspaceSection === "control";
  const shouldShowWorkspaceIntegrations = workspaceSection === "integrations";
  const showWorkspaceChannels = workspaceSection === "channels";
  const showWorkspacePlaybook = workspaceSection === "playbook";
  const showWorkspaceKnowledge = workspaceSection === "knowledge";
  const showWorkspaceFunctions = workspaceSection === "functions";
  const shouldShowWorkspacePlaceholder =
    !shouldShowWorkspaceOverview &&
    !shouldShowWorkspaceSettings &&
    !shouldShowWorkspacePrompting &&
    !shouldShowWorkspaceMessages &&
    !shouldShowWorkspaceControl &&
    !shouldShowWorkspaceIntegrations &&
    !liveWorkspaceSections.has(workspaceSection);

  function updateDraft<K extends keyof WorkspaceDraft>(key: K, value: WorkspaceDraft[K]) {
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

  function toggleAgentIntegration(integrationId: string, enabled: boolean) {
    const isReferencedByFunction = draft.channelConfig.functionBlocks.some(
      (fn) => fn.steps.some((step) => step.integrationId === integrationId),
    );

    if (!enabled && isReferencedByFunction) {
      setError("Remove this integration from Functions before turning it off for this agent.");
      return;
    }

    const enabledIds = new Set(draft.channelConfig.integrations.enabledIds);

    if (enabled) {
      enabledIds.add(integrationId);
    } else {
      enabledIds.delete(integrationId);
    }

    setError(null);
    updateChannelConfig({
      integrations: normalizeIntegrationsConfig({
        enabledIds: Array.from(enabledIds),
      }),
    });
  }

  function updateControlConfig(patch: Partial<ControlConfig>) {
    updateDraft("channelConfig", {
      ...draft.channelConfig,
      control: normalizeControlConfig({
        ...draft.channelConfig.control,
        ...patch,
      }),
    });
  }

  function updateAgentSettings(patch: Partial<AgentSettingsConfig>) {
    updateDraft("channelConfig", {
      ...draft.channelConfig,
      agentSettings: normalizeAgentSettings(
        {
          ...draft.channelConfig.agentSettings,
          ...patch,
        },
        tenant.timezone,
      ),
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

  function getFunctionStepKey(functionIndex: number, stepIndex: number) {
    return getSheetInspectorKey(draft.channelConfig.functionBlocks[functionIndex]?.steps[stepIndex]);
  }

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
    const key = getSheetInspectorKey(step);
    const stepUiId = step?.uiId ?? "";

    if (!key || !stepUiId || !integration || integration.type !== IntegrationType.GOOGLE_SHEETS || !spreadsheetId) {
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
      const latestStepPosition = findFunctionStepPosition(
        draftRef.current.channelConfig.functionBlocks,
        stepUiId,
      );

      if (
        !latestStepPosition ||
        latestStepPosition.step.integrationId !== integration.id ||
        integrationById.get(latestStepPosition.step.integrationId)?.type !== IntegrationType.GOOGLE_SHEETS
      ) {
        return;
      }

      setDraft((current) => {
        const currentStepPosition = findFunctionStepPosition(current.channelConfig.functionBlocks, stepUiId);

        if (
          !currentStepPosition ||
          currentStepPosition.step.integrationId !== integration.id ||
          integrationById.get(currentStepPosition.step.integrationId)?.type !== IntegrationType.GOOGLE_SHEETS
        ) {
          return current;
        }

        return {
          ...current,
          channelConfig: {
            ...current.channelConfig,
            functionBlocks: current.channelConfig.functionBlocks.map((fn, currentFunctionIndex) =>
              currentFunctionIndex === currentStepPosition.functionIndex
                ? {
                    ...fn,
                    steps: fn.steps.map((currentStep, currentStepIndex) =>
                      currentStepIndex === currentStepPosition.stepIndex
                        ? {
                            ...currentStep,
                            params: stringifyJsonObject({
                              ...safeParseJsonObject(currentStep.params),
                              spreadsheetId: item.spreadsheetId,
                              spreadsheetTitle: item.title,
                              sheetName:
                                item.selectedSheetName || item.sheets[0]?.title || "",
                            }),
                          }
                        : currentStep,
                    ),
                  }
                : fn,
            ),
          },
        };
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
  }, [draft.channelConfig.functionBlocks, integrationById, tenant.id]);

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

        const key = getSheetInspectorKey(step);
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
  }, [draft.channelConfig.functionBlocks, inspectGoogleSpreadsheet, integrationById, sheetInspectors]);

  async function loadGoogleSpreadsheetCatalog(toolIndex: number, stepIndex: number) {
    const step = draft.channelConfig.functionBlocks[toolIndex]?.steps[stepIndex];
    const integration = step ? integrationById.get(step.integrationId) : null;
    const key = getSheetInspectorKey(step);
    const stepUiId = step?.uiId ?? "";

    if (!key || !stepUiId || !integration || integration.type !== IntegrationType.GOOGLE_SHEETS) {
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

      const latestStepPosition = findFunctionStepPosition(
        draftRef.current.channelConfig.functionBlocks,
        stepUiId,
      );

      if (
        !latestStepPosition ||
        latestStepPosition.step.integrationId !== integration.id ||
        integrationById.get(latestStepPosition.step.integrationId)?.type !== IntegrationType.GOOGLE_SHEETS
      ) {
        return;
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
      const latestStepPosition = findFunctionStepPosition(
        draftRef.current.channelConfig.functionBlocks,
        stepUiId,
      );

      if (
        !latestStepPosition ||
        latestStepPosition.step.integrationId !== integration.id ||
        integrationById.get(latestStepPosition.step.integrationId)?.type !== IntegrationType.GOOGLE_SHEETS
      ) {
        return;
      }

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
    const nextIndex = draft.knowledgeBlocks.length;

    updateDraft("knowledgeBlocks", [
      ...draft.knowledgeBlocks,
      createKnowledgeDraft(),
    ]);
    setSelectedKnowledgeIndex(nextIndex);
  }

  function moveKnowledgeBlock(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;

    updateDraft("knowledgeBlocks", moveItem(draft.knowledgeBlocks, index, direction));

    if (selectedKnowledgeIndex === index) {
      setSelectedKnowledgeIndex(nextIndex);
    } else if (selectedKnowledgeIndex === nextIndex) {
      setSelectedKnowledgeIndex(index);
    }
  }

  function removeKnowledgeBlock(index: number) {
    updateDraft(
      "knowledgeBlocks",
      draft.knowledgeBlocks.filter((_, itemIndex) => itemIndex !== index),
    );

    if (selectedKnowledgeIndex === index) {
      setSelectedKnowledgeIndex(null);
    } else if (selectedKnowledgeIndex !== null && selectedKnowledgeIndex > index) {
      setSelectedKnowledgeIndex(selectedKnowledgeIndex - 1);
    }
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
    updateFunction(toolIndex, {
      steps: [
        ...draft.channelConfig.functionBlocks[toolIndex].steps,
        {
          uiId: createDraftUiId("step"),
          integrationId: connectedIntegrations[0]?.id ?? "",
          action: "",
          params: "{}",
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

    if (hasInvalidScheduleWindow(draft.channelConfig.agentSettings)) {
      setError("Fix invalid Settings schedule windows before saving this agent.");
      return;
    }

    if (hasIncompleteKnowledgeBlocks(draft.knowledgeBlocks)) {
      setError("Complete or remove empty Knowledge items before saving this agent.");
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const promptingForPayload = normalizePromptingConfig({
        ...draft.channelConfig.prompting,
        languagePreference: null,
        showChannelContext: false,
        showContactIdentity: false,
      });
      const payload = {
        name: draft.name,
        persona: draft.persona,
        tone: draft.tone,
        languagePreference: undefined,
        status: draft.status,
        channelId: draft.channelId,
        channelConfig: {
          runtimeType: draft.channelConfig.runtimeType,
          priceAttachmentFileId: draft.channelConfig.priceAttachmentFileId || undefined,
          priceAttachmentFileName: draft.channelConfig.priceAttachmentFileName || undefined,
          priceAttachmentMimeType: draft.channelConfig.priceAttachmentMimeType || undefined,
          priceAttachmentPublicUrl: draft.channelConfig.priceAttachmentPublicUrl || undefined,
          agentSettings: draft.channelConfig.agentSettings,
          channelBehavior: draft.channelConfig.channelBehavior,
          conversationPlaybook: draft.channelConfig.conversationPlaybook,
          prompting: promptingForPayload,
          control: draft.channelConfig.control,
          integrations: draft.channelConfig.integrations,
          functionBlocks: stripFunctionUiIds(draft.channelConfig.functionBlocks),
        },
        knowledgeBlocks: stripKnowledgeUiIds(draft.knowledgeBlocks),
      };
      const parsedPayload = agentDraftSchema.safeParse(payload);

      if (!parsedPayload.success) {
        setError(formatAgentDraftValidationError(parsedPayload.error));
        return;
      }

      const response = await fetch(
        agent
          ? `/api/admin/tenants/${tenant.id}/agents/${agent.id}`
          : `/api/admin/tenants/${tenant.id}/agents`,
        {
          method: agent ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(parsedPayload.data),
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

  async function updateAgentStatus(nextStatus: AgentStatus) {
    if (!agent) {
      updateDraft("status", nextStatus);
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(
        `/api/admin/tenants/${tenant.id}/agents/${agent.id}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: nextStatus }),
        },
      );

      const result = (await response.json().catch(() => null)) as
        | { error?: string; item?: { status?: AgentStatus } }
        | null;

      if (!response.ok || !result?.item?.status) {
        setError(result?.error || "Could not update agent status.");
        return;
      }

      const updatedStatus = result.item.status;
      setDraft((current) => ({ ...current, status: updatedStatus }));
      try {
        const savedDraft = JSON.parse(savedDraftSnapshot) as WorkspaceDraft;
        setSavedDraftSnapshot(JSON.stringify({ ...savedDraft, status: updatedStatus }));
      } catch {
        setSavedDraftSnapshot(JSON.stringify({ ...draft, status: updatedStatus }));
      }
      setSuccess(updatedStatus === AgentStatus.ACTIVE ? "Agent resumed." : "Agent paused.");

      startTransition(() => {
        router.refresh();
      });
    } catch (statusError) {
      setError(
        statusError instanceof Error
          ? statusError.message
          : "Could not update agent status.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function checkDeployReadiness() {
    if (!agent) {
      setError("Save this draft first, then open the workspace to check deployment readiness.");
      return;
    }

    setIsCheckingDeploy(true);
    setError(null);
    setSuccess(null);

    try {
        const response = await fetch(
          `/api/admin/tenants/${tenant.id}/agents/${agent.id}/deploy`,
          {
            method: "GET",
          },
        );

      const result = (await response.json().catch(() => null)) as
        | { error?: string; item?: DeployReadinessResult }
        | null;

      if (!result?.item) {
        setError(result?.error || "Could not assess deploy readiness.");
        return;
      }

      setSuccess(result.item.message);
    } catch (deployError) {
      setError(
        deployError instanceof Error
          ? deployError.message
          : "Could not assess deploy readiness.",
      );
      } finally {
        setIsCheckingDeploy(false);
      }
    }

    async function deployCurrentAgent() {
      if (!agent) {
        setError("Save this draft first, then open the workspace to deploy.");
        return;
      }

      setIsDeploying(true);
      setError(null);
      setSuccess(null);

      try {
        const response = await fetch(
          `/api/admin/tenants/${tenant.id}/agents/${agent.id}/deploy`,
          {
            method: "POST",
          },
        );

        const result = (await response.json().catch(() => null)) as
          | { error?: string; item?: DeployReadinessResult }
          | null;

        if (!result?.item) {
          setError(result?.error || "Could not deploy this agent.");
          return;
        }

        setSuccess(result.item.message);
      } catch (deployError) {
        setError(
          deployError instanceof Error
            ? deployError.message
            : "Could not deploy this agent.",
        );
      } finally {
        setIsDeploying(false);
      }
    }

  return (
    <div className="mx-auto max-w-[1720px] space-y-6">
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

      <div
        className="grid gap-6 xl:grid-cols-[minmax(0,1120px)] xl:items-start"
      >
        <div className="space-y-6">
          {shouldShowWorkspaceOverview ? (
            <WorkspaceOverviewSection
              agentName={agent ? agent.name : draft.name}
              functionCount={draft.channelConfig.functionBlocks.length}
              isDirty={isDirty}
              knowledgeCount={draft.knowledgeBlocks.length}
              runtimeProfile={runtimeProfile}
              selectedChannel={selectedChannel}
              softInfoPanelClassName={softInfoPanelClassName}
              status={draft.status}
            />
          ) : null}

          {shouldShowWorkspacePlaceholder ? (
            <SurfaceCard
              className="rounded-[30px] bg-[linear-gradient(180deg,#fffdf9_0%,#f7efe2_100%)] shadow-[0_16px_34px_rgba(31,23,40,0.05)]"
              title={selectedWorkspaceSection.title}
              description={selectedWorkspaceSection.description}
            >
              <EmptyState
                title={`${selectedWorkspaceSection.title} is the next workspace slice`}
                description="This section now has a real home in the agent workspace IA. The runtime contract stays stable while we move each operator control into its permanent destination."
              />
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className={softInfoPanelClassName}>
                  <p className="text-sm font-semibold text-foreground">Why this section exists</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {selectedWorkspaceSection.description}
                  </p>
                </div>
                <div className={softInfoPanelClassName}>
                  <p className="text-sm font-semibold text-foreground">Current safe fallback</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    The current agent runs from the saved workspace configuration. This section is intentionally staged so we can move complex operator controls here without breaking the live runtime path.
                  </p>
                </div>
              </div>
            </SurfaceCard>
          ) : null}

          {shouldShowWorkspaceSettings ? (
            <WorkspaceSettingsSection
              agentSettings={draft.channelConfig.agentSettings}
              name={draft.name}
              onAgentSettingsChange={updateAgentSettings}
              onNameChange={(value) => updateDraft("name", value)}
              onStatusChange={updateAgentStatus}
              status={draft.status}
              tenantTimezone={tenant.timezone}
            />
          ) : null}

          {shouldShowWorkspacePrompting ? (
            <WorkspacePromptingSection
              isReadOnlyMode={isReadOnlyMode}
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
              onPreserveModelVoiceChange={(value) =>
                updateChannelConfig({
                  prompting: normalizePromptingConfig({
                    ...draft.channelConfig.prompting,
                    preserveModelVoice: value,
                  }),
                })
              }
              onPersonaChange={(value) => {
                updateDraft("persona", value);
                updateChannelConfig({
                  prompting: normalizePromptingConfig({
                    ...draft.channelConfig.prompting,
                    persona: value,
                  }),
                });
              }}
              onToneChange={(value) => {
                updateDraft("tone", value);
                updateChannelConfig({
                  prompting: normalizePromptingConfig({
                    ...draft.channelConfig.prompting,
                    tone: value,
                  }),
                });
              }}
              persona={draft.persona}
              promptingInstruction={draft.channelConfig.prompting.instruction ?? ""}
              promptingNotes={draft.channelConfig.prompting.notes ?? ""}
              preserveModelVoice={draft.channelConfig.prompting.preserveModelVoice}
              tone={draft.tone}
            />
          ) : null}

          {showWorkspaceChannels ? (
            <WorkspaceChannelsSection
              assignedChannels={assignedChannels}
              channelConnections={tenant.channelConnections}
              isReadOnlyMode={isReadOnlyMode}
              onSelectChannel={(connection) => {
                updateDraft("channelId", connection.id);
                updateDraft("channelConfig", {
                  ...draft.channelConfig,
                  channelBehavior: getDefaultChannelBehaviorConfig(connection.type),
                });
              }}
              sectionCanvasClassName={sectionCanvasClassName}
              selectedChannelId={draft.channelId}
              softInfoPanelClassName={softInfoPanelClassName}
              tenantId={tenant.id}
            />
          ) : null}

          {shouldShowWorkspaceMessages ? (
            <WorkspaceMessagesSection
              channelBehavior={draft.channelConfig.channelBehavior}
              isReadOnlyMode={isReadOnlyMode}
              modelStyleManagedByPrompt={draft.channelConfig.prompting.preserveModelVoice}
              onUpdateChannelBehavior={updateChannelBehavior}
            />
          ) : null}

          {shouldShowWorkspaceControl ? (
            <WorkspaceControlSection
              control={draft.channelConfig.control}
              isReadOnlyMode={isReadOnlyMode}
              onUpdateControl={updateControlConfig}
            />
          ) : null}

          {showWorkspacePlaybook ? (
            <PlaybookSection
              discoveryFieldLabels={discoveryFieldLabels}
              isReadOnlyMode={isReadOnlyMode || draft.channelConfig.prompting.preserveModelVoice}
              isPlaybookActive={!draft.channelConfig.prompting.preserveModelVoice}
              onApplyPreset={applyConversationPlaybookPreset}
              onMoveDiscoveryOrder={moveDiscoveryOrder}
              onToggleDiscoveryField={toggleDiscoveryField}
              onToggleFieldArray={togglePlaybookFieldArray}
              onUpdatePlaybook={updateConversationPlaybook}
              playbook={draft.channelConfig.conversationPlaybook}
            />
          ) : null}

          {showWorkspaceKnowledge ? (
            <KnowledgeSection
              blocks={draft.knowledgeBlocks}
              isReadOnlyMode={isReadOnlyMode}
              onAddBlock={addKnowledgeBlock}
              onCloseEditor={() => setSelectedKnowledgeIndex(null)}
              onMoveBlock={moveKnowledgeBlock}
              onOpenBlock={setSelectedKnowledgeIndex}
              onRemoveBlock={removeKnowledgeBlock}
              onUpdateBlock={updateKnowledge}
              selectedBlockIndex={selectedKnowledgeIndex}
            />
          ) : null}

          {showWorkspaceFunctions ? (
            <FunctionsSection
              connectedIntegrations={connectedIntegrations}
              functionBlocks={draft.channelConfig.functionBlocks}
              getFunctionStepKey={getFunctionStepKey}
              getGoogleCalendarParams={getGoogleCalendarParams}
              getGoogleSheetsParams={getGoogleSheetsParams}
              integrationById={integrationById}
              isReadOnlyMode={isReadOnlyMode}
              isWorkspaceMode={true}
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
              runtimeActions={runtimeProfile.actions}
            />
          ) : null}

          {shouldShowWorkspaceIntegrations ? (
            <IntegrationsSection
              dependencies={functionDependenciesByIntegration}
              enabledIntegrationIds={draft.channelConfig.integrations.enabledIds}
              integrations={tenant.integrationConnections}
              onIntegrationEnabledChange={toggleAgentIntegration}
              sectionCanvasClassName={sectionCanvasClassName}
              softInfoPanelClassName={softInfoPanelClassName}
            />
          ) : null}

          <div className="flex flex-wrap justify-end gap-3 border-t border-[#e8edf5] pt-5">
            {isReadOnlyMode ? (
              <>
                <button
                  className={primaryButtonClassName}
                  onClick={checkDeployReadiness}
                  type="button"
                >
                  {isCheckingDeploy ? "Checking readiness..." : "Check readiness"}
                </button>
                <button
                  className={primaryButtonClassName}
                  disabled={isCheckingDeploy || isDeploying}
                  onClick={deployCurrentAgent}
                  type="button"
                >
                  {isDeploying ? "Deploying..." : "Deploy agent"}
                </button>
              </>
            ) : (
              <>
                <button
                  className={primaryButtonClassName}
                  disabled={isSaving}
                  onClick={saveDraft}
                  type="button"
                >
                  {isSaving ? "Saving..." : "Save changes"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}




