import { IntegrationType } from "@prisma/client";
import type { SafeIntegrationConnection } from "@/components/stafless/agent-editor-shared";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  AlertTriangle,
  Braces,
  CheckCircle2,
  ChevronRight,
  CircleQuestionMark,
  Plus,
  Trash2,
} from "lucide-react";

import {
  EmptyState,
  FormField,
  SurfaceCard,
  ToggleSwitch,
  inputClassName,
  secondaryButtonClassName,
  selectClassName,
  textareaClassName,
} from "@/components/stafless/foundation";
import { humanizeWorkspaceToken } from "@/components/stafless/workspace-sections/utils";
import {
  FunctionBlockConfig,
  formatEnumLabel,
  functionParameterTypeOptions,
  functionPostActionOptions,
  functionReactionActionOptions,
} from "@/lib/agent-config";
import {
  GoogleCalendarParams,
  GoogleSheetsColumnMappingDraft,
  GoogleSheetsFilterDraft,
  GoogleSheetsOperationDraft,
  GoogleSheetsParams,
  getGoogleSheetsActionForOperation,
} from "@/lib/function-execution";
import {
  PrimaryDestinationType,
  changePrimaryDestinationType,
  createPrimaryDestination,
  getDestinationSelectorOptions,
  getLinkedPrimaryStep,
  loadViewModel,
  removePrimaryDestination,
  updatePrimaryDestinationLabel,
  updatePrimaryDestinationStep,
} from "@/lib/functions/destination-mapping";
import { applyFunctionVmChange } from "@/lib/functions/apply-function-vm-change";

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

function uniqueValues(values: Array<string | undefined>) {
  return values.filter(
    (value, index, items): value is string =>
      Boolean(value && value.trim()) && items.indexOf(value) === index,
  );
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getIntegrationDisplayLabel(integration: SafeIntegrationConnection) {
  const metadata = asRecord(integration.metadata);
  const explicitLabel =
    (typeof metadata?.name === "string" && metadata.name.trim()) ||
    (typeof metadata?.email === "string" && metadata.email.trim()) ||
    (typeof metadata?.calendarName === "string" && metadata.calendarName.trim()) ||
    (typeof metadata?.spreadsheetTitle === "string" && metadata.spreadsheetTitle.trim()) ||
    (typeof metadata?.provider === "string" && metadata.provider.trim());
  const baseLabel = formatEnumLabel(integration.type);

  return explicitLabel ? `${baseLabel} - ${explicitLabel}` : baseLabel;
}

const businessDayOptions = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
] as const;

const calendarDateSourceOptions = [
  { value: "request_date", label: "Structured date from function call" },
  { value: "time_text", label: "Infer from customer time text" },
  { value: "literal", label: "Fixed date" },
] as const;

const calendarTimeSourceOptions = [
  { value: "time_text", label: "Customer time text from function call" },
  { value: "literal", label: "Fixed time" },
] as const;

const calendarEmailSourceOptions = [
  { value: "customer_email", label: "Customer email from function call" },
  { value: "default_email", label: "Fallback default email" },
  { value: "literal", label: "Fixed email" },
] as const;

const googleSheetsOperationOptions = [
  { value: "get_rows", label: "Lookup rows" },
  { value: "capacity_availability", label: "Check capacity availability" },
  { value: "append_row", label: "Add row" },
  { value: "update_rows", label: "Update rows" },
] as const;

const googleSheetsValueSourceOptions = [
  { value: "literal", label: "Fixed value" },
  { value: "requested_date", label: "Requested date" },
  { value: "user_message", label: "User message" },
  { value: "time_text", label: "Requested time text" },
  { value: "couple_name", label: "Couple name" },
  { value: "wedding_date", label: "Wedding date" },
  { value: "location", label: "Location" },
  { value: "email", label: "Email" },
  { value: "channel", label: "Channel" },
] as const;

function isIsoDateLiteral(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

function isEmailLiteral(value: string) {
  return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(value.trim());
}

function isCalendarTimeLiteral(value: string) {
  return /(^\d{1,2}:\d{2}$)|(^\d{1,2}\s*(am|pm)$)|(^\d{1,2}:\d{2}\s*(am|pm)$)/i.test(
    value.trim(),
  );
}

function toggleBusinessDay(days: number[], day: number) {
  return days.includes(day)
    ? days.filter((value) => value !== day)
    : [...days, day].sort((left, right) => left - right);
}

function getGoogleSheetsBindingPreview(source: GoogleSheetsColumnMappingDraft["valueSource"]) {
  switch (source) {
    case "requested_date":
      return "Uses the requested date parsed from the function call.";
    case "user_message":
      return "Uses the customer's raw message text from the function call.";
    case "time_text":
      return "Uses the requested time text from the function call.";
    case "couple_name":
      return "Uses the couple name captured in the function call.";
    case "wedding_date":
      return "Uses the wedding date captured in the function call.";
    case "location":
      return "Uses the location captured in the function call.";
    case "email":
      return "Uses the email captured in the function call.";
    case "channel":
      return "Uses the source channel captured in the function call.";
    default:
      return "Uses the fixed value stored in this field.";
  }
}

const compactInputClassName =
  "h-9 w-full rounded-md border border-[#d8e0ec] bg-white px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/80 focus:border-[#8ea2ff] focus:ring-2 focus:ring-[#8ea2ff]/10";
const compactSelectClassName = compactInputClassName;
const compactTextareaClassName =
  "w-full rounded-md border border-[#d8e0ec] bg-white px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/80 focus:border-[#8ea2ff] focus:ring-2 focus:ring-[#8ea2ff]/10";
const iconButtonClassName =
  "inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#d8e0ec] bg-white text-[#475467] transition hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8ea2ff]/20";
const functionListCardClassName =
  "rounded-[16px] border border-[#e3e8f1] bg-white px-4 py-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:border-[#cfd8e6] hover:bg-[#fbfcff]";
const detailSectionCardClassName =
  "rounded-[14px] border border-[#dbe3ef] bg-white px-4 py-4 shadow-[0_1px_2px_rgba(16,24,40,0.02)]";
const detailSectionTitleClassName =
  "text-[18px] font-semibold tracking-[-0.02em] text-[#111827]";

function getFunctionPreview(fn: FunctionDraft) {
  return (
    fn.description.trim() ||
    fn.parameters.map((parameter) => parameter.name.trim()).filter(Boolean).join(", ") ||
    "Open the function to configure its business action, parameters, and result delivery."
  );
}

function getFunctionMeta(fn: FunctionDraft) {
  return [
    `${fn.parameters.length} params`,
    `${fn.steps.length} steps`,
    fn.resultTargets.length ? `${fn.resultTargets.length} targets` : null,
  ]
    .filter(Boolean)
    .join(" • ");
}

function getReactionDescription(value: FunctionDraft["reactionAction"]) {
  switch (value) {
    case "send_message":
      return "The agent sends a direct reply immediately after the function completes.";
    case "send_instruction":
      return "The function result is treated like an instruction layer for the next reply.";
    case "send_nothing":
      return "The function completes silently without an automatic customer-facing message.";
    default:
      return "The AI agent decides how to respond based on the function result.";
  }
}

function getPostActionDescription(value: FunctionDraft["postAction"]) {
  switch (value) {
    case "pause_dialog":
      return "The dialog is paused after the function finishes.";
    case "switch_agent":
      return "Use this when another agent or flow should take over next.";
    case "change_prompt":
      return "Use this when the function should alter the agent's prompt context.";
    default:
      return "The agent continues the current conversation after the function runs.";
  }
}

function getFunctionBusinessMeta(fn: FunctionDraft) {
  const parts = [fn.active ? "Active" : "Inactive"];

  parts.push(
    fn.parameters.length === 1 ? "1 parameter" : `${fn.parameters.length} parameters`,
  );

  if (fn.disableDelayedMessages) {
    parts.push("Delayed messages off");
  }

  return parts.join(" • ");
}

function getFunctionBackendLabel(
  fn: FunctionDraft,
  integrationById: Map<string, SafeIntegrationConnection>,
) {
  const primaryTarget =
    fn.resultTargets.find((target) => target.type === "google_calendar") ??
    fn.resultTargets.find((target) => target.type === "google_sheets") ??
    fn.resultTargets.find((target) => target.type === "api_request") ??
    fn.resultTargets[0];

  if (primaryTarget?.type === "google_calendar") {
    return "Google Calendar";
  }

  if (primaryTarget?.type === "google_sheets") {
    return "Google Sheets";
  }

  if (primaryTarget?.type === "api_request") {
    return "Custom API";
  }

  const firstConnectedStep = fn.steps.find((step) => integrationById.has(step.integrationId));
  const firstStepIntegration = firstConnectedStep
    ? integrationById.get(firstConnectedStep.integrationId)
    : null;

  return firstStepIntegration ? formatEnumLabel(firstStepIntegration.type) : "No backend";
}

function getFunctionReadiness(
  fn: FunctionDraft,
  integrationById: Map<string, SafeIntegrationConnection>,
) {
  if (!fn.active) {
    return {
      status: "inactive" as const,
      label: "Inactive",
      detail: "The agent will not call this function.",
    };
  }

  if (!fn.name.trim() || !fn.description.trim()) {
    return {
      status: "blocked" as const,
      label: "Needs basics",
      detail: "Name and summary are required before this function can run.",
    };
  }

  if (fn.steps.length === 0) {
    return {
      status: "blocked" as const,
      label: "Needs backend",
      detail: "Choose Google Calendar or Google Sheets and bind a connected account.",
    };
  }

  const hasConnectedStep = fn.steps.some((step) => integrationById.has(step.integrationId));

  if (!hasConnectedStep) {
    return {
      status: "blocked" as const,
      label: "Needs integration",
      detail: "Select an integration enabled for this agent.",
    };
  }

  return {
    status: "ready" as const,
    label: "Ready",
    detail: "This function has an executable backend.",
  };
}

function getDestinationIntegrationType(destination: PrimaryDestinationType) {
  if (destination === "google_sheets") {
    return IntegrationType.GOOGLE_SHEETS;
  }

  if (destination === "google_calendar") {
    return IntegrationType.GOOGLE_CALENDAR;
  }

  return null;
}

function isOperatorDestinationAvailable(
  destination: PrimaryDestinationType,
  connectedIntegrations: SafeIntegrationConnection[],
) {
  const integrationType = getDestinationIntegrationType(destination);

  if (!integrationType) {
    return false;
  }

  return connectedIntegrations.some((integration) => integration.type === integrationType);
}

function getDestinationUnavailableCopy(destination: PrimaryDestinationType) {
  switch (destination) {
    case "google_sheets":
      return "Turn on Google Sheets in Integrations first.";
    case "google_calendar":
      return "Turn on Google Calendar in Integrations first.";
    case "api_request":
      return "Custom API is not available in this workspace slice.";
    default:
      return "This legacy destination is preserved but not configurable here.";
  }
}

export function FunctionsSection({
  functionBlocks,
  isReadOnlyMode,
  isWorkspaceMode,
  connectedIntegrations,
  integrationById,
  sheetInspectors,
  sectionCanvasClassName,
  onAddFunctionBlock,
  onMoveFunctionBlock,
  onRemoveFunctionBlock,
  onUpdateFunction,
  onAddFunctionParameter,
  onUpdateFunctionParameter,
  onRemoveFunctionParameter,
  onAddFunctionStep,
  onRemoveFunctionStep,
  onFunctionStepIntegrationChange,
  onUpdateFunctionStep,
  onUpdateFunctionStepParams,
  onLoadGoogleSpreadsheetCatalog,
  onInspectGoogleSpreadsheet,
  onAddGoogleSheetsFilter,
  onUpdateGoogleSheetsFilter,
  onAddGoogleSheetsColumnMapping,
  onUpdateGoogleSheetsColumnMapping,
  getFunctionStepKey,
  getGoogleSheetsParams,
  getGoogleCalendarParams,
}: {
  functionBlocks: FunctionDraft[];
  isReadOnlyMode: boolean;
  isWorkspaceMode: boolean;
  connectedIntegrations: SafeIntegrationConnection[];
  integrationById: Map<string, SafeIntegrationConnection>;
  sheetInspectors: Record<string, SheetInspectionState>;
  sectionCanvasClassName: string;
  onAddFunctionBlock: () => void;
  onMoveFunctionBlock: (index: number, direction: -1 | 1) => void;
  onRemoveFunctionBlock: (index: number) => void;
  onUpdateFunction: (index: number, patch: Partial<FunctionDraft>) => void;
  onAddFunctionParameter: (functionIndex: number) => void;
  onUpdateFunctionParameter: (
    functionIndex: number,
    parameterIndex: number,
    patch: Partial<FunctionDraft["parameters"][number]>,
  ) => void;
  onRemoveFunctionParameter: (functionIndex: number, parameterIndex: number) => void;
  onAddFunctionStep: (functionIndex: number) => void;
  onRemoveFunctionStep: (functionIndex: number, stepIndex: number) => void;
  onFunctionStepIntegrationChange: (
    functionIndex: number,
    stepIndex: number,
    integrationId: string,
  ) => void;
  onUpdateFunctionStep: (
    functionIndex: number,
    stepIndex: number,
    patch: Partial<ToolStepDraft>,
  ) => void;
  onUpdateFunctionStepParams: (
    functionIndex: number,
    stepIndex: number,
    patch: Record<string, unknown>,
  ) => void;
  onLoadGoogleSpreadsheetCatalog: (functionIndex: number, stepIndex: number) => void;
  onInspectGoogleSpreadsheet: (functionIndex: number, stepIndex: number) => void;
  onAddGoogleSheetsFilter: (functionIndex: number, stepIndex: number) => void;
  onUpdateGoogleSheetsFilter: (
    functionIndex: number,
    stepIndex: number,
    filterIndex: number,
    patch: Partial<GoogleSheetsFilterDraft>,
  ) => void;
  onAddGoogleSheetsColumnMapping: (functionIndex: number, stepIndex: number) => void;
  onUpdateGoogleSheetsColumnMapping: (
    functionIndex: number,
    stepIndex: number,
    mappingIndex: number,
    patch: Partial<GoogleSheetsColumnMappingDraft>,
  ) => void;
  getFunctionStepKey: (functionIndex: number, stepIndex: number) => string;
  getGoogleSheetsParams: (step: ToolStepDraft) => GoogleSheetsParams;
  getGoogleCalendarParams: (step: ToolStepDraft) => GoogleCalendarParams;
}) {
  const [selectedFunctionUiId, setSelectedFunctionUiId] = useState<string | null>(null);

  const selectedFunctionEntry = useMemo(() => {
    if (!selectedFunctionUiId) {
      return null;
    }

    const index = functionBlocks.findIndex((fn) => fn.uiId === selectedFunctionUiId);

    if (index === -1) {
      return null;
    }

    return {
      fn: functionBlocks[index],
      functionIndex: index,
    };
  }, [functionBlocks, selectedFunctionUiId]);

  useEffect(() => {
    if (!functionBlocks.length) {
      setSelectedFunctionUiId(null);
      return;
    }

    if (
      selectedFunctionUiId &&
      functionBlocks.some((fn) => fn.uiId === selectedFunctionUiId)
    ) {
      return;
    }

    setSelectedFunctionUiId(null);
  }, [functionBlocks, selectedFunctionUiId]);

  const applyVmChange = (
    functionIndex: number,
    updater: (currentVm: ReturnType<typeof loadViewModel<FunctionResultTargetDraft, ToolStepDraft, FunctionParameterDraft>>) => ReturnType<typeof loadViewModel<FunctionResultTargetDraft, ToolStepDraft, FunctionParameterDraft>>,
  ) => {
    const currentFunction = functionBlocks[functionIndex];

    if (!currentFunction) {
      return;
    }

    onUpdateFunction(functionIndex, applyFunctionVmChange(currentFunction, updater));
  };

  const createPrimaryStepStrategy = () => ({
    createStep: (type: "google_sheets" | "google_calendar" | "api_request"): ToolStepDraft => ({
      uiId: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      id: crypto.randomUUID(),
      integrationId: "",
      action:
        type === "google_sheets"
          ? getGoogleSheetsActionForOperation("get_rows")
          : type === "google_calendar"
            ? "check consultation calendar availability"
            : "send custom api request",
      params:
        type === "google_sheets"
          ? JSON.stringify(getGoogleSheetsParams({ uiId: "", integrationId: "", action: "", params: "{}" }), null, 2)
          : type === "google_calendar"
            ? JSON.stringify(getGoogleCalendarParams({ uiId: "", integrationId: "", action: "", params: "{}" }), null, 2)
            : "{}",
    }),
    getStepId: (step: ToolStepDraft) => step.id ?? null,
    findLegacyStepIndex: (
      steps: ToolStepDraft[],
      destinationType: "google_sheets" | "google_calendar" | "api_request",
    ) => {
      const matches = steps
        .map((step, index) => ({ step, index }))
        .filter(({ step }) =>
          destinationType === "google_sheets"
            ? integrationById.get(step.integrationId)?.type === IntegrationType.GOOGLE_SHEETS
            : destinationType === "google_calendar"
              ? integrationById.get(step.integrationId)?.type ===
                IntegrationType.GOOGLE_CALENDAR
              : (() => {
                  const integrationType = integrationById.get(step.integrationId)?.type;

                  return (
                    !integrationType ||
                    (integrationType !== IntegrationType.GOOGLE_SHEETS &&
                      integrationType !== IntegrationType.GOOGLE_CALENDAR)
                  );
                })(),
        );

      return matches.length === 1 ? matches[0]!.index : -1;
    },
  });

  const visibleFunctionEntries =
    isWorkspaceMode
      ? selectedFunctionEntry
        ? [selectedFunctionEntry]
        : []
      : functionBlocks.map((fn, functionIndex) => ({ fn, functionIndex }));

  return (
    <SurfaceCard
      className="border-0 bg-transparent p-0 shadow-none"
      title="Functions"
      description="Define business actions in a compact operator workspace, then bind execution to tenant integrations."
      action={
        isReadOnlyMode ? null : (
          <button className={secondaryButtonClassName} onClick={onAddFunctionBlock} type="button">
            <Plus className="mr-2 size-4" />
            Add function
          </button>
        )
      }
    >
      <div className={sectionCanvasClassName}>
        <div className="space-y-5">
          {functionBlocks.length === 0 ? (
            <EmptyState
              title="No functions configured yet"
              description="Start with an explicit business action, then add parameters, execution steps, and result delivery only where this agent truly needs them."
              action={
                isReadOnlyMode ? undefined : (
                  <button
                    className={secondaryButtonClassName}
                    onClick={onAddFunctionBlock}
                    type="button"
                  >
                    <Plus className="mr-2 size-4" />
                    Add first function
                  </button>
                )
              }
            />
          ) : null}

          {isWorkspaceMode && functionBlocks.length > 0 && !selectedFunctionEntry ? (
            <div className="mx-auto w-full max-w-[720px] space-y-6">
              <div className="flex items-start justify-between gap-4 border-b border-[#e8edf5] pb-5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h1 className="text-[18px] font-semibold tracking-[-0.02em] text-[#101828]">
                      Functions
                    </h1>
                    <CircleQuestionMark className="size-4 text-[#98a2b3]" />
                  </div>
                  <p className="mt-2 max-w-[560px] text-sm leading-6 text-[#667085]">
                    Functions connect the agent to real business actions. Start with a clear
                    action name, then open the function to configure parameters, behavior,
                    and result delivery.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {functionBlocks.map((fn, functionIndex) => {
                  const readiness = getFunctionReadiness(fn, integrationById);
                  const backendLabel = getFunctionBackendLabel(fn, integrationById);

                  return (
                    <div
                      key={fn.uiId}
                      className={functionListCardClassName}
                    >
                      <button
                        className="flex w-full items-start gap-4 text-left"
                        onClick={() => setSelectedFunctionUiId(fn.uiId)}
                        type="button"
                      >
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-[#f4f6fb] text-[#6c63ff]">
                          <Braces className="size-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-base font-semibold text-[#111827]">
                              {fn.name.trim() || `Untitled function ${functionIndex + 1}`}
                            </p>
                            <span className="rounded-[8px] bg-[#eef2f7] px-2 py-1 text-xs font-semibold text-[#526173]">
                              {backendLabel}
                            </span>
                            <span
                              className={
                                readiness.status === "ready"
                                  ? "inline-flex items-center gap-1 rounded-[8px] bg-[#eaf7ee] px-2 py-1 text-xs font-semibold text-[#247144]"
                                  : readiness.status === "blocked"
                                    ? "inline-flex items-center gap-1 rounded-[8px] bg-[#fff3e8] px-2 py-1 text-xs font-semibold text-[#b45309]"
                                    : "inline-flex items-center gap-1 rounded-[8px] bg-[#eef2f7] px-2 py-1 text-xs font-semibold text-[#667085]"
                              }
                            >
                              {readiness.status === "ready" ? (
                                <CheckCircle2 className="size-3.5" />
                              ) : readiness.status === "blocked" ? (
                                <AlertTriangle className="size-3.5" />
                              ) : null}
                              {readiness.label}
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-sm leading-6 text-[#667085]">
                            {getFunctionPreview(fn)}
                          </p>
                          <p className="mt-2 text-xs font-medium uppercase tracking-[0.12em] text-[#98a2b3]">
                            {getFunctionBusinessMeta(fn)}
                          </p>
                          {readiness.status === "blocked" ? (
                            <p className="mt-2 text-sm leading-5 text-[#b45309]">
                              {readiness.detail}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-3 pt-1">
                          <div
                            onClick={(event) => event.stopPropagation()}
                            role="presentation"
                          >
                            <ToggleSwitch
                              checked={fn.active}
                              disabled={isReadOnlyMode}
                              onCheckedChange={(checked) =>
                                onUpdateFunction(functionIndex, { active: checked })
                              }
                            />
                          </div>
                          <ChevronRight className="size-4 text-[#98a2b3]" />
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>

              {!isReadOnlyMode ? (
                <div className="flex justify-center pt-1">
                  <button
                    className="inline-flex size-9 items-center justify-center rounded-full bg-[#6c63ff] text-white transition hover:bg-[#5a52ea]"
                    onClick={onAddFunctionBlock}
                    type="button"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {isWorkspaceMode && selectedFunctionEntry ? (
            <div className="mx-auto w-full max-w-[880px] space-y-6">
              <div className="flex items-start justify-between gap-4 border-b border-[#e8edf5] pb-5">
                <div className="min-w-0">
                  <button
                    className="inline-flex items-center gap-2 text-sm font-medium text-[#667085] transition hover:text-[#111827]"
                    onClick={() => setSelectedFunctionUiId(null)}
                    type="button"
                  >
                    <ArrowLeft className="size-4" />
                    Back to functions
                  </button>
                  <div className="mt-3 flex items-center gap-2">
                    <h1 className="truncate text-[18px] font-semibold tracking-[-0.02em] text-[#101828]">
                      {selectedFunctionEntry.fn.name.trim() || "Untitled function"}
                    </h1>
                    <CircleQuestionMark className="size-4 text-[#98a2b3]" />
                  </div>
                  <p className="mt-2 max-w-[640px] text-sm leading-6 text-[#667085]">
                    Configure the function contract, post-scenario behavior, delayed-message
                    handling, and the destination that receives the result.
                  </p>
                </div>
                <div className="text-sm text-[#98a2b3]">
                  {selectedFunctionEntry.fn.active ? "Active" : "Inactive"}
                </div>
              </div>
            </div>
          ) : null}

          {visibleFunctionEntries.map(({ fn, functionIndex }) => (
            <div
              key={fn.uiId}
              className={
                isWorkspaceMode
                  ? "mx-auto w-full max-w-[880px] space-y-6"
                  : "rounded-[16px] border border-[#e6ebf2] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
              }
            >
              <div
                className={
                  isWorkspaceMode
                    ? "hidden"
                    : "mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-[#edf1f6] pb-4"
                }
              >
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#8090ab]">
                    Function {functionIndex + 1}
                  </p>
                  <p className="mt-1 text-base font-semibold text-foreground">
                    {fn.name.trim() || `Untitled function ${functionIndex + 1}`}
                  </p>
                </div>
                {!isReadOnlyMode ? (
                  <div className="flex gap-2">
                    <button
                      className={iconButtonClassName}
                      onClick={() => onMoveFunctionBlock(functionIndex, -1)}
                      type="button"
                    >
                      <ArrowUp className="size-4" />
                    </button>
                    <button
                      className={iconButtonClassName}
                      onClick={() => onMoveFunctionBlock(functionIndex, 1)}
                      type="button"
                    >
                      <ArrowDown className="size-4" />
                    </button>
                    <button
                      className={iconButtonClassName}
                      onClick={() => onRemoveFunctionBlock(functionIndex)}
                      type="button"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="space-y-4">
                {!isWorkspaceMode ? (
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                    <div className="space-y-4">
                      <FormField label="Function name" labelClassName="text-xs font-medium text-[#667085]">
                        <input
                          className={compactInputClassName}
                          onChange={(event) => onUpdateFunction(functionIndex, { name: event.target.value })}
                          readOnly={isReadOnlyMode}
                          value={fn.name}
                        />
                      </FormField>
                      <FormField label="Summary" labelClassName="text-xs font-medium text-[#667085]">
                        <textarea
                          className={compactTextareaClassName}
                          onChange={(event) =>
                            onUpdateFunction(functionIndex, { description: event.target.value })
                          }
                          readOnly={isReadOnlyMode}
                          value={fn.description}
                        />
                      </FormField>
                    </div>

                    <div className="rounded-[12px] border border-[#e6ebf2] bg-[#fbfcfe] px-4 py-4">
                      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#8090ab]">
                        Workspace note
                      </p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Keep the operator focused on the business action first. Execution details
                        stay below, but the function itself should read like something the agent does
                        for the client.
                      </p>
                    </div>
                  </div>
                ) : null}

                {isWorkspaceMode ? (
                  <>
                    <div className="space-y-3">
                      <h2 className={detailSectionTitleClassName}>Function details</h2>
                      <div className={detailSectionCardClassName}>
                        <div className="space-y-4">
                          <div className="flex items-start justify-between gap-4 rounded-[12px] border border-[#e6ebf2] bg-[#fafcff] px-4 py-4">
                            <div className="space-y-1">
                              <p className="text-sm font-medium text-[#111827]">Function status</p>
                              <p className="text-sm leading-6 text-[#667085]">
                                Control whether this function is available to the agent right now.
                              </p>
                            </div>
                            <ToggleSwitch
                              checked={fn.active}
                              disabled={isReadOnlyMode}
                              onCheckedChange={(checked) =>
                                onUpdateFunction(functionIndex, { active: checked })
                              }
                            />
                          </div>
                          <FormField label="Function name" labelClassName="text-xs font-medium text-[#667085]">
                            <input
                              className={compactInputClassName}
                              onChange={(event) => onUpdateFunction(functionIndex, { name: event.target.value })}
                              readOnly={isReadOnlyMode}
                              value={fn.name}
                            />
                          </FormField>
                          <FormField label="Summary" labelClassName="text-xs font-medium text-[#667085]">
                            <textarea
                              className={compactTextareaClassName}
                              onChange={(event) =>
                                onUpdateFunction(functionIndex, { description: event.target.value })
                              }
                              readOnly={isReadOnlyMode}
                              value={fn.description}
                            />
                          </FormField>
                        </div>
                      </div>

                      <div className={detailSectionCardClassName}>
                        <div className="flex items-center gap-2">
                          <h2 className={detailSectionTitleClassName}>Reaction after function</h2>
                          <CircleQuestionMark className="size-4 text-[#98a2b3]" />
                        </div>
                        <div className="mt-4 space-y-4">
                          <FormField label="Action" labelClassName="text-xs font-medium text-[#667085]">
                            <select
                              className={compactSelectClassName}
                              disabled={isReadOnlyMode}
                              onChange={(event) =>
                                onUpdateFunction(functionIndex, {
                                  reactionAction:
                                    event.target.value as FunctionDraft["reactionAction"],
                                })
                              }
                              value={fn.reactionAction}
                            >
                              {functionReactionActionOptions.map((option) => (
                                <option key={option} value={option}>
                                  {humanizeWorkspaceToken(option)}
                                </option>
                              ))}
                            </select>
                          </FormField>
                          <div className="rounded-[12px] border border-[#e6ebf2] bg-[#fafcff] px-4 py-4 text-sm leading-6 text-[#667085]">
                            {getReactionDescription(fn.reactionAction)}
                          </div>
                        </div>
                      </div>

                      <div className={detailSectionCardClassName}>
                        <div className="flex items-center gap-2">
                          <h2 className={detailSectionTitleClassName}>Post-scenario</h2>
                          <CircleQuestionMark className="size-4 text-[#98a2b3]" />
                        </div>
                        <div className="mt-4 space-y-4">
                          <FormField label="Action" labelClassName="text-xs font-medium text-[#667085]">
                            <select
                              className={compactSelectClassName}
                              disabled={isReadOnlyMode}
                              onChange={(event) =>
                                onUpdateFunction(functionIndex, {
                                  postAction: event.target.value as FunctionDraft["postAction"],
                                })
                              }
                              value={fn.postAction}
                            >
                              {functionPostActionOptions.map((option) => (
                                <option key={option} value={option}>
                                  {humanizeWorkspaceToken(option)}
                                </option>
                              ))}
                            </select>
                          </FormField>
                          <div className="rounded-[12px] border border-[#e6ebf2] bg-[#fafcff] px-4 py-4 text-sm leading-6 text-[#667085]">
                            {getPostActionDescription(fn.postAction)}
                          </div>
                        </div>
                      </div>

                      <div className={detailSectionCardClassName}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <h2 className={detailSectionTitleClassName}>Disable delayed messages</h2>
                            <p className="text-sm leading-6 text-[#667085]">
                              After this function runs, scheduled delayed messages will be turned off for the current dialog.
                            </p>
                          </div>
                          <ToggleSwitch
                            checked={fn.disableDelayedMessages}
                            disabled={isReadOnlyMode}
                            onCheckedChange={(checked) =>
                              onUpdateFunction(functionIndex, {
                                disableDelayedMessages: checked,
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <h2 className={detailSectionTitleClassName}>Function parameters</h2>
                        {!isReadOnlyMode ? (
                          <button
                            className="inline-flex size-8 items-center justify-center rounded-full bg-[#6c63ff] text-white transition hover:bg-[#5b53ea]"
                            onClick={() => onAddFunctionParameter(functionIndex)}
                            type="button"
                          >
                            <Plus className="size-4" />
                          </button>
                        ) : null}
                      </div>
                      <div className={detailSectionCardClassName}>
                        <div className="space-y-4">
                          {fn.parameters.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              No structured inputs yet. Add the fields the model should extract
                              before this function runs.
                            </p>
                          ) : null}
                          {fn.parameters.map((parameter, parameterIndex) => (
                            <div
                              key={parameter.uiId}
                              className="space-y-4 rounded-[12px] border border-[#e5e7eb] bg-white px-4 py-4"
                            >
                              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_200px_minmax(0,1.2fr)_40px]">
                                <FormField label="Name" labelClassName="text-xs font-medium text-[#667085]">
                                  <input
                                    className={compactInputClassName}
                                    onChange={(event) =>
                                      onUpdateFunctionParameter(functionIndex, parameterIndex, {
                                        name: event.target.value,
                                      })
                                    }
                                    readOnly={isReadOnlyMode}
                                    value={parameter.name}
                                  />
                                </FormField>
                                <FormField label="Type" labelClassName="text-xs font-medium text-[#667085]">
                                  <select
                                    className={compactSelectClassName}
                                    disabled={isReadOnlyMode}
                                    onChange={(event) =>
                                      onUpdateFunctionParameter(functionIndex, parameterIndex, {
                                        type:
                                          event.target.value as FunctionDraft["parameters"][number]["type"],
                                      })
                                    }
                                    value={parameter.type}
                                  >
                                    {functionParameterTypeOptions.map((option) => (
                                      <option key={option} value={option}>
                                        {humanizeWorkspaceToken(option)}
                                      </option>
                                    ))}
                                  </select>
                                </FormField>
                                <FormField label="Instruction" labelClassName="text-xs font-medium text-[#667085]">
                                  <textarea
                                    className={compactTextareaClassName}
                                    onChange={(event) =>
                                      onUpdateFunctionParameter(functionIndex, parameterIndex, {
                                        instruction: event.target.value,
                                      })
                                    }
                                    readOnly={isReadOnlyMode}
                                    value={parameter.instruction ?? ""}
                                  />
                                </FormField>
                                {!isReadOnlyMode ? (
                                  <button
                                    className={`${iconButtonClassName} self-end`}
                                    onClick={() =>
                                      onRemoveFunctionParameter(functionIndex, parameterIndex)
                                    }
                                    type="button"
                                  >
                                    <Trash2 className="size-4" />
                                  </button>
                                ) : null}
                              </div>

                              <FormField label="Allowed values" labelClassName="text-xs font-medium text-[#667085]">
                                <input
                                  className={compactInputClassName}
                                  onChange={(event) =>
                                    onUpdateFunctionParameter(functionIndex, parameterIndex, {
                                      allowedValues: event.target.value
                                        .split(",")
                                        .map((value) => value.trim())
                                        .filter(Boolean),
                                    })
                                  }
                                  placeholder="Add values separated by commas"
                                  readOnly={isReadOnlyMode}
                                  value={parameter.allowedValues.join(", ")}
                                />
                              </FormField>
                              <label className="flex items-center gap-3 text-sm text-[#344054]">
                                <input
                                  checked={parameter.required}
                                  disabled={isReadOnlyMode}
                                  onChange={(event) =>
                                    onUpdateFunctionParameter(functionIndex, parameterIndex, {
                                      required: event.target.checked,
                                    })
                                  }
                                  type="checkbox"
                                />
                                Required parameter
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h2 className={detailSectionTitleClassName}>Result delivery</h2>
                      <div className={detailSectionCardClassName}>
                        {(() => {
                          const primaryStepStrategy = createPrimaryStepStrategy();
                          const functionViewModel = loadViewModel(fn, primaryStepStrategy);
                          const primaryBinding = functionViewModel.resultDelivery.primary;
                          const primaryTarget = primaryBinding?.target ?? null;
                          const visibleDestinationOptions = getDestinationSelectorOptions({
                            isNewFunction: fn.resultTargets.length === 0,
                            currentTargets: fn.resultTargets,
                          });
                          const operatorDestinationOptions = visibleDestinationOptions.filter(
                            (option) =>
                              option.value !== "api_request" ||
                              primaryTarget?.type === "api_request",
                          );
                          const secondaryTargets = functionViewModel.advanced.secondaryTargets;
                          const hasAdvancedOnlyTargets =
                            functionViewModel.advanced.advancedOnlyTargets.length > 0;
                          const hasLegacyCompatTargets =
                            functionViewModel.advanced.legacyCompatTargets.length > 0;
                          const linkedPrimaryStep = getLinkedPrimaryStep(functionViewModel);
                          const primaryStep = linkedPrimaryStep?.step ?? null;
                          const sheetParams = primaryStep ? getGoogleSheetsParams(primaryStep) : null;
                          const calendarParams = primaryStep
                            ? getGoogleCalendarParams(primaryStep)
                            : null;

                          return (
                            <div className="space-y-4">
                              <p className="text-sm leading-6 text-[#667085]">
                                Choose one primary destination for this function. Any legacy
                                multi-step wiring stays available below in Advanced execution.
                              </p>

                              {!primaryTarget ? (
                                <div className="space-y-4 rounded-[12px] border border-dashed border-[#cfd8e6] bg-[#fbfcff] px-4 py-5">
                                  <p className="text-sm font-medium text-[#344054]">
                                    {hasAdvancedOnlyTargets || fn.steps.length > 0
                                      ? "This function still uses advanced delivery."
                                      : "Create the primary destination for this function."}
                                  </p>
                                  {hasAdvancedOnlyTargets || fn.steps.length > 0 ? (
                                    <p className="text-sm text-[#667085]">
                                      Result delivery is currently defined through legacy targets
                                      or execution steps. Choose a supported destination below if
                                      you want to move this function into the new flow. Existing
                                      advanced data will stay intact.
                                    </p>
                                  ) : null}
                                  <div className="grid gap-3 md:grid-cols-2">
                                    {operatorDestinationOptions.map((option) => {
                                      const isAvailable = isOperatorDestinationAvailable(
                                        option.value,
                                        connectedIntegrations,
                                      );

                                      return (
                                        <button
                                          key={option.value}
                                          className={
                                            isAvailable
                                              ? "rounded-[12px] border border-[#dbe3ef] bg-white px-4 py-3 text-left text-sm font-medium text-[#111827] transition hover:border-[#b9c7dd] hover:bg-[#f8faff]"
                                              : "cursor-not-allowed rounded-[12px] border border-[#dbe3ef] bg-[#f3f5f8] px-4 py-3 text-left text-sm font-medium text-[#8b98aa]"
                                          }
                                          disabled={isReadOnlyMode || !isAvailable}
                                          onClick={() =>
                                            applyVmChange(functionIndex, (currentVm) =>
                                              createPrimaryDestination(
                                                currentVm,
                                                option.value,
                                                primaryStepStrategy,
                                              ),
                                            )
                                          }
                                          type="button"
                                        >
                                          <span className="block">{option.label}</span>
                                          {!isAvailable ? (
                                            <span className="mt-1 block text-xs font-normal leading-5">
                                              {getDestinationUnavailableCopy(option.value)}
                                            </span>
                                          ) : null}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)_40px]">
                                    <FormField label="Destination" labelClassName="text-xs font-medium text-[#667085]">
                                      <select
                                        className={compactSelectClassName}
                                        disabled={isReadOnlyMode}
                                        onChange={(event) =>
                                          applyVmChange(functionIndex, (currentVm) =>
                                            changePrimaryDestinationType(
                                              currentVm,
                                              event.target.value as PrimaryDestinationType,
                                              primaryStepStrategy,
                                            ),
                                          )
                                        }
                                        value={primaryTarget.type}
                                      >
                                        {operatorDestinationOptions.map((option) => (
                                          <option
                                            disabled={
                                              primaryTarget.type !== option.value &&
                                              !isOperatorDestinationAvailable(
                                                option.value,
                                                connectedIntegrations,
                                              )
                                            }
                                            key={option.value}
                                            value={option.value}
                                          >
                                            {option.label}
                                            {option.compatibility ? " (legacy)" : ""}
                                          </option>
                                        ))}
                                      </select>
                                    </FormField>
                                    <FormField label="What to send" labelClassName="text-xs font-medium text-[#667085]">
                                      <input
                                        className={compactInputClassName}
                                        onChange={(event) =>
                                          applyVmChange(functionIndex, (currentVm) =>
                                            updatePrimaryDestinationLabel(
                                              currentVm,
                                              event.target.value,
                                            ),
                                          )
                                        }
                                        readOnly={isReadOnlyMode}
                                        value={primaryTarget.label}
                                      />
                                    </FormField>
                                    {!isReadOnlyMode ? (
                                      <button
                                        className={`${iconButtonClassName} self-end`}
                                        onClick={() =>
                                          applyVmChange(functionIndex, removePrimaryDestination)
                                        }
                                        type="button"
                                      >
                                        <Trash2 className="size-4" />
                                      </button>
                                    ) : null}
                                  </div>

                                  {hasLegacyCompatTargets || hasAdvancedOnlyTargets ? (
                                    <div className="rounded-[12px] border border-[#e6ebf2] bg-[#fafcff] px-4 py-3 text-sm text-[#667085]">
                                      {secondaryTargets.length > 0
                                        ? `${secondaryTargets.length} legacy result target${secondaryTargets.length === 1 ? "" : "s"} remain preserved in Advanced execution.`
                                        : "Additional advanced delivery data remains preserved in Advanced execution."}
                                    </div>
                                  ) : null}

                                  {primaryBinding?.mode === "compatibility" ? (
                                    <div className="rounded-[12px] border border-[#e6ebf2] bg-[#fafcff] px-4 py-3 text-sm text-[#667085]">
                                      This destination is shown in compatibility mode. Its legacy
                                      delivery data stays preserved, and any deeper execution
                                      wiring remains in Advanced execution.
                                    </div>
                                  ) : null}

                                  {primaryBinding?.tier === "A" &&
                                  primaryBinding.kind !== "api_request" &&
                                  !primaryStep ? (
                                    <div className="rounded-[12px] border border-dashed border-[#cfd8e6] bg-[#fbfcff] px-4 py-5">
                                      <p className="text-sm text-[#667085]">
                                        Add one execution step to bind this destination to a real
                                        integration action.
                                      </p>
                                      {!isReadOnlyMode ? (
                                        <button
                                          className={`${secondaryButtonClassName} mt-4`}
                                          onClick={() =>
                                            applyVmChange(functionIndex, (currentVm) =>
                                              changePrimaryDestinationType(
                                                currentVm,
                                                primaryBinding.kind,
                                                primaryStepStrategy,
                                              ),
                                            )
                                          }
                                          type="button"
                                        >
                                          <Plus className="mr-2 size-4" />
                                          Add destination step
                                        </button>
                                      ) : null}
                                    </div>
                                  ) : null}

                                  {primaryTarget.type === "google_sheets" && primaryStep ? (
                                    <div className="grid gap-4 rounded-[12px] border border-[#e5e7eb] bg-white px-4 py-4 md:grid-cols-2">
                                      <FormField label="Google Sheets account">
                                        <select
                                          className={compactSelectClassName}
                                          disabled={isReadOnlyMode}
                                          onChange={(event) =>
                                            applyVmChange(functionIndex, (currentVm) =>
                                              updatePrimaryDestinationStep(
                                                currentVm,
                                                (currentStep) => ({
                                                  ...currentStep,
                                                  integrationId: event.target.value,
                                                }),
                                                primaryStepStrategy,
                                              ),
                                            )
                                          }
                                          value={primaryStep.integrationId}
                                        >
                                          <option value="">Select integration</option>
                                          {connectedIntegrations
                                            .filter(
                                              (integration) =>
                                                integration.type === IntegrationType.GOOGLE_SHEETS,
                                            )
                                            .map((integration) => (
                                              <option key={integration.id} value={integration.id}>
                                                {getIntegrationDisplayLabel(integration)}
                                              </option>
                                            ))}
                                        </select>
                                      </FormField>
                                      <FormField label="Action">
                                        <select
                                          className={compactSelectClassName}
                                          disabled={isReadOnlyMode}
                                          onChange={(event) => {
                                            const operation =
                                              event.target.value as GoogleSheetsOperationDraft;
                                            applyVmChange(functionIndex, (currentVm) =>
                                              updatePrimaryDestinationStep(
                                                currentVm,
                                                (currentStep) => ({
                                                  ...currentStep,
                                                  action: getGoogleSheetsActionForOperation(operation),
                                                  params: JSON.stringify(
                                                    {
                                                      ...getGoogleSheetsParams(currentStep),
                                                      operation,
                                                    },
                                                    null,
                                                    2,
                                                  ),
                                                }),
                                                primaryStepStrategy,
                                              ),
                                            );
                                          }}
                                          value={sheetParams?.operation ?? "get_rows"}
                                        >
                                          {googleSheetsOperationOptions.map((option) => (
                                            <option key={option.value} value={option.value}>
                                              {option.label}
                                            </option>
                                          ))}
                                        </select>
                                      </FormField>
                                      <FormField label="Spreadsheet ID">
                                        <input
                                          className={compactInputClassName}
                                          onChange={(event) =>
                                            applyVmChange(functionIndex, (currentVm) =>
                                              updatePrimaryDestinationStep(
                                                currentVm,
                                                (currentStep) => ({
                                                  ...currentStep,
                                                  params: JSON.stringify(
                                                    {
                                                      ...getGoogleSheetsParams(currentStep),
                                                      spreadsheetId: event.target.value,
                                                    },
                                                    null,
                                                    2,
                                                  ),
                                                }),
                                                primaryStepStrategy,
                                              ),
                                            )
                                          }
                                          readOnly={isReadOnlyMode}
                                          value={sheetParams?.spreadsheetId ?? ""}
                                        />
                                      </FormField>
                                      <FormField label="Sheet tab">
                                        <input
                                          className={compactInputClassName}
                                          onChange={(event) =>
                                            applyVmChange(functionIndex, (currentVm) =>
                                              updatePrimaryDestinationStep(
                                                currentVm,
                                                (currentStep) => ({
                                                  ...currentStep,
                                                  params: JSON.stringify(
                                                    {
                                                      ...getGoogleSheetsParams(currentStep),
                                                      sheetName: event.target.value,
                                                    },
                                                    null,
                                                    2,
                                                  ),
                                                }),
                                                primaryStepStrategy,
                                              ),
                                            )
                                          }
                                          readOnly={isReadOnlyMode}
                                          value={sheetParams?.sheetName ?? ""}
                                        />
                                      </FormField>
                                      {sheetParams?.operation === "capacity_availability" ? (
                                        <>
                                          <FormField label="Date column">
                                            <input
                                              className={compactInputClassName}
                                              onChange={(event) =>
                                                applyVmChange(functionIndex, (currentVm) =>
                                                  updatePrimaryDestinationStep(
                                                    currentVm,
                                                    (currentStep) => ({
                                                      ...currentStep,
                                                      params: JSON.stringify(
                                                        {
                                                          ...getGoogleSheetsParams(currentStep),
                                                          dateColumn: event.target.value,
                                                        },
                                                        null,
                                                        2,
                                                      ),
                                                    }),
                                                    primaryStepStrategy,
                                                  ),
                                                )
                                              }
                                              readOnly={isReadOnlyMode}
                                              value={sheetParams.dateColumn}
                                            />
                                          </FormField>
                                          <FormField label="Status column">
                                            <input
                                              className={compactInputClassName}
                                              onChange={(event) =>
                                                applyVmChange(functionIndex, (currentVm) =>
                                                  updatePrimaryDestinationStep(
                                                    currentVm,
                                                    (currentStep) => ({
                                                      ...currentStep,
                                                      params: JSON.stringify(
                                                        {
                                                          ...getGoogleSheetsParams(currentStep),
                                                          statusColumn: event.target.value,
                                                        },
                                                        null,
                                                        2,
                                                      ),
                                                    }),
                                                    primaryStepStrategy,
                                                  ),
                                                )
                                              }
                                              readOnly={isReadOnlyMode}
                                              value={sheetParams.statusColumn}
                                            />
                                          </FormField>
                                          <FormField label="Region column">
                                            <input
                                              className={compactInputClassName}
                                              onChange={(event) =>
                                                applyVmChange(functionIndex, (currentVm) =>
                                                  updatePrimaryDestinationStep(
                                                    currentVm,
                                                    (currentStep) => ({
                                                      ...currentStep,
                                                      params: JSON.stringify(
                                                        {
                                                          ...getGoogleSheetsParams(currentStep),
                                                          regionColumn: event.target.value,
                                                        },
                                                        null,
                                                        2,
                                                      ),
                                                    }),
                                                    primaryStepStrategy,
                                                  ),
                                                )
                                              }
                                              readOnly={isReadOnlyMode}
                                              value={sheetParams.regionColumn}
                                            />
                                          </FormField>
                                          <FormField label="Booked status">
                                            <input
                                              className={compactInputClassName}
                                              onChange={(event) =>
                                                applyVmChange(functionIndex, (currentVm) =>
                                                  updatePrimaryDestinationStep(
                                                    currentVm,
                                                    (currentStep) => ({
                                                      ...currentStep,
                                                      params: JSON.stringify(
                                                        {
                                                          ...getGoogleSheetsParams(currentStep),
                                                          bookedStatusValue: event.target.value,
                                                        },
                                                        null,
                                                        2,
                                                      ),
                                                    }),
                                                    primaryStepStrategy,
                                                  ),
                                                )
                                              }
                                              readOnly={isReadOnlyMode}
                                              value={sheetParams.bookedStatusValue}
                                            />
                                          </FormField>
                                          <div className="grid gap-3 md:col-span-2 md:grid-cols-2">
                                            {sheetParams.capacityRules.map((rule, ruleIndex) => (
                                              <div
                                                className="rounded-[10px] border border-[#e5e7eb] bg-[#fbfcff] px-3 py-3"
                                                key={`${rule.region}:${ruleIndex}`}
                                              >
                                                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667085]">
                                                  {rule.region}
                                                </p>
                                                <FormField label="Capacity">
                                                  <input
                                                    className={compactInputClassName}
                                                    min={1}
                                                    onChange={(event) =>
                                                      applyVmChange(functionIndex, (currentVm) =>
                                                        updatePrimaryDestinationStep(
                                                          currentVm,
                                                          (currentStep) => {
                                                            const currentParams =
                                                              getGoogleSheetsParams(currentStep);
                                                            const nextRules =
                                                              currentParams.capacityRules.map(
                                                                (currentRule, currentIndex) =>
                                                                  currentIndex === ruleIndex
                                                                    ? {
                                                                        ...currentRule,
                                                                        capacity: Math.max(
                                                                          Number(
                                                                            event.target.value || 1,
                                                                          ),
                                                                          1,
                                                                        ),
                                                                      }
                                                                    : currentRule,
                                                              );

                                                            return {
                                                              ...currentStep,
                                                              params: JSON.stringify(
                                                                {
                                                                  ...currentParams,
                                                                  capacityRules: nextRules,
                                                                },
                                                                null,
                                                                2,
                                                              ),
                                                            };
                                                          },
                                                          primaryStepStrategy,
                                                        ),
                                                      )
                                                    }
                                                    readOnly={isReadOnlyMode}
                                                    type="number"
                                                    value={rule.capacity}
                                                  />
                                                </FormField>
                                              </div>
                                            ))}
                                          </div>
                                        </>
                                      ) : null}
                                    </div>
                                  ) : null}

                                  {primaryTarget.type === "google_calendar" && primaryStep ? (
                                    <div className="grid gap-4 rounded-[12px] border border-[#e5e7eb] bg-white px-4 py-4 md:grid-cols-2">
                                      <FormField label="Google Calendar account">
                                        <select
                                          className={compactSelectClassName}
                                          disabled={isReadOnlyMode}
                                          onChange={(event) =>
                                            applyVmChange(functionIndex, (currentVm) =>
                                              updatePrimaryDestinationStep(
                                                currentVm,
                                                (currentStep) => ({
                                                  ...currentStep,
                                                  integrationId: event.target.value,
                                                }),
                                                primaryStepStrategy,
                                              ),
                                            )
                                          }
                                          value={primaryStep.integrationId}
                                        >
                                          <option value="">Select integration</option>
                                          {connectedIntegrations
                                            .filter(
                                              (integration) =>
                                                integration.type ===
                                                IntegrationType.GOOGLE_CALENDAR,
                                            )
                                            .map((integration) => (
                                              <option key={integration.id} value={integration.id}>
                                                {getIntegrationDisplayLabel(integration)}
                                              </option>
                                            ))}
                                        </select>
                                      </FormField>
                                      <FormField label="Action">
                                        <select
                                          className={compactSelectClassName}
                                          disabled={isReadOnlyMode}
                                          onChange={(event) =>
                                            applyVmChange(functionIndex, (currentVm) =>
                                              updatePrimaryDestinationStep(
                                                currentVm,
                                                (currentStep) => ({
                                                  ...currentStep,
                                                  action:
                                                    event.target.value === "book_call"
                                                      ? "book call and send invite"
                                                      : "check consultation calendar availability",
                                                }),
                                                primaryStepStrategy,
                                              ),
                                            )
                                          }
                                          value={calendarParams?.operation ?? "check_calendar"}
                                        >
                                          <option value="check_calendar">Get free time</option>
                                          <option value="book_call">Create event</option>
                                        </select>
                                      </FormField>
                                      <FormField label="Calendar ID">
                                        <input
                                          className={compactInputClassName}
                                          onChange={(event) =>
                                            applyVmChange(functionIndex, (currentVm) =>
                                              updatePrimaryDestinationStep(
                                                currentVm,
                                                (currentStep) => ({
                                                  ...currentStep,
                                                  params: JSON.stringify(
                                                    {
                                                      ...getGoogleCalendarParams(currentStep),
                                                      calendarId: event.target.value,
                                                    },
                                                    null,
                                                    2,
                                                  ),
                                                }),
                                                primaryStepStrategy,
                                              ),
                                            )
                                          }
                                          readOnly={isReadOnlyMode}
                                          value={calendarParams?.calendarId ?? ""}
                                        />
                                      </FormField>
                                      <FormField label="Timezone">
                                        <input
                                          className={compactInputClassName}
                                          onChange={(event) =>
                                            applyVmChange(functionIndex, (currentVm) =>
                                              updatePrimaryDestinationStep(
                                                currentVm,
                                                (currentStep) => ({
                                                  ...currentStep,
                                                  params: JSON.stringify(
                                                    {
                                                      ...getGoogleCalendarParams(currentStep),
                                                      timeZone: event.target.value,
                                                    },
                                                    null,
                                                    2,
                                                  ),
                                                }),
                                                primaryStepStrategy,
                                              ),
                                            )
                                          }
                                          readOnly={isReadOnlyMode}
                                          value={calendarParams?.timeZone ?? ""}
                                        />
                                      </FormField>
                                    </div>
                                  ) : null}

                                  {primaryTarget.type === "api_request" && primaryStep ? (
                                    <div className="rounded-[12px] border border-[#f3c7a6] bg-[#fff7ed] px-4 py-4">
                                      <div className="flex gap-3">
                                        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#b45309]" />
                                        <div>
                                          <p className="text-sm font-semibold text-[#92400e]">
                                            Custom API is preserved as legacy data.
                                          </p>
                                          <p className="mt-1 text-sm leading-6 text-[#9a5b22]">
                                            This workspace slice does not expose Custom API setup because
                                            there is no first-class runtime executor for it yet. Switch this
                                            function to Google Calendar or Google Sheets, or keep the legacy
                                            data in Advanced execution until Custom API is implemented.
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  ) : null}
                                </>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </>
                ) : null}

                <details
                  className={isWorkspaceMode ? "rounded-[14px] border border-[#e6ebf2] bg-white px-4 py-4" : ""}
                  open={!isWorkspaceMode}
                >
                  {isWorkspaceMode ? (
                    <summary className="cursor-pointer list-none text-sm font-semibold text-[#111827]">
                      Advanced compatibility
                    </summary>
                  ) : null}
                  <fieldset
                    className={`space-y-5 disabled:opacity-75 ${isWorkspaceMode ? "pt-4" : "border-t border-[#e8d8c5] pt-6"}`}
                    disabled={isWorkspaceMode || isReadOnlyMode}
                  >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Execution steps
                      </p>
                      {isWorkspaceMode ? (
                        <p className="mt-1 text-sm text-[#667085]">
                          Preserved legacy execution data for migrated functions:{" "}
                          {getFunctionMeta(fn)}. New workspace actions should use Result delivery above.
                        </p>
                      ) : null}
                    </div>
                    {!isReadOnlyMode && !isWorkspaceMode ? (
                      <button
                        className={secondaryButtonClassName}
                        onClick={() => onAddFunctionStep(functionIndex)}
                        type="button"
                      >
                        <Plus className="mr-2 size-4" />
                        Add step
                      </button>
                    ) : null}
                  </div>

                  {fn.steps.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No integration steps yet.</p>
                  ) : null}

                  {fn.steps.map((step, stepIndex) => {
                    const selectedIntegration = integrationById.get(step.integrationId);
                    const isGoogleSheets = selectedIntegration?.type === IntegrationType.GOOGLE_SHEETS;
                    const isGoogleCalendar =
                      selectedIntegration?.type === IntegrationType.GOOGLE_CALENDAR;
                    const sheetParams = getGoogleSheetsParams(step);
                    const calendarParams = getGoogleCalendarParams(step);
                    const sheetInspector = sheetInspectors[getFunctionStepKey(functionIndex, stepIndex)];
                    const availableSpreadsheets = [
                      ...(sheetInspector?.spreadsheets ?? []),
                      ...((sheetParams.spreadsheetId && sheetParams.spreadsheetTitle)
                        ? [{ id: sheetParams.spreadsheetId, name: sheetParams.spreadsheetTitle }]
                        : []),
                    ].filter(
                      (spreadsheet, index, allSpreadsheets) =>
                        allSpreadsheets.findIndex((item) => item.id === spreadsheet.id) === index,
                    );
                    const availableSheets = uniqueValues([
                      ...(sheetInspector?.sheets ?? []),
                      sheetParams.sheetName,
                    ]);
                    const availableHeaders = uniqueValues([
                      ...(sheetInspector?.headers ?? []),
                      ...sheetParams.filters.map((filter) => filter.column),
                    ]);

                    return (
                      <div key={step.uiId} className="border-l-[3px] border-[#c75c2a] py-2 pl-5 pr-0">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-foreground">
                            Step {stepIndex + 1}
                          </p>
                          {selectedIntegration ? (
                            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                              {getIntegrationDisplayLabel(selectedIntegration)}
                            </span>
                          ) : null}
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <FormField label="Integration">
                            <select
                              className={selectClassName}
                              disabled={isReadOnlyMode}
                              onChange={(event) =>
                                onFunctionStepIntegrationChange(
                                  functionIndex,
                                  stepIndex,
                                  event.target.value,
                                )
                              }
                              value={step.integrationId}
                            >
                              <option value="">Select integration</option>
                              {connectedIntegrations.map((integration) => (
                                <option key={integration.id} value={integration.id}>
                                  {getIntegrationDisplayLabel(integration)}
                                </option>
                              ))}
                            </select>
                          </FormField>
                          <FormField label="Action">
                            {isGoogleCalendar ? (
                              <select
                                className={selectClassName}
                                disabled={isReadOnlyMode}
                                onChange={(event) =>
                                  onUpdateFunctionStep(functionIndex, stepIndex, {
                                    action:
                                      event.target.value === "book_call"
                                        ? "book call and send invite"
                                        : "check consultation calendar availability",
                                  })
                                }
                                value={calendarParams.operation}
                              >
                                <option value="check_calendar">Get free time</option>
                                <option value="book_call">Create event</option>
                              </select>
                            ) : isGoogleSheets ? (
                              <select
                                className={selectClassName}
                                disabled={isReadOnlyMode}
                                onChange={(event) =>
                                  {
                                    const operation =
                                      event.target.value as GoogleSheetsOperationDraft;
                                    onUpdateFunctionStep(functionIndex, stepIndex, {
                                      action: getGoogleSheetsActionForOperation(operation),
                                    });
                                    onUpdateFunctionStepParams(functionIndex, stepIndex, {
                                      operation,
                                    });
                                  }
                                }
                                value={sheetParams.operation}
                              >
                                {googleSheetsOperationOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                className={inputClassName}
                                onChange={(event) =>
                                  onUpdateFunctionStep(functionIndex, stepIndex, {
                                    action: event.target.value,
                                  })
                                }
                                readOnly={isReadOnlyMode}
                                value={step.action}
                              />
                            )}
                          </FormField>
                        </div>

                        {isGoogleSheets ? (
                          <div className="mt-6 space-y-5 border-t border-[#eadbc8] pt-6">
                            <div className="space-y-2 rounded-[22px] border border-[#eadccc] bg-[#fffdf9] px-6 py-5">
                              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8c745b]">
                                Google Sheets
                              </p>
                              <h4 className="text-xl font-semibold tracking-tight text-foreground">
                                {sheetParams.operation === "append_row"
                                  ? "Sheet write flow"
                                  : sheetParams.operation === "update_rows"
                                    ? "Sheet update flow"
                                    : sheetParams.operation === "capacity_availability"
                                      ? "Capacity availability flow"
                                      : "Sheet lookup flow"}
                              </h4>
                              <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                                {sheetParams.operation === "append_row"
                                  ? "Pick the spreadsheet file, bind the sheet tab, then map function fields into the row this action should append."
                                  : sheetParams.operation === "update_rows"
                                    ? "Pick the spreadsheet file, define which rows should be found, then map the field values this action should overwrite."
                                    : sheetParams.operation === "capacity_availability"
                                      ? "Pick the bookings sheet, bind the date/status/region columns, then define how many booked rows each region can accept."
                                      : "Pick the spreadsheet file, bind the sheet tab, then define the row conditions this function should use when searching for a match."}
                              </p>
                            </div>

                            <div className="space-y-5 rounded-[22px] bg-white/72 p-5 ring-1 ring-[#eadccc]">
                              <div className="space-y-4 rounded-[18px] border border-[#eadccc] bg-[#fffaf2] p-4">
                                <div className="flex items-start gap-4">
                                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#201627] text-sm font-semibold text-[#f7efe4]">
                                    1
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-sm font-semibold text-foreground">
                                      Connect the spreadsheet file
                                    </p>
                                    <p className="text-sm leading-6 text-muted-foreground">
                                      Start by loading the tenant&apos;s Google Sheets files, then pick
                                      the file and tab this Google Sheets action should use.
                                    </p>
                                  </div>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                  <button
                                    className={secondaryButtonClassName}
                                    disabled={isReadOnlyMode || sheetInspector?.isLoading}
                                    onClick={() =>
                                      onLoadGoogleSpreadsheetCatalog(functionIndex, stepIndex)
                                    }
                                    type="button"
                                  >
                                    {sheetInspector?.isLoading ? "Loading..." : "Load files"}
                                  </button>
                                  <button
                                    className={secondaryButtonClassName}
                                    disabled={
                                      isReadOnlyMode ||
                                      sheetInspector?.isLoading ||
                                      !sheetParams.spreadsheetId.trim()
                                    }
                                    onClick={() => onInspectGoogleSpreadsheet(functionIndex, stepIndex)}
                                    type="button"
                                  >
                                    {sheetInspector?.isLoading ? "Loading..." : "Load sheet schema"}
                                  </button>
                                </div>

                                {availableSpreadsheets.length > 0 ? (
                                  <div className="grid gap-3 md:grid-cols-2">
                                    {availableSpreadsheets.map((spreadsheet) => {
                                      const active = spreadsheet.id === sheetParams.spreadsheetId;

                                      return (
                                        <button
                                          key={spreadsheet.id}
                                          className={`rounded-[18px] px-4 py-4 text-left ring-1 transition ${
                                            active
                                              ? "bg-[#201627] text-[#f7efe4] ring-[#201627]"
                                              : "bg-white text-foreground ring-[#eadccc] hover:bg-[#fcf7ef]"
                                          }`}
                                          disabled={isReadOnlyMode}
                                          onClick={() =>
                                            onUpdateFunctionStepParams(functionIndex, stepIndex, {
                                              spreadsheetId: spreadsheet.id,
                                              spreadsheetTitle: spreadsheet.name,
                                              sheetName: "",
                                            })
                                          }
                                          type="button"
                                        >
                                          <p className="text-sm font-semibold">{spreadsheet.name}</p>
                                          <p
                                            className={`mt-1 text-xs ${
                                              active ? "text-[#eadccc]" : "text-muted-foreground"
                                            }`}
                                          >
                                            {active ? "Selected file" : "Use this file"}
                                          </p>
                                        </button>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="rounded-[16px] bg-white px-4 py-3 text-sm text-muted-foreground ring-1 ring-[#eadccc]">
                                    Load files first to choose a spreadsheet from the connected Google
                                    Sheets account.
                                  </div>
                                )}

                                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
                                  <FormField label="Selected file">
                                    <input
                                      className={inputClassName}
                                      readOnly
                                      value={
                                        sheetParams.spreadsheetTitle ||
                                        sheetParams.spreadsheetId ||
                                        ""
                                      }
                                    />
                                  </FormField>
                                  <FormField label="Header row">
                                    <input
                                      className={inputClassName}
                                      min={1}
                                      onChange={(event) =>
                                        onUpdateFunctionStepParams(functionIndex, stepIndex, {
                                          headerRow: Math.max(Number(event.target.value || 1), 1),
                                        })
                                      }
                                      readOnly={isReadOnlyMode}
                                      type="number"
                                      value={sheetParams.headerRow}
                                    />
                                  </FormField>
                                </div>

                                <FormField label="Sheet tab">
                                  <select
                                    className={selectClassName}
                                    disabled={isReadOnlyMode || !availableSheets.length}
                                    onChange={(event) =>
                                      onUpdateFunctionStepParams(functionIndex, stepIndex, {
                                        sheetName: event.target.value,
                                      })
                                    }
                                    value={sheetParams.sheetName}
                                  >
                                    <option value="">
                                      {availableSheets.length
                                        ? "Select sheet"
                                        : "Load sheet schema first"}
                                    </option>
                                    {availableSheets.map((sheetName) => (
                                      <option key={sheetName} value={sheetName}>
                                        {sheetName}
                                      </option>
                                    ))}
                                  </select>
                                </FormField>
                              </div>

                              {sheetParams.operation === "get_rows" ||
                              sheetParams.operation === "update_rows" ? (
                                <div className="space-y-4 rounded-[18px] border border-[#eadccc] bg-[#fffaf2] p-4">
                                <div className="flex items-start gap-4">
                                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#201627] text-sm font-semibold text-[#f7efe4]">
                                    2
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-sm font-semibold text-foreground">
                                      {sheetParams.operation === "update_rows"
                                        ? "Find the rows to update"
                                        : "Build the row conditions"}
                                    </p>
                                    <p className="text-sm leading-6 text-muted-foreground">
                                      {sheetParams.operation === "update_rows"
                                        ? "Add one or more conditions so the action knows which existing rows should be updated."
                                        : "Add one or more conditions so the lookup knows which rows to match inside the selected sheet."}
                                    </p>
                                  </div>
                                </div>

                                <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
                                  <FormField label="How conditions combine">
                                    <select
                                      className={selectClassName}
                                      disabled={isReadOnlyMode}
                                      onChange={(event) =>
                                        onUpdateFunctionStepParams(functionIndex, stepIndex, {
                                          combineFilters: event.target.value,
                                        })
                                      }
                                      value={sheetParams.combineFilters}
                                    >
                                      <option value="AND">All conditions must match</option>
                                      <option value="OR">Any condition can match</option>
                                    </select>
                                  </FormField>
                                  <div className="rounded-[16px] bg-white px-4 py-3 text-sm text-muted-foreground ring-1 ring-[#eadccc]">
                                    {sheetParams.combineFilters === "AND"
                                      ? "The row must satisfy every condition below."
                                      : "A row can match as soon as one condition below is true."}
                                  </div>
                                </div>

                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-semibold text-foreground">
                                      Lookup conditions
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      Choose the column, matching rule, and value source for each
                                      condition.
                                    </p>
                                  </div>
                                  <button
                                    className={secondaryButtonClassName}
                                    disabled={isReadOnlyMode}
                                    onClick={() => onAddGoogleSheetsFilter(functionIndex, stepIndex)}
                                    type="button"
                                  >
                                    <Plus className="mr-2 size-4" />
                                    Add condition
                                  </button>
                                </div>
                                {sheetParams.filters.map((filter, filterIndex) => (
                                  <div
                                    key={`${step.uiId}:${filterIndex}`}
                                    className="space-y-4 rounded-[18px] bg-white p-4 ring-1 ring-[#eadccc]"
                                  >
                                    <div className="grid gap-4 lg:grid-cols-3">
                                      <FormField label="Column name">
                                        <select
                                          className={selectClassName}
                                          disabled={isReadOnlyMode}
                                          onChange={(event) =>
                                            onUpdateGoogleSheetsFilter(
                                              functionIndex,
                                              stepIndex,
                                              filterIndex,
                                              { column: event.target.value },
                                            )
                                          }
                                          value={filter.column}
                                        >
                                          <option value="">
                                            {availableHeaders.length
                                              ? "Select column"
                                              : "Load sheet schema first"}
                                          </option>
                                          {availableHeaders.map((header) => (
                                            <option key={header} value={header}>
                                              {header}
                                            </option>
                                          ))}
                                        </select>
                                      </FormField>
                                      <FormField label="Matching rule">
                                        <select
                                          className={selectClassName}
                                          disabled={isReadOnlyMode}
                                          onChange={(event) =>
                                            onUpdateGoogleSheetsFilter(
                                              functionIndex,
                                              stepIndex,
                                              filterIndex,
                                              {
                                                operator:
                                                  event.target.value as GoogleSheetsFilterDraft["operator"],
                                              },
                                            )
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
                                          disabled={isReadOnlyMode}
                                          onChange={(event) =>
                                            onUpdateGoogleSheetsFilter(
                                              functionIndex,
                                              stepIndex,
                                              filterIndex,
                                              {
                                                valueSource:
                                                  event.target.value as GoogleSheetsFilterDraft["valueSource"],
                                              },
                                            )
                                          }
                                          value={filter.valueSource}
                                        >
                                          {googleSheetsValueSourceOptions.map((option) => (
                                            <option key={option.value} value={option.value}>
                                              {option.label}
                                            </option>
                                          ))}
                                        </select>
                                      </FormField>
                                    </div>
                                    <FormField
                                      label={
                                        filter.valueSource === "literal"
                                          ? "Fixed value"
                                          : "Resolved value preview"
                                      }
                                    >
                                      {filter.valueSource === "literal" ? (
                                        <input
                                          className={inputClassName}
                                          onChange={(event) =>
                                            onUpdateGoogleSheetsFilter(
                                              functionIndex,
                                              stepIndex,
                                              filterIndex,
                                              { value: event.target.value },
                                            )
                                          }
                                          placeholder="Type the value this column should match"
                                          readOnly={isReadOnlyMode}
                                          value={filter.value}
                                        />
                                      ) : (
                                        <div className="rounded-[16px] bg-[#fcf7ef] px-4 py-3 text-sm text-muted-foreground ring-1 ring-[#eadccc]">
                                          {getGoogleSheetsBindingPreview(filter.valueSource)}
                                        </div>
                                      )}
                                    </FormField>
                                  </div>
                                ))}
                                </div>
                              ) : null}

                              {sheetParams.operation === "capacity_availability" ? (
                                <div className="space-y-4 rounded-[18px] border border-[#eadccc] bg-[#fffaf2] p-4">
                                  <div className="flex items-start gap-4">
                                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#201627] text-sm font-semibold text-[#f7efe4]">
                                      2
                                    </div>
                                    <div className="space-y-1">
                                      <p className="text-sm font-semibold text-foreground">
                                        Bind availability columns
                                      </p>
                                      <p className="text-sm leading-6 text-muted-foreground">
                                        The function counts booked rows for the requested wedding date
                                        and region, then compares the count with the configured capacity.
                                      </p>
                                    </div>
                                  </div>

                                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                    <FormField label="Date column">
                                      <input
                                        className={inputClassName}
                                        onChange={(event) =>
                                          onUpdateFunctionStepParams(functionIndex, stepIndex, {
                                            dateColumn: event.target.value,
                                          })
                                        }
                                        readOnly={isReadOnlyMode}
                                        value={sheetParams.dateColumn}
                                      />
                                    </FormField>
                                    <FormField label="Status column">
                                      <input
                                        className={inputClassName}
                                        onChange={(event) =>
                                          onUpdateFunctionStepParams(functionIndex, stepIndex, {
                                            statusColumn: event.target.value,
                                          })
                                        }
                                        readOnly={isReadOnlyMode}
                                        value={sheetParams.statusColumn}
                                      />
                                    </FormField>
                                    <FormField label="Region column">
                                      <input
                                        className={inputClassName}
                                        onChange={(event) =>
                                          onUpdateFunctionStepParams(functionIndex, stepIndex, {
                                            regionColumn: event.target.value,
                                          })
                                        }
                                        readOnly={isReadOnlyMode}
                                        value={sheetParams.regionColumn}
                                      />
                                    </FormField>
                                    <FormField label="Booked status">
                                      <input
                                        className={inputClassName}
                                        onChange={(event) =>
                                          onUpdateFunctionStepParams(functionIndex, stepIndex, {
                                            bookedStatusValue: event.target.value,
                                          })
                                        }
                                        readOnly={isReadOnlyMode}
                                        value={sheetParams.bookedStatusValue}
                                      />
                                    </FormField>
                                  </div>

                                  <div className="grid gap-4 md:grid-cols-2">
                                    {sheetParams.capacityRules.map((rule, ruleIndex) => (
                                      <div
                                        className="space-y-3 rounded-[18px] bg-white p-4 ring-1 ring-[#eadccc]"
                                        key={`${step.uiId}:capacity:${ruleIndex}`}
                                      >
                                        <FormField label="Region label">
                                          <input
                                            className={inputClassName}
                                            onChange={(event) => {
                                              const nextRules = sheetParams.capacityRules.map(
                                                (currentRule, currentIndex) =>
                                                  currentIndex === ruleIndex
                                                    ? { ...currentRule, region: event.target.value }
                                                    : currentRule,
                                              );
                                              onUpdateFunctionStepParams(functionIndex, stepIndex, {
                                                capacityRules: nextRules,
                                              });
                                            }}
                                            readOnly={isReadOnlyMode}
                                            value={rule.region}
                                          />
                                        </FormField>
                                        <FormField label="Aliases">
                                          <input
                                            className={inputClassName}
                                            onChange={(event) => {
                                              const nextRules = sheetParams.capacityRules.map(
                                                (currentRule, currentIndex) =>
                                                  currentIndex === ruleIndex
                                                    ? {
                                                        ...currentRule,
                                                        aliases: event.target.value
                                                          .split(",")
                                                          .map((alias) => alias.trim())
                                                          .filter(Boolean),
                                                      }
                                                    : currentRule,
                                              );
                                              onUpdateFunctionStepParams(functionIndex, stepIndex, {
                                                capacityRules: nextRules,
                                              });
                                            }}
                                            readOnly={isReadOnlyMode}
                                            value={rule.aliases.join(", ")}
                                          />
                                        </FormField>
                                        <FormField label="Capacity">
                                          <input
                                            className={inputClassName}
                                            min={1}
                                            onChange={(event) => {
                                              const nextRules = sheetParams.capacityRules.map(
                                                (currentRule, currentIndex) =>
                                                  currentIndex === ruleIndex
                                                    ? {
                                                        ...currentRule,
                                                        capacity: Math.max(
                                                          Number(event.target.value || 1),
                                                          1,
                                                        ),
                                                      }
                                                    : currentRule,
                                              );
                                              onUpdateFunctionStepParams(functionIndex, stepIndex, {
                                                capacityRules: nextRules,
                                              });
                                            }}
                                            readOnly={isReadOnlyMode}
                                            type="number"
                                            value={rule.capacity}
                                          />
                                        </FormField>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : null}

                              {sheetParams.operation === "append_row" ||
                              sheetParams.operation === "update_rows" ? (
                                <div className="space-y-4 rounded-[18px] border border-[#eadccc] bg-[#fffaf2] p-4">
                                  <div className="flex items-start gap-4">
                                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#201627] text-sm font-semibold text-[#f7efe4]">
                                      {sheetParams.operation === "append_row" ? 2 : 3}
                                    </div>
                                    <div className="space-y-1">
                                      <p className="text-sm font-semibold text-foreground">
                                        {sheetParams.operation === "append_row"
                                          ? "Map the row values"
                                          : "Define the row changes"}
                                      </p>
                                      <p className="text-sm leading-6 text-muted-foreground">
                                        {sheetParams.operation === "append_row"
                                          ? "Choose which columns should receive values when this function appends a new row."
                                          : "Choose which columns should be overwritten after the matching rows are found."}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-semibold text-foreground">
                                        Column mapping
                                      </p>
                                      <p className="text-sm text-muted-foreground">
                                        Each mapping writes one value from the function call into one
                                        sheet column.
                                      </p>
                                    </div>
                                    <button
                                      className={secondaryButtonClassName}
                                      disabled={isReadOnlyMode}
                                      onClick={() =>
                                        onAddGoogleSheetsColumnMapping(functionIndex, stepIndex)
                                      }
                                      type="button"
                                    >
                                      <Plus className="mr-2 size-4" />
                                      Add mapping
                                    </button>
                                  </div>
                                  {sheetParams.columnMappings.map((mapping, mappingIndex) => (
                                    <div
                                      key={`${step.uiId}:mapping:${mappingIndex}`}
                                      className="space-y-4 rounded-[18px] bg-white p-4 ring-1 ring-[#eadccc]"
                                    >
                                      <div className="grid gap-4 lg:grid-cols-3">
                                        <FormField label="Column name">
                                          <select
                                            className={selectClassName}
                                            disabled={isReadOnlyMode}
                                            onChange={(event) =>
                                              onUpdateGoogleSheetsColumnMapping(
                                                functionIndex,
                                                stepIndex,
                                                mappingIndex,
                                                { column: event.target.value },
                                              )
                                            }
                                            value={mapping.column}
                                          >
                                            <option value="">
                                              {availableHeaders.length
                                                ? "Select column"
                                                : "Load sheet schema first"}
                                            </option>
                                            {availableHeaders.map((header) => (
                                              <option key={header} value={header}>
                                                {header}
                                              </option>
                                            ))}
                                          </select>
                                        </FormField>
                                        <FormField label="Value source">
                                          <select
                                            className={selectClassName}
                                            disabled={isReadOnlyMode}
                                            onChange={(event) =>
                                              onUpdateGoogleSheetsColumnMapping(
                                                functionIndex,
                                                stepIndex,
                                                mappingIndex,
                                                {
                                                  valueSource:
                                                    event.target.value as GoogleSheetsColumnMappingDraft["valueSource"],
                                                },
                                              )
                                            }
                                            value={mapping.valueSource}
                                          >
                                            {googleSheetsValueSourceOptions.map((option) => (
                                              <option key={option.value} value={option.value}>
                                                {option.label}
                                              </option>
                                            ))}
                                          </select>
                                        </FormField>
                                        <FormField
                                          label={
                                            mapping.valueSource === "literal"
                                              ? "Fixed value"
                                              : "Resolved value preview"
                                          }
                                        >
                                          {mapping.valueSource === "literal" ? (
                                            <input
                                              className={inputClassName}
                                              onChange={(event) =>
                                                onUpdateGoogleSheetsColumnMapping(
                                                  functionIndex,
                                                  stepIndex,
                                                  mappingIndex,
                                                  { value: event.target.value },
                                                )
                                              }
                                              placeholder="Type the value for this column"
                                              readOnly={isReadOnlyMode}
                                              value={mapping.value}
                                            />
                                          ) : (
                                            <div className="rounded-[16px] bg-[#fcf7ef] px-4 py-3 text-sm text-muted-foreground ring-1 ring-[#eadccc]">
                                              {getGoogleSheetsBindingPreview(mapping.valueSource)}
                                            </div>
                                          )}
                                        </FormField>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : null}

                              <div className="space-y-4 rounded-[18px] border border-[#eadccc] bg-[#fffaf2] p-4">
                                <div className="flex items-start gap-4">
                                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#201627] text-sm font-semibold text-[#f7efe4]">
                                    {sheetParams.operation === "update_rows" ? 4 : 3}
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-sm font-semibold text-foreground">
                                      Review the loaded columns
                                    </p>
                                    <p className="text-sm leading-6 text-muted-foreground">
                                      Once the sheet schema is loaded, use these headers to wire each
                                      condition or mapping to a real column.
                                    </p>
                                  </div>
                                </div>
                                <div className="space-y-2 rounded-[16px] bg-white px-4 py-4 ring-1 ring-[#eadccc]">
                                  {sheetInspector?.title ? (
                                    <p className="text-sm font-semibold text-foreground">
                                      Connected file: {sheetInspector.title}
                                    </p>
                                  ) : null}
                                  {sheetInspector?.headers?.length ? (
                                    <p className="text-sm text-muted-foreground">
                                      Available columns: {sheetInspector.headers.join(", ")}
                                    </p>
                                  ) : (
                                    <p className="text-sm text-muted-foreground">
                                      Load the sheet schema to see the actual header names before you
                                      finish wiring the lookup.
                                    </p>
                                  )}
                                  {sheetInspector?.error ? (
                                    <p className="text-sm text-destructive">{sheetInspector.error}</p>
                                  ) : null}
                                </div>
                              </div>
                          </div>
                          </div>
                        ) : isGoogleCalendar ? (
                          <div className="mt-6 space-y-5 border-t border-[#eadbc8] pt-6">
                            <div className="space-y-2 rounded-[22px] border border-[#eadccc] bg-[#fffdf9] px-6 py-5">
                              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8c745b]">
                                Google Calendar
                              </p>
                              <h4 className="text-xl font-semibold tracking-tight text-foreground">
                                {calendarParams.operation === "book_call"
                                  ? "Calendar booking flow"
                                  : "Availability lookup flow"}
                              </h4>
                              <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                                {calendarParams.operation === "book_call"
                                  ? "Configure the booking action the agent should run after a slot is confirmed: pick the calendar, bind the live inputs, and decide how the created event should behave."
                                  : "Configure how the agent checks availability: pick the calendar, bind the requested date source, and define the working window used for slot search."}
                              </p>
                            </div>
                            <div className="space-y-5 rounded-[22px] bg-white/72 p-5 ring-1 ring-[#eadccc]">
                                <div className="flex items-start gap-4 rounded-[12px] border border-[#e6ebf2] bg-[#fbfcfe] p-4">
                                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#201627] text-sm font-semibold text-[#f7efe4]">
                                    1
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-sm font-semibold text-foreground">
                                      Pick the calendar target
                                    </p>
                                    <p className="text-sm leading-6 text-muted-foreground">
                                      Start by choosing the calendar, timezone, and consultation length this function should operate with.
                                    </p>
                                  </div>
                                </div>
                                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                  <FormField label="Calendar ID">
                                    <input
                                      className={inputClassName}
                                      onChange={(event) =>
                                        onUpdateFunctionStepParams(functionIndex, stepIndex, {
                                          calendarId: event.target.value,
                                        })
                                      }
                                      placeholder="primary or calendar id"
                                      readOnly={isReadOnlyMode}
                                      value={calendarParams.calendarId}
                                    />
                                  </FormField>
                                  <FormField label="Time zone">
                                    <input
                                      className={inputClassName}
                                      onChange={(event) =>
                                        onUpdateFunctionStepParams(functionIndex, stepIndex, {
                                          timeZone: event.target.value,
                                        })
                                      }
                                      readOnly={isReadOnlyMode}
                                      value={calendarParams.timeZone}
                                    />
                                  </FormField>
                                  <FormField label="Duration (minutes)">
                                    <input
                                      className={inputClassName}
                                      min={5}
                                      onChange={(event) =>
                                        onUpdateFunctionStepParams(functionIndex, stepIndex, {
                                          slotDurationMinutes: Math.max(
                                            Number(event.target.value || 0),
                                            5,
                                          ),
                                        })
                                      }
                                      readOnly={isReadOnlyMode}
                                      type="number"
                                      value={calendarParams.slotDurationMinutes}
                                    />
                                  </FormField>
                                </div>

                                <div className="space-y-4 rounded-[18px] border border-[#eadccc] bg-[#fffaf2] p-4">
                                  <div>
                                    <div className="flex items-start gap-4">
                                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#201627] text-sm font-semibold text-[#f7efe4]">
                                        2
                                      </div>
                                      <div className="space-y-1">
                                        <p className="text-sm font-semibold text-foreground">
                                          Bind the live inputs
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                          Decide which values come from the live function call and which ones stay fixed inside this calendar action.
                                        </p>
                                      </div>
                                    </div>
                                  </div>

                                  {calendarParams.operation === "check_calendar" ? (
                                    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                                      <FormField label="Availability date source">
                                        <select
                                          className={selectClassName}
                                          disabled={isReadOnlyMode}
                                          onChange={(event) =>
                                            onUpdateFunctionStepParams(functionIndex, stepIndex, {
                                              availabilityDateSource: event.target.value,
                                            })
                                          }
                                          value={calendarParams.availabilityDateSource}
                                        >
                                          {calendarDateSourceOptions.map((option) => (
                                            <option key={option.value} value={option.value}>
                                              {option.label}
                                            </option>
                                          ))}
                                        </select>
                                      </FormField>
                                      <FormField
                                        label={
                                          calendarParams.availabilityDateSource === "literal"
                                            ? "Fixed availability date"
                                            : "Binding preview"
                                        }
                                      >
                                        {calendarParams.availabilityDateSource === "literal" ? (
                                          <div className="space-y-2">
                                            <input
                                              className={inputClassName}
                                              onChange={(event) =>
                                                onUpdateFunctionStepParams(functionIndex, stepIndex, {
                                                  availabilityDateValue: event.target.value,
                                                })
                                              }
                                              placeholder="YYYY-MM-DD"
                                              readOnly={isReadOnlyMode}
                                              value={calendarParams.availabilityDateValue}
                                            />
                                            {calendarParams.availabilityDateValue.trim() &&
                                            !isIsoDateLiteral(calendarParams.availabilityDateValue) ? (
                                              <p className="text-sm text-destructive">
                                                Use `YYYY-MM-DD`. Saving stays blocked until this fixed date is valid.
                                              </p>
                                            ) : null}
                                          </div>
                                        ) : (
                                          <div className="rounded-[16px] bg-white px-4 py-3 text-sm text-muted-foreground ring-1 ring-[#eadccc]">
                                            {calendarParams.availabilityDateSource === "request_date"
                                              ? "Uses the function call date field when the model supplies one."
                                              : "Falls back to date inference from the customer's scheduling message."}
                                          </div>
                                        )}
                                      </FormField>
                                    </div>
                                  ) : (
                                    <div className="grid gap-4 lg:grid-cols-3">
                                      <FormField label="Booking date source">
                                        <select
                                          className={selectClassName}
                                          disabled={isReadOnlyMode}
                                          onChange={(event) =>
                                            onUpdateFunctionStepParams(functionIndex, stepIndex, {
                                              bookingDateSource: event.target.value,
                                            })
                                          }
                                          value={calendarParams.bookingDateSource}
                                        >
                                          {calendarDateSourceOptions.map((option) => (
                                            <option key={option.value} value={option.value}>
                                              {option.label}
                                            </option>
                                          ))}
                                        </select>
                                      </FormField>
                                      <FormField label="Booking time source">
                                        <select
                                          className={selectClassName}
                                          disabled={isReadOnlyMode}
                                          onChange={(event) =>
                                            onUpdateFunctionStepParams(functionIndex, stepIndex, {
                                              bookingTimeSource: event.target.value,
                                            })
                                          }
                                          value={calendarParams.bookingTimeSource}
                                        >
                                          {calendarTimeSourceOptions.map((option) => (
                                            <option key={option.value} value={option.value}>
                                              {option.label}
                                            </option>
                                          ))}
                                        </select>
                                      </FormField>
                                      <FormField label="Invite email source">
                                        <select
                                          className={selectClassName}
                                          disabled={isReadOnlyMode}
                                          onChange={(event) =>
                                            onUpdateFunctionStepParams(functionIndex, stepIndex, {
                                              inviteEmailSource: event.target.value,
                                            })
                                          }
                                          value={calendarParams.inviteEmailSource}
                                        >
                                          {calendarEmailSourceOptions.map((option) => (
                                            <option key={option.value} value={option.value}>
                                              {option.label}
                                            </option>
                                          ))}
                                        </select>
                                      </FormField>

                                      <FormField
                                        label={
                                          calendarParams.bookingDateSource === "literal"
                                            ? "Fixed booking date"
                                            : "Date binding preview"
                                        }
                                      >
                                        {calendarParams.bookingDateSource === "literal" ? (
                                          <div className="space-y-2">
                                            <input
                                              className={inputClassName}
                                              onChange={(event) =>
                                                onUpdateFunctionStepParams(functionIndex, stepIndex, {
                                                  bookingDateValue: event.target.value,
                                                })
                                              }
                                              placeholder="YYYY-MM-DD"
                                              readOnly={isReadOnlyMode}
                                              value={calendarParams.bookingDateValue}
                                            />
                                            {calendarParams.bookingDateValue.trim() &&
                                            !isIsoDateLiteral(calendarParams.bookingDateValue) ? (
                                              <p className="text-sm text-destructive">
                                                Use `YYYY-MM-DD`. Saving stays blocked until this fixed booking date is valid.
                                              </p>
                                            ) : null}
                                          </div>
                                        ) : (
                                          <div className="rounded-[16px] bg-white px-4 py-3 text-sm text-muted-foreground ring-1 ring-[#eadccc]">
                                            {calendarParams.bookingDateSource === "request_date"
                                              ? "Uses the structured date field from the function call."
                                              : "Infers the booking date from the customer's scheduling text."}
                                          </div>
                                        )}
                                      </FormField>

                                      <FormField
                                        label={
                                          calendarParams.bookingTimeSource === "literal"
                                            ? "Fixed booking time"
                                            : "Time binding preview"
                                        }
                                      >
                                        {calendarParams.bookingTimeSource === "literal" ? (
                                          <div className="space-y-2">
                                            <input
                                              className={inputClassName}
                                              onChange={(event) =>
                                                onUpdateFunctionStepParams(functionIndex, stepIndex, {
                                                  bookingTimeValue: event.target.value,
                                                })
                                              }
                                              placeholder="HH:MM"
                                              readOnly={isReadOnlyMode}
                                              value={calendarParams.bookingTimeValue}
                                            />
                                            {calendarParams.bookingTimeValue.trim() &&
                                            !isCalendarTimeLiteral(calendarParams.bookingTimeValue) ? (
                                              <p className="text-sm text-destructive">
                                                Use `HH:MM` or `10:30 am`. Saving stays blocked until this fixed time is valid.
                                              </p>
                                            ) : null}
                                          </div>
                                        ) : (
                                          <div className="rounded-[16px] bg-white px-4 py-3 text-sm text-muted-foreground ring-1 ring-[#eadccc]">
                                            Uses the time text the model passes in the function call.
                                          </div>
                                        )}
                                      </FormField>

                                      <FormField
                                        label={
                                          calendarParams.inviteEmailSource === "literal"
                                            ? "Fixed invite email"
                                            : "Email binding preview"
                                        }
                                      >
                                        {calendarParams.inviteEmailSource === "literal" ? (
                                          <div className="space-y-2">
                                            <input
                                              className={inputClassName}
                                              onChange={(event) =>
                                                onUpdateFunctionStepParams(functionIndex, stepIndex, {
                                                  inviteEmailValue: event.target.value,
                                                })
                                              }
                                              placeholder="client@example.com"
                                              readOnly={isReadOnlyMode}
                                              value={calendarParams.inviteEmailValue}
                                            />
                                            {!calendarParams.inviteEmailValue.trim() ? (
                                              <p className="text-sm text-destructive">
                                                Fixed invite email cannot stay empty, or runtime will reject this booking action.
                                              </p>
                                            ) : !isEmailLiteral(calendarParams.inviteEmailValue) ? (
                                              <p className="text-sm text-destructive">
                                                Use a valid email address. Saving stays blocked until this invite email is valid.
                                              </p>
                                            ) : null}
                                          </div>
                                        ) : (
                                          <div className="rounded-[16px] bg-white px-4 py-3 text-sm text-muted-foreground ring-1 ring-[#eadccc]">
                                            {calendarParams.inviteEmailSource === "customer_email"
                                              ? "Uses the customer email from the function call when available."
                                              : "Falls back to the default email already available at runtime."}
                                          </div>
                                        )}
                                      </FormField>
                                    </div>
                                  )}
                                </div>

                                <div className="space-y-4 rounded-[18px] border border-[#eadccc] bg-[#fffaf2] p-4">
                                  <div className="flex items-start gap-4">
                                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#201627] text-sm font-semibold text-[#f7efe4]">
                                      3
                                    </div>
                                    <div className="space-y-1">
                                      <p className="text-sm font-semibold text-foreground">
                                        Define the scheduling window
                                      </p>
                                      <p className="text-sm text-muted-foreground">
                                        Both availability lookup and booking will obey these working hours and selected business days.
                                      </p>
                                    </div>
                                  </div>
                                  <div className="grid gap-4 md:grid-cols-2">
                                  <FormField label="Availability window starts">
                                    <input
                                      className={inputClassName}
                                      max={23}
                                      min={0}
                                      onChange={(event) =>
                                        onUpdateFunctionStepParams(functionIndex, stepIndex, {
                                          businessWindowStartHour: Math.max(
                                            Math.min(
                                              Number(event.target.value || 0),
                                              Math.max(calendarParams.businessWindowEndHour - 1, 0),
                                            ),
                                            0,
                                          ),
                                        })
                                      }
                                      readOnly={isReadOnlyMode}
                                      type="number"
                                      value={calendarParams.businessWindowStartHour}
                                    />
                                  </FormField>
                                  <FormField label="Availability window ends">
                                    <input
                                      className={inputClassName}
                                      max={23}
                                      min={0}
                                      onChange={(event) =>
                                        onUpdateFunctionStepParams(functionIndex, stepIndex, {
                                          businessWindowEndHour: Math.min(
                                            Math.max(
                                              Number(event.target.value || 0),
                                              Math.min(calendarParams.businessWindowStartHour + 1, 23),
                                            ),
                                            23,
                                          ),
                                        })
                                      }
                                      readOnly={isReadOnlyMode}
                                      type="number"
                                      value={calendarParams.businessWindowEndHour}
                                    />
                                  </FormField>
                                  </div>
                                  <div className="space-y-3">
                                    <div>
                                      <p className="text-sm font-semibold text-foreground">
                                        Business days
                                      </p>
                                      <p className="text-sm text-muted-foreground">
                                        Runtime already respects these days when checking and booking slots.
                                      </p>
                                    </div>
                                  <div className="flex flex-wrap gap-2">
                                    {businessDayOptions.map((day) => {
                                      const active = calendarParams.businessDays.includes(day.value);

                                      return (
                                        <label
                                          key={day.value}
                                          className={`flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm ring-1 transition ${
                                            active
                                              ? "bg-[#201627] text-[#f7efe4] ring-[#201627]"
                                              : "bg-[#faf3e9] text-foreground ring-[#eadccc]"
                                          }`}
                                        >
                                          <input
                                            checked={active}
                                            className="sr-only"
                                            disabled={isReadOnlyMode}
                                            onChange={() =>
                                              onUpdateFunctionStepParams(functionIndex, stepIndex, {
                                                businessDays: toggleBusinessDay(
                                                  calendarParams.businessDays,
                                                  day.value,
                                                ),
                                              })
                                            }
                                            type="checkbox"
                                          />
                                          {day.label}
                                        </label>
                                      );
                                    })}
                                  </div>
                                </div>
                                </div>
                              </div>

                              {/* visual summary rail intentionally removed for a cleaner MoonAI-like flow
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8c745b]">
                                    Setup summary
                                  </p>
                                </div>
                                <div className="rounded-[16px] bg-white/85 p-4 ring-1 ring-[#eadccc]">
                                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8c745b]">
                                    Calendar
                                  </p>
                                  <p className="mt-2 text-sm font-semibold text-foreground">
                                    {calendarParams.calendarId || "Calendar not selected yet"}
                                  </p>
                                  <p className="mt-1 text-sm text-muted-foreground">
                                    {calendarParams.timeZone} · {calendarParams.slotDurationMinutes} min
                                  </p>
                                </div>
                                <div className="rounded-[16px] bg-white/85 p-4 ring-1 ring-[#eadccc]">
                                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8c745b]">
                                    Working window
                                  </p>
                                  <p className="mt-2 text-sm font-semibold text-foreground">
                                    {calendarParams.businessWindowStartHour}:00 - {calendarParams.businessWindowEndHour}:00
                                  </p>
                                  <p className="mt-1 text-sm text-muted-foreground">
                                    {calendarParams.businessDays.length
                                      ? businessDayOptions
                                          .filter((day) => calendarParams.businessDays.includes(day.value))
                                          .map((day) => day.label)
                                          .join(", ")
                                      : "No business days selected"}
                                  </p>
                                </div>
                                <div className="rounded-[16px] bg-white/85 p-4 ring-1 ring-[#eadccc]">
                                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8c745b]">
                                    Operator note
                                  </p>
                                  <p className="mt-2 text-sm leading-6 text-[#655446]">
                                    {calendarParams.operation === "book_call"
                                      ? "Use this as the second step in the booking chain: confirm the slot, then call this function to create the event."
                                      : "Use this as the first step in the booking chain: collect the date, fetch slots, then ask the customer which one works."}
                                  </p>
                                </div>
                                {calendarParams.operation === "book_call" ? (
                                  <div className="space-y-3">
                                    <label className="flex items-center gap-3 rounded-[12px] border border-[#e6ebf2] bg-white px-4 py-4 text-sm text-foreground">
                                      <input
                                        checked={calendarParams.checkConflictsBeforeBooking}
                                        disabled={isReadOnlyMode}
                                        onChange={(event) =>
                                          onUpdateFunctionStepParams(functionIndex, stepIndex, {
                                            checkConflictsBeforeBooking: event.target.checked,
                                          })
                                        }
                                        type="checkbox"
                                      />
                                      Block booking when the slot is already busy
                                    </label>
                                    <label className="flex items-center gap-3 rounded-[12px] border border-[#e6ebf2] bg-white px-4 py-4 text-sm text-foreground">
                                      <input
                                        checked={calendarParams.createMeetLink}
                                        disabled={isReadOnlyMode}
                                        onChange={(event) =>
                                          onUpdateFunctionStepParams(functionIndex, stepIndex, {
                                            createMeetLink: event.target.checked,
                                          })
                                        }
                                        type="checkbox"
                                      />
                                      Create Google Meet link automatically
                                    </label>
                                    <label className="flex items-center gap-3 rounded-[12px] border border-[#e6ebf2] bg-white px-4 py-4 text-sm text-foreground">
                                      <input
                                        checked={calendarParams.inviteCustomerByEmail}
                                        disabled={isReadOnlyMode}
                                        onChange={(event) =>
                                          onUpdateFunctionStepParams(functionIndex, stepIndex, {
                                            inviteCustomerByEmail: event.target.checked,
                                          })
                                        }
                                        type="checkbox"
                                      />
                                      Send calendar invite to customer email when available
                                    </label>
                                  </div>
                                ) : null}
                              */}

                            {calendarParams.operation === "book_call" ? (
                              <div className="space-y-4 rounded-[22px] bg-white/72 p-5 ring-1 ring-[#eadccc]">
                                <div className="flex items-start gap-4 rounded-[12px] border border-[#e6ebf2] bg-[#fbfcfe] p-4">
                                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#201627] text-sm font-semibold text-[#f7efe4]">
                                    4
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-sm font-semibold text-foreground">
                                      Define the booked event
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      Choose how the created event should look, whether it should remind the customer, and whether the booking should also log a lead row.
                                    </p>
                                  </div>
                                </div>
                                <div className="grid gap-4 lg:grid-cols-2">
                                  <FormField label="Event title template">
                                    <input
                                      className={inputClassName}
                                      onChange={(event) =>
                                        onUpdateFunctionStepParams(functionIndex, stepIndex, {
                                          eventSummaryTemplate: event.target.value,
                                        })
                                      }
                                      readOnly={isReadOnlyMode}
                                      value={calendarParams.eventSummaryTemplate}
                                    />
                                  </FormField>
                                  <FormField label="Description template">
                                    <textarea
                                      className={textareaClassName}
                                      onChange={(event) =>
                                        onUpdateFunctionStepParams(functionIndex, stepIndex, {
                                          eventDescriptionTemplate: event.target.value,
                                        })
                                      }
                                      readOnly={isReadOnlyMode}
                                      value={calendarParams.eventDescriptionTemplate}
                                    />
                                  </FormField>
                                </div>

                                <div className="rounded-[18px] bg-[#faf3e9] p-4 ring-1 ring-[#eadccc]">
                                  <p className="text-sm font-semibold text-foreground">
                                    Template variables
                                  </p>
                                  <p className="mt-2 text-sm text-muted-foreground">
                                    Use `{"{{coupleName}}"}`, `{"{{weddingDate}}"}`, `{"{{location}}"}`, `{"{{channel}}"}`, `{"{{email}}"}`, `{"{{date}}"}`, and `{"{{time}}"}` inside title or description templates.
                                  </p>
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                  <label className="flex items-center gap-3 rounded-[12px] border border-[#e6ebf2] bg-white px-4 py-4 text-sm text-foreground">
                                    <input
                                      checked={calendarParams.checkConflictsBeforeBooking}
                                      disabled={isReadOnlyMode}
                                      onChange={(event) =>
                                        onUpdateFunctionStepParams(functionIndex, stepIndex, {
                                          checkConflictsBeforeBooking: event.target.checked,
                                        })
                                      }
                                      type="checkbox"
                                    />
                                    Block booking when the slot is already busy
                                  </label>
                                  <label className="flex items-center gap-3 rounded-[12px] border border-[#e6ebf2] bg-white px-4 py-4 text-sm text-foreground">
                                    <input
                                      checked={calendarParams.createMeetLink}
                                      disabled={isReadOnlyMode}
                                      onChange={(event) =>
                                        onUpdateFunctionStepParams(functionIndex, stepIndex, {
                                          createMeetLink: event.target.checked,
                                        })
                                      }
                                      type="checkbox"
                                    />
                                    Create Google Meet link automatically
                                  </label>
                                  <label className="flex items-center gap-3 rounded-[12px] border border-[#e6ebf2] bg-white px-4 py-4 text-sm text-foreground">
                                    <input
                                      checked={calendarParams.inviteCustomerByEmail}
                                      disabled={isReadOnlyMode}
                                      onChange={(event) =>
                                        onUpdateFunctionStepParams(functionIndex, stepIndex, {
                                          inviteCustomerByEmail: event.target.checked,
                                        })
                                      }
                                      type="checkbox"
                                    />
                                    Send calendar invite to customer email when available
                                  </label>
                                </div>

                                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
                                  <label className="flex items-center gap-3 rounded-[12px] border border-[#e6ebf2] bg-white px-4 py-4 text-sm text-foreground">
                                    <input
                                      checked={calendarParams.reminderEnabled}
                                      disabled={isReadOnlyMode}
                                      onChange={(event) =>
                                        onUpdateFunctionStepParams(functionIndex, stepIndex, {
                                          reminderEnabled: event.target.checked,
                                        })
                                      }
                                      type="checkbox"
                                    />
                                    Add Google Calendar email reminder
                                  </label>
                                  <FormField label="Reminder minutes before event">
                                    <input
                                      className={inputClassName}
                                      min={0}
                                      onChange={(event) =>
                                        onUpdateFunctionStepParams(functionIndex, stepIndex, {
                                          reminderMinutesBefore: Math.max(
                                            Number(event.target.value || 0),
                                            0,
                                          ),
                                        })
                                      }
                                      readOnly={isReadOnlyMode || !calendarParams.reminderEnabled}
                                      type="number"
                                      value={calendarParams.reminderMinutesBefore}
                                    />
                                  </FormField>
                                </div>

                                <label className="flex items-center gap-3 rounded-[12px] border border-[#e6ebf2] bg-white px-4 py-4 text-sm text-foreground">
                                  <input
                                    checked={calendarParams.syncLeadToSheets}
                                    disabled={isReadOnlyMode}
                                    onChange={(event) =>
                                      onUpdateFunctionStepParams(functionIndex, stepIndex, {
                                        syncLeadToSheets: event.target.checked,
                                      })
                                    }
                                    type="checkbox"
                                  />
                                  Sync booked leads to Google Sheets
                                </label>

                                {calendarParams.syncLeadToSheets ? (
                                  <div className="space-y-4">
                                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                      <FormField label="Spreadsheet ID">
                                        <input
                                          className={inputClassName}
                                          onChange={(event) =>
                                            onUpdateFunctionStepParams(functionIndex, stepIndex, {
                                              leadSpreadsheetId: event.target.value,
                                            })
                                          }
                                          readOnly={isReadOnlyMode}
                                          value={calendarParams.leadSpreadsheetId}
                                        />
                                      </FormField>
                                      <FormField label="Spreadsheet title">
                                        <input
                                          className={inputClassName}
                                          onChange={(event) =>
                                            onUpdateFunctionStepParams(functionIndex, stepIndex, {
                                              leadSpreadsheetTitle: event.target.value,
                                            })
                                          }
                                          readOnly={isReadOnlyMode}
                                          value={calendarParams.leadSpreadsheetTitle}
                                        />
                                      </FormField>
                                      <FormField label="Sheet name">
                                        <input
                                          className={inputClassName}
                                          onChange={(event) =>
                                            onUpdateFunctionStepParams(functionIndex, stepIndex, {
                                              leadSheetName: event.target.value,
                                            })
                                          }
                                          readOnly={isReadOnlyMode}
                                          value={calendarParams.leadSheetName}
                                        />
                                      </FormField>
                                      <FormField label="Header row">
                                        <input
                                          className={inputClassName}
                                          min={1}
                                          onChange={(event) =>
                                            onUpdateFunctionStepParams(functionIndex, stepIndex, {
                                              leadHeaderRow: Math.max(
                                                Number(event.target.value || 1),
                                                1,
                                              ),
                                            })
                                          }
                                          readOnly={isReadOnlyMode}
                                          type="number"
                                          value={calendarParams.leadHeaderRow}
                                        />
                                      </FormField>
                                    </div>

                                    <div className="space-y-3">
                                      <div>
                                        <p className="text-sm font-semibold text-foreground">
                                          Lead column mapping
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                          These keys are used when the booking runtime writes a lead row after a successful event.
                                        </p>
                                      </div>
                                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                        <FormField label="Couple name column">
                                          <input
                                            className={inputClassName}
                                            onChange={(event) =>
                                              onUpdateFunctionStepParams(functionIndex, stepIndex, {
                                                leadColumns: {
                                                  ...calendarParams.leadColumns,
                                                  coupleName: event.target.value,
                                                },
                                              })
                                            }
                                            readOnly={isReadOnlyMode}
                                            value={calendarParams.leadColumns.coupleName}
                                          />
                                        </FormField>
                                        <FormField label="Wedding date column">
                                          <input
                                            className={inputClassName}
                                            onChange={(event) =>
                                              onUpdateFunctionStepParams(functionIndex, stepIndex, {
                                                leadColumns: {
                                                  ...calendarParams.leadColumns,
                                                  weddingDate: event.target.value,
                                                },
                                              })
                                            }
                                            readOnly={isReadOnlyMode}
                                            value={calendarParams.leadColumns.weddingDate}
                                          />
                                        </FormField>
                                        <FormField label="Location column">
                                          <input
                                            className={inputClassName}
                                            onChange={(event) =>
                                              onUpdateFunctionStepParams(functionIndex, stepIndex, {
                                                leadColumns: {
                                                  ...calendarParams.leadColumns,
                                                  location: event.target.value,
                                                },
                                              })
                                            }
                                            readOnly={isReadOnlyMode}
                                            value={calendarParams.leadColumns.location}
                                          />
                                        </FormField>
                                        <FormField label="Call date column">
                                          <input
                                            className={inputClassName}
                                            onChange={(event) =>
                                              onUpdateFunctionStepParams(functionIndex, stepIndex, {
                                                leadColumns: {
                                                  ...calendarParams.leadColumns,
                                                  callDate: event.target.value,
                                                },
                                              })
                                            }
                                            readOnly={isReadOnlyMode}
                                            value={calendarParams.leadColumns.callDate}
                                          />
                                        </FormField>
                                        <FormField label="Call time column">
                                          <input
                                            className={inputClassName}
                                            onChange={(event) =>
                                              onUpdateFunctionStepParams(functionIndex, stepIndex, {
                                                leadColumns: {
                                                  ...calendarParams.leadColumns,
                                                  callTime: event.target.value,
                                                },
                                              })
                                            }
                                            readOnly={isReadOnlyMode}
                                            value={calendarParams.leadColumns.callTime}
                                          />
                                        </FormField>
                                        <FormField label="Email column">
                                          <input
                                            className={inputClassName}
                                            onChange={(event) =>
                                              onUpdateFunctionStepParams(functionIndex, stepIndex, {
                                                leadColumns: {
                                                  ...calendarParams.leadColumns,
                                                  email: event.target.value,
                                                },
                                              })
                                            }
                                            readOnly={isReadOnlyMode}
                                            value={calendarParams.leadColumns.email}
                                          />
                                        </FormField>
                                        <FormField label="Channel column">
                                          <input
                                            className={inputClassName}
                                            onChange={(event) =>
                                              onUpdateFunctionStepParams(functionIndex, stepIndex, {
                                                leadColumns: {
                                                  ...calendarParams.leadColumns,
                                                  channel: event.target.value,
                                                },
                                              })
                                            }
                                            readOnly={isReadOnlyMode}
                                            value={calendarParams.leadColumns.channel}
                                          />
                                        </FormField>
                                      </div>
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <div className="mt-4">
                            <FormField label="Params (JSON)">
                              <textarea
                                className={textareaClassName}
                                onChange={(event) =>
                                  onUpdateFunctionStep(functionIndex, stepIndex, {
                                    params: event.target.value,
                                  })
                                }
                                readOnly={isReadOnlyMode}
                                value={step.params}
                              />
                            </FormField>
                          </div>
                        )}

                        {!isReadOnlyMode && !isWorkspaceMode ? (
                          <div className="mt-4 flex justify-end">
                            <button
                              className={secondaryButtonClassName}
                              onClick={() => onRemoveFunctionStep(functionIndex, stepIndex)}
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
                </fieldset>
                </details>
              </div>
            </div>
          ))}
        </div>
      </div>
    </SurfaceCard>
  );
}
