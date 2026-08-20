import { ChannelType } from "@prisma/client";

export const conversationAutomationScopes = {
  UNCLASSIFIED: "UNCLASSIFIED",
  NEW_LEAD: "NEW_LEAD",
  LEGACY: "LEGACY",
  PRECHECK_FAILED: "PRECHECK_FAILED",
} as const;

export type ConversationAutomationScope =
  (typeof conversationAutomationScopes)[keyof typeof conversationAutomationScopes];

type InstagramNewLeadPolicy =
  | { enabled: false }
  | { enabled: true; cutoverAt: Date | null };

type InstagramPreflightResult = {
  status: "prior_history_found" | "no_prior_history" | "not_checked" | "error";
  historyMessages?: Array<{ createdAt?: Date }>;
};

export type InstagramNewLeadDecision = {
  allowAutomation: boolean;
  scope: ConversationAutomationScope;
  reason:
    | "policy_disabled"
    | "eligible_existing_new_lead"
    | "eligible_no_prior_history"
    | "eligible_post_cutover_history"
    | "legacy_existing_conversation"
    | "legacy_history_before_cutover"
    | "preflight_unverified";
};

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function getInstagramNewLeadPolicy(channelConfig: unknown): InstagramNewLeadPolicy {
  const config = readRecord(channelConfig);

  if (config.instagramInboundPolicy !== "new_leads_only") {
    return { enabled: false };
  }

  const rawCutoverAt =
    typeof config.instagramNewLeadCutoverAt === "string"
      ? config.instagramNewLeadCutoverAt.trim()
      : "";
  const cutoverAt = rawCutoverAt ? new Date(rawCutoverAt) : null;

  return {
    enabled: true,
    cutoverAt: cutoverAt && Number.isFinite(cutoverAt.getTime()) ? cutoverAt : null,
  };
}

export function isConversationEligibleForAutomation(args: {
  channel: ChannelType;
  channelConfig: unknown;
  automationScope?: string | null;
}) {
  if (args.channel !== ChannelType.INSTAGRAM) {
    return true;
  }

  const policy = getInstagramNewLeadPolicy(args.channelConfig);
  return !policy.enabled || args.automationScope === conversationAutomationScopes.NEW_LEAD;
}

export function decideInstagramNewLeadEligibility(args: {
  policy: InstagramNewLeadPolicy;
  existingConversationScope?: string | null;
  preflight?: InstagramPreflightResult;
}): InstagramNewLeadDecision {
  if (!args.policy.enabled) {
    return {
      allowAutomation: true,
      scope: conversationAutomationScopes.UNCLASSIFIED,
      reason: "policy_disabled",
    };
  }

  if (args.existingConversationScope !== undefined) {
    if (args.existingConversationScope === conversationAutomationScopes.NEW_LEAD) {
      return {
        allowAutomation: true,
        scope: conversationAutomationScopes.NEW_LEAD,
        reason: "eligible_existing_new_lead",
      };
    }

    return {
      allowAutomation: false,
      scope: conversationAutomationScopes.LEGACY,
      reason: "legacy_existing_conversation",
    };
  }

  const cutoverAt = args.policy.enabled ? args.policy.cutoverAt : null;

  if (!cutoverAt || !args.preflight) {
    return {
      allowAutomation: false,
      scope: conversationAutomationScopes.PRECHECK_FAILED,
      reason: "preflight_unverified",
    };
  }

  if (args.preflight.status === "no_prior_history") {
    return {
      allowAutomation: true,
      scope: conversationAutomationScopes.NEW_LEAD,
      reason: "eligible_no_prior_history",
    };
  }

  if (args.preflight.status !== "prior_history_found") {
    return {
      allowAutomation: false,
      scope: conversationAutomationScopes.PRECHECK_FAILED,
      reason: "preflight_unverified",
    };
  }

  const hasHistoryBeforeCutover = (args.preflight.historyMessages ?? []).some((message) => {
    const timestamp = message.createdAt?.getTime();
    return timestamp === undefined || !Number.isFinite(timestamp) || timestamp < cutoverAt.getTime();
  });

  if (hasHistoryBeforeCutover) {
    return {
      allowAutomation: false,
      scope: conversationAutomationScopes.LEGACY,
      reason: "legacy_history_before_cutover",
    };
  }

  return {
    allowAutomation: true,
    scope: conversationAutomationScopes.NEW_LEAD,
    reason: "eligible_post_cutover_history",
  };
}
