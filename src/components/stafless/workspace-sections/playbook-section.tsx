import { ArrowDown, ArrowUp } from "lucide-react";

import {
  FormField,
  SurfaceCard,
  selectClassName,
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
} from "@/lib/agent-builder";
import { humanizeWorkspaceToken } from "@/components/stafless/workspace-sections/utils";

export function PlaybookSection({
  playbook,
  discoveryFieldLabels,
  isReadOnlyMode,
  onApplyPreset,
  onUpdatePlaybook,
  onToggleDiscoveryField,
  onToggleFieldArray,
  onMoveDiscoveryOrder,
}: {
  playbook: ConversationPlaybookConfig;
  discoveryFieldLabels: Record<DiscoveryField, string>;
  isReadOnlyMode: boolean;
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
  return (
    <SurfaceCard
      className="border-0 bg-transparent p-0 shadow-none"
      title="Conversation Playbook"
      description="Define how this agent opens, qualifies, checks, and advances a conversation toward the business outcome."
    >
      <div className="rounded-[36px] border border-[#ead7c0] bg-[radial-gradient(circle_at_top_left,#fffdf8_0%,#f8eee0_45%,#f4e7d6_100%)] p-6 shadow-[0_24px_54px_rgba(49,31,18,0.08)] sm:p-8">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_320px]">
          <div className="rounded-[28px] bg-[#201627] px-6 py-6 text-[#f7efe4] shadow-[0_20px_40px_rgba(31,23,40,0.18)]">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#d4c4af]">
              Playbook direction
            </p>
            <h3 className="mt-3 text-2xl font-semibold tracking-tight text-white">
              Shape the conversation spine before the business details.
            </h3>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#ddd0bf]">
              Decide what the agent asks first, what it must know before checking anything, and
              how it turns a reply into a real next step.
            </p>
          </div>
          <div className="rounded-[28px] bg-white/82 p-5 ring-1 ring-[#e8d8c6] shadow-[0_18px_34px_rgba(31,23,40,0.05)]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#887560]">
              Operator note
            </p>
            <p className="mt-3 text-sm leading-7 text-[#4a3d33]">
              Keep this universal. Use playbook rules for conversation logic and leave business
              facts for knowledge blocks.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-5 xl:grid-cols-4">
          <FormField
            label="Playbook preset"
            hint="Start from a reusable conversation pattern, then tailor it to the business."
          >
            <select
              className={selectClassName}
              disabled={isReadOnlyMode}
              onChange={(event) =>
                onApplyPreset(event.target.value as ConversationPlaybookConfig["preset"])
              }
              value={playbook.preset}
            >
              {conversationPlaybookPresetOptions.map((option) => (
                <option key={option} value={option}>
                  {humanizeWorkspaceToken(option)}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Primary goal">
            <select
              className={selectClassName}
              disabled={isReadOnlyMode}
              onChange={(event) =>
                onUpdatePlaybook({
                  primaryGoal: event.target.value as ConversationPlaybookConfig["primaryGoal"],
                })
              }
              value={playbook.primaryGoal}
            >
              {playbookGoalOptions.map((option) => (
                <option key={option} value={option}>
                  {humanizeWorkspaceToken(option)}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Success action">
            <select
              className={selectClassName}
              disabled={isReadOnlyMode}
              onChange={(event) =>
                onUpdatePlaybook({
                  successAction: event.target.value as ConversationPlaybookConfig["successAction"],
                })
              }
              value={playbook.successAction}
            >
              {successActionOptions.map((option) => (
                <option key={option} value={option}>
                  {humanizeWorkspaceToken(option)}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Opening strategy">
            <select
              className={selectClassName}
              disabled={isReadOnlyMode}
              onChange={(event) =>
                onUpdatePlaybook({
                  openingStrategy: event.target.value as ConversationPlaybookConfig["openingStrategy"],
                })
              }
              value={playbook.openingStrategy}
            >
              {openingStrategyOptions.map((option) => (
                <option key={option} value={option}>
                  {humanizeWorkspaceToken(option)}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <div className="mt-8 rounded-[30px] bg-white/82 p-6 ring-1 ring-[#e8d8c6] shadow-[0_18px_34px_rgba(31,23,40,0.05)]">
          <div className="grid gap-8 2xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8c745b]">
                  Discovery model
                </p>
                <h4 className="mt-2 text-xl font-semibold tracking-tight text-[#2f2330]">
                  What this business needs to learn
                </h4>
                <p className="mt-2 text-sm leading-7 text-[#655446]">
                  Choose the information the agent should collect. Keep this universal and
                  business-shaped, not vertical-hardcoded.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {discoveryFieldOptions.map((field) => {
                  const selected = playbook.discoveryFields.includes(field);

                  return (
                    <label
                      key={field}
                      className={
                        selected
                          ? "flex min-h-[84px] items-start gap-3 rounded-[20px] border border-[#d6a06c] bg-[#fff7ef] px-4 py-4 shadow-[0_8px_18px_rgba(199,92,42,0.08)] transition"
                          : "flex min-h-[84px] items-start gap-3 rounded-[20px] border border-[#eadfcf] bg-[#fffcf8] px-4 py-4 transition hover:border-[#d8c1aa] hover:bg-white"
                      }
                    >
                      <input
                        checked={selected}
                        className="mt-1 size-4"
                        disabled={isReadOnlyMode}
                        onChange={(event) => onToggleDiscoveryField(field, event.target.checked)}
                        type="checkbox"
                      />
                      <div>
                        <p className="text-sm font-semibold text-[#2f2330]">
                          {discoveryFieldLabels[field]}
                        </p>
                        <p className="mt-1.5 text-xs leading-6 text-[#736255]">
                          {selected ? "Included in the discovery model." : "Optional input for this agent."}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[24px] bg-[#fcf7ef] p-5 ring-1 ring-[#eadccc]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8c745b]">
                  Discovery order
                </p>
                <h4 className="mt-2 text-lg font-semibold tracking-tight text-[#2f2330]">
                  Conversation spine
                </h4>
                <p className="mt-2 text-sm leading-7 text-[#655446]">
                  Reorder the selected fields so the agent knows what to collect first.
                </p>
              </div>
              <div className="mt-4 space-y-2.5">
                {playbook.discoveryOrder.map((field, index) => (
                  <div
                    key={field}
                    className="rounded-[18px] bg-white/92 px-4 py-3 ring-1 ring-[#eadccc]"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="flex size-8 items-center justify-center rounded-full bg-[#f4eadc] text-xs font-semibold text-[#6d5c4d] ring-1 ring-[#eadccc]">
                          {index + 1}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[#2f2330]">
                            {discoveryFieldLabels[field]}
                          </p>
                          <p className="text-xs leading-5 text-[#7a685b]">
                            Collected at step {index + 1}
                          </p>
                        </div>
                      </div>
                      {!isReadOnlyMode ? (
                        <div className="flex gap-2">
                          <button
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#eadccc] bg-[#fff8ef] text-[#5f4b44] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                            disabled={index === 0}
                            onClick={() => onMoveDiscoveryOrder(field, -1)}
                            type="button"
                          >
                            <ArrowUp className="size-4" />
                          </button>
                          <button
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#eadccc] bg-[#fff8ef] text-[#5f4b44] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                            disabled={index === playbook.discoveryOrder.length - 1}
                            onClick={() => onMoveDiscoveryOrder(field, 1)}
                            type="button"
                          >
                            <ArrowDown className="size-4" />
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-[30px] bg-white/82 p-6 ring-1 ring-[#e8d8c6] shadow-[0_18px_34px_rgba(31,23,40,0.05)]">
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8c745b]">
              Collection gates
            </p>
            <h4 className="mt-2 text-xl font-semibold tracking-tight text-[#2f2330]">
              What must be known before the agent moves
            </h4>
            <p className="mt-2 text-sm leading-7 text-[#655446]">
              Define the opening asks and the minimum context required before availability checks
              or pricing.
            </p>
          </div>
          <div className="grid gap-6 xl:grid-cols-3">
            {[
              {
                key: "openingFields" as const,
                title: "Opening fields",
                hint: "What the agent tries to collect in the first reply.",
              },
              {
                key: "minInfoBeforeAvailability" as const,
                title: "Minimum info before availability",
                hint: "Do not check availability before these are known.",
              },
              {
                key: "minInfoBeforePricing" as const,
                title: "Minimum info before pricing",
                hint: "Only send pricing after this much context is collected.",
              },
            ].map((group) => (
              <div
                key={group.key}
                className="rounded-[24px] bg-white/82 p-5 ring-1 ring-[#e8d8c6] shadow-[0_18px_34px_rgba(31,23,40,0.05)]"
              >
                <p className="text-sm font-semibold text-[#2f2330]">{group.title}</p>
                <p className="mt-2 text-sm leading-6 text-[#6c5a4b]">{group.hint}</p>
                <div className="mt-4 space-y-2">
                  {playbook.discoveryFields.map((field) => (
                    <label
                      key={`${group.key}-${field}`}
                      className="flex items-center gap-3 rounded-[14px] px-2 py-2 hover:bg-[#faf5ee]"
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
                      <span className="text-sm text-[#3c302f]">{discoveryFieldLabels[field]}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 rounded-[30px] bg-white/82 p-6 ring-1 ring-[#e8d8c6] shadow-[0_18px_34px_rgba(31,23,40,0.05)]">
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8c745b]">
              Conversation decisions
            </p>
            <h4 className="mt-2 text-xl font-semibold tracking-tight text-[#2f2330]">
              How the runtime should move the conversation
            </h4>
            <p className="mt-2 text-sm leading-7 text-[#655446]">
              Tell the runtime how this agent should behave after qualification, FAQ answers,
              unavailable slots, and booking intent.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {[
              {
                label: "Pricing behavior",
                value: playbook.pricingBehavior,
                options: pricingBehaviorOptions,
                onChange: (value: string) =>
                  onUpdatePlaybook({
                    pricingBehavior: value as ConversationPlaybookConfig["pricingBehavior"],
                  }),
              },
              {
                label: "If unavailable",
                value: playbook.unavailableBehavior,
                options: unavailableBehaviorOptions,
                onChange: (value: string) =>
                  onUpdatePlaybook({
                    unavailableBehavior: value as ConversationPlaybookConfig["unavailableBehavior"],
                  }),
              },
              {
                label: "Booking behavior",
                value: playbook.bookingBehavior,
                options: bookingBehaviorOptions,
                onChange: (value: string) =>
                  onUpdatePlaybook({
                    bookingBehavior: value as ConversationPlaybookConfig["bookingBehavior"],
                  }),
              },
              {
                label: "After FAQ",
                value: playbook.afterFaqBehavior,
                options: afterFaqBehaviorOptions,
                onChange: (value: string) =>
                  onUpdatePlaybook({
                    afterFaqBehavior: value as ConversationPlaybookConfig["afterFaqBehavior"],
                  }),
              },
              {
                label: "Conversation momentum",
                value: playbook.conversationMomentum,
                options: conversationMomentumOptions,
                onChange: (value: string) =>
                  onUpdatePlaybook({
                    conversationMomentum:
                      value as ConversationPlaybookConfig["conversationMomentum"],
                  }),
              },
              {
                label: "Fallback behavior",
                value: playbook.fallbackBehavior,
                options: fallbackBehaviorOptions,
                onChange: (value: string) =>
                  onUpdatePlaybook({
                    fallbackBehavior: value as ConversationPlaybookConfig["fallbackBehavior"],
                  }),
              },
            ].map((field) => (
              <FormField key={field.label} label={field.label}>
                <select
                  className={selectClassName}
                  disabled={isReadOnlyMode}
                  onChange={(event) => field.onChange(event.target.value)}
                  value={field.value}
                >
                  {field.options.map((option) => (
                    <option key={option} value={option}>
                      {humanizeWorkspaceToken(option)}
                    </option>
                  ))}
                </select>
              </FormField>
            ))}
            <div className="md:col-span-2 xl:col-span-3">
              <FormField
                label="Playbook notes"
                hint="Optional. Use this for business-specific rules, not channel formatting."
              >
                <textarea
                  className={textareaClassName}
                  onChange={(event) => onUpdatePlaybook({ notes: event.target.value })}
                  readOnly={isReadOnlyMode}
                  placeholder="For example: If they ask for balayage, suggest a consultation before quoting exact pricing."
                  value={playbook.notes ?? ""}
                />
              </FormField>
            </div>
          </div>
        </div>
      </div>
    </SurfaceCard>
  );
}
