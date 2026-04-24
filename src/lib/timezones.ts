export type TimezoneOption = {
  value: string;
  label: string;
};

let cachedTimezoneOptions:
  | {
      cacheKey: string;
      options: TimezoneOption[];
    }
  | null = null;

function normalizeOffsetLabel(label: string) {
  if (!label || label === "GMT" || label === "UTC") {
    return "GMT+0";
  }

  return label.replace("UTC", "GMT");
}

function getOffsetLabel(timezone: string, now = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "shortOffset",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now);
    const offset = parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT+0";

    return normalizeOffsetLabel(offset);
  } catch {
    return "GMT+0";
  }
}

export function isValidTimezone(value: string) {
  try {
    Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function getSupportedTimezones() {
  if (typeof Intl.supportedValuesOf === "function") {
    return Intl.supportedValuesOf("timeZone");
  }

  return ["UTC"];
}

export function getTimezoneDisplayLabel(timezone: string, now = new Date()) {
  return `${timezone} ${getOffsetLabel(timezone, now)}`;
}

export function getTimezoneOptions(args?: {
  selectedTimezone?: string | null;
  tenantTimezone?: string | null;
  now?: Date;
}) {
  const now = args?.now ?? new Date();
  const cacheKey = now.toISOString().slice(0, 10);

  if (!cachedTimezoneOptions || cachedTimezoneOptions.cacheKey !== cacheKey) {
    cachedTimezoneOptions = {
      cacheKey,
      options: getSupportedTimezones()
        .sort((left, right) => left.localeCompare(right))
        .map((timezone): TimezoneOption => ({
          value: timezone,
          label: getTimezoneDisplayLabel(timezone, now),
        })),
    };
  }

  const optionsMap = new Map(
    cachedTimezoneOptions.options.map((option) => [option.value, option] as const),
  );

  for (const candidate of [args?.selectedTimezone, args?.tenantTimezone, "UTC"]) {
    if (typeof candidate === "string" && candidate.trim() && isValidTimezone(candidate.trim())) {
      optionsMap.set(candidate.trim(), {
        value: candidate.trim(),
        label: getTimezoneDisplayLabel(candidate.trim(), now),
      });
    }
  }

  return [...optionsMap.values()]
    .sort((left, right) => left.value.localeCompare(right.value))
    .map((option) => option);
}
