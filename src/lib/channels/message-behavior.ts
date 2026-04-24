type FollowUpSendLimit =
  | "once_per_dialog"
  | "up_to_2_times_per_dialog"
  | "up_to_3_times_per_dialog";

type FollowUpOutOfHoursBehavior =
  | "send_immediately_ignore_schedule"
  | "wait_for_schedule_window"
  | "skip_follow_up";

type FollowUpRuleConfig = {
  delayDays: number;
  delayHours: number;
  delayMinutes: number;
  sendLimit: FollowUpSendLimit;
  outOfHoursBehavior: FollowUpOutOfHoursBehavior;
  instruction: string;
};

function asObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function asFollowUpRule(value: unknown): FollowUpRuleConfig | null {
  const parsed = asObject(value);

  if (!parsed) {
    return null;
  }

  const delayDays =
    typeof parsed.delayDays === "number" && Number.isFinite(parsed.delayDays)
      ? Math.max(0, Math.floor(parsed.delayDays))
      : 0;
  const delayHours =
    typeof parsed.delayHours === "number" && Number.isFinite(parsed.delayHours)
      ? Math.max(0, Math.min(23, Math.floor(parsed.delayHours)))
      : 0;
  const delayMinutes =
    typeof parsed.delayMinutes === "number" && Number.isFinite(parsed.delayMinutes)
      ? Math.max(0, Math.min(59, Math.floor(parsed.delayMinutes)))
      : 0;
  const sendLimit =
    parsed.sendLimit === "up_to_2_times_per_dialog" ||
    parsed.sendLimit === "up_to_3_times_per_dialog"
      ? parsed.sendLimit
      : "once_per_dialog";
  const outOfHoursBehavior =
    parsed.outOfHoursBehavior === "wait_for_schedule_window" ||
    parsed.outOfHoursBehavior === "skip_follow_up"
      ? parsed.outOfHoursBehavior
      : "send_immediately_ignore_schedule";
  const instruction =
    typeof parsed.instruction === "string" ? parsed.instruction.trim() : "";

  if (delayDays + delayHours + delayMinutes <= 0 || !instruction) {
    return null;
  }

  return {
    delayDays,
    delayHours,
    delayMinutes,
    sendLimit,
    outOfHoursBehavior,
    instruction,
  };
}

export function readMessageBehaviorConfig(config: unknown) {
  const parsed = asObject(config);
  const channelBehavior = asObject(parsed?.channelBehavior);

  return {
    messageFormat:
      channelBehavior?.messageFormat === "split_into_2_3_messages"
        ? "split_into_2_3_messages"
        : "single_message",
    allowAttachments:
      typeof channelBehavior?.allowAttachments === "boolean"
        ? channelBehavior.allowAttachments
        : false,
    bufferDelaySeconds:
      typeof channelBehavior?.bufferDelaySeconds === "number" &&
      Number.isFinite(channelBehavior.bufferDelaySeconds)
        ? Math.max(0, Math.min(300, Math.floor(channelBehavior.bufferDelaySeconds)))
        : 0,
    followUpEnabled:
      typeof channelBehavior?.followUpEnabled === "boolean"
        ? channelBehavior.followUpEnabled
        : false,
    followUpRules: Array.isArray(channelBehavior?.followUpRules)
      ? channelBehavior.followUpRules
          .map((rule) => asFollowUpRule(rule))
          .filter((rule): rule is FollowUpRuleConfig => Boolean(rule))
      : [],
  };
}

export function splitOutgoingMessage(text: string, config: unknown) {
  const behavior = readMessageBehaviorConfig(config);
  const normalized = text.trim();

  if (!normalized) {
    return "";
  }

  if (behavior.messageFormat !== "split_into_2_3_messages") {
    return normalized;
  }

  const parts = normalized
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length <= 1) {
    return normalized;
  }

  if (parts.length <= 3) {
    return parts;
  }

  return [parts[0] ?? "", parts[1] ?? "", parts.slice(2).join("\n\n")].filter(Boolean);
}

export function getFollowUpSendLimitCount(sendLimit: FollowUpSendLimit | string) {
  switch (sendLimit) {
    case "up_to_2_times_per_dialog":
      return 2;
    case "up_to_3_times_per_dialog":
      return 3;
    case "once_per_dialog":
    default:
      return 1;
  }
}

export function getFollowUpDelayMs(rule: FollowUpRuleConfig) {
  return (
    rule.delayDays * 24 * 60 * 60 * 1000 +
    rule.delayHours * 60 * 60 * 1000 +
    rule.delayMinutes * 60 * 1000
  );
}

export const messageBehaviorTestHelpers = {
  splitOutgoingMessage,
  readMessageBehaviorConfig,
  getFollowUpSendLimitCount,
  getFollowUpDelayMs,
};
