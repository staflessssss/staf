import { AgentStatus } from "@prisma/client";
import { Bot, CircleAlert, CircleQuestionMark } from "lucide-react";

import {
  FormField,
  ToggleSwitch,
  inputClassName,
  selectClassName,
} from "@/components/stafless/foundation";
import { AgentSettingsConfig } from "@/lib/agent-config";
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

const sectionTitleClassName = "text-[18px] font-semibold tracking-[-0.02em] text-[#111827]";
const settingRowClassName =
  "rounded-[14px] border border-[#dbe3ef] bg-white px-4 py-4 shadow-[0_1px_2px_rgba(16,24,40,0.02)]";
const disabledFieldClassName = "bg-[#f8fafc] text-muted-foreground";
const mutedTextClassName = "text-sm leading-6 text-[#667085]";
const cardHeadingClassName = "text-base font-semibold text-[#111827]";
const scheduleTimeInputClassName =
  "w-full rounded-[10px] border border-[#dde3ee] bg-white px-3 py-2 text-center text-sm text-[#344054] outline-none transition focus:border-[#6c63ff] focus:ring-4 focus:ring-[#6c63ff]/10 disabled:bg-[#f8fafc] disabled:text-[#98a2b3]";

export function hasInvalidScheduleWindow(agentSettings: AgentSettingsConfig) {
  if (!agentSettings.scheduleEnabled) {
    return false;
  }

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
}: {
  name: string;
  status: AgentStatus;
  agentSettings: AgentSettingsConfig;
  tenantTimezone?: string | null;
  onNameChange: (value: string) => void;
  onStatusChange: (status: AgentStatus) => void;
  onAgentSettingsChange: (patch: Partial<AgentSettingsConfig>) => void;
}) {
  const scheduleHasInvalidWindow = hasInvalidScheduleWindow(agentSettings);
  const timezoneOptions = getTimezoneOptions({
    selectedTimezone: agentSettings.timezone,
    tenantTimezone,
  });
  const agentIsActive = status === AgentStatus.ACTIVE;
  const canToggleBotStatus = status === AgentStatus.ACTIVE || status === AgentStatus.PAUSED;
  const nonOperationalStatusLabel = status.toLowerCase().replace(/_/g, " ");

  return (
    <div className="mx-auto w-full max-w-[720px] space-y-9">
      <section className="space-y-6">
        <div className="flex items-start justify-between gap-4 border-b border-[#e8edf5] pb-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-[18px] font-semibold tracking-[-0.02em] text-[#101828]">
                Settings
              </h1>
              <CircleQuestionMark className="size-4 text-[#98a2b3]" />
            </div>
            <p className="mt-2 max-w-[560px] text-sm leading-6 text-[#667085]">
              Configure the agent identity, activation state, timezone, and weekly work schedule.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className={sectionTitleClassName}>General settings</h2>

          <div className={settingRowClassName}>
            <div className="flex items-start gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-[12px] border border-[#e6ebf2] bg-[#f8fafc] text-[#344054]">
                <Bot className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <FormField label="Name">
                  <input
                    className={inputClassName}
                    onChange={(event) => onNameChange(event.target.value)}
                    value={name}
                  />
                </FormField>
              </div>
            </div>
          </div>

          <div className={settingRowClassName}>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className={cardHeadingClassName}>Bot status</p>
                <p className={mutedTextClassName}>
                  {canToggleBotStatus
                    ? "Activate or pause this agent for incoming dialogs."
                    : `Current status is ${nonOperationalStatusLabel}; pause and resume become available when the agent is operational.`}
                </p>
              </div>
              <ToggleSwitch
                checked={agentIsActive}
                disabled={!canToggleBotStatus}
                onCheckedChange={(checked) =>
                  onStatusChange(checked ? AgentStatus.ACTIVE : AgentStatus.PAUSED)
                }
              />
            </div>
          </div>

          <div className={settingRowClassName}>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className={cardHeadingClassName}>Default chat state</p>
                <p className={mutedTextClassName}>
                  New dialogs will start enabled by default when this toggle is on.
                </p>
              </div>
              <ToggleSwitch
                checked={agentSettings.defaultChatEnabled}
                onCheckedChange={(checked) =>
                  onAgentSettingsChange({ defaultChatEnabled: checked })
                }
              />
            </div>
          </div>

          <div className={settingRowClassName}>
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
                onChange={(event) => onAgentSettingsChange({ timezone: event.target.value })}
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
      </section>

      <section className="space-y-3">
        <h2 className={sectionTitleClassName}>Schedule</h2>

        <div className={settingRowClassName}>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className={cardHeadingClassName}>Enable schedule</p>
              <p className={mutedTextClassName}>
                Configure automatic activation windows for this agent.
              </p>
              <p className={mutedTextClassName}>
                Selected times are interpreted in the agent timezone.
              </p>
            </div>
            <ToggleSwitch
              checked={agentSettings.scheduleEnabled}
              onCheckedChange={(checked) =>
                onAgentSettingsChange({ scheduleEnabled: checked })
              }
            />
          </div>

          {scheduleHasInvalidWindow ? (
            <div className="mt-4 rounded-[12px] border border-[#f0d2c7] bg-[#fff5f1] px-4 py-3 text-sm text-[#7f3f2a]">
              <div className="flex items-start gap-3">
                <CircleAlert className="mt-0.5 size-4 shrink-0" />
                <span>Each active day must end later than it starts.</span>
              </div>
            </div>
          ) : null}

          <div className="mt-5 space-y-3">
            {agentSettings.weeklySchedule.map((window, index) => (
              <div
                key={window.day}
                className="rounded-[12px] border border-[#e5e7eb] bg-white px-4 py-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-[#111827]">{dayLabels[window.day]}</p>
                    <p className="text-sm text-[#667085]">Active day window</p>
                  </div>
                  <ToggleSwitch
                    checked={window.enabled}
                    disabled={!agentSettings.scheduleEnabled}
                    onCheckedChange={(checked) =>
                      onAgentSettingsChange({
                        weeklySchedule: agentSettings.weeklySchedule.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, enabled: checked } : item,
                        ),
                      })
                    }
                  />
                </div>

                <div className="mt-4 flex items-center gap-4">
                  <input
                    className={`${scheduleTimeInputClassName} ${!agentSettings.scheduleEnabled || !window.enabled ? disabledFieldClassName : ""}`}
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

                  <span className="text-[#667085]">to</span>

                  <input
                    className={`${scheduleTimeInputClassName} ${!agentSettings.scheduleEnabled || !window.enabled ? disabledFieldClassName : ""}`}
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
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
