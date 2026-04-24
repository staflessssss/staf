import { AgentSettingsConfig } from "@/lib/agent-builder";

const weekdayMap: Record<string, AgentSettingsConfig["weeklySchedule"][number]["day"]> = {
  monday: "monday",
  tuesday: "tuesday",
  wednesday: "wednesday",
  thursday: "thursday",
  friday: "friday",
  saturday: "saturday",
  sunday: "sunday",
};

export function getCurrentScheduleSlot(timezone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const weekday = parts.find((part) => part.type === "weekday")?.value.toLowerCase() ?? "";
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";

  return {
    day: weekdayMap[weekday],
    time: `${hour}:${minute}`,
  };
}

export function isWithinAgentSchedule(agentSettings: AgentSettingsConfig, now = new Date()) {
  if (!agentSettings.scheduleEnabled) {
    return true;
  }

  const currentSlot = getCurrentScheduleSlot(agentSettings.timezone, now);
  const dayWindow = agentSettings.weeklySchedule.find((window) => window.day === currentSlot.day);

  if (!dayWindow?.enabled) {
    return false;
  }

  return currentSlot.time >= dayWindow.start && currentSlot.time < dayWindow.end;
}

export function findNextAgentScheduleWindowStart(
  agentSettings: AgentSettingsConfig,
  from = new Date(),
) {
  if (!agentSettings.scheduleEnabled) {
    return from;
  }

  const cursor = new Date(from.getTime());
  cursor.setSeconds(0, 0);
  cursor.setMinutes(cursor.getMinutes() + 1);

  for (let minute = 0; minute < 7 * 24 * 60; minute += 1) {
    if (isWithinAgentSchedule(agentSettings, cursor)) {
      return cursor;
    }

    cursor.setMinutes(cursor.getMinutes() + 1);
  }

  return null;
}
