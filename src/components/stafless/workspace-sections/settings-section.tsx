import { AgentStatus } from "@prisma/client";

import {
  FormField,
  SurfaceCard,
  inputClassName,
  selectClassName,
} from "@/components/stafless/foundation";
import { AgentSettingsConfig } from "@/lib/agent-builder";
import { getTimezoneOptions } from "@/lib/timezones";

const dayLabels: Record<AgentSettingsConfig["weeklySchedule"][number]["day"], string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

function hasInvalidScheduleWindow(agentSettings: AgentSettingsConfig) {
  return agentSettings.weeklySchedule.some(
    (window) => window.enabled && window.start >= window.end,
  );
}

export function WorkspaceSettingsSection({
  name,
  status,
  agentSettings,
  tenantTimezone,
  onNameChange,
  onStatusChange,
  onAgentSettingsChange,
  sectionCanvasClassName,
  softInfoPanelClassName,
}: {
  name: string;
  status: AgentStatus;
  agentSettings: AgentSettingsConfig;
  tenantTimezone?: string | null;
  onNameChange: (value: string) => void;
  onStatusChange: (status: AgentStatus) => void;
  onAgentSettingsChange: (patch: Partial<AgentSettingsConfig>) => void;
  sectionCanvasClassName: string;
  softInfoPanelClassName: string;
}) {
  const scheduleHasInvalidWindow = hasInvalidScheduleWindow(agentSettings);
  const timezoneOptions = getTimezoneOptions({
    selectedTimezone: agentSettings.timezone,
    tenantTimezone,
  });

  return (
    <SurfaceCard
      className="rounded-[30px] bg-[linear-gradient(180deg,#fffdf9_0%,#f7efe2_100%)] shadow-[0_16px_34px_rgba(31,23,40,0.05)]"
      title="Settings"
      description="Operational identity, launch posture, and default runtime behavior live here."
    >
      <div className={sectionCanvasClassName}>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_320px]">
          <div className="space-y-5">
            <div className="rounded-[22px] bg-white/80 p-5 ring-1 ring-[#eadccc]">
              <div className="grid gap-5 md:grid-cols-2">
                <FormField
                  label="Agent name"
                  hint="Use a business-facing name the operator can scan quickly."
                >
                  <input
                    className={inputClassName}
                    onChange={(event) => onNameChange(event.target.value)}
                    value={name}
                  />
                </FormField>
                <div className="space-y-3">
                  <p className="text-sm font-medium text-foreground">Bot status</p>
                  <label className="flex items-center justify-between rounded-[18px] bg-[#faf3e9] px-4 py-4 text-sm text-foreground ring-1 ring-[#eadccc]">
                    <div>
                      <p className="font-semibold text-foreground">Agent active</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Toggle between live operation and paused posture.
                      </p>
                    </div>
                    <input
                      checked={status === AgentStatus.ACTIVE}
                      onChange={(event) =>
                        onStatusChange(event.target.checked ? AgentStatus.ACTIVE : AgentStatus.PAUSED)
                      }
                      type="checkbox"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="rounded-[22px] bg-white/80 p-5 ring-1 ring-[#eadccc]">
                <label className="flex items-center justify-between gap-4 rounded-[18px] bg-[#faf3e9] px-4 py-4 text-sm text-foreground ring-1 ring-[#eadccc]">
                  <div>
                    <p className="font-semibold text-foreground">Default chat state</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      If enabled, the agent auto-starts new dialogs from the first user message.
                    </p>
                  </div>
                  <input
                    checked={agentSettings.defaultChatEnabled}
                    onChange={(event) =>
                      onAgentSettingsChange({ defaultChatEnabled: event.target.checked })
                    }
                    type="checkbox"
                  />
                </label>
              </div>

              <div className="rounded-[22px] bg-white/80 p-5 ring-1 ring-[#eadccc]">
                <FormField
                  label="Timezone"
                  hint={
                    tenantTimezone
                      ? `Tenant default: ${tenantTimezone}`
                      : "Set the working timezone used for schedule interpretation."
                  }
                >
                  <select
                    className={selectClassName}
                    onChange={(event) =>
                      onAgentSettingsChange({ timezone: event.target.value })
                    }
                    value={agentSettings.timezone}
                  >
                    {timezoneOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>
            </div>

            <div className="rounded-[22px] bg-white/80 p-5 ring-1 ring-[#eadccc]">
              <div className="mb-4 flex items-center justify-between gap-4 rounded-[18px] bg-[#faf3e9] px-4 py-4 ring-1 ring-[#eadccc]">
                <div>
                  <p className="text-sm font-semibold text-foreground">Schedule</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Use this only when the agent should not operate 24/7.
                  </p>
                </div>
                <input
                  checked={agentSettings.scheduleEnabled}
                  onChange={(event) =>
                    onAgentSettingsChange({ scheduleEnabled: event.target.checked })
                  }
                  type="checkbox"
                />
              </div>

              <div className="space-y-3">
                {scheduleHasInvalidWindow ? (
                  <div className="rounded-[18px] border border-[#f0d2c7] bg-[#fff5f1] px-4 py-3 text-sm text-[#7f3f2a]">
                    Each active day must end later than it starts.
                  </div>
                ) : null}
                {agentSettings.weeklySchedule.map((window, index) => (
                  <div
                    key={window.day}
                    className="grid gap-3 rounded-[18px] bg-[#fff9f1] px-4 py-4 ring-1 ring-[#eadccc] md:grid-cols-[84px_100px_minmax(0,1fr)_20px_minmax(0,1fr)] md:items-center"
                  >
                    <p className="text-sm font-semibold text-foreground">{dayLabels[window.day]}</p>
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <input
                        checked={window.enabled}
                        onChange={(event) =>
                          onAgentSettingsChange({
                            weeklySchedule: agentSettings.weeklySchedule.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, enabled: event.target.checked } : item,
                            ),
                          })
                        }
                        type="checkbox"
                      />
                      Active
                    </label>
                    <input
                      className={`${inputClassName} ${!agentSettings.scheduleEnabled || !window.enabled ? "bg-[#f8f3eb]" : ""}`}
                      disabled={!agentSettings.scheduleEnabled || !window.enabled}
                      onChange={(event) =>
                        onAgentSettingsChange({
                          weeklySchedule: agentSettings.weeklySchedule.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, start: event.target.value } : item,
                          ),
                        })
                      }
                      type="time"
                      value={window.start}
                    />
                    <span className="text-center text-sm text-muted-foreground">-</span>
                    <input
                      className={`${inputClassName} ${!agentSettings.scheduleEnabled || !window.enabled ? "bg-[#f8f3eb]" : ""}`}
                      disabled={!agentSettings.scheduleEnabled || !window.enabled}
                      onChange={(event) =>
                        onAgentSettingsChange({
                          weeklySchedule: agentSettings.weeklySchedule.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, end: event.target.value } : item,
                          ),
                        })
                      }
                      type="time"
                      value={window.end}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className={softInfoPanelClassName}>
              <p className="text-sm font-semibold text-foreground">What belongs here</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                <li>Agent identity and live status.</li>
                <li>Whether the agent auto-starts new dialogs.</li>
                <li>Timezone and optional weekly operating schedule.</li>
              </ul>
            </div>
            <div className={softInfoPanelClassName}>
              <p className="text-sm font-semibold text-foreground">What stays elsewhere</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Persona and tone stay in Prompting. Conversation strategy stays in Playbook. Message pacing and follow-up behavior stay in Messages.
              </p>
            </div>
          </div>
        </div>
      </div>
    </SurfaceCard>
  );
}
