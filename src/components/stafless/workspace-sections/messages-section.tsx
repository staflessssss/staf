import { ChannelConnection } from "@prisma/client";

import {
  FormField,
  SurfaceCard,
  selectClassName,
  textareaClassName,
} from "@/components/stafless/foundation";
import {
  channelBehaviorPresetOptions,
  ChannelBehaviorConfig,
  ctaStyleOptions,
  emojiUsageOptions,
  followUpOutOfHoursBehaviorOptions,
  followUpSendLimitOptions,
  messageFormatOptions,
  responseLengthOptions,
  tonePaceOptions,
} from "@/lib/agent-builder";
import { humanizeWorkspaceToken } from "@/components/stafless/workspace-sections/utils";

export function WorkspaceMessagesSection({
  selectedChannel,
  channelBehavior,
  isReadOnlyMode,
  onApplyPreset,
  onUpdateChannelBehavior,
  softInfoPanelClassName,
}: {
  selectedChannel: ChannelConnection | null;
  channelBehavior: ChannelBehaviorConfig;
  isReadOnlyMode: boolean;
  onApplyPreset: (
    preset: ChannelBehaviorConfig["preset"],
    channelType: ChannelConnection["type"] | null | undefined,
  ) => void;
  onUpdateChannelBehavior: (patch: Partial<ChannelBehaviorConfig>) => void;
  softInfoPanelClassName: string;
}) {
  return (
    <SurfaceCard
      className="rounded-[30px] bg-[linear-gradient(180deg,#fffefb_0%,#f8efe3_100%)] shadow-[0_16px_34px_rgba(31,23,40,0.05)]"
      title="Messages"
      description="Keep message behavior separate from conversation logic: this section controls presentation, pacing, and delivery posture in the current channel."
    >
      <div className="rounded-[30px] bg-[linear-gradient(180deg,#fffefb_0%,#f8efe3_100%)] p-6 ring-1 ring-[#e6d7c5] shadow-[0_18px_36px_rgba(31,23,40,0.06)] sm:p-7">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_280px]">
          <FormField
            label="Behavior preset"
            hint="Recommended defaults still adapt to the selected channel, but this section owns how replies should feel."
          >
            <select
              className={selectClassName}
              disabled={isReadOnlyMode || !selectedChannel}
              onChange={(event) =>
                onApplyPreset(
                  event.target.value as ChannelBehaviorConfig["preset"],
                  selectedChannel?.type,
                )
              }
              value={channelBehavior.preset}
            >
              {channelBehaviorPresetOptions.map((option) => (
                <option key={option} value={option}>
                  {humanizeWorkspaceToken(option)}
                </option>
              ))}
            </select>
          </FormField>
          <div className="rounded-[24px] bg-[#fff8ef] p-5 ring-1 ring-[#eadccc]">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ccbda8]">
              Message layer
            </p>
            <p className="mt-3 text-sm leading-7 text-[#655446]">
              Playbook answers what the agent should achieve. Messages answers how that reply should arrive: shorter, split, richer, calmer, more direct, or more polished for the active channel.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <FormField label="Response length">
            <select
              className={selectClassName}
              disabled={isReadOnlyMode}
              onChange={(event) =>
                onUpdateChannelBehavior({
                  responseLength: event.target.value as ChannelBehaviorConfig["responseLength"],
                })
              }
              value={channelBehavior.responseLength}
            >
              {responseLengthOptions.map((option) => (
                <option key={option} value={option}>
                  {humanizeWorkspaceToken(option)}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Message format">
            <select
              className={selectClassName}
              disabled={isReadOnlyMode}
              onChange={(event) =>
                onUpdateChannelBehavior({
                  messageFormat: event.target.value as ChannelBehaviorConfig["messageFormat"],
                })
              }
              value={channelBehavior.messageFormat}
            >
              {messageFormatOptions.map((option) => (
                <option key={option} value={option}>
                  {humanizeWorkspaceToken(option)}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Tone pace">
            <select
              className={selectClassName}
              disabled={isReadOnlyMode}
              onChange={(event) =>
                onUpdateChannelBehavior({
                  tonePace: event.target.value as ChannelBehaviorConfig["tonePace"],
                })
              }
              value={channelBehavior.tonePace}
            >
              {tonePaceOptions.map((option) => (
                <option key={option} value={option}>
                  {humanizeWorkspaceToken(option)}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="CTA style">
            <select
              className={selectClassName}
              disabled={isReadOnlyMode}
              onChange={(event) =>
                onUpdateChannelBehavior({
                  ctaStyle: event.target.value as ChannelBehaviorConfig["ctaStyle"],
                })
              }
              value={channelBehavior.ctaStyle}
            >
              {ctaStyleOptions.map((option) => (
                <option key={option} value={option}>
                  {humanizeWorkspaceToken(option)}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Emoji usage">
            <select
              className={selectClassName}
              disabled={isReadOnlyMode}
              onChange={(event) =>
                onUpdateChannelBehavior({
                  emojiUsage: event.target.value as ChannelBehaviorConfig["emojiUsage"],
                })
              }
              value={channelBehavior.emojiUsage}
            >
              {emojiUsageOptions.map((option) => (
                <option key={option} value={option}>
                  {humanizeWorkspaceToken(option)}
                </option>
              ))}
            </select>
          </FormField>
          <FormField
            label="Message buffer delay"
            hint="If several customer messages arrive in a row, the agent waits this many seconds and sends one combined reply."
          >
            <input
              className={selectClassName}
              disabled={isReadOnlyMode}
              min={0}
              onChange={(event) =>
                onUpdateChannelBehavior({
                  bufferDelaySeconds: Number(event.target.value || 0),
                })
              }
              type="number"
              value={channelBehavior.bufferDelaySeconds}
            />
          </FormField>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {[
            {
              key: "useSignature",
              label: "Use signature",
              value: channelBehavior.useSignature,
            },
            {
              key: "useRichFormatting",
              label: "Use rich formatting",
              value: channelBehavior.useRichFormatting,
            },
            {
              key: "allowAttachments",
              label: "Allow attachments",
              value: channelBehavior.allowAttachments,
            },
          ].map((toggle) => (
            <label
              key={toggle.key}
              className="flex items-center gap-3 rounded-[18px] bg-white/80 px-4 py-4 ring-1 ring-[#eadccc]"
            >
              <input
                checked={toggle.value}
                className="size-4"
                disabled={isReadOnlyMode}
                onChange={(event) =>
                  onUpdateChannelBehavior({
                    [toggle.key]: event.target.checked,
                  } as Partial<ChannelBehaviorConfig>)
                }
                type="checkbox"
              />
              <span className="text-sm font-medium text-[#2f2330]">{toggle.label}</span>
            </label>
          ))}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className={softInfoPanelClassName}>
            <p className="text-sm font-semibold text-foreground">What lives here now</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Formatting, split-message posture, CTA energy, emoji policy, signatures, and attachment permission all belong to the message layer now.
            </p>
          </div>
          <div className={softInfoPanelClassName}>
            <p className="text-sm font-semibold text-foreground">What lands next</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Follow-up reminders now live in the message layer too, so delivery timing can evolve without leaking into Playbook or Channel assignment.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-[24px] bg-white/80 p-5 ring-1 ring-[#eadccc]">
          <label className="flex items-center gap-3">
            <input
              checked={channelBehavior.followUpEnabled}
              className="size-4"
              disabled={isReadOnlyMode}
              onChange={(event) =>
                onUpdateChannelBehavior({
                  followUpEnabled: event.target.checked,
                })
              }
              type="checkbox"
            />
            <span className="text-sm font-semibold text-[#2f2330]">
              Delayed follow-up messages
            </span>
          </label>
          <p className="mt-2 text-sm leading-6 text-[#655446]">
            If the customer does not answer the latest assistant message, the agent can send one or more reminder messages after the configured delay.
          </p>

          {channelBehavior.followUpEnabled ? (
            <div className="mt-5 space-y-4">
              {channelBehavior.followUpRules.map((rule, index) => (
                <div
                  key={`follow-up-rule-${index}`}
                  className="rounded-[20px] bg-[#fff8ef] p-4 ring-1 ring-[#eadccc]"
                >
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                    <FormField label="Days">
                      <input
                        className={selectClassName}
                        disabled={isReadOnlyMode}
                        min={0}
                        onChange={(event) =>
                          onUpdateChannelBehavior({
                            followUpRules: channelBehavior.followUpRules.map((item, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...item,
                                    delayDays: Number(event.target.value || 0),
                                  }
                                : item,
                            ),
                          })
                        }
                        type="number"
                        value={rule.delayDays}
                      />
                    </FormField>
                    <FormField label="Hours">
                      <input
                        className={selectClassName}
                        disabled={isReadOnlyMode}
                        max={23}
                        min={0}
                        onChange={(event) =>
                          onUpdateChannelBehavior({
                            followUpRules: channelBehavior.followUpRules.map((item, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...item,
                                    delayHours: Number(event.target.value || 0),
                                  }
                                : item,
                            ),
                          })
                        }
                        type="number"
                        value={rule.delayHours}
                      />
                    </FormField>
                    <FormField label="Minutes">
                      <input
                        className={selectClassName}
                        disabled={isReadOnlyMode}
                        max={59}
                        min={0}
                        onChange={(event) =>
                          onUpdateChannelBehavior({
                            followUpRules: channelBehavior.followUpRules.map((item, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...item,
                                    delayMinutes: Number(event.target.value || 0),
                                  }
                                : item,
                            ),
                          })
                        }
                        type="number"
                        value={rule.delayMinutes}
                      />
                    </FormField>
                    <FormField label="Send limit">
                      <select
                        className={selectClassName}
                        disabled={isReadOnlyMode}
                        onChange={(event) =>
                          onUpdateChannelBehavior({
                            followUpRules: channelBehavior.followUpRules.map((item, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...item,
                                    sendLimit:
                                      event.target.value as ChannelBehaviorConfig["followUpRules"][number]["sendLimit"],
                                  }
                                : item,
                            ),
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
                    <FormField label="Outside work hours">
                      <select
                        className={selectClassName}
                        disabled={isReadOnlyMode}
                        onChange={(event) =>
                          onUpdateChannelBehavior({
                            followUpRules: channelBehavior.followUpRules.map((item, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...item,
                                    outOfHoursBehavior:
                                      event.target.value as ChannelBehaviorConfig["followUpRules"][number]["outOfHoursBehavior"],
                                  }
                                : item,
                            ),
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
                    <FormField
                      label="Instruction"
                      hint="This text becomes the reminder message that will be sent if the customer stays silent."
                    >
                      <textarea
                        className={textareaClassName}
                        onChange={(event) =>
                          onUpdateChannelBehavior({
                            followUpRules: channelBehavior.followUpRules.map((item, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...item,
                                    instruction: event.target.value,
                                  }
                                : item,
                            ),
                          })
                        }
                        readOnly={isReadOnlyMode}
                        placeholder="For example: Just checking in. If you'd like, I can still help with pricing or the next booking step."
                        value={rule.instruction}
                      />
                    </FormField>
                  </div>

                  <div className="mt-4 flex justify-end">
                    <button
                      className="text-sm font-semibold text-[#8d3c31] disabled:opacity-50"
                      disabled={isReadOnlyMode}
                      onClick={() =>
                        onUpdateChannelBehavior({
                          followUpRules: channelBehavior.followUpRules.filter(
                            (_, itemIndex) => itemIndex !== index,
                          ),
                        })
                      }
                      type="button"
                    >
                      Remove rule
                    </button>
                  </div>
                </div>
              ))}

              <button
                className="rounded-full bg-[#efe2d0] px-4 py-2 text-sm font-semibold text-[#4c382f] disabled:opacity-50"
                disabled={isReadOnlyMode}
                onClick={() =>
                  onUpdateChannelBehavior({
                    followUpRules: [
                      ...channelBehavior.followUpRules,
                      {
                        delayDays: 0,
                        delayHours: 4,
                        delayMinutes: 0,
                        sendLimit: "once_per_dialog",
                        outOfHoursBehavior: "send_immediately_ignore_schedule",
                        instruction: "",
                      },
                    ],
                  })
                }
                type="button"
              >
                Add follow-up rule
              </button>
            </div>
          ) : null}
        </div>

        <div className="mt-6">
          <FormField
            label="Message notes"
            hint="Optional. Add delivery-specific rules that should stay separate from business logic."
          >
            <textarea
              className={textareaClassName}
              onChange={(event) => onUpdateChannelBehavior({ notes: event.target.value })}
              readOnly={isReadOnlyMode}
              placeholder="For example: Keep Instagram replies punchy, split longer answers, and avoid a long sign-off."
              value={channelBehavior.notes ?? ""}
            />
          </FormField>
        </div>
      </div>
    </SurfaceCard>
  );
}
