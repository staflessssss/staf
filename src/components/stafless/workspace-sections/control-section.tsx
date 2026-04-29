import {
  FormField,
  ToggleSwitch,
  inputClassName,
  selectClassName,
  textareaClassName,
} from "@/components/stafless/foundation";
import { ControlConfig, historyWindowTypeOptions } from "@/lib/agent-config";
import { humanizeWorkspaceToken } from "@/components/stafless/workspace-sections/utils";

const sectionTitleClassName = "text-[18px] font-semibold tracking-[-0.02em] text-[#111827]";
const fieldCardClassName =
  "rounded-[14px] border border-[#dbe3ef] bg-white px-4 py-4 shadow-[0_1px_2px_rgba(16,24,40,0.02)]";
const mutedTextClassName = "text-sm leading-6 text-[#667085]";
const cardHeadingClassName = "text-base font-semibold text-[#111827]";

const maxDayOptions = [
  { value: 1, label: "1 day" },
  { value: 2, label: "2 days" },
  { value: 3, label: "3 days" },
  { value: 5, label: "5 days" },
  { value: 7, label: "1 week" },
  { value: 14, label: "2 weeks" },
  { value: 30, label: "1 month" },
  { value: 90, label: "3 months" },
];

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

function getAntiSpamWindowMinutes(control: ControlConfig) {
  return Math.max(1, Math.round(control.antiSpamWindowSeconds / 60));
}

export function WorkspaceControlSection({
  control,
  isReadOnlyMode,
  onUpdateControl,
}: {
  control: ControlConfig;
  isReadOnlyMode: boolean;
  onUpdateControl: (patch: Partial<ControlConfig>) => void;
}) {
  const messageLimitEnabled =
    control.historyWindowType === "message_count" || control.historyWindowType === "hybrid";
  const timeLimitEnabled =
    control.historyWindowType === "time_window" || control.historyWindowType === "hybrid";
  const antiSpamWindowMinutes = getAntiSpamWindowMinutes(control);

  return (
    <div className="mx-auto w-full max-w-[720px] space-y-9">
      <section className="space-y-6">
        <div className="border-b border-[#e8edf5] pb-5">
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-[#101828]">
            Control
          </h1>
        </div>

        <div className="space-y-3">
          <h2 className={sectionTitleClassName}>History optimization</h2>

          <div className={fieldCardClassName}>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className={cardHeadingClassName}>History window</p>
                <HelpHint label="Controls which previous messages are passed into the model before it replies." />
              </div>
              <p className={mutedTextClassName}>
                Limit the conversation history the agent uses for each answer.
              </p>
            </div>

            <div className="mt-4">
              <FormField label="Mode">
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
            </div>
          </div>

          <div className={fieldCardClassName}>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className={cardHeadingClassName}>Message count limit</p>
                <HelpHint label="The agent focuses on the latest messages so long conversations do not confuse the answer." />
              </div>
              <p className={mutedTextClassName}>
                The agent uses only the latest messages in the dialog.
              </p>
            </div>

            <div className="mt-4">
              <FormField label="Number of messages">
                <input
                  className={inputClassName}
                  disabled={isReadOnlyMode || !messageLimitEnabled}
                  min={1}
                  onChange={(event) =>
                    onUpdateControl({
                      maxMessages: Number(event.target.value || 0),
                    })
                  }
                  type="number"
                  value={control.maxMessages}
                />
              </FormField>
            </div>
          </div>

          <div className={fieldCardClassName}>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className={cardHeadingClassName}>Time limit</p>
                <HelpHint label="Old messages are ignored when they fall outside the selected window." />
              </div>
              <p className={mutedTextClassName}>
                The agent uses only recent dialog history.
              </p>
            </div>

            <div className="mt-4">
              <FormField label="Time window">
                <select
                  className={selectClassName}
                  disabled={isReadOnlyMode || !timeLimitEnabled}
                  onChange={(event) =>
                    onUpdateControl({
                      maxDays: Number(event.target.value || 1),
                    })
                  }
                  value={String(control.maxDays)}
                >
                  {maxDayOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className={sectionTitleClassName}>User message limit</h2>

        <div className={fieldCardClassName}>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className={cardHeadingClassName}>Limit repeated messages</p>
                <HelpHint label="If the user reaches the configured number of messages during the selected period, the agent stops answering that user until the period expires." />
              </div>
              <p className={mutedTextClassName}>
                Protect the agent from repeated or mass user messages.
              </p>
            </div>
            <ToggleSwitch
              checked={control.antiSpamEnabled}
              disabled={isReadOnlyMode}
              onCheckedChange={(checked) =>
                onUpdateControl({
                  antiSpamEnabled: checked,
                })
              }
            />
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <FormField label="Message count">
              <input
                className={inputClassName}
                disabled={isReadOnlyMode || !control.antiSpamEnabled}
                min={1}
                onChange={(event) =>
                  onUpdateControl({
                    antiSpamMessageCount: Number(event.target.value || 0),
                  })
                }
                type="number"
                value={control.antiSpamMessageCount}
              />
            </FormField>

            <FormField label="Duration in minutes">
              <input
                className={inputClassName}
                disabled={isReadOnlyMode || !control.antiSpamEnabled}
                min={1}
                onChange={(event) =>
                  onUpdateControl({
                    antiSpamWindowSeconds: Number(event.target.value || 0) * 60,
                  })
                }
                type="number"
                value={antiSpamWindowMinutes}
              />
            </FormField>
          </div>

          <div className="mt-4">
            <FormField
              label="Limit response message"
              hint="Optional. If this is empty, the agent silently ignores messages after the limit until the duration expires."
            >
              <textarea
                className={textareaClassName}
                disabled={isReadOnlyMode || !control.antiSpamEnabled}
                onChange={(event) =>
                  onUpdateControl({
                    antiSpamAutoReply: event.target.value,
                  })
                }
                placeholder="Write the message the user receives after the limit"
                value={control.antiSpamAutoReply ?? ""}
              />
            </FormField>
          </div>
        </div>
      </section>
    </div>
  );
}
