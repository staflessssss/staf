"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useMemo, useState } from "react";
import {
  ChannelConnection,
  Feature,
  FeatureType,
  IntegrationType,
  IntegrationConnection,
  Step,
} from "@prisma/client";
import {
  ArrowDown,
  ArrowUp,
  FlaskConical,
  Layers3,
  MessageSquareQuote,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react";

import {
  Checklist,
  EmptyState,
  FormField,
  StatusBadge,
  SurfaceCard,
  WizardStepper,
  inputClassName,
  primaryButtonClassName,
  selectClassName,
  secondaryButtonClassName,
  textareaClassName,
} from "@/components/stafless/foundation";
import { buildSystemPrompt } from "@/lib/prompt-builder";

type SerializableTenant = {
  id: string;
  name: string;
  slug: string;
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
  channel: ChannelConnection;
  features: (Feature & {
    steps: (Step & { integration: IntegrationConnection })[];
  })[];
};

type KnowledgeDraft = {
  name: string;
  description: string;
  knowledgeContent: string;
};

type ToolStepDraft = {
  integrationId: string;
  action: string;
  params: string;
};

type ToolDraft = {
  name: string;
  description: string;
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

type GoogleSheetsFilterDraft = {
  column: string;
  operator: "equals" | "not_equals" | "contains" | "is_empty" | "is_not_empty";
  valueSource: "literal" | "requested_date" | "user_message";
  value: string;
};

type BuilderDraft = {
  name: string;
  persona: string;
  tone: string;
  languagePreference: string;
  channelId: string;
  knowledgeBlocks: KnowledgeDraft[];
  toolBlocks: ToolDraft[];
};

type SandboxResult = {
  message: string;
  promptPreview: string;
  usedTooling: string[];
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

const wizardSteps = [
  { id: "basics", title: "Basics", question: "Who is this agent?" },
  { id: "channel", title: "Channel", question: "Where does it operate?" },
  { id: "knowledge", title: "Knowledge", question: "What should it know?" },
  { id: "tools", title: "Tools", question: "What can it do?" },
  { id: "review", title: "Review", question: "Is it ready to test and deploy?" },
];

const sampleKnowledge: KnowledgeDraft[] = [
  {
    name: "Service scope",
    description:
      "Describe what the business offers, who it serves, and where the service boundaries are.",
    knowledgeContent:
      "The studio handles wedding videography, highlight edits, and post-event delivery. It does not offer photography-only packages.",
  },
];

const sampleTools: ToolDraft[] = [
  {
    name: "Check booking calendar",
    description: "Review primary calendar availability before promising a slot.",
    steps: [],
  },
];

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

function getGoogleSheetsParams(step: ToolStepDraft) {
  const params = safeParseJsonObject(step.params);
  const filters = Array.isArray(params.filters)
    ? params.filters
        .map((filter) => {
          if (!filter || typeof filter !== "object" || Array.isArray(filter)) {
            return null;
          }

          const candidate = filter as Record<string, unknown>;

          return {
            column: typeof candidate.column === "string" ? candidate.column : "",
            operator:
              typeof candidate.operator === "string" &&
              ["equals", "not_equals", "contains", "is_empty", "is_not_empty"].includes(
                candidate.operator,
              )
                ? (candidate.operator as GoogleSheetsFilterDraft["operator"])
                : "equals",
            valueSource:
              typeof candidate.valueSource === "string" &&
              ["literal", "requested_date", "user_message"].includes(candidate.valueSource)
                ? (candidate.valueSource as GoogleSheetsFilterDraft["valueSource"])
                : "literal",
            value: typeof candidate.value === "string" ? candidate.value : "",
          };
        })
        .filter((filter): filter is GoogleSheetsFilterDraft => Boolean(filter))
    : [];

  return {
    operation: typeof params.operation === "string" ? params.operation : "get_rows",
    spreadsheetId:
      typeof params.spreadsheetId === "string" ? params.spreadsheetId : "",
    spreadsheetTitle:
      typeof params.spreadsheetTitle === "string" ? params.spreadsheetTitle : "",
    sheetName: typeof params.sheetName === "string" ? params.sheetName : "",
    combineFilters:
      typeof params.combineFilters === "string" && params.combineFilters === "OR"
        ? "OR"
        : "AND",
    headerRow:
      typeof params.headerRow === "number" && params.headerRow > 0 ? params.headerRow : 1,
    filters:
      filters.length > 0
        ? filters
        : [
            {
              column: "",
              operator: "equals" as const,
              valueSource: "requested_date" as const,
              value: "",
            },
          ],
  };
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

function createInitialDraft(tenant: SerializableTenant, agent?: SerializableAgent): BuilderDraft {
  const knowledgeBlocks =
    agent?.features
      .filter((feature) => feature.type === FeatureType.KNOWLEDGE)
      .map((feature) => ({
        name: feature.name,
        description: feature.description,
        knowledgeContent: feature.knowledgeContent ?? "",
      })) ?? [];
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

  return {
    name: agent?.name ?? `${tenant.name} Concierge`,
    persona:
      agent?.persona ??
      `A polished front-desk operator for ${tenant.name} who keeps replies accurate, warm, and useful under pressure.`,
    tone: agent?.tone ?? "friendly",
    languagePreference: agent?.languagePreference ?? "",
    channelId:
      agent?.channelId ??
      tenant.channelConnections.find((connection) => connection.status === "CONNECTED")?.id ??
      "",
    knowledgeBlocks: knowledgeBlocks.length > 0 ? knowledgeBlocks : sampleKnowledge,
    toolBlocks: toolBlocks.length > 0 ? toolBlocks : sampleTools,
  };
}

function parseToolParams(toolBlocks: ToolDraft[]) {
  return toolBlocks.map((tool) => ({
    name: tool.name,
    description: tool.description,
    steps: tool.steps.map((step, stepIndex) => {
      try {
        return {
          integrationId: step.integrationId,
          action: step.action,
          params: JSON.parse(step.params || "{}"),
        };
      } catch {
        throw new Error(
          `Tool "${tool.name || `#${stepIndex + 1}`}" has invalid JSON params.`,
        );
      }
    }),
  }));
}

export function AgentBuilderClient({
  tenant,
  mode,
  agent,
}: {
  tenant: SerializableTenant;
  mode: "create" | "edit" | "detail";
  agent?: SerializableAgent;
}) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(mode === "detail" ? 4 : 0);
  const [draft, setDraft] = useState<BuilderDraft>(() => createInitialDraft(tenant, agent));
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [testMessage, setTestMessage] = useState(
    "A new lead asks whether July 14 is available and wants a premium package overview.",
  );
  const [isTesting, setIsTesting] = useState(false);
  const [sandboxResult, setSandboxResult] = useState<SandboxResult | null>(null);
  const [isCheckingDeploy, setIsCheckingDeploy] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployReadiness, setDeployReadiness] = useState<DeployReadinessResult | null>(null);
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

  const promptPreview = buildSystemPrompt({
    name: draft.name,
    persona: draft.persona,
    tone: draft.tone,
    languagePreference: draft.languagePreference || null,
    channel: selectedChannel,
    knowledgeBlocks: draft.knowledgeBlocks,
    toolBlocks: draft.toolBlocks.map((tool) => ({
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

  const checklistItems = [
    {
      label: draft.name.trim() && draft.persona.trim() ? "Basics are defined" : "Complete the basics step",
      done: Boolean(draft.name.trim() && draft.persona.trim()),
      hint: "Name, tone, persona, and optional language preference shape the operator-facing brief.",
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
      label: `${draft.knowledgeBlocks.length} knowledge block${draft.knowledgeBlocks.length === 1 ? "" : "s"} ready`,
      done: draft.knowledgeBlocks.every(
        (block) =>
          block.name.trim() && block.description.trim() && block.knowledgeContent.trim(),
      ),
      hint: "Knowledge stays free-form so each business can teach the agent its own context.",
    },
    {
      label: `${draft.toolBlocks.length} tool block${draft.toolBlocks.length === 1 ? "" : "s"} ready`,
      done: draft.toolBlocks.every(
        (tool) =>
          tool.name.trim() &&
          tool.description.trim() &&
          tool.steps.every((step) => step.integrationId && step.action.trim()),
      ),
      hint: "Tools define what the agent can do through connected integrations.",
    },
    {
      label: sandboxResult ? "Sandbox test completed" : "Run a sandbox test before deploy",
      done: Boolean(sandboxResult),
      hint: sandboxResult
        ? "The current draft has already produced a sandbox response."
        : "Use the test box to verify how the draft responds before live deployment exists.",
    },
  ];

  function updateDraft<K extends keyof BuilderDraft>(key: K, value: BuilderDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updateKnowledge(index: number, patch: Partial<KnowledgeDraft>) {
    setDraft((current) => ({
      ...current,
      knowledgeBlocks: current.knowledgeBlocks.map((block, blockIndex) =>
        blockIndex === index ? { ...block, ...patch } : block,
      ),
    }));
  }

  function updateTool(index: number, patch: Partial<ToolDraft>) {
    setDraft((current) => ({
      ...current,
      toolBlocks: current.toolBlocks.map((tool, toolIndex) =>
        toolIndex === index ? { ...tool, ...patch } : tool,
      ),
    }));
  }

  function updateToolStep(
    toolIndex: number,
    stepIndex: number,
    patch: Partial<ToolStepDraft>,
  ) {
    setDraft((current) => ({
      ...current,
      toolBlocks: current.toolBlocks.map((tool, currentToolIndex) =>
        currentToolIndex === toolIndex
          ? {
              ...tool,
              steps: tool.steps.map((step, currentStepIndex) =>
                currentStepIndex === stepIndex ? { ...step, ...patch } : step,
              ),
            }
          : tool,
      ),
    }));
  }

  function getToolStepKey(toolIndex: number, stepIndex: number) {
    return `${toolIndex}:${stepIndex}`;
  }

  function updateToolStepParams(
    toolIndex: number,
    stepIndex: number,
    patch: Record<string, unknown>,
  ) {
    const currentParams = safeParseJsonObject(
      draft.toolBlocks[toolIndex]?.steps[stepIndex]?.params ?? "{}",
    );

    updateToolStep(toolIndex, stepIndex, {
      params: stringifyJsonObject({
        ...currentParams,
        ...patch,
      }),
    });
  }

  function updateGoogleSheetsFilters(
    toolIndex: number,
    stepIndex: number,
    filters: GoogleSheetsFilterDraft[],
  ) {
    updateToolStepParams(toolIndex, stepIndex, { filters });
  }

  function updateGoogleSheetsFilter(
    toolIndex: number,
    stepIndex: number,
    filterIndex: number,
    patch: Partial<GoogleSheetsFilterDraft>,
  ) {
    const currentFilters = getGoogleSheetsParams(draft.toolBlocks[toolIndex].steps[stepIndex]).filters;

    updateGoogleSheetsFilters(
      toolIndex,
      stepIndex,
      currentFilters.map((filter, currentFilterIndex) =>
        currentFilterIndex === filterIndex ? { ...filter, ...patch } : filter,
      ),
    );
  }

  function addGoogleSheetsFilter(toolIndex: number, stepIndex: number) {
    const currentFilters = getGoogleSheetsParams(draft.toolBlocks[toolIndex].steps[stepIndex]).filters;

    updateGoogleSheetsFilters(toolIndex, stepIndex, [
      ...currentFilters,
      { column: "", operator: "equals", valueSource: "literal", value: "" },
    ]);
  }

  function removeGoogleSheetsFilter(toolIndex: number, stepIndex: number, filterIndex: number) {
    const currentFilters = getGoogleSheetsParams(draft.toolBlocks[toolIndex].steps[stepIndex]).filters;
    const nextFilters = currentFilters.filter((_, currentFilterIndex) => currentFilterIndex !== filterIndex);

    updateGoogleSheetsFilters(
      toolIndex,
      stepIndex,
      nextFilters.length > 0
        ? nextFilters
        : [{ column: "", operator: "equals", valueSource: "literal", value: "" }],
    );
  }

  async function inspectGoogleSpreadsheet(toolIndex: number, stepIndex: number) {
    const step = draft.toolBlocks[toolIndex]?.steps[stepIndex];
    const integration = step ? integrationById.get(step.integrationId) : null;
    const sheetParams = step ? getGoogleSheetsParams(step) : null;
    const spreadsheetId = sheetParams?.spreadsheetId.trim() ?? "";
    const key = getToolStepKey(toolIndex, stepIndex);

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

      updateToolStepParams(toolIndex, stepIndex, {
        spreadsheetId: item.spreadsheetId,
        spreadsheetTitle: item.title,
        sheetName:
          sheetParams?.sheetName && item.sheets.some((sheet) => sheet.title === sheetParams.sheetName)
            ? sheetParams.sheetName
            : item.selectedSheetName || item.sheets[0]?.title || "",
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
  }

  async function loadGoogleSpreadsheetCatalog(toolIndex: number, stepIndex: number) {
    const step = draft.toolBlocks[toolIndex]?.steps[stepIndex];
    const integration = step ? integrationById.get(step.integrationId) : null;
    const key = getToolStepKey(toolIndex, stepIndex);

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
      { name: "", description: "", knowledgeContent: "" },
    ]);
  }

  function addToolBlock() {
    updateDraft("toolBlocks", [
      ...draft.toolBlocks,
      { name: "", description: "", steps: [] },
    ]);
  }

  function addToolStep(toolIndex: number) {
    updateTool(toolIndex, {
      steps: [
        ...draft.toolBlocks[toolIndex].steps,
        {
          integrationId: connectedIntegrations[0]?.id ?? "",
          action: "",
          params: "{}",
        },
      ],
    });
  }

  async function saveDraft() {
    if (mode === "detail") {
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
        knowledgeBlocks: draft.knowledgeBlocks,
        toolBlocks: parseToolParams(draft.toolBlocks),
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

      if (!agent && result?.item?.id) {
        router.push(`/admin/clients/${tenant.id}/agents/${result.item.id}/edit`);
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

  async function runSandboxTest() {
    setIsTesting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/agent/invoke", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tenantId: tenant.id,
          agentId: agent?.id,
          message: testMessage,
          draft: {
            name: draft.name,
            persona: draft.persona,
            tone: draft.tone,
            languagePreference: draft.languagePreference || undefined,
            channelId: draft.channelId,
            knowledgeBlocks: draft.knowledgeBlocks,
            toolBlocks: parseToolParams(draft.toolBlocks),
          },
        }),
      });

      const result = (await response.json().catch(() => null)) as
        | { error?: string; item?: SandboxResult }
        | null;

      if (!response.ok || !result?.item) {
        setError(result?.error || "Could not run the sandbox test.");
        return;
      }

      setSandboxResult(result.item);
      setDeployReadiness(null);
      setSuccess("Sandbox response generated.");
      setCurrentStep(4);
    } catch (testError) {
      setError(
        testError instanceof Error
          ? testError.message
          : "Could not run the sandbox test.",
      );
    } finally {
      setIsTesting(false);
    }
  }

  function handleNextStep() {
    setCurrentStep((step) => Math.min(step + 1, wizardSteps.length - 1));
  }

  function handlePreviousStep() {
    setCurrentStep((step) => Math.max(step - 1, 0));
  }

  async function checkDeployReadiness() {
    if (!agent) {
      setError("Save this draft first, then open the detail view to check deployment readiness.");
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

      setDeployReadiness(result.item);
      setSuccess(result.item.message);
      setCurrentStep(4);
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
        setError("Save this draft first, then open the detail view to deploy.");
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

        setDeployReadiness(result.item);
        setSuccess(result.item.message);
        setCurrentStep(4);
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
    <div className="space-y-8">
      <WizardStepper currentStep={currentStep} steps={wizardSteps} />

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

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <SurfaceCard
            title="Basics"
            description="Set the editorial voice and role of the agent before channels and tools add complexity."
          >
            <div className="grid gap-5 md:grid-cols-2">
              <FormField
                label="Agent name"
                hint="Use a business-facing name the operator can scan quickly."
              >
                <input
                  className={inputClassName}
                  onChange={(event) => updateDraft("name", event.target.value)}
                  readOnly={mode === "detail"}
                  value={draft.name}
                />
              </FormField>
              <FormField label="Tone">
                <select
                  className={selectClassName}
                  disabled={mode === "detail"}
                  onChange={(event) => updateDraft("tone", event.target.value)}
                  value={draft.tone}
                >
                  <option value="friendly">Friendly</option>
                  <option value="calm">Calm</option>
                  <option value="premium">Premium</option>
                  <option value="direct">Direct</option>
                </select>
              </FormField>
              <FormField
                label="Preferred response language"
                hint="Optional. Leave blank to keep the agent multilingual-first."
              >
                <input
                  className={inputClassName}
                  onChange={(event) =>
                    updateDraft("languagePreference", event.target.value)
                  }
                  placeholder="For example: Russian, English, Spanish"
                  readOnly={mode === "detail"}
                  value={draft.languagePreference}
                />
              </FormField>
            </div>
            <div className="mt-5">
              <FormField
                label="Persona"
                hint="Describe the role the agent should consistently inhabit."
              >
                <textarea
                  className={textareaClassName}
                  onChange={(event) => updateDraft("persona", event.target.value)}
                  readOnly={mode === "detail"}
                  value={draft.persona}
                />
              </FormField>
            </div>
          </SurfaceCard>

          <SurfaceCard
            title="Channel"
            description="Bind the agent to one connected tenant channel. Unavailable channels stay visible so the rule is obvious."
          >
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
              <div className="space-y-3">
                {tenant.channelConnections.map((connection) => {
                  const assignedAgentName = assignedChannels.get(connection.id);
                  const isUnavailable =
                    connection.status !== "CONNECTED" || Boolean(assignedAgentName);

                  return (
                    <label
                      key={connection.id}
                      className="flex cursor-pointer items-start gap-4 rounded-[20px] border border-border bg-[#faf6f0] p-5"
                    >
                      <input
                        checked={draft.channelId === connection.id}
                        className="mt-1"
                        disabled={mode === "detail" || isUnavailable}
                        name="channelId"
                        onChange={() => updateDraft("channelId", connection.id)}
                        type="radio"
                      />
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-base font-semibold text-foreground">
                            {connection.type}
                          </p>
                          <StatusBadge status={connection.status} />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {assignedAgentName
                            ? `Already assigned to ${assignedAgentName}.`
                            : connection.status === "CONNECTED"
                              ? "Ready for agent assignment."
                              : "This channel must be connected before it can be assigned."}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </SurfaceCard>

          <SurfaceCard
            title="Knowledge"
            description="Knowledge blocks stay free-form and editorial instead of collapsing into rigid templates."
            action={
              mode === "detail" ? null : (
                <button
                  className={secondaryButtonClassName}
                  onClick={addKnowledgeBlock}
                  type="button"
                >
                  <Plus className="mr-2 size-4" />
                  Add knowledge block
                </button>
              )
            }
          >
            <div className="space-y-4">
              {draft.knowledgeBlocks.map((block, index) => (
                <div
                  key={`${block.name}-${index}`}
                  className="rounded-[20px] border border-border bg-[#faf6f0] p-5"
                >
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-foreground">
                      Knowledge block {index + 1}
                    </p>
                    {mode !== "detail" ? (
                      <div className="flex gap-2">
                        <button
                          className={secondaryButtonClassName}
                          onClick={() =>
                            updateDraft(
                              "knowledgeBlocks",
                              moveItem(draft.knowledgeBlocks, index, -1),
                            )
                          }
                          type="button"
                        >
                          <ArrowUp className="size-4" />
                        </button>
                        <button
                          className={secondaryButtonClassName}
                          onClick={() =>
                            updateDraft(
                              "knowledgeBlocks",
                              moveItem(draft.knowledgeBlocks, index, 1),
                            )
                          }
                          type="button"
                        >
                          <ArrowDown className="size-4" />
                        </button>
                        <button
                          className={secondaryButtonClassName}
                          onClick={() =>
                            updateDraft(
                              "knowledgeBlocks",
                              draft.knowledgeBlocks.filter((_, itemIndex) => itemIndex !== index),
                            )
                          }
                          type="button"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <div className="space-y-4">
                    <FormField label="Block name">
                      <input
                        className={inputClassName}
                        onChange={(event) =>
                          updateKnowledge(index, { name: event.target.value })
                        }
                        readOnly={mode === "detail"}
                        value={block.name}
                      />
                    </FormField>
                    <FormField label="Summary">
                      <textarea
                        className={textareaClassName}
                        onChange={(event) =>
                          updateKnowledge(index, { description: event.target.value })
                        }
                        readOnly={mode === "detail"}
                        value={block.description}
                      />
                    </FormField>
                    <FormField label="Knowledge content">
                      <textarea
                        className={textareaClassName}
                        onChange={(event) =>
                          updateKnowledge(index, {
                            knowledgeContent: event.target.value,
                          })
                        }
                        readOnly={mode === "detail"}
                        value={block.knowledgeContent}
                      />
                    </FormField>
                  </div>
                </div>
              ))}
            </div>
          </SurfaceCard>

          <SurfaceCard
            title="Tools"
            description="Tool rows represent real business actions backed by tenant integrations."
            action={
              mode === "detail" ? null : (
                <button
                  className={secondaryButtonClassName}
                  onClick={addToolBlock}
                  type="button"
                >
                  <Plus className="mr-2 size-4" />
                  Add tool
                </button>
              )
            }
          >
            <div className="space-y-4">
              {draft.toolBlocks.map((tool, toolIndex) => (
                <div
                  key={`${tool.name}-${toolIndex}`}
                  className="rounded-[24px] border border-border bg-white p-6 shadow-[0_10px_24px_rgba(31,23,40,0.04)]"
                >
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-foreground">Tool block {toolIndex + 1}</p>
                    {mode !== "detail" ? (
                      <div className="flex gap-2">
                        <button
                          className={secondaryButtonClassName}
                          onClick={() =>
                            updateDraft("toolBlocks", moveItem(draft.toolBlocks, toolIndex, -1))
                          }
                          type="button"
                        >
                          <ArrowUp className="size-4" />
                        </button>
                        <button
                          className={secondaryButtonClassName}
                          onClick={() =>
                            updateDraft("toolBlocks", moveItem(draft.toolBlocks, toolIndex, 1))
                          }
                          type="button"
                        >
                          <ArrowDown className="size-4" />
                        </button>
                        <button
                          className={secondaryButtonClassName}
                          onClick={() =>
                            updateDraft(
                              "toolBlocks",
                              draft.toolBlocks.filter((_, index) => index !== toolIndex),
                            )
                          }
                          type="button"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <div className="space-y-4">
                    <FormField label="Tool name">
                      <input
                        className={inputClassName}
                        onChange={(event) =>
                          updateTool(toolIndex, { name: event.target.value })
                        }
                        readOnly={mode === "detail"}
                        value={tool.name}
                      />
                    </FormField>
                    <FormField label="Summary">
                      <textarea
                        className={textareaClassName}
                        onChange={(event) =>
                          updateTool(toolIndex, { description: event.target.value })
                        }
                        readOnly={mode === "detail"}
                        value={tool.description}
                      />
                    </FormField>
                    <div className="space-y-4 border-t border-[#ece2d4] pt-5">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-foreground">Executable steps</p>
                        {mode !== "detail" ? (
                          <button
                            className={secondaryButtonClassName}
                            onClick={() => addToolStep(toolIndex)}
                            type="button"
                          >
                            <Plus className="mr-2 size-4" />
                            Add step
                          </button>
                        ) : null}
                      </div>
                      {tool.steps.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No integration steps yet.
                        </p>
                      ) : null}
                      {tool.steps.map((step, stepIndex) => {
                        const selectedIntegration = integrationById.get(step.integrationId);
                        const isGoogleSheets = selectedIntegration?.type === IntegrationType.GOOGLE_SHEETS;
                        const sheetParams = getGoogleSheetsParams(step);
                        const sheetInspector = sheetInspectors[getToolStepKey(toolIndex, stepIndex)];

                        return (
                          <div
                            key={`${step.integrationId}-${stepIndex}`}
                            className="rounded-[20px] border border-[#e8ddcf] bg-[#fcfaf6] p-5 shadow-[0_8px_18px_rgba(31,23,40,0.03)]"
                          >
                            <div className="mb-4 flex items-center justify-between gap-3">
                              <p className="text-sm font-semibold text-foreground">
                                Step {stepIndex + 1}
                              </p>
                              {selectedIntegration ? (
                                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                  {selectedIntegration.type}
                                </span>
                              ) : null}
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                              <FormField label="Integration">
                                <select
                                  className={selectClassName}
                                  disabled={mode === "detail"}
                                  onChange={(event) => {
                                    const nextIntegrationId = event.target.value;
                                    const nextIntegration = integrationById.get(nextIntegrationId);

                                    updateToolStep(toolIndex, stepIndex, {
                                      integrationId: nextIntegrationId,
                                      action:
                                        nextIntegration?.type === IntegrationType.GOOGLE_SHEETS &&
                                        !step.action.trim()
                                          ? "lookup rows in sheet"
                                          : step.action,
                                      params:
                                        nextIntegration?.type === IntegrationType.GOOGLE_SHEETS &&
                                        step.params.trim() === "{}"
                                          ? stringifyJsonObject({
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
                                            })
                                          : step.params,
                                    });
                                    setSheetInspectors((current) => {
                                      const next = { ...current };
                                      delete next[getToolStepKey(toolIndex, stepIndex)];
                                      return next;
                                    });
                                  }}
                                  value={step.integrationId}
                                >
                                  <option value="">Select integration</option>
                                  {connectedIntegrations.map((integration) => (
                                    <option key={integration.id} value={integration.id}>
                                      {integration.type}
                                    </option>
                                  ))}
                                </select>
                              </FormField>
                              <FormField label="Action">
                                <input
                                  className={inputClassName}
                                  onChange={(event) =>
                                    updateToolStep(toolIndex, stepIndex, {
                                      action: event.target.value,
                                    })
                                  }
                                  readOnly={mode === "detail"}
                                  value={step.action}
                                />
                              </FormField>
                            </div>
                            {isGoogleSheets ? (
                              <div className="mt-5 space-y-5 border-t border-[#ece2d4] pt-5">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-semibold text-foreground">
                                      Google Sheets lookup
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      Configure a document, sheet, and universal row filters.
                                    </p>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      className={secondaryButtonClassName}
                                      disabled={mode === "detail" || sheetInspector?.isLoading}
                                      onClick={() => loadGoogleSpreadsheetCatalog(toolIndex, stepIndex)}
                                      type="button"
                                    >
                                      {sheetInspector?.isLoading ? "Loading..." : "Load spreadsheets"}
                                    </button>
                                    <button
                                      className={secondaryButtonClassName}
                                      disabled={
                                        mode === "detail" ||
                                        sheetInspector?.isLoading ||
                                        !sheetParams.spreadsheetId.trim()
                                      }
                                      onClick={() => inspectGoogleSpreadsheet(toolIndex, stepIndex)}
                                      type="button"
                                    >
                                      {sheetInspector?.isLoading ? "Loading..." : "Load sheets"}
                                    </button>
                                  </div>
                                </div>
                                <div className="grid gap-4 md:grid-cols-2">
                                  <FormField label="Resource">
                                    <select className={selectClassName} disabled value="sheet_within_document">
                                      <option value="sheet_within_document">Sheet Within Document</option>
                                    </select>
                                  </FormField>
                                  <FormField label="Operation">
                                    <select
                                      className={selectClassName}
                                      disabled={mode === "detail"}
                                      onChange={(event) =>
                                        updateToolStepParams(toolIndex, stepIndex, {
                                          operation: event.target.value,
                                        })
                                      }
                                      value={sheetParams.operation}
                                    >
                                      <option value="get_rows">Get Row(s)</option>
                                    </select>
                                  </FormField>
                                </div>
                                <FormField label="Document">
                                  <select
                                    className={selectClassName}
                                    disabled={mode === "detail" || !sheetInspector?.spreadsheets?.length}
                                    onChange={(event) => {
                                      const selectedSpreadsheet = sheetInspector?.spreadsheets?.find(
                                        (spreadsheet) => spreadsheet.id === event.target.value,
                                      );

                                      updateToolStepParams(toolIndex, stepIndex, {
                                        spreadsheetId: event.target.value,
                                        spreadsheetTitle: selectedSpreadsheet?.name ?? "",
                                        sheetName: "",
                                      });
                                    }}
                                    value={sheetParams.spreadsheetId}
                                  >
                                    <option value="">
                                      {sheetInspector?.spreadsheets?.length
                                        ? "From list"
                                        : "Load spreadsheets first"}
                                    </option>
                                    {sheetInspector?.spreadsheets?.map((spreadsheet) => (
                                      <option key={spreadsheet.id} value={spreadsheet.id}>
                                        {spreadsheet.name}
                                      </option>
                                    ))}
                                  </select>
                                </FormField>
                                <div className="grid gap-4 md:grid-cols-2">
                                  <FormField label="Spreadsheet ID or URL">
                                    <input
                                      className={inputClassName}
                                      onChange={(event) => {
                                        updateToolStepParams(toolIndex, stepIndex, {
                                          spreadsheetId: event.target.value,
                                          spreadsheetTitle: "",
                                          sheetName: "",
                                        });
                                        setSheetInspectors((current) => ({
                                          ...current,
                                          [getToolStepKey(toolIndex, stepIndex)]: {
                                            isLoading: false,
                                            error: null,
                                            spreadsheetId: event.target.value,
                                            sheets: [],
                                          },
                                        }));
                                      }}
                                      readOnly={mode === "detail"}
                                      placeholder="Paste a Google Sheets URL or spreadsheet ID"
                                      value={sheetParams.spreadsheetId}
                                    />
                                  </FormField>
                                  <FormField label="Sheet">
                                    <select
                                      className={selectClassName}
                                      disabled={mode === "detail" || !sheetInspector?.sheets?.length}
                                      onChange={(event) =>
                                        updateToolStepParams(toolIndex, stepIndex, {
                                          sheetName: event.target.value,
                                        })
                                      }
                                      value={sheetParams.sheetName}
                                    >
                                      <option value="">
                                        {sheetInspector?.sheets?.length
                                          ? "Select sheet"
                                          : "Load spreadsheet first"}
                                      </option>
                                      {sheetInspector?.sheets.map((sheetName) => (
                                        <option key={sheetName} value={sheetName}>
                                          {sheetName}
                                        </option>
                                      ))}
                                    </select>
                                  </FormField>
                                </div>
                                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
                                  <FormField label="Combine filters">
                                    <select
                                      className={selectClassName}
                                      disabled={mode === "detail"}
                                      onChange={(event) =>
                                        updateToolStepParams(toolIndex, stepIndex, {
                                          combineFilters: event.target.value,
                                        })
                                      }
                                      value={sheetParams.combineFilters}
                                    >
                                      <option value="AND">AND</option>
                                      <option value="OR">OR</option>
                                    </select>
                                  </FormField>
                                  <FormField label="Header row">
                                    <input
                                      className={inputClassName}
                                      min={1}
                                      onChange={(event) =>
                                        updateToolStepParams(toolIndex, stepIndex, {
                                          headerRow: Math.max(Number(event.target.value || 1), 1),
                                        })
                                      }
                                      readOnly={mode === "detail"}
                                      type="number"
                                      value={sheetParams.headerRow}
                                    />
                                  </FormField>
                                </div>
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-semibold text-foreground">Filters</p>
                                      <p className="text-sm text-muted-foreground">
                                        Build row conditions the same way you would in a spreadsheet query.
                                      </p>
                                    </div>
                                    <button
                                      className={secondaryButtonClassName}
                                      disabled={mode === "detail"}
                                      onClick={() => addGoogleSheetsFilter(toolIndex, stepIndex)}
                                      type="button"
                                    >
                                      <Plus className="mr-2 size-4" />
                                      Add filter
                                    </button>
                                  </div>
                                  {sheetParams.filters.map((filter, filterIndex) => (
                                    <div
                                      key={`${filter.column}-${filterIndex}`}
                                      className="space-y-3 rounded-[16px] border border-[#ece2d4] bg-white p-4"
                                    >
                                      <div className="grid gap-4 md:grid-cols-3">
                                        <FormField label="Column">
                                          <select
                                            className={selectClassName}
                                            disabled={mode === "detail"}
                                            onChange={(event) =>
                                              updateGoogleSheetsFilter(toolIndex, stepIndex, filterIndex, {
                                                column: event.target.value,
                                              })
                                            }
                                            value={filter.column}
                                          >
                                            <option value="">
                                              {sheetInspector?.headers?.length
                                                ? "Select column"
                                                : "Load sheet headers first"}
                                            </option>
                                            {sheetInspector?.headers?.map((header) => (
                                              <option key={header} value={header}>
                                                {header}
                                              </option>
                                            ))}
                                          </select>
                                        </FormField>
                                        <FormField label="Operator">
                                          <select
                                            className={selectClassName}
                                            disabled={mode === "detail"}
                                            onChange={(event) =>
                                              updateGoogleSheetsFilter(toolIndex, stepIndex, filterIndex, {
                                                operator: event.target.value as GoogleSheetsFilterDraft["operator"],
                                              })
                                            }
                                            value={filter.operator}
                                          >
                                            <option value="equals">Equals</option>
                                            <option value="not_equals">Not equals</option>
                                            <option value="contains">Contains</option>
                                            <option value="is_empty">Is empty</option>
                                            <option value="is_not_empty">Is not empty</option>
                                          </select>
                                        </FormField>
                                        <FormField label="Value source">
                                          <select
                                            className={selectClassName}
                                            disabled={mode === "detail"}
                                            onChange={(event) =>
                                              updateGoogleSheetsFilter(toolIndex, stepIndex, filterIndex, {
                                                valueSource: event.target.value as GoogleSheetsFilterDraft["valueSource"],
                                              })
                                            }
                                            value={filter.valueSource}
                                          >
                                            <option value="literal">Literal value</option>
                                            <option value="requested_date">Requested date</option>
                                            <option value="user_message">User message</option>
                                          </select>
                                        </FormField>
                                      </div>
                                      {filter.operator !== "is_empty" &&
                                      filter.operator !== "is_not_empty" &&
                                      filter.valueSource === "literal" ? (
                                        <FormField label="Value">
                                          <input
                                            className={inputClassName}
                                            onChange={(event) =>
                                              updateGoogleSheetsFilter(toolIndex, stepIndex, filterIndex, {
                                                value: event.target.value,
                                              })
                                            }
                                            readOnly={mode === "detail"}
                                            value={filter.value}
                                          />
                                        </FormField>
                                      ) : (
                                        <p className="text-sm text-muted-foreground">
                                          {filter.valueSource === "requested_date"
                                            ? "This filter uses the date extracted from the request."
                                            : filter.valueSource === "user_message"
                                              ? "This filter uses the full user message as the comparison value."
                                              : "This operator does not require a comparison value."}
                                        </p>
                                      )}
                                      {mode !== "detail" ? (
                                        <div className="flex justify-end">
                                          <button
                                            className={secondaryButtonClassName}
                                            onClick={() =>
                                              removeGoogleSheetsFilter(toolIndex, stepIndex, filterIndex)
                                            }
                                            type="button"
                                          >
                                            <Trash2 className="mr-2 size-4" />
                                            Remove filter
                                          </button>
                                        </div>
                                      ) : null}
                                    </div>
                                  ))}
                                </div>
                                {sheetInspector?.title || sheetParams.spreadsheetTitle ? (
                                  <p className="text-sm text-muted-foreground">
                                    Spreadsheet: {sheetInspector?.title ?? sheetParams.spreadsheetTitle}
                                  </p>
                                ) : null}
                                {sheetInspector?.headers?.length ? (
                                  <p className="text-sm text-muted-foreground">
                                    Columns: {sheetInspector.headers.join(", ")}
                                  </p>
                                ) : null}
                                {sheetInspector?.error ? (
                                  <p className="text-sm text-destructive">{sheetInspector.error}</p>
                                ) : null}
                              </div>
                            ) : (
                              <div className="mt-4">
                                <FormField label="Params (JSON)">
                                  <textarea
                                    className={textareaClassName}
                                    onChange={(event) =>
                                      updateToolStep(toolIndex, stepIndex, {
                                        params: event.target.value,
                                      })
                                    }
                                    readOnly={mode === "detail"}
                                    value={step.params}
                                  />
                                </FormField>
                              </div>
                            )}
                            {mode !== "detail" ? (
                              <div className="mt-4 flex justify-end">
                                <button
                                  className={secondaryButtonClassName}
                                  onClick={() =>
                                    updateTool(toolIndex, {
                                      steps: tool.steps.filter((_, index) => index !== stepIndex),
                                    })
                                  }
                                  type="button"
                                >
                                  <Trash2 className="mr-2 size-4" />
                                  Remove step
                                </button>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SurfaceCard>

          {mode !== "detail" ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
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
                <button
                  className={primaryButtonClassName}
                  disabled={currentStep === wizardSteps.length - 1 || isSaving}
                  onClick={handleNextStep}
                  type="button"
                >
                  Next step
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-6 xl:sticky xl:top-8 xl:self-start">
          <SurfaceCard
            title="Review and launch"
            description="The review area reads like a launch checklist instead of another generic form."
          >
            <Checklist items={checklistItems} />
            <div className="mt-6 flex flex-wrap gap-3">
              {mode === "detail" ? (
                <>
                  <button
                    className={secondaryButtonClassName}
                    onClick={runSandboxTest}
                    type="button"
                  >
                    {isTesting ? "Testing..." : "Test agent"}
                  </button>
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
                    className={secondaryButtonClassName}
                    onClick={saveDraft}
                    type="button"
                  >
                    {agent ? "Save changes" : "Save draft"}
                  </button>
                  <button
                    className={primaryButtonClassName}
                    onClick={() => setCurrentStep(4)}
                    type="button"
                  >
                    Continue to review
                  </button>
                  <button
                    className={secondaryButtonClassName}
                    onClick={runSandboxTest}
                    type="button"
                  >
                    {isTesting ? "Testing..." : "Run sandbox test"}
                  </button>
                </>
              )}
            </div>
          </SurfaceCard>

          <SurfaceCard
            title="Prompt preview"
            description="Structured preview of the current system prompt before runtime wiring is completed."
          >
            <pre className="overflow-x-auto rounded-[20px] border border-border bg-[#221b2d] p-5 font-mono text-[13px] leading-6 text-[#f4f1ea]">
              {promptPreview}
            </pre>
          </SurfaceCard>

          <SurfaceCard
            title="Sandbox"
            description="Testing remains visually isolated so the operator understands this is a safe pre-deploy workspace."
          >
            <div className="rounded-[20px] border border-border bg-[#faf6f0] p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <FlaskConical className="size-4 text-primary" />
                Sandbox test prompt
              </div>
              <textarea
                className={`${textareaClassName} mt-3`}
                onChange={(event) => setTestMessage(event.target.value)}
                readOnly={isTesting}
                value={testMessage}
              />
              <div className="mt-4 flex items-start gap-3 rounded-[16px] border border-[#eadfce] bg-white px-4 py-3">
                <MessageSquareQuote className="mt-1 size-4 text-primary" />
                <p className="text-sm leading-6 text-[#433a49]">
                  {sandboxResult?.message ??
                    "Run a sandbox test to see how this draft responds before live deployment exists."}
                </p>
              </div>
              {sandboxResult?.usedTooling.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {sandboxResult.usedTooling.map((toolName) => (
                    <span
                      key={toolName}
                      className="rounded-full border border-border bg-white px-3 py-1 text-xs font-medium text-muted-foreground"
                    >
                      {toolName}
                    </span>
                  ))}
                </div>
              ) : null}
              {deployReadiness ? (
                <div className="mt-4 rounded-[16px] border border-border bg-white p-4">
                  <p className="text-sm font-semibold text-foreground">
                    Deploy readiness
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[#433a49]">
                    {deployReadiness.summary}
                  </p>
                  <div className="mt-3 space-y-2">
                    {deployReadiness.items.map((item) => (
                      <div
                        key={item.key}
                        className="rounded-[14px] border border-border bg-[#faf6f0] px-3 py-2"
                      >
                        <p className="text-sm font-medium text-foreground">
                          {item.done ? "Ready" : "Needs work"}: {item.label}
                        </p>
                        <p className="text-xs leading-5 text-muted-foreground">
                          {item.detail}
                        </p>
                      </div>
                    ))}
                  </div>
                  {deployReadiness.channelConfig ? (
                    <div className="mt-4 rounded-[14px] border border-border bg-[#f7f2ea] px-3 py-3">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#636563]">
                        Webhook status
                      </p>
                      <p className="mt-2 text-sm font-medium text-foreground">
                        {deployReadiness.channelConfig.webhookRegistration === "registered"
                          ? "Registered and ready to receive live traffic."
                          : deployReadiness.channelConfig.webhookRegistration === "pending_public_url"
                            ? "Waiting for a public HTTPS app URL before Telegram webhook registration can complete."
                            : deployReadiness.channelConfig.webhookRegistration === "ready_to_register"
                              ? "Ready to register on the next live deploy."
                              : "Webhook registration state is available."}
                      </p>
                      <div className="mt-3 space-y-1 text-xs leading-5 text-[#554336]">
                        <p>
                          Channel: {deployReadiness.channelConfig.channelType ?? "Unknown"}
                        </p>
                        <p>
                          Outbound mode: {deployReadiness.channelConfig.outboundMode ?? "Unknown"}
                        </p>
                        {deployReadiness.channelConfig.webhookPath ? (
                          <p>Route: {deployReadiness.channelConfig.webhookPath}</p>
                        ) : null}
                        {deployReadiness.channelConfig.webhookUrl ? (
                          <p>Public URL: {deployReadiness.channelConfig.webhookUrl}</p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </SurfaceCard>

          <SurfaceCard
            title="Tenant context"
            description="The builder remains anchored to tenant isolation from the start."
          >
            <div className="space-y-3">
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
              <div className="text-xs leading-5 text-muted-foreground">
                Future runtime isolation remains one conversation per `(agentId, contactId)` and the UI keeps that operational model visible.
              </div>
            </div>
          </SurfaceCard>
        </div>
      </div>
    </div>
  );
}

