import { ArrowDown, ArrowUp, CircleQuestionMark } from "lucide-react";

import {
  FormField,
  textareaClassName,
} from "@/components/stafless/foundation";
import {
  afterFaqBehaviorOptions,
  bookingBehaviorOptions,
  conversationMomentumOptions,
  conversationPlaybookPresetOptions,
  ConversationPlaybookConfig,
  discoveryFieldOptions,
  DiscoveryField,
  fallbackBehaviorOptions,
  openingStrategyOptions,
  playbookGoalOptions,
  pricingBehaviorOptions,
  successActionOptions,
  unavailableBehaviorOptions,
} from "@/lib/agent-config";
import { humanizeWorkspaceToken } from "@/components/stafless/workspace-sections/utils";

const sectionTitleClassName = "text-[18px] font-semibold tracking-[-0.02em] text-[#111827]";
const fieldCardClassName =
  "rounded-[14px] border border-[#dbe3ef] bg-white px-4 py-4 shadow-[0_1px_2px_rgba(16,24,40,0.02)]";
const mutedTextClassName = "text-sm leading-6 text-[#667085]";
const cardHeadingClassName = "text-base font-semibold text-[#111827]";
const compactSelectClassName =
  "w-full rounded-[10px] border border-[#dde3ee] bg-white px-3 py-2 text-sm text-[#344054] outline-none transition focus:border-[#6c63ff] focus:ring-4 focus:ring-[#6c63ff]/10 disabled:bg-[#f8fafc] disabled:text-[#98a2b3]";

const fieldExplanations: Record<DiscoveryField, string> = {
  customer_name: "Who the agent is talking to.",
  service_needed: "What the customer wants.",
  preferred_date: "When the customer wants it.",
  preferred_time: "Which time window works.",
  location_or_branch: "Where the request should be handled.",
  budget: "Whether the offer fits the customer.",
  urgency: "How fast the customer needs an answer.",
  preferred_specialist: "Who the customer wants to work with.",
  contact_preference: "How the business should continue the dialog.",
  notes_or_special_request: "Extra context that changes the answer.",
};

function HelpHint({ label }: { label: string }) {
  return (
    <span
      className="inline-flex size-4 items-center justify-center rounded-full border border-[#b8c4d6] text-[10px] font-semibold text-[#667085]"
      title={label}
    >
      ?
    </span>
  );
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-1">
      <h2 className={sectionTitleClassName}>{title}</h2>
      <p className={mutedTextClassName}>{description}</p>
    </div>
  );
}

function SelectField<T extends string>({
  label,
  explanation,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  explanation: string;
  value: T;
  options: readonly T[];
  disabled: boolean;
  onChange: (value: T) => void;
}) {
  return (
    <FormField label={label} hint={explanation}>
      <select
        className={compactSelectClassName}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as T)}
        value={value}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {humanizeWorkspaceToken(option)}
          </option>
        ))}
      </select>
    </FormField>
  );
}

function FieldCheckbox({
  checked,
  disabled,
  label,
  explanation,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  label: string;
  explanation?: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-[76px] items-start gap-3 rounded-[12px] border border-[#e6ebf2] bg-[#fbfcfe] px-3 py-3 transition hover:border-[#cfd8e7] hover:bg-white">
      <input
        checked={checked}
        className="mt-1 size-4"
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-[#111827]">{label}</span>
        {explanation ? (
          <span className="mt-1 block text-xs leading-5 text-[#667085]">{explanation}</span>
        ) : null}
      </span>
    </label>
  );
}

export function PlaybookSection({
  playbook,
  discoveryFieldLabels,
  isReadOnlyMode,
  isPlaybookActive = true,
  onApplyPreset,
  onUpdatePlaybook,
  onToggleDiscoveryField,
  onToggleFieldArray,
  onMoveDiscoveryOrder,
}: {
  playbook: ConversationPlaybookConfig;
  discoveryFieldLabels: Record<DiscoveryField, string>;
  isReadOnlyMode: boolean;
  isPlaybookActive?: boolean;
  onApplyPreset: (preset: ConversationPlaybookConfig["preset"]) => void;
  onUpdatePlaybook: (patch: Partial<ConversationPlaybookConfig>) => void;
  onToggleDiscoveryField: (field: DiscoveryField, checked: boolean) => void;
  onToggleFieldArray: (
    key: "openingFields" | "minInfoBeforeAvailability" | "minInfoBeforePricing",
    field: DiscoveryField,
    checked: boolean,
  ) => void;
  onMoveDiscoveryOrder: (field: DiscoveryField, direction: -1 | 1) => void;
}) {
  const selectedDiscoveryFields = playbook.discoveryFields;
  const orderedFields = playbook.discoveryOrder.filter((field) =>
    selectedDiscoveryFields.includes(field),
  );

  return (
    <div className="mx-auto w-full max-w-[720px] space-y-9">
      <section className="space-y-6">
        <div className="flex items-start justify-between gap-4 border-b border-[#e8edf5] pb-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-[18px] font-semibold tracking-[-0.02em] text-[#101828]">
                Playbook
              </h1>
              <CircleQuestionMark className="size-4 text-[#98a2b3]" />
            </div>
            <p className="mt-2 max-w-[590px] text-sm leading-6 text-[#667085]">
              Configure the conversation rules the agent follows: what to ask, when to give pricing,
              and what counts as a successful next step.
            </p>
          </div>
        </div>

        {!isPlaybookActive ? (
          <div className="rounded-[12px] border border-[#dbe3ef] bg-[#f8fafc] px-4 py-3 text-sm leading-6 text-[#475467]">
            This agent is in Voice-first conversation mode. Playbook values are preserved for a
            future guided mode, but they are not sent to the model. Change the mode in Prompting
            before editing these settings.
          </div>
        ) : null}

        <div className="space-y-3">
          <SectionHeader
            title="Goal"
            description="These fields tell the agent what the dialog is trying to achieve."
          />

          <div className={fieldCardClassName}>
            <div className="grid gap-4 md:grid-cols-2">
              <SelectField
                disabled={isReadOnlyMode}
                explanation="Loads a starting structure. Changing it replaces the playbook with that preset."
                label="Playbook preset"
                onChange={onApplyPreset}
                options={conversationPlaybookPresetOptions}
                value={playbook.preset}
              />
              <SelectField
                disabled={isReadOnlyMode}
                explanation="The main outcome the agent should push toward during the conversation."
                label="Agent goal"
                onChange={(primaryGoal) => onUpdatePlaybook({ primaryGoal })}
                options={playbookGoalOptions}
                value={playbook.primaryGoal}
              />
              <SelectField
                disabled={isReadOnlyMode}
                explanation="The event that means the agent did its job for this dialog."
                label="Successful outcome"
                onChange={(successAction) => onUpdatePlaybook({ successAction })}
                options={successActionOptions}
                value={playbook.successAction}
              />
              <SelectField
                disabled={isReadOnlyMode}
                explanation="How aggressively the first reply should collect missing information."
                label="Opening strategy"
                onChange={(openingStrategy) => onUpdatePlaybook({ openingStrategy })}
                options={openingStrategyOptions}
                value={playbook.openingStrategy}
              />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <SectionHeader
            title="Discovery"
            description="Choose what the agent should learn from the customer and in what order."
          />

          <div className={fieldCardClassName}>
            <div className="flex items-center gap-2">
              <p className={cardHeadingClassName}>Information to collect</p>
              <HelpHint label="Selected fields become the agent's discovery checklist. They are not shown to the customer as a form." />
            </div>
            <p className={mutedTextClassName}>
              The agent uses these as conversation targets, not as visible customer fields.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {discoveryFieldOptions.map((field) => (
                <FieldCheckbox
                  checked={selectedDiscoveryFields.includes(field)}
                  disabled={isReadOnlyMode}
                  explanation={fieldExplanations[field]}
                  key={field}
                  label={discoveryFieldLabels[field]}
                  onChange={(checked) => onToggleDiscoveryField(field, checked)}
                />
              ))}
            </div>
          </div>

          <div className={fieldCardClassName}>
            <div className="flex items-center gap-2">
              <p className={cardHeadingClassName}>Discovery order</p>
              <HelpHint label="The model uses this order as priority when several details are missing." />
            </div>
            <p className={mutedTextClassName}>
              Higher items are collected earlier. This keeps the dialog focused instead of asking
              random questions.
            </p>

            <div className="mt-4 space-y-2">
              {orderedFields.length > 0 ? (
                orderedFields.map((field, index) => (
                  <div
                    className="flex items-center justify-between gap-3 rounded-[12px] border border-[#e6ebf2] bg-[#fbfcfe] px-3 py-3"
                    key={field}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#eef2ff] text-xs font-semibold text-[#4f46e5]">
                        {index + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#111827]">
                          {discoveryFieldLabels[field]}
                        </p>
                        <p className="text-xs leading-5 text-[#667085]">
                          {fieldExplanations[field]}
                        </p>
                      </div>
                    </div>
                    {!isReadOnlyMode ? (
                      <div className="flex shrink-0 gap-2">
                        <button
                          aria-label={`Move ${discoveryFieldLabels[field]} up`}
                          className="inline-flex size-8 items-center justify-center rounded-[10px] border border-[#dde3ee] bg-white text-[#475467] transition hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-40"
                          disabled={index === 0}
                          onClick={() => onMoveDiscoveryOrder(field, -1)}
                          type="button"
                        >
                          <ArrowUp className="size-4" />
                        </button>
                        <button
                          aria-label={`Move ${discoveryFieldLabels[field]} down`}
                          className="inline-flex size-8 items-center justify-center rounded-[10px] border border-[#dde3ee] bg-white text-[#475467] transition hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-40"
                          disabled={index === orderedFields.length - 1}
                          onClick={() => onMoveDiscoveryOrder(field, 1)}
                          type="button"
                        >
                          <ArrowDown className="size-4" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="rounded-[12px] border border-dashed border-[#dbe3ef] bg-[#f8fafc] px-3 py-3 text-sm text-[#667085]">
                  Select at least one discovery field to create an order.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <SectionHeader
            title="Rules before actions"
            description="These gates stop the agent from giving pricing or checking availability too early."
          />

          <div className="grid gap-3 lg:grid-cols-3">
            {[
              {
                key: "openingFields" as const,
                title: "Ask early",
                explanation: "The first details the agent should try to collect in the opening reply.",
              },
              {
                key: "minInfoBeforeAvailability" as const,
                title: "Before availability",
                explanation: "Required details before the agent checks a slot, calendar, or schedule.",
              },
              {
                key: "minInfoBeforePricing" as const,
                title: "Before pricing",
                explanation: "Required details before the agent shares price or pricing guidance.",
              },
            ].map((group) => (
              <div className={fieldCardClassName} key={group.key}>
                <p className={cardHeadingClassName}>{group.title}</p>
                <p className="mt-1 text-xs leading-5 text-[#667085]">{group.explanation}</p>
                <div className="mt-4 space-y-2">
                  {selectedDiscoveryFields.length > 0 ? (
                    selectedDiscoveryFields.map((field) => (
                      <label
                        className="flex items-center gap-2 rounded-[10px] px-2 py-2 text-sm text-[#344054] hover:bg-[#f8fafc]"
                        key={`${group.key}-${field}`}
                      >
                        <input
                          checked={playbook[group.key].includes(field)}
                          className="size-4"
                          disabled={isReadOnlyMode}
                          onChange={(event) =>
                            onToggleFieldArray(group.key, field, event.target.checked)
                          }
                          type="checkbox"
                        />
                        <span>{discoveryFieldLabels[field]}</span>
                      </label>
                    ))
                  ) : (
                    <p className="text-sm leading-6 text-[#667085]">No discovery fields selected.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <SectionHeader
            title="Conversation behavior"
            description="These controls define how the agent reacts after the customer asks, answers, or gets stuck."
          />

          <div className={fieldCardClassName}>
            <div className="grid gap-4 md:grid-cols-2">
              <SelectField
                disabled={isReadOnlyMode}
                explanation="When the agent is allowed to share pricing."
                label="Pricing behavior"
                onChange={(pricingBehavior) => onUpdatePlaybook({ pricingBehavior })}
                options={pricingBehaviorOptions}
                value={playbook.pricingBehavior}
              />
              <SelectField
                disabled={isReadOnlyMode}
                explanation="What the agent should do when a requested time or option is unavailable."
                label="If unavailable"
                onChange={(unavailableBehavior) => onUpdatePlaybook({ unavailableBehavior })}
                options={unavailableBehaviorOptions}
                value={playbook.unavailableBehavior}
              />
              <SelectField
                disabled={isReadOnlyMode}
                explanation="How the agent should handle a customer who is ready to book."
                label="Booking behavior"
                onChange={(bookingBehavior) => onUpdatePlaybook({ bookingBehavior })}
                options={bookingBehaviorOptions}
                value={playbook.bookingBehavior}
              />
              <SelectField
                disabled={isReadOnlyMode}
                explanation="What the agent should do after answering a factual question."
                label="After FAQ"
                onChange={(afterFaqBehavior) => onUpdatePlaybook({ afterFaqBehavior })}
                options={afterFaqBehaviorOptions}
                value={playbook.afterFaqBehavior}
              />
              <SelectField
                disabled={isReadOnlyMode}
                explanation="How strongly the agent should keep the conversation moving."
                label="Conversation momentum"
                onChange={(conversationMomentum) => onUpdatePlaybook({ conversationMomentum })}
                options={conversationMomentumOptions}
                value={playbook.conversationMomentum}
              />
              <SelectField
                disabled={isReadOnlyMode}
                explanation="What the agent should do when it cannot answer confidently."
                label="Fallback behavior"
                onChange={(fallbackBehavior) => onUpdatePlaybook({ fallbackBehavior })}
                options={fallbackBehaviorOptions}
                value={playbook.fallbackBehavior}
              />
            </div>

            <div className="mt-5">
              <FormField
                label="Operator notes"
                hint="Extra business-specific rules. This is sent to the agent as behavior guidance, not shown to the customer."
              >
                <textarea
                  className={textareaClassName}
                  onChange={(event) => onUpdatePlaybook({ notes: event.target.value })}
                  placeholder="Example: If the customer asks for an exact price too early, ask for the service details first."
                  readOnly={isReadOnlyMode}
                  value={playbook.notes ?? ""}
                />
              </FormField>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
