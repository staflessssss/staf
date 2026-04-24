import { IntegrationConnection, IntegrationType } from "@prisma/client";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import {
  EmptyState,
  FormField,
  SurfaceCard,
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
  functionResultTargetTypeOptions,
} from "@/lib/agent-builder";
import {
  GoogleCalendarParams,
  GoogleSheetsColumnMappingDraft,
  GoogleSheetsFilterDraft,
  GoogleSheetsOperationDraft,
  GoogleSheetsParams,
  getGoogleSheetsActionForOperation,
} from "@/lib/function-execution";

type ToolStepDraft = {
  uiId: string;
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

function getIntegrationDisplayLabel(integration: IntegrationConnection) {
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
  onAddFunctionResultTarget,
  onUpdateFunctionResultTarget,
  onRemoveFunctionResultTarget,
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
  connectedIntegrations: IntegrationConnection[];
  integrationById: Map<string, IntegrationConnection>;
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
  onAddFunctionResultTarget: (functionIndex: number) => void;
  onUpdateFunctionResultTarget: (
    functionIndex: number,
    targetIndex: number,
    patch: Partial<FunctionDraft["resultTargets"][number]>,
  ) => void;
  onRemoveFunctionResultTarget: (functionIndex: number, targetIndex: number) => void;
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
  return (
    <SurfaceCard
      className="border-0 bg-transparent p-0 shadow-none"
      title="Functions"
      description="Define business actions as structured functions, then bind their execution steps to tenant integrations."
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

          {functionBlocks.map((fn, functionIndex) => (
            <div
              key={fn.uiId}
              className="rounded-[30px] bg-[linear-gradient(180deg,#fffefb_0%,#fbf4ea_100%)] p-6 ring-1 ring-[#dfcfbb]"
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-foreground">Function {functionIndex + 1}</p>
                {!isReadOnlyMode ? (
                  <div className="flex gap-2">
                    <button
                      className={secondaryButtonClassName}
                      onClick={() => onMoveFunctionBlock(functionIndex, -1)}
                      type="button"
                    >
                      <ArrowUp className="size-4" />
                    </button>
                    <button
                      className={secondaryButtonClassName}
                      onClick={() => onMoveFunctionBlock(functionIndex, 1)}
                      type="button"
                    >
                      <ArrowDown className="size-4" />
                    </button>
                    <button
                      className={secondaryButtonClassName}
                      onClick={() => onRemoveFunctionBlock(functionIndex)}
                      type="button"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="space-y-4">
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_320px]">
                  <div className="space-y-4">
                    <FormField label="Function name">
                      <input
                        className={inputClassName}
                        onChange={(event) => onUpdateFunction(functionIndex, { name: event.target.value })}
                        readOnly={isReadOnlyMode}
                        value={fn.name}
                      />
                    </FormField>
                    <FormField label="Summary">
                      <textarea
                        className={textareaClassName}
                        onChange={(event) =>
                          onUpdateFunction(functionIndex, { description: event.target.value })
                        }
                        readOnly={isReadOnlyMode}
                        value={fn.description}
                      />
                    </FormField>
                  </div>

                  <div className="rounded-[22px] bg-[#201627] px-5 py-5 text-[#f7efe4] shadow-[0_16px_34px_rgba(31,23,40,0.12)]">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#d4c4af]">
                      Function role
                    </p>
                    <p className="mt-3 text-sm leading-7 text-[#eadfcf]">
                      Keep the operator focused on the business action first. Execution details
                      stay below, but the function itself should read like something the agent does
                      for the client.
                    </p>
                  </div>
                </div>

                {isWorkspaceMode ? (
                  <>
                    <div className="grid gap-5 rounded-[22px] bg-white/72 p-5 ring-1 ring-[#eadccc] lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)]">
                      <div className="space-y-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8c745b]">
                          Function contract
                        </p>
                        <div className="grid gap-4 md:grid-cols-2">
                          <label className="flex items-center gap-3 rounded-[16px] bg-[#faf3e9] px-4 py-3 text-sm text-foreground ring-1 ring-[#eadccc]">
                            <input
                              checked={fn.active}
                              disabled={isReadOnlyMode}
                              onChange={(event) =>
                                onUpdateFunction(functionIndex, { active: event.target.checked })
                              }
                              type="checkbox"
                            />
                            Function active
                          </label>
                          <label className="flex items-center gap-3 rounded-[16px] bg-[#faf3e9] px-4 py-3 text-sm text-foreground ring-1 ring-[#eadccc]">
                            <input
                              checked={fn.disableDelayedMessages}
                              disabled={isReadOnlyMode}
                              onChange={(event) =>
                                onUpdateFunction(functionIndex, {
                                  disableDelayedMessages: event.target.checked,
                                })
                              }
                              type="checkbox"
                            />
                            Disable delayed messages after run
                          </label>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <FormField label="Reaction after execution">
                            <select
                              className={selectClassName}
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
                          <FormField label="Post-scenario">
                            <select
                              className={selectClassName}
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
                        </div>
                      </div>

                      <div className="space-y-3 rounded-[18px] bg-[#fcf7ef] px-5 py-5 ring-1 ring-[#eadccc]">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8c745b]">
                          Operator guidance
                        </p>
                        <p className="text-sm leading-7 text-[#655446]">
                          Use the contract layer for when the function should run, what the model
                          must extract first, and how the agent should continue after execution.
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-5 lg:grid-cols-2">
                      <div className="rounded-[22px] bg-white/72 p-5 ring-1 ring-[#eadccc]">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-foreground">Input parameters</p>
                          {!isReadOnlyMode ? (
                            <button
                              className={secondaryButtonClassName}
                              onClick={() => onAddFunctionParameter(functionIndex)}
                              type="button"
                            >
                              <Plus className="mr-2 size-4" />
                              Add parameter
                            </button>
                          ) : null}
                        </div>
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
                              className="space-y-3 rounded-[18px] bg-[#fff9f1] p-4 ring-1 ring-[#eadccc]"
                            >
                              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto]">
                                <FormField label="Name">
                                  <input
                                    className={inputClassName}
                                    onChange={(event) =>
                                      onUpdateFunctionParameter(functionIndex, parameterIndex, {
                                        name: event.target.value,
                                      })
                                    }
                                    readOnly={isReadOnlyMode}
                                    value={parameter.name}
                                  />
                                </FormField>
                                <FormField label="Type">
                                  <select
                                    className={selectClassName}
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
                                {!isReadOnlyMode ? (
                                  <button
                                    className={`${secondaryButtonClassName} self-end`}
                                    onClick={() =>
                                      onRemoveFunctionParameter(functionIndex, parameterIndex)
                                    }
                                    type="button"
                                  >
                                    <Trash2 className="size-4" />
                                  </button>
                                ) : null}
                              </div>
                              <FormField label="Instruction">
                                <input
                                  className={inputClassName}
                                  onChange={(event) =>
                                    onUpdateFunctionParameter(functionIndex, parameterIndex, {
                                      instruction: event.target.value,
                                    })
                                  }
                                  readOnly={isReadOnlyMode}
                                  value={parameter.instruction ?? ""}
                                />
                              </FormField>
                              <FormField label="Allowed values (comma-separated)">
                                <input
                                  className={inputClassName}
                                  onChange={(event) =>
                                    onUpdateFunctionParameter(functionIndex, parameterIndex, {
                                      allowedValues: event.target.value
                                        .split(",")
                                        .map((value) => value.trim())
                                        .filter(Boolean),
                                    })
                                  }
                                  readOnly={isReadOnlyMode}
                                  value={parameter.allowedValues.join(", ")}
                                />
                              </FormField>
                              <label className="flex items-center gap-3 text-sm text-foreground">
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

                      <div className="rounded-[22px] bg-white/72 p-5 ring-1 ring-[#eadccc]">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-foreground">Result delivery</p>
                          {!isReadOnlyMode ? (
                            <button
                              className={secondaryButtonClassName}
                              onClick={() => onAddFunctionResultTarget(functionIndex)}
                              type="button"
                            >
                              <Plus className="mr-2 size-4" />
                              Add target
                            </button>
                          ) : null}
                        </div>
                        <div className="space-y-4">
                          {fn.resultTargets.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              No explicit result targets yet. Execution can still flow through the
                              bound steps below.
                            </p>
                          ) : null}
                          {fn.resultTargets.map((target, targetIndex) => (
                            <div
                              key={target.uiId}
                              className="grid gap-3 rounded-[18px] bg-[#fff9f1] p-4 ring-1 ring-[#eadccc] md:grid-cols-[180px_minmax(0,1fr)_auto]"
                            >
                              <FormField label="Target type">
                                <select
                                  className={selectClassName}
                                  disabled={isReadOnlyMode}
                                  onChange={(event) =>
                                    onUpdateFunctionResultTarget(functionIndex, targetIndex, {
                                      type:
                                        event.target.value as FunctionDraft["resultTargets"][number]["type"],
                                    })
                                  }
                                  value={target.type}
                                >
                                  {functionResultTargetTypeOptions.map((option) => (
                                    <option key={option} value={option}>
                                      {humanizeWorkspaceToken(option)}
                                    </option>
                                  ))}
                                </select>
                              </FormField>
                              <FormField label="Label">
                                <input
                                  className={inputClassName}
                                  onChange={(event) =>
                                    onUpdateFunctionResultTarget(functionIndex, targetIndex, {
                                      label: event.target.value,
                                    })
                                  }
                                  readOnly={isReadOnlyMode}
                                  value={target.label}
                                />
                              </FormField>
                              {!isReadOnlyMode ? (
                                <button
                                  className={`${secondaryButtonClassName} self-end`}
                                  onClick={() =>
                                    onRemoveFunctionResultTarget(functionIndex, targetIndex)
                                  }
                                  type="button"
                                >
                                  <Trash2 className="size-4" />
                                </button>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                ) : null}

                <div className="space-y-5 border-t border-[#e8d8c5] pt-6">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-foreground">Executable steps</p>
                    {!isReadOnlyMode ? (
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
                                    : "Sheet lookup flow"}
                              </h4>
                              <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                                {sheetParams.operation === "append_row"
                                  ? "Pick the spreadsheet file, bind the sheet tab, then map function fields into the row this action should append."
                                  : sheetParams.operation === "update_rows"
                                    ? "Pick the spreadsheet file, define which rows should be found, then map the field values this action should overwrite."
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

                              {sheetParams.operation !== "append_row" ? (
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

                              {sheetParams.operation !== "get_rows" ? (
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
                                <div className="flex items-start gap-4 rounded-[18px] bg-[#fcf7ef] p-4 ring-1 ring-[#eadccc]">
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
                                    <label className="flex items-center gap-3 rounded-[16px] bg-[#faf3e9] px-4 py-4 text-sm text-foreground ring-1 ring-[#eadccc]">
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
                                    <label className="flex items-center gap-3 rounded-[16px] bg-[#faf3e9] px-4 py-4 text-sm text-foreground ring-1 ring-[#eadccc]">
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
                                    <label className="flex items-center gap-3 rounded-[16px] bg-[#faf3e9] px-4 py-4 text-sm text-foreground ring-1 ring-[#eadccc]">
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
                                    <FormField label="Owner Telegram chat ID">
                                      <input
                                        className={inputClassName}
                                        onChange={(event) =>
                                          onUpdateFunctionStepParams(functionIndex, stepIndex, {
                                            ownerTelegramChatId: event.target.value,
                                          })
                                        }
                                        placeholder="Optional escalation target"
                                        readOnly={isReadOnlyMode}
                                        value={calendarParams.ownerTelegramChatId}
                                      />
                                    </FormField>
                                  </div>
                                ) : null}
                              */}

                            {calendarParams.operation === "book_call" ? (
                              <div className="space-y-4 rounded-[22px] bg-white/72 p-5 ring-1 ring-[#eadccc]">
                                <div className="flex items-start gap-4 rounded-[18px] bg-[#fcf7ef] p-4 ring-1 ring-[#eadccc]">
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
                                  <label className="flex items-center gap-3 rounded-[16px] bg-[#faf3e9] px-4 py-4 text-sm text-foreground ring-1 ring-[#eadccc]">
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
                                  <label className="flex items-center gap-3 rounded-[16px] bg-[#faf3e9] px-4 py-4 text-sm text-foreground ring-1 ring-[#eadccc]">
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
                                  <label className="flex items-center gap-3 rounded-[16px] bg-[#faf3e9] px-4 py-4 text-sm text-foreground ring-1 ring-[#eadccc]">
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
                                  <FormField label="Owner Telegram chat ID">
                                    <input
                                      className={inputClassName}
                                      onChange={(event) =>
                                        onUpdateFunctionStepParams(functionIndex, stepIndex, {
                                          ownerTelegramChatId: event.target.value,
                                        })
                                      }
                                      placeholder="Optional escalation target"
                                      readOnly={isReadOnlyMode}
                                      value={calendarParams.ownerTelegramChatId}
                                    />
                                  </FormField>
                                </div>

                                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
                                  <label className="flex items-center gap-3 rounded-[16px] bg-[#faf3e9] px-4 py-4 text-sm text-foreground ring-1 ring-[#eadccc]">
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

                                <label className="flex items-center gap-3 rounded-[16px] bg-[#faf3e9] px-4 py-4 text-sm text-foreground ring-1 ring-[#eadccc]">
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

                        {!isReadOnlyMode ? (
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
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </SurfaceCard>
  );
}
