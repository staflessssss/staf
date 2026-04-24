import {
  FormField,
  SurfaceCard,
  inputClassName,
  selectClassName,
  textareaClassName,
} from "@/components/stafless/foundation";
import {
  autoResumeUnitOptions,
  ControlConfig,
  historyWindowTypeOptions,
} from "@/lib/agent-builder";
import { humanizeWorkspaceToken } from "@/components/stafless/workspace-sections/utils";

export function WorkspaceControlSection({
  control,
  isReadOnlyMode,
  onUpdateControl,
  softInfoPanelClassName,
}: {
  control: ControlConfig;
  isReadOnlyMode: boolean;
  onUpdateControl: (patch: Partial<ControlConfig>) => void;
  softInfoPanelClassName: string;
}) {
  return (
    <SurfaceCard
      className="rounded-[30px] bg-[linear-gradient(180deg,#fffefb_0%,#f8efe3_100%)] shadow-[0_16px_34px_rgba(31,23,40,0.05)]"
      title="Control"
      description="Give the runtime explicit operating limits: how much history to use, how operator intervention pauses the agent, and which phrases stop or resume automation."
    >
      <div className="rounded-[30px] bg-[linear-gradient(180deg,#fffefb_0%,#f8efe3_100%)] p-6 ring-1 ring-[#e6d7c5] shadow-[0_18px_36px_rgba(31,23,40,0.06)] sm:p-7">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className={softInfoPanelClassName}>
            <p className="text-sm font-semibold text-foreground">Runtime boundary</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Control is where we stop mixing conversation logic, message presentation, and runtime safety. This section sets operator rules that future channels and functions can rely on consistently.
            </p>
          </div>
          <div className={softInfoPanelClassName}>
            <p className="text-sm font-semibold text-foreground">What lands here now</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              History policy, operator pause behavior, anti-spam posture, auto-resume, and stop/resume phrases are stored as structured config instead of implied rules.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-2">
          <div className="rounded-[20px] bg-[#f5fff7] px-4 py-4 ring-1 ring-[#cfe7d5]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#4f7a58]">
              Enforced today
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              History windowing and anti-spam already change live runtime behavior.
            </p>
          </div>
          <div className="rounded-[20px] bg-[#fff8f1] px-4 py-4 ring-1 ring-[#ead9c7]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8c745b]">
              Policy layer next
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Operator intervention, auto-resume, and stop/resume phrases are saved now and already shape control policy instructions, with hard runtime enforcement landing in the handoff layer.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-[24px] bg-white/82 p-5 ring-1 ring-[#e8d8c6] shadow-[0_18px_34px_rgba(31,23,40,0.05)]">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8c745b]">History policy</p>
          <p className="mt-2 text-sm text-muted-foreground">Enforced in runtime now.</p>
          <div className="mt-4 grid gap-5 md:grid-cols-3">
            <FormField label="History window">
              <select
                className={selectClassName}
                disabled={isReadOnlyMode}
                onChange={(event) =>
                  onUpdateControl({
                    historyWindowType: event.target.value as ControlConfig["historyWindowType"],
                  })
                }
                value={control.historyWindowType}
              >
                {historyWindowTypeOptions.map((option) => (
                  <option key={option} value={option}>
                    {humanizeWorkspaceToken(option)}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Max messages">
              <input
                className={inputClassName}
                inputMode="numeric"
                onChange={(event) =>
                  onUpdateControl({
                    maxMessages: Number(event.target.value || 0),
                  })
                }
                readOnly={isReadOnlyMode}
                value={control.maxMessages}
              />
            </FormField>
            <FormField label="Max days">
              <input
                className={inputClassName}
                inputMode="numeric"
                onChange={(event) =>
                  onUpdateControl({
                    maxDays: Number(event.target.value || 0),
                  })
                }
                readOnly={isReadOnlyMode}
                value={control.maxDays}
              />
            </FormField>
          </div>
        </div>

        <div className="mt-6 rounded-[24px] bg-white/82 p-5 ring-1 ring-[#e8d8c6] shadow-[0_18px_34px_rgba(31,23,40,0.05)]">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8c745b]">Operator intervention</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Saved today, with full runtime enforcement landing alongside operator handoff state.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {[
              {
                key: "pauseOnOperatorIntervention",
                label: "Pause when operator replies",
                value: control.pauseOnOperatorIntervention,
              },
              {
                key: "ignoreFirstOperatorMessage",
                label: "Ignore first operator message",
                value: control.ignoreFirstOperatorMessage,
              },
              {
                key: "autoResumeEnabled",
                label: "Auto resume after handoff",
                value: control.autoResumeEnabled,
              },
              {
                key: "resumeMessageEnabled",
                label: "Send message on resume",
                value: control.resumeMessageEnabled,
              },
            ].map((toggle) => (
              <label
                key={toggle.key}
                className="flex items-center gap-3 rounded-[18px] bg-[#fff9f1] px-4 py-4 ring-1 ring-[#eadccc]"
              >
                <input
                  checked={toggle.value}
                  className="size-4"
                  disabled={isReadOnlyMode}
                  onChange={(event) =>
                    onUpdateControl({
                      [toggle.key]: event.target.checked,
                    } as Partial<ControlConfig>)
                  }
                  type="checkbox"
                />
                <span className="text-sm font-medium text-[#2f2330]">{toggle.label}</span>
              </label>
            ))}
          </div>
          <div className="mt-5 grid gap-5 md:grid-cols-[1fr_180px]">
            <FormField label="Auto resume after">
              <input
                className={inputClassName}
                inputMode="numeric"
                onChange={(event) =>
                  onUpdateControl({
                    autoResumeAfterValue: Number(event.target.value || 0),
                  })
                }
                readOnly={isReadOnlyMode}
                value={control.autoResumeAfterValue}
              />
            </FormField>
            <FormField label="Unit">
              <select
                className={selectClassName}
                disabled={isReadOnlyMode}
                onChange={(event) =>
                  onUpdateControl({
                    autoResumeAfterUnit: event.target.value as ControlConfig["autoResumeAfterUnit"],
                  })
                }
                value={control.autoResumeAfterUnit}
              >
                {autoResumeUnitOptions.map((option) => (
                  <option key={option} value={option}>
                    {humanizeWorkspaceToken(option)}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
          <div className="mt-5">
            <FormField
              label="Resume message"
              hint="Optional. If enabled, the agent can send this when it automatically resumes after operator intervention."
            >
              <textarea
                className={textareaClassName}
                onChange={(event) =>
                  onUpdateControl({
                    resumeMessage: event.target.value,
                  })
                }
                readOnly={isReadOnlyMode}
                value={control.resumeMessage ?? ""}
              />
            </FormField>
          </div>
        </div>

        <div className="mt-6 rounded-[24px] bg-white/82 p-5 ring-1 ring-[#e8d8c6] shadow-[0_18px_34px_rgba(31,23,40,0.05)]">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8c745b]">Anti-spam</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Enforced in runtime now, including a cooldown so the same calming auto-reply does not fire repeatedly in one burst.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <label className="flex items-center gap-3 rounded-[18px] bg-[#fff9f1] px-4 py-4 ring-1 ring-[#eadccc]">
              <input
                checked={control.antiSpamEnabled}
                className="size-4"
                disabled={isReadOnlyMode}
                onChange={(event) =>
                  onUpdateControl({
                    antiSpamEnabled: event.target.checked,
                  })
                }
                type="checkbox"
              />
              <span className="text-sm font-medium text-[#2f2330]">Enable anti-spam</span>
            </label>
            <FormField label="Message burst threshold">
              <input
                className={inputClassName}
                inputMode="numeric"
                onChange={(event) =>
                  onUpdateControl({
                    antiSpamMessageCount: Number(event.target.value || 0),
                  })
                }
                readOnly={isReadOnlyMode}
                value={control.antiSpamMessageCount}
              />
            </FormField>
            <FormField label="Window (seconds)">
              <input
                className={inputClassName}
                inputMode="numeric"
                onChange={(event) =>
                  onUpdateControl({
                    antiSpamWindowSeconds: Number(event.target.value || 0),
                  })
                }
                readOnly={isReadOnlyMode}
                value={control.antiSpamWindowSeconds}
              />
            </FormField>
          </div>
          <div className="mt-5">
            <FormField
              label="Anti-spam auto-reply"
              hint="Optional. If anti-spam is enabled, this can be used as the operator-facing response during a pause."
            >
              <textarea
                className={textareaClassName}
                onChange={(event) =>
                  onUpdateControl({
                    antiSpamAutoReply: event.target.value,
                  })
                }
                readOnly={isReadOnlyMode}
                value={control.antiSpamAutoReply ?? ""}
              />
            </FormField>
          </div>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <FormField
            label="Stop phrases"
            hint="One phrase per line. Stored now and already reflected in control policy instructions; hard stop-state handling lands with the conversation-control slice."
          >
            <textarea
              className={textareaClassName}
              onChange={(event) =>
                onUpdateControl({
                  stopPhrases: event.target.value
                    .split(/\r?\n/)
                    .map((line) => line.trim())
                    .filter(Boolean),
                })
              }
              readOnly={isReadOnlyMode}
              value={control.stopPhrases.join("\n")}
            />
          </FormField>
          <FormField
            label="Resume phrases"
            hint="One phrase per line. Stored now and reflected in control policy instructions; hard resume-state handling lands with the conversation-control slice."
          >
            <textarea
              className={textareaClassName}
              onChange={(event) =>
                onUpdateControl({
                  resumePhrases: event.target.value
                    .split(/\r?\n/)
                    .map((line) => line.trim())
                    .filter(Boolean),
                })
              }
              readOnly={isReadOnlyMode}
              value={control.resumePhrases.join("\n")}
            />
          </FormField>
        </div>
      </div>
    </SurfaceCard>
  );
}
