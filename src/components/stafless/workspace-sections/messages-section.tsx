import { Plus, Trash2 } from "lucide-react";

import {
  FormField,
  ToggleSwitch,
  selectClassName,
  secondaryButtonClassName,
  textareaClassName,
} from "@/components/stafless/foundation";
import {
  ChannelBehaviorConfig,
  followUpOutOfHoursBehaviorOptions,
  followUpSendLimitOptions,
  getDefaultFollowUpRuleConfig,
} from "@/lib/agent-config";
import { humanizeWorkspaceToken } from "@/components/stafless/workspace-sections/utils";

const sectionTitleClassName = "text-[18px] font-semibold tracking-[-0.02em] text-[#111827]";
const fieldCardClassName =
  "rounded-[14px] border border-[#dbe3ef] bg-white px-4 py-4 shadow-[0_1px_2px_rgba(16,24,40,0.02)]";
const mutedTextClassName = "text-sm leading-6 text-[#667085]";
const cardHeadingClassName = "text-base font-semibold text-[#111827]";
const compactInputClassName =
  "w-full rounded-[10px] border border-[#dde3ee] bg-white px-3 py-2 text-sm text-[#344054] outline-none transition focus:border-[#6c63ff] focus:ring-4 focus:ring-[#6c63ff]/10 disabled:bg-[#f8fafc] disabled:text-[#98a2b3]";

const bufferDelayOptions = [1, 2, 3, 5, 10, 15, 20, 30, 45, 60];
const hourOptions = Array.from({ length: 24 }, (_, option) => String(option).padStart(2, "0"));
const minuteOptions = ["00", "05", "10", "15", "20", "30", "45", "55"];

const defaultFollowUpInstruction = "Check whether the user still needs help and ask one clear next-step question.";

function createDefaultFollowUpRule() {
  return {
    ...getDefaultFollowUpRuleConfig(),
    instruction: defaultFollowUpInstruction,
  };
}

function getSplitMessagesEnabled(channelBehavior: ChannelBehaviorConfig) {
  return channelBehavior.messageFormat === "split_into_2_3_messages";
}

function getBufferedRepliesEnabled(channelBehavior: ChannelBehaviorConfig) {
  return channelBehavior.bufferDelaySeconds > 0;
}

function getBufferedDelayValue(channelBehavior: ChannelBehaviorConfig) {
  return channelBehavior.bufferDelaySeconds > 0 ? channelBehavior.bufferDelaySeconds : 1;
}

function updateFollowUpRule(
  rules: ChannelBehaviorConfig["followUpRules"],
  index: number,
  patch: Partial<ChannelBehaviorConfig["followUpRules"][number]>,
) {
  return rules.map((rule, ruleIndex) =>
    ruleIndex === index ? { ...rule, ...patch } : rule,
  );
}

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

export function WorkspaceMessagesSection({
  channelBehavior,
  isReadOnlyMode,
  onOpenTest,
  onUpdateChannelBehavior,
}: {
  channelBehavior: ChannelBehaviorConfig;
  isReadOnlyMode: boolean;
  onOpenTest: () => void;
  onUpdateChannelBehavior: (patch: Partial<ChannelBehaviorConfig>) => void;
}) {
  const splitMessagesEnabled = getSplitMessagesEnabled(channelBehavior);
  const bufferedRepliesEnabled = getBufferedRepliesEnabled(channelBehavior);
  const bufferDelayValue = getBufferedDelayValue(channelBehavior);

  return (
    <div className="mx-auto w-full max-w-[720px] space-y-9">
      <section className="space-y-6">
        <div className="flex items-center justify-between gap-4 border-b border-[#e8edf5] pb-5">
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-[#101828]">
            Messages
          </h1>
          <button className={secondaryButtonClassName} onClick={onOpenTest} type="button">
            Test chat
          </button>
        </div>

        <div className="space-y-3">
          <h2 className={sectionTitleClassName}>Message delivery</h2>

          <div className={fieldCardClassName}>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className={cardHeadingClassName}>Split messages</p>
                  <HelpHint label="The agent sends each paragraph as a separate message instead of one long reply." />
                </div>
                <p className={mutedTextClassName}>
                  Send paragraph-based replies as separate messages.
                </p>
              </div>
              <ToggleSwitch
                checked={splitMessagesEnabled}
                disabled={isReadOnlyMode}
                onCheckedChange={(checked) =>
                  onUpdateChannelBehavior({
                    messageFormat: checked ? "split_into_2_3_messages" : "single_message",
                  })
                }
              />
            </div>
          </div>

          <div className={fieldCardClassName}>
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <p className={cardHeadingClassName}>Message buffer</p>
                  <HelpHint label="The agent waits briefly, combines rapid user messages, then sends one answer." />
                </div>
                <ToggleSwitch
                  checked={bufferedRepliesEnabled}
                  disabled={isReadOnlyMode}
                  onCheckedChange={(checked) =>
                    onUpdateChannelBehavior({
                      bufferDelaySeconds: checked ? bufferDelayValue : 0,
                    })
                  }
                />
              </div>
              <p className={mutedTextClassName}>
                Delay replies to combine rapid user messages into one answer.
              </p>
            </div>

            <div className="mt-4">
              <FormField label="Delay in seconds">
                <select
                  className={selectClassName}
                  disabled={isReadOnlyMode || !bufferedRepliesEnabled}
                  onChange={(event) =>
                    onUpdateChannelBehavior({
                      bufferDelaySeconds: Number(event.target.value || 0),
                    })
                  }
                  value={String(bufferDelayValue)}
                >
                  {bufferDelayOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className={sectionTitleClassName}>Follow-up messages</h2>

        <div className={fieldCardClassName}>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className={cardHeadingClassName}>Delayed follow-up</p>
                <HelpHint label="If the user does not answer, the agent sends reminders using the timing and instruction below." />
              </div>
              <p className={mutedTextClassName}>
                Automatically send reminders when the user does not reply.
              </p>
            </div>
            <ToggleSwitch
              checked={channelBehavior.followUpEnabled}
              disabled={isReadOnlyMode}
              onCheckedChange={(checked) =>
                onUpdateChannelBehavior({
                  followUpEnabled: checked,
                  followUpRules:
                    checked && channelBehavior.followUpRules.length === 0
                      ? [createDefaultFollowUpRule()]
                      : channelBehavior.followUpRules,
                })
              }
            />
          </div>
        </div>

        {channelBehavior.followUpEnabled ? (
          <div className={fieldCardClassName}>
            <div className="space-y-4">
              {channelBehavior.followUpRules.map((rule, index) => (
                <div
                  key={`follow-up-rule-${index}`}
                  className="rounded-[12px] border border-[#dbe3ef] bg-white px-4 py-4"
                >
                  <div className="grid gap-3 md:grid-cols-[64px_80px_80px_minmax(0,1fr)_40px]">
                    <FormField label="Days">
                      <input
                        className={compactInputClassName}
                        disabled={isReadOnlyMode}
                        min={0}
                        onChange={(event) =>
                          onUpdateChannelBehavior({
                            followUpRules: updateFollowUpRule(channelBehavior.followUpRules, index, {
                              delayDays: Number(event.target.value || 0),
                            }),
                          })
                        }
                        type="number"
                        value={rule.delayDays}
                      />
                    </FormField>

                    <FormField label="Hours">
                      <select
                        className={compactInputClassName}
                        disabled={isReadOnlyMode}
                        onChange={(event) =>
                          onUpdateChannelBehavior({
                            followUpRules: updateFollowUpRule(channelBehavior.followUpRules, index, {
                              delayHours: Number(event.target.value || 0),
                            }),
                          })
                        }
                        value={String(rule.delayHours).padStart(2, "0")}
                      >
                        {hourOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </FormField>

                    <FormField label="Minutes">
                      <select
                        className={compactInputClassName}
                        disabled={isReadOnlyMode}
                        onChange={(event) =>
                          onUpdateChannelBehavior({
                            followUpRules: updateFollowUpRule(channelBehavior.followUpRules, index, {
                              delayMinutes: Number(event.target.value || 0),
                            }),
                          })
                        }
                        value={String(rule.delayMinutes).padStart(2, "0")}
                      >
                        {minuteOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </FormField>

                    <FormField label="Send limit">
                      <select
                        className={selectClassName}
                        disabled={isReadOnlyMode}
                        onChange={(event) =>
                          onUpdateChannelBehavior({
                            followUpRules: updateFollowUpRule(channelBehavior.followUpRules, index, {
                              sendLimit:
                                event.target.value as ChannelBehaviorConfig["followUpRules"][number]["sendLimit"],
                            }),
                          })
                        }
                        value={rule.sendLimit}
                      >
                        {followUpSendLimitOptions.map((option) => (
                          <option key={option} value={option}>
                            {humanizeWorkspaceToken(option)}
                          </option>
                        ))}
                      </select>
                    </FormField>

                    <div className="flex items-end">
                      <button
                        aria-label={`Delete follow-up rule ${index + 1}`}
                        className="inline-flex size-10 items-center justify-center rounded-[10px] border border-[#e5e7eb] bg-white text-[#f04438] transition hover:bg-[#fff5f4] disabled:opacity-50"
                        disabled={isReadOnlyMode}
                        onClick={() =>
                          onUpdateChannelBehavior({
                            followUpEnabled: channelBehavior.followUpRules.length > 1,
                            followUpRules: channelBehavior.followUpRules.filter(
                              (_, ruleIndex) => ruleIndex !== index,
                            ),
                          })
                        }
                        type="button"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4">
                    <FormField label="Outside schedule behavior">
                      <select
                        className={selectClassName}
                        disabled={isReadOnlyMode}
                        onChange={(event) =>
                          onUpdateChannelBehavior({
                            followUpRules: updateFollowUpRule(channelBehavior.followUpRules, index, {
                              outOfHoursBehavior:
                                event.target.value as ChannelBehaviorConfig["followUpRules"][number]["outOfHoursBehavior"],
                            }),
                          })
                        }
                        value={rule.outOfHoursBehavior}
                      >
                        {followUpOutOfHoursBehaviorOptions.map((option) => (
                          <option key={option} value={option}>
                            {humanizeWorkspaceToken(option)}
                          </option>
                        ))}
                      </select>
                    </FormField>
                  </div>

                  <div className="mt-4">
                    <FormField label="Instruction">
                      <textarea
                        className={textareaClassName}
                        disabled={isReadOnlyMode}
                        onChange={(event) =>
                          onUpdateChannelBehavior({
                            followUpRules: updateFollowUpRule(channelBehavior.followUpRules, index, {
                              instruction: event.target.value,
                            }),
                          })
                        }
                        placeholder="Write the follow-up message instruction"
                        value={rule.instruction}
                      />
                    </FormField>
                  </div>
                </div>
              ))}

              <div className="flex justify-center">
                <button
                  aria-label="Add follow-up rule"
                  className="inline-flex size-9 items-center justify-center rounded-full bg-[#6c63ff] text-white transition hover:bg-[#5b53ea] disabled:opacity-50"
                  disabled={isReadOnlyMode}
                  onClick={() =>
                    onUpdateChannelBehavior({
                      followUpRules: [...channelBehavior.followUpRules, createDefaultFollowUpRule()],
                    })
                  }
                  type="button"
                >
                  <Plus className="size-4" />
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
