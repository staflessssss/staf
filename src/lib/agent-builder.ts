import {
  AgentStatus,
  ChannelConnection,
  ChannelType,
  ConnectionStatus,
  Feature,
  FeatureType,
  IntegrationConnection,
  MessageRole,
  Prisma,
  PrismaClient,
  Step,
} from "@prisma/client";
import { z } from "zod";

import { isValidTimezone } from "@/lib/timezones";

export const discoveryFieldOptions = [
  "customer_name",
  "service_needed",
  "preferred_date",
  "preferred_time",
  "location_or_branch",
  "budget",
  "urgency",
  "preferred_specialist",
  "contact_preference",
  "notes_or_special_request",
] as const;

export type DiscoveryField = (typeof discoveryFieldOptions)[number];

export const playbookGoalOptions = [
  "capture_lead",
  "book_appointment",
  "qualify_inquiry",
  "answer_faq",
  "close_sale",
] as const;

export const successActionOptions = [
  "qualified_lead_created",
  "booking_requested",
  "booking_completed",
  "pricing_shared",
  "human_handoff_requested",
] as const;

export const openingStrategyOptions = [
  "ask_one_thing_first",
  "ask_two_things_together",
  "ask_for_whatever_is_missing",
] as const;

export const pricingBehaviorOptions = [
  "only_when_asked",
  "after_qualification",
  "after_availability_is_confirmed",
  "immediately_if_relevant",
] as const;

export const unavailableBehaviorOptions = [
  "offer_nearest_alternatives_automatically",
  "ask_the_customer_for_other_options",
  "offer_waitlist_or_callback",
] as const;

export const bookingBehaviorOptions = [
  "request_confirmation_before_booking",
  "offer_booking_link",
  "hold_slot_and_ask_to_confirm",
] as const;

export const afterFaqBehaviorOptions = [
  "return_to_qualification",
  "offer_pricing",
  "offer_booking",
  "stay_in_faq_mode_unless_asked",
] as const;

export const conversationMomentumOptions = [
  "always_end_with_a_question",
  "end_with_next_step_or_question",
  "soft_close_when_appropriate",
] as const;

export const fallbackBehaviorOptions = [
  "ask_a_clarifying_question",
  "offer_a_few_choices",
  "hand_off_to_human",
] as const;

export const channelBehaviorPresetOptions = [
  "recommended_for_channel",
  "gmail_recommended",
  "instagram_recommended",
  "telegram_recommended",
  "website_chat_recommended",
] as const;

export const responseLengthOptions = ["short", "balanced", "detailed"] as const;
export const messageFormatOptions = ["single_message", "split_into_2_3_messages"] as const;
export const tonePaceOptions = ["warm", "professional", "fast", "concise"] as const;
export const ctaStyleOptions = ["ask_a_question", "offer_options", "prompt_booking"] as const;
export const emojiUsageOptions = ["none", "limited", "moderate"] as const;
export const followUpSendLimitOptions = [
  "once_per_dialog",
  "up_to_2_times_per_dialog",
  "up_to_3_times_per_dialog",
] as const;
export const followUpOutOfHoursBehaviorOptions = [
  "send_immediately_ignore_schedule",
  "wait_for_schedule_window",
  "skip_follow_up",
] as const;
export const historyWindowTypeOptions = ["message_count", "time_window", "hybrid"] as const;
export const autoResumeUnitOptions = ["minutes", "hours", "days"] as const;
export const functionParameterTypeOptions = [
  "text",
  "email",
  "date",
  "time_text",
  "number",
  "boolean",
] as const;
export const functionReactionActionOptions = [
  "ai_agent_decides",
  "send_message",
  "send_instruction",
  "send_nothing",
] as const;
export const functionPostActionOptions = [
  "continue_dialog",
  "pause_dialog",
  "switch_agent",
  "change_prompt",
] as const;
export const functionResultTargetTypeOptions = [
  "integration_step",
  "google_sheets",
  "google_calendar",
  "telegram_report",
  "api_request",
  "file_delivery",
  "python_hook",
] as const;

export const conversationPlaybookPresetOptions = [
  "general_lead_capture",
  "appointment_booking",
  "faq_then_convert",
  "high_intent_closer",
  "beauty_salon_lead_capture",
] as const;

export type FollowUpRuleConfig = {
  delayDays: number;
  delayHours: number;
  delayMinutes: number;
  sendLimit: (typeof followUpSendLimitOptions)[number];
  outOfHoursBehavior: (typeof followUpOutOfHoursBehaviorOptions)[number];
  instruction: string;
};

export type ChannelBehaviorConfig = {
  preset: (typeof channelBehaviorPresetOptions)[number];
  responseLength: (typeof responseLengthOptions)[number];
  messageFormat: (typeof messageFormatOptions)[number];
  tonePace: (typeof tonePaceOptions)[number];
  ctaStyle: (typeof ctaStyleOptions)[number];
  emojiUsage: (typeof emojiUsageOptions)[number];
  bufferDelaySeconds: number;
  useSignature: boolean;
  useRichFormatting: boolean;
  allowAttachments: boolean;
  followUpEnabled: boolean;
  followUpRules: FollowUpRuleConfig[];
  notes?: string | null;
};

export type ConversationPlaybookConfig = {
  preset: (typeof conversationPlaybookPresetOptions)[number];
  primaryGoal: (typeof playbookGoalOptions)[number];
  successAction: (typeof successActionOptions)[number];
  openingStrategy: (typeof openingStrategyOptions)[number];
  openingFields: DiscoveryField[];
  discoveryFields: DiscoveryField[];
  discoveryOrder: DiscoveryField[];
  minInfoBeforeAvailability: DiscoveryField[];
  minInfoBeforePricing: DiscoveryField[];
  pricingBehavior: (typeof pricingBehaviorOptions)[number];
  unavailableBehavior: (typeof unavailableBehaviorOptions)[number];
  bookingBehavior: (typeof bookingBehaviorOptions)[number];
  afterFaqBehavior: (typeof afterFaqBehaviorOptions)[number];
  conversationMomentum: (typeof conversationMomentumOptions)[number];
  fallbackBehavior: (typeof fallbackBehaviorOptions)[number];
  notes?: string | null;
};

export type ControlConfig = {
  historyWindowType: (typeof historyWindowTypeOptions)[number];
  maxMessages: number;
  maxDays: number;
  pauseOnOperatorIntervention: boolean;
  ignoreFirstOperatorMessage: boolean;
  antiSpamEnabled: boolean;
  antiSpamMessageCount: number;
  antiSpamWindowSeconds: number;
  antiSpamAutoReply?: string | null;
  autoResumeEnabled: boolean;
  autoResumeAfterValue: number;
  autoResumeAfterUnit: (typeof autoResumeUnitOptions)[number];
  resumeMessageEnabled: boolean;
  resumeMessage?: string | null;
  stopPhrases: string[];
  resumePhrases: string[];
};

export const agentScheduleDayOptions = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export type AgentScheduleDay = (typeof agentScheduleDayOptions)[number];

export type AgentScheduleWindowConfig = {
  day: AgentScheduleDay;
  enabled: boolean;
  start: string;
  end: string;
};

export type AgentSettingsConfig = {
  defaultChatEnabled: boolean;
  timezone: string;
  scheduleEnabled: boolean;
  weeklySchedule: AgentScheduleWindowConfig[];
};

export type PromptingConfig = {
  persona?: string | null;
  tone?: string | null;
  languagePreference?: string | null;
  instruction?: string | null;
  showContactIdentity: boolean;
  showChannelContext: boolean;
  notes?: string | null;
};

export type FunctionParameterConfig = {
  name: string;
  type: (typeof functionParameterTypeOptions)[number];
  instruction?: string | null;
  allowedValues: string[];
  required: boolean;
};

export type FunctionResultTargetConfig = {
  type: (typeof functionResultTargetTypeOptions)[number];
  label: string;
  primaryStepId?: string;
};

export type FunctionBlockConfig = {
  name: string;
  description: string;
  active: boolean;
  parameters: FunctionParameterConfig[];
  reactionAction: (typeof functionReactionActionOptions)[number];
  postAction: (typeof functionPostActionOptions)[number];
  disableDelayedMessages: boolean;
  resultTargets: FunctionResultTargetConfig[];
  steps: Array<{
    id?: string;
    integrationId: string;
    action: string;
    params: Record<string, unknown> | string;
  }>;
};

function uniqueOrderedFields(fields: DiscoveryField[]) {
  return fields.filter(
    (field, index, items): field is DiscoveryField =>
      discoveryFieldOptions.includes(field) && items.indexOf(field) === index,
  );
}

export function getDefaultChannelBehaviorConfig(
  channelType?: ChannelType | null,
): ChannelBehaviorConfig {
  const base = {
    bufferDelaySeconds: 0,
    followUpEnabled: false,
    followUpRules: [],
    notes: null,
  } satisfies Pick<
    ChannelBehaviorConfig,
    "bufferDelaySeconds" | "followUpEnabled" | "followUpRules" | "notes"
  >;

  switch (channelType) {
    case ChannelType.GMAIL:
      return {
        preset: "gmail_recommended",
        responseLength: "balanced",
        messageFormat: "single_message",
        tonePace: "warm",
        ctaStyle: "ask_a_question",
        emojiUsage: "limited",
        ...base,
        useSignature: true,
        useRichFormatting: true,
        allowAttachments: true,
      };
    case ChannelType.INSTAGRAM:
      return {
        preset: "instagram_recommended",
        responseLength: "short",
        messageFormat: "split_into_2_3_messages",
        tonePace: "fast",
        ctaStyle: "offer_options",
        emojiUsage: "limited",
        ...base,
        useSignature: false,
        useRichFormatting: false,
        allowAttachments: false,
      };
    case ChannelType.TELEGRAM:
      return {
        preset: "telegram_recommended",
        responseLength: "short",
        messageFormat: "single_message",
        tonePace: "concise",
        ctaStyle: "offer_options",
        emojiUsage: "limited",
        ...base,
        useSignature: false,
        useRichFormatting: false,
        allowAttachments: false,
      };
    default:
      return {
        preset: "recommended_for_channel",
        responseLength: "short",
        messageFormat: "single_message",
        tonePace: "fast",
        ctaStyle: "prompt_booking",
        emojiUsage: "limited",
        ...base,
        useSignature: false,
        useRichFormatting: false,
        allowAttachments: false,
      };
  }
}

export function getChannelBehaviorPresetConfig(
  preset: (typeof channelBehaviorPresetOptions)[number],
  channelType?: ChannelType | null,
): ChannelBehaviorConfig {
  switch (preset) {
    case "gmail_recommended":
      return getDefaultChannelBehaviorConfig(ChannelType.GMAIL);
    case "instagram_recommended":
      return getDefaultChannelBehaviorConfig(ChannelType.INSTAGRAM);
    case "telegram_recommended":
      return getDefaultChannelBehaviorConfig(ChannelType.TELEGRAM);
    case "website_chat_recommended":
      return getDefaultChannelBehaviorConfig(null);
    case "recommended_for_channel":
    default:
      return getDefaultChannelBehaviorConfig(channelType);
  }
}

export function getConversationPlaybookPreset(
  preset: (typeof conversationPlaybookPresetOptions)[number],
): ConversationPlaybookConfig {
  switch (preset) {
    case "appointment_booking":
      return {
        preset,
        primaryGoal: "book_appointment",
        successAction: "booking_completed",
        openingStrategy: "ask_two_things_together",
        openingFields: ["service_needed", "preferred_date"],
        discoveryFields: [
          "customer_name",
          "service_needed",
          "preferred_date",
          "preferred_time",
          "location_or_branch",
        ],
        discoveryOrder: [
          "customer_name",
          "service_needed",
          "preferred_date",
          "preferred_time",
          "location_or_branch",
        ],
        minInfoBeforeAvailability: ["service_needed", "preferred_date", "preferred_time"],
        minInfoBeforePricing: ["service_needed"],
        pricingBehavior: "after_availability_is_confirmed",
        unavailableBehavior: "offer_nearest_alternatives_automatically",
        bookingBehavior: "request_confirmation_before_booking",
        afterFaqBehavior: "offer_booking",
        conversationMomentum: "end_with_next_step_or_question",
        fallbackBehavior: "ask_a_clarifying_question",
        notes: null,
      };
    case "faq_then_convert":
      return {
        preset,
        primaryGoal: "answer_faq",
        successAction: "qualified_lead_created",
        openingStrategy: "ask_for_whatever_is_missing",
        openingFields: ["service_needed"],
        discoveryFields: [
          "customer_name",
          "service_needed",
          "preferred_date",
          "preferred_time",
          "location_or_branch",
        ],
        discoveryOrder: [
          "service_needed",
          "customer_name",
          "preferred_date",
          "preferred_time",
          "location_or_branch",
        ],
        minInfoBeforeAvailability: ["service_needed", "preferred_date", "preferred_time"],
        minInfoBeforePricing: ["service_needed"],
        pricingBehavior: "only_when_asked",
        unavailableBehavior: "ask_the_customer_for_other_options",
        bookingBehavior: "request_confirmation_before_booking",
        afterFaqBehavior: "return_to_qualification",
        conversationMomentum: "end_with_next_step_or_question",
        fallbackBehavior: "ask_a_clarifying_question",
        notes: null,
      };
    case "high_intent_closer":
      return {
        preset,
        primaryGoal: "close_sale",
        successAction: "booking_completed",
        openingStrategy: "ask_for_whatever_is_missing",
        openingFields: ["service_needed", "preferred_date"],
        discoveryFields: [
          "customer_name",
          "service_needed",
          "preferred_date",
          "preferred_time",
          "location_or_branch",
        ],
        discoveryOrder: [
          "service_needed",
          "preferred_date",
          "preferred_time",
          "customer_name",
          "location_or_branch",
        ],
        minInfoBeforeAvailability: ["service_needed", "preferred_date", "preferred_time"],
        minInfoBeforePricing: ["service_needed"],
        pricingBehavior: "immediately_if_relevant",
        unavailableBehavior: "offer_nearest_alternatives_automatically",
        bookingBehavior: "request_confirmation_before_booking",
        afterFaqBehavior: "offer_booking",
        conversationMomentum: "always_end_with_a_question",
        fallbackBehavior: "offer_a_few_choices",
        notes: null,
      };
    case "beauty_salon_lead_capture":
      return {
        preset,
        primaryGoal: "capture_lead",
        successAction: "qualified_lead_created",
        openingStrategy: "ask_two_things_together",
        openingFields: ["customer_name", "service_needed"],
        discoveryFields: [
          "customer_name",
          "service_needed",
          "preferred_date",
          "preferred_time",
          "preferred_specialist",
          "location_or_branch",
        ],
        discoveryOrder: [
          "customer_name",
          "service_needed",
          "preferred_date",
          "preferred_time",
          "preferred_specialist",
          "location_or_branch",
        ],
        minInfoBeforeAvailability: ["service_needed", "preferred_date", "preferred_time"],
        minInfoBeforePricing: ["service_needed"],
        pricingBehavior: "after_qualification",
        unavailableBehavior: "offer_nearest_alternatives_automatically",
        bookingBehavior: "request_confirmation_before_booking",
        afterFaqBehavior: "return_to_qualification",
        conversationMomentum: "end_with_next_step_or_question",
        fallbackBehavior: "ask_a_clarifying_question",
        notes: null,
      };
    case "general_lead_capture":
    default:
      return {
        preset: "general_lead_capture",
        primaryGoal: "capture_lead",
        successAction: "qualified_lead_created",
        openingStrategy: "ask_two_things_together",
        openingFields: ["customer_name", "service_needed"],
        discoveryFields: [
          "customer_name",
          "service_needed",
          "preferred_date",
          "preferred_time",
          "location_or_branch",
        ],
        discoveryOrder: [
          "customer_name",
          "service_needed",
          "preferred_date",
          "preferred_time",
          "location_or_branch",
        ],
        minInfoBeforeAvailability: ["service_needed", "preferred_date", "preferred_time"],
        minInfoBeforePricing: ["service_needed"],
        pricingBehavior: "after_qualification",
        unavailableBehavior: "offer_nearest_alternatives_automatically",
        bookingBehavior: "request_confirmation_before_booking",
        afterFaqBehavior: "return_to_qualification",
        conversationMomentum: "end_with_next_step_or_question",
        fallbackBehavior: "ask_a_clarifying_question",
        notes: null,
      };
  }
}

export function normalizeConversationPlaybook(
  value?: Partial<ConversationPlaybookConfig> | null,
): ConversationPlaybookConfig {
  const base = getConversationPlaybookPreset(value?.preset ?? "general_lead_capture");
  const discoveryFields = uniqueOrderedFields(
    (value?.discoveryFields as DiscoveryField[] | undefined) ?? base.discoveryFields,
  );
  const discoveryOrder = [
    ...uniqueOrderedFields((value?.discoveryOrder as DiscoveryField[] | undefined) ?? []),
    ...discoveryFields.filter(
      (field) =>
        !((value?.discoveryOrder as DiscoveryField[] | undefined) ?? []).includes(field),
    ),
  ];

  return {
    ...base,
    ...value,
    openingFields: uniqueOrderedFields(
      (value?.openingFields as DiscoveryField[] | undefined) ?? base.openingFields,
    ).filter((field) => discoveryFields.includes(field)),
    discoveryFields,
    discoveryOrder,
    minInfoBeforeAvailability: uniqueOrderedFields(
      (value?.minInfoBeforeAvailability as DiscoveryField[] | undefined) ?? base.minInfoBeforeAvailability,
    ).filter((field) => discoveryFields.includes(field)),
    minInfoBeforePricing: uniqueOrderedFields(
      (value?.minInfoBeforePricing as DiscoveryField[] | undefined) ?? base.minInfoBeforePricing,
    ).filter((field) => discoveryFields.includes(field)),
    notes: typeof value?.notes === "string" ? value.notes : base.notes,
  };
}

export function getDefaultFollowUpRuleConfig(): FollowUpRuleConfig {
  return {
    delayDays: 0,
    delayHours: 4,
    delayMinutes: 0,
    sendLimit: "once_per_dialog",
    outOfHoursBehavior: "send_immediately_ignore_schedule",
    instruction: "",
  };
}

export function normalizeFollowUpRule(
  value?: Partial<FollowUpRuleConfig> | null,
): FollowUpRuleConfig {
  const base = getDefaultFollowUpRuleConfig();

  return {
    ...base,
    ...value,
    delayDays:
      typeof value?.delayDays === "number" && Number.isFinite(value.delayDays)
        ? Math.max(0, Math.floor(value.delayDays))
        : base.delayDays,
    delayHours:
      typeof value?.delayHours === "number" && Number.isFinite(value.delayHours)
        ? Math.max(0, Math.min(23, Math.floor(value.delayHours)))
        : base.delayHours,
    delayMinutes:
      typeof value?.delayMinutes === "number" && Number.isFinite(value.delayMinutes)
        ? Math.max(0, Math.min(59, Math.floor(value.delayMinutes)))
        : base.delayMinutes,
    instruction:
      typeof value?.instruction === "string" ? value.instruction.trim() : base.instruction,
  };
}

export function normalizeChannelBehavior(
  value: Partial<ChannelBehaviorConfig> | null | undefined,
  channelType?: ChannelType | null,
): ChannelBehaviorConfig {
  const base = getDefaultChannelBehaviorConfig(channelType);

  return {
    ...base,
    ...value,
    bufferDelaySeconds:
      typeof value?.bufferDelaySeconds === "number" && Number.isFinite(value.bufferDelaySeconds)
        ? Math.max(0, Math.min(300, Math.floor(value.bufferDelaySeconds)))
        : base.bufferDelaySeconds,
    followUpEnabled:
      typeof value?.followUpEnabled === "boolean"
        ? value.followUpEnabled
        : base.followUpEnabled,
    followUpRules: Array.isArray(value?.followUpRules)
      ? value.followUpRules
          .map((rule) => normalizeFollowUpRule(rule))
          .filter((rule) => rule.delayDays + rule.delayHours + rule.delayMinutes > 0)
      : base.followUpRules,
    notes: typeof value?.notes === "string" ? value.notes : base.notes,
  };
}

export function getDefaultControlConfig(): ControlConfig {
  return {
    historyWindowType: "hybrid",
    maxMessages: 30,
    maxDays: 14,
    pauseOnOperatorIntervention: true,
    ignoreFirstOperatorMessage: false,
    antiSpamEnabled: false,
    antiSpamMessageCount: 5,
    antiSpamWindowSeconds: 60,
    antiSpamAutoReply: null,
    autoResumeEnabled: false,
    autoResumeAfterValue: 3,
    autoResumeAfterUnit: "hours",
    resumeMessageEnabled: false,
    resumeMessage: null,
    stopPhrases: [],
    resumePhrases: [],
  };
}

function normalizePhraseList(values?: string[] | null) {
  if (!Array.isArray(values)) {
    return [];
  }

  return Array.from(
    new Set(
      values
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter(Boolean),
    ),
  );
}

export function normalizeControlConfig(
  value?: Partial<ControlConfig> | null,
): ControlConfig {
  const base = getDefaultControlConfig();

  return {
    ...base,
    ...value,
    maxMessages:
      typeof value?.maxMessages === "number" && Number.isFinite(value.maxMessages)
        ? Math.max(1, Math.floor(value.maxMessages))
        : base.maxMessages,
    maxDays:
      typeof value?.maxDays === "number" && Number.isFinite(value.maxDays)
        ? Math.max(1, Math.floor(value.maxDays))
        : base.maxDays,
    antiSpamMessageCount:
      typeof value?.antiSpamMessageCount === "number" && Number.isFinite(value.antiSpamMessageCount)
        ? Math.max(1, Math.floor(value.antiSpamMessageCount))
        : base.antiSpamMessageCount,
    antiSpamWindowSeconds:
      typeof value?.antiSpamWindowSeconds === "number" && Number.isFinite(value.antiSpamWindowSeconds)
        ? Math.max(5, Math.floor(value.antiSpamWindowSeconds))
        : base.antiSpamWindowSeconds,
    autoResumeAfterValue:
      typeof value?.autoResumeAfterValue === "number" && Number.isFinite(value.autoResumeAfterValue)
        ? Math.max(1, Math.floor(value.autoResumeAfterValue))
        : base.autoResumeAfterValue,
    antiSpamAutoReply:
      typeof value?.antiSpamAutoReply === "string" ? value.antiSpamAutoReply : base.antiSpamAutoReply,
    resumeMessage:
      typeof value?.resumeMessage === "string" ? value.resumeMessage : base.resumeMessage,
    stopPhrases: normalizePhraseList(value?.stopPhrases),
    resumePhrases: normalizePhraseList(value?.resumePhrases),
  };
}

const defaultAgentScheduleWindows: AgentScheduleWindowConfig[] = agentScheduleDayOptions.map((day) => ({
  day,
  enabled: false,
  start: "09:00",
  end: "18:00",
}));

function normalizeScheduleTime(value: unknown, fallback: string) {
  return typeof value === "string" && /^\d{2}:\d{2}$/.test(value) ? value : fallback;
}

function isOrderedScheduleWindow(start: string, end: string) {
  return start < end;
}

export function getDefaultAgentSettingsConfig(timezone?: string | null): AgentSettingsConfig {
  const safeTimezone =
    typeof timezone === "string" && timezone.trim() && isValidTimezone(timezone.trim())
      ? timezone.trim()
      : "UTC";

  return {
    defaultChatEnabled: true,
    timezone: safeTimezone,
    scheduleEnabled: false,
    weeklySchedule: defaultAgentScheduleWindows.map((window) => ({ ...window })),
  };
}

export function normalizePromptingConfig(
  value?: Partial<PromptingConfig> | null,
): PromptingConfig {
  return {
    persona:
      typeof value?.persona === "string" && value.persona.trim().length > 0
        ? value.persona.trim()
        : null,
    tone:
      typeof value?.tone === "string" && value.tone.trim().length > 0
        ? value.tone.trim()
        : null,
    languagePreference:
      typeof value?.languagePreference === "string" &&
      value.languagePreference.trim().length > 0
        ? value.languagePreference.trim()
        : null,
    instruction:
      typeof value?.instruction === "string" && value.instruction.trim().length > 0
        ? value.instruction.trim()
        : null,
    showContactIdentity:
      typeof value?.showContactIdentity === "boolean" ? value.showContactIdentity : false,
    showChannelContext:
      typeof value?.showChannelContext === "boolean" ? value.showChannelContext : false,
    notes:
      typeof value?.notes === "string" && value.notes.trim().length > 0
        ? value.notes.trim()
        : null,
  };
}

export function resolvePromptingIdentity(args: {
  prompting?: Partial<PromptingConfig> | null;
  persona: string;
  tone: string;
  languagePreference?: string | null;
}) {
  const prompting = normalizePromptingConfig(args.prompting);

  return {
    persona: prompting.persona ?? args.persona,
    tone: prompting.tone ?? args.tone,
    languagePreference: prompting.languagePreference ?? args.languagePreference ?? null,
    prompting,
  };
}

export function normalizeAgentSettings(
  value?: Partial<AgentSettingsConfig> | null,
  timezone?: string | null,
): AgentSettingsConfig {
  const base = getDefaultAgentSettingsConfig(timezone);
  const incomingWindows = Array.isArray(value?.weeklySchedule) ? value.weeklySchedule : [];

  return {
    defaultChatEnabled:
      typeof value?.defaultChatEnabled === "boolean"
        ? value.defaultChatEnabled
        : base.defaultChatEnabled,
    timezone:
      typeof value?.timezone === "string" &&
      value.timezone.trim() &&
      isValidTimezone(value.timezone.trim())
        ? value.timezone.trim()
        : base.timezone,
    scheduleEnabled:
      typeof value?.scheduleEnabled === "boolean"
        ? value.scheduleEnabled
        : base.scheduleEnabled,
    weeklySchedule: agentScheduleDayOptions.map((day) => {
      const existingWindow = incomingWindows.find((window) => window?.day === day);
      const fallbackWindow = base.weeklySchedule.find((window) => window.day === day) ?? {
        day,
        enabled: false,
        start: "09:00",
        end: "18:00",
      };

      return {
        day,
        enabled:
          typeof existingWindow?.enabled === "boolean"
            ? existingWindow.enabled
            : fallbackWindow.enabled,
        start: normalizeScheduleTime(existingWindow?.start, fallbackWindow.start),
        end: normalizeScheduleTime(existingWindow?.end, fallbackWindow.end),
      };
    }),
  };
}

export const knowledgeBlockSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(500),
  knowledgeContent: z.string().trim().min(1).max(10_000),
});

export const functionParameterSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.enum(functionParameterTypeOptions).default("text"),
  instruction: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => (value ? value : undefined)),
  allowedValues: z.array(z.string().trim().min(1).max(120)).default([]),
  required: z.boolean().default(false),
});

export const functionResultTargetSchema = z.object({
  type: z.enum(functionResultTargetTypeOptions).default("integration_step"),
  label: z.string().trim().min(1).max(160),
  primaryStepId: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : undefined)),
});

export const functionBlockSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(500),
  active: z.boolean().default(true),
  parameters: z.array(functionParameterSchema).default([]),
  reactionAction: z.enum(functionReactionActionOptions).default("ai_agent_decides"),
  postAction: z.enum(functionPostActionOptions).default("continue_dialog"),
  disableDelayedMessages: z.boolean().default(false),
  resultTargets: z.array(functionResultTargetSchema).default([]),
  steps: z
    .array(
      z.object({
        id: z
          .string()
          .trim()
          .optional()
          .transform((value) => (value ? value : undefined)),
        integrationId: z.string().trim().min(1),
        action: z.string().trim().min(1).max(120),
        params: z.union([z.record(z.string(), z.unknown()), z.string().trim()]).default({}),
      }),
    )
    .default([]),
});

const scheduleWindowSchema = z.object({
  day: z.enum(agentScheduleDayOptions),
  enabled: z.boolean().default(false),
  start: z.string().regex(/^\d{2}:\d{2}$/).default("09:00"),
  end: z.string().regex(/^\d{2}:\d{2}$/).default("18:00"),
});

export const channelConfigSchema = z
  .object({
    priceAttachmentFileId: z
      .string()
      .trim()
      .max(500)
      .optional()
      .transform((value) => (value ? value : undefined)),
    priceAttachmentFileName: z
      .string()
      .trim()
      .max(240)
      .optional()
      .transform((value) => (value ? value : undefined)),
    priceAttachmentMimeType: z
      .string()
      .trim()
      .max(120)
      .optional()
      .transform((value) => (value ? value : undefined)),
    channelBehavior: z
      .object({
        preset: z.enum(channelBehaviorPresetOptions).default("recommended_for_channel"),
        responseLength: z.enum(responseLengthOptions).default("balanced"),
        messageFormat: z.enum(messageFormatOptions).default("single_message"),
        tonePace: z.enum(tonePaceOptions).default("warm"),
        ctaStyle: z.enum(ctaStyleOptions).default("ask_a_question"),
        emojiUsage: z.enum(emojiUsageOptions).default("limited"),
        bufferDelaySeconds: z.number().int().min(0).max(300).default(0),
        useSignature: z.boolean().default(false),
        useRichFormatting: z.boolean().default(false),
        allowAttachments: z.boolean().default(false),
        followUpEnabled: z.boolean().default(false),
        followUpRules: z
          .array(
            z.object({
              delayDays: z.number().int().min(0).max(30).default(0),
              delayHours: z.number().int().min(0).max(23).default(4),
              delayMinutes: z.number().int().min(0).max(59).default(0),
              sendLimit: z.enum(followUpSendLimitOptions).default("once_per_dialog"),
              outOfHoursBehavior: z
                .enum(followUpOutOfHoursBehaviorOptions)
                .default("send_immediately_ignore_schedule"),
              instruction: z.string().trim().max(2000).default(""),
            }),
          )
          .default([]),
        notes: z
          .string()
          .trim()
          .max(1000)
          .optional()
          .transform((value) => (value ? value : undefined)),
      })
      .optional(),
    conversationPlaybook: z
      .object({
        preset: z.enum(conversationPlaybookPresetOptions).default("general_lead_capture"),
        primaryGoal: z.enum(playbookGoalOptions).default("capture_lead"),
        successAction: z.enum(successActionOptions).default("qualified_lead_created"),
        openingStrategy: z.enum(openingStrategyOptions).default("ask_two_things_together"),
        openingFields: z.array(z.enum(discoveryFieldOptions)).default(["customer_name", "service_needed"]),
        discoveryFields: z
          .array(z.enum(discoveryFieldOptions))
          .default([
            "customer_name",
            "service_needed",
            "preferred_date",
            "preferred_time",
            "location_or_branch",
          ]),
        discoveryOrder: z
          .array(z.enum(discoveryFieldOptions))
          .default([
            "customer_name",
            "service_needed",
            "preferred_date",
            "preferred_time",
            "location_or_branch",
          ]),
        minInfoBeforeAvailability: z
          .array(z.enum(discoveryFieldOptions))
          .default(["service_needed", "preferred_date", "preferred_time"]),
        minInfoBeforePricing: z.array(z.enum(discoveryFieldOptions)).default(["service_needed"]),
        pricingBehavior: z.enum(pricingBehaviorOptions).default("after_qualification"),
        unavailableBehavior: z
          .enum(unavailableBehaviorOptions)
          .default("offer_nearest_alternatives_automatically"),
        bookingBehavior: z
          .enum(bookingBehaviorOptions)
          .default("request_confirmation_before_booking"),
        afterFaqBehavior: z.enum(afterFaqBehaviorOptions).default("return_to_qualification"),
        conversationMomentum: z
          .enum(conversationMomentumOptions)
          .default("end_with_next_step_or_question"),
        fallbackBehavior: z
          .enum(fallbackBehaviorOptions)
          .default("ask_a_clarifying_question"),
        notes: z
          .string()
          .trim()
          .max(2000)
          .optional()
          .transform((value) => (value ? value : undefined)),
      })
      .optional(),
    prompting: z
      .object({
        persona: z
          .string()
          .trim()
          .max(10_000)
          .nullable()
          .optional()
          .transform((value) => (value ? value : undefined)),
        tone: z
          .string()
          .trim()
          .max(120)
          .nullable()
          .optional()
          .transform((value) => (value ? value : undefined)),
        languagePreference: z
          .string()
          .trim()
          .max(120)
          .nullable()
          .optional()
          .transform((value) => (value ? value : undefined)),
        instruction: z
          .string()
          .trim()
          .max(10000)
          .nullable()
          .optional()
          .transform((value) => (value ? value : undefined)),
        showContactIdentity: z.boolean().default(false),
        showChannelContext: z.boolean().default(false),
        notes: z
          .string()
          .trim()
          .max(4000)
          .nullable()
          .optional()
          .transform((value) => (value ? value : undefined)),
      })
      .optional(),
    control: z
      .object({
        historyWindowType: z.enum(historyWindowTypeOptions).default("hybrid"),
        maxMessages: z.number().int().min(1).max(500).default(30),
        maxDays: z.number().int().min(1).max(365).default(14),
        pauseOnOperatorIntervention: z.boolean().default(true),
        ignoreFirstOperatorMessage: z.boolean().default(false),
        antiSpamEnabled: z.boolean().default(false),
        antiSpamMessageCount: z.number().int().min(1).max(100).default(5),
        antiSpamWindowSeconds: z.number().int().min(5).max(3600).default(60),
        antiSpamAutoReply: z
          .string()
          .trim()
          .max(1000)
          .optional()
          .transform((value) => (value ? value : undefined)),
        autoResumeEnabled: z.boolean().default(false),
        autoResumeAfterValue: z.number().int().min(1).max(365).default(3),
        autoResumeAfterUnit: z.enum(autoResumeUnitOptions).default("hours"),
        resumeMessageEnabled: z.boolean().default(false),
        resumeMessage: z
          .string()
          .trim()
          .max(1000)
          .optional()
          .transform((value) => (value ? value : undefined)),
        stopPhrases: z.array(z.string().trim().min(1).max(120)).default([]),
        resumePhrases: z.array(z.string().trim().min(1).max(120)).default([]),
      })
      .optional(),
    agentSettings: z
      .object({
        defaultChatEnabled: z.boolean().default(true),
        timezone: z.string().trim().min(2).max(100).default("UTC"),
        scheduleEnabled: z.boolean().default(false),
        weeklySchedule: z.array(scheduleWindowSchema).default(defaultAgentScheduleWindows),
      })
      .superRefine((value, ctx) => {
        if (!isValidTimezone(value.timezone)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Timezone must be a valid IANA timezone.",
            path: ["timezone"],
          });
        }

        value.weeklySchedule.forEach((window, index) => {
          if (window.enabled && !isOrderedScheduleWindow(window.start, window.end)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Schedule end time must be later than start time.",
              path: ["weeklySchedule", index, "end"],
            });
          }
        });
      })
      .optional(),
    functionBlocks: z.array(functionBlockSchema).optional(),
  })
  .default({
    priceAttachmentFileId: undefined,
    priceAttachmentFileName: undefined,
    priceAttachmentMimeType: undefined,
    channelBehavior: undefined,
    conversationPlaybook: undefined,
    prompting: undefined,
    control: undefined,
    agentSettings: undefined,
    functionBlocks: undefined,
  });

const builderManagedChannelConfigKeys = [
  "priceAttachmentFileId",
  "priceAttachmentFileName",
  "priceAttachmentMimeType",
  "channelBehavior",
  "conversationPlaybook",
  "prompting",
  "control",
  "agentSettings",
  "functionBlocks",
] as const;

export const agentDraftSchema = z.object({
  name: z.string().trim().min(1).max(120),
  persona: z.string().trim().min(1).max(10_000),
  tone: z.string().trim().min(1).max(120),
  languagePreference: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((value) => (value ? value : null)),
  channelId: z.string().trim().min(1),
  status: z.nativeEnum(AgentStatus).optional().default(AgentStatus.DRAFT),
  channelConfig: channelConfigSchema.optional().default({
    priceAttachmentFileId: undefined,
    priceAttachmentFileName: undefined,
    priceAttachmentMimeType: undefined,
  }),
  knowledgeBlocks: z.array(knowledgeBlockSchema).default([]),
});

export type AgentDraftInput = z.infer<typeof agentDraftSchema>;

export function deriveToolBlocksFromDraft(
  input: Pick<AgentDraftInput, "channelConfig">,
) {
  const functionBlocks = normalizeFunctionBlocks(input.channelConfig?.functionBlocks ?? []);
  return functionBlocksToToolBlocks(functionBlocks);
}

export function getDefaultFunctionBlock(): FunctionBlockConfig {
  return {
    name: "New function",
    description: "Describe the business action this function should perform.",
    active: true,
    parameters: [],
    reactionAction: "ai_agent_decides",
    postAction: "continue_dialog",
    disableDelayedMessages: false,
    resultTargets: [],
    steps: [],
  };
}

export function normalizeFunctionBlock(
  value?: Partial<FunctionBlockConfig> | null,
): FunctionBlockConfig {
  const base = getDefaultFunctionBlock();

  return {
    ...base,
    ...value,
    name: typeof value?.name === "string" && value.name.trim() ? value.name.trim() : base.name,
    description:
      typeof value?.description === "string" && value.description.trim()
        ? value.description.trim()
        : base.description,
    active: typeof value?.active === "boolean" ? value.active : base.active,
    parameters: Array.isArray(value?.parameters)
      ? value.parameters
          .map((parameter) => ({
            name:
              typeof parameter?.name === "string" && parameter.name.trim()
                ? parameter.name.trim()
                : "parameter",
            type:
              typeof parameter?.type === "string" &&
              functionParameterTypeOptions.includes(parameter.type as never)
                ? (parameter.type as FunctionParameterConfig["type"])
                : "text",
            instruction:
              typeof parameter?.instruction === "string" && parameter.instruction.trim()
                ? parameter.instruction.trim()
                : undefined,
            allowedValues: Array.isArray(parameter?.allowedValues)
              ? parameter.allowedValues
                  .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
                  .map((entry) => entry.trim())
              : [],
            required: typeof parameter?.required === "boolean" ? parameter.required : false,
          }))
      : base.parameters,
    reactionAction:
      typeof value?.reactionAction === "string" &&
      functionReactionActionOptions.includes(value.reactionAction as never)
        ? (value.reactionAction as FunctionBlockConfig["reactionAction"])
        : base.reactionAction,
    postAction:
      typeof value?.postAction === "string" &&
      functionPostActionOptions.includes(value.postAction as never)
        ? (value.postAction as FunctionBlockConfig["postAction"])
        : base.postAction,
    disableDelayedMessages:
      typeof value?.disableDelayedMessages === "boolean"
        ? value.disableDelayedMessages
        : base.disableDelayedMessages,
    resultTargets: Array.isArray(value?.resultTargets)
      ? value.resultTargets
          .map((target) => ({
            type:
              typeof target?.type === "string" &&
              functionResultTargetTypeOptions.includes(target.type as never)
                ? (target.type as FunctionResultTargetConfig["type"])
                : "integration_step",
            label:
              typeof target?.label === "string" && target.label.trim()
                ? target.label.trim()
                : "Result target",
            primaryStepId:
              typeof target?.primaryStepId === "string" && target.primaryStepId.trim()
                ? target.primaryStepId.trim()
                : undefined,
          }))
      : base.resultTargets,
    steps: Array.isArray(value?.steps)
      ? value.steps
          .filter(
            (step): step is {
              id?: string;
              integrationId: string;
              action: string;
              params: Record<string, unknown> | string;
            } =>
              Boolean(step && typeof step === "object" && !Array.isArray(step)),
          )
          .map((step) => ({
            id: typeof step.id === "string" && step.id.trim() ? step.id.trim() : undefined,
            integrationId: typeof step.integrationId === "string" ? step.integrationId : "",
            action: typeof step.action === "string" ? step.action : "",
            params:
              typeof step.params === "string" || (step.params && typeof step.params === "object" && !Array.isArray(step.params))
                ? step.params
                : {},
          }))
      : base.steps,
  };
}

export function normalizeFunctionBlocks(
  values?: Array<Partial<FunctionBlockConfig>> | null,
): FunctionBlockConfig[] {
  if (!Array.isArray(values) || values.length === 0) {
    return [];
  }

  return values.map((value) => normalizeFunctionBlock(value));
}

type ToolLikeBlock = {
  name: string;
  description: string;
  steps?: Array<{
    integrationId: string;
    action: string;
    params: Record<string, unknown>;
  }>;
};

export function toolBlockToFunctionBlock(toolBlock: ToolLikeBlock): FunctionBlockConfig {
  return normalizeFunctionBlock({
    name: toolBlock.name,
    description: toolBlock.description,
    steps:
      toolBlock.steps?.map((step) => ({
        integrationId: step.integrationId,
        action: step.action,
        params: step.params,
      })) ?? [],
  });
}

export function functionBlockToToolBlock(functionBlock: FunctionBlockConfig) {
  return {
    name: functionBlock.name,
    description: functionBlock.description,
    steps: functionBlock.steps.map((step) => ({
      integrationId: step.integrationId,
      action: step.action,
      params:
        typeof step.params === "string"
          ? (() => {
              try {
                return JSON.parse(step.params || "{}");
              } catch {
                return {};
              }
            })()
          : step.params,
    })),
  };
}

export function functionBlocksToToolBlocks(functionBlocks: FunctionBlockConfig[]) {
  return functionBlocks.map((block) => functionBlockToToolBlock(block));
}

export const sandboxInvokeSchema = z.object({
  tenantId: z.string().trim().min(1),
  agentId: z.string().trim().min(1).optional(),
  contactId: z.string().trim().min(1).max(120).optional(),
  message: z.string().trim().min(1).max(4_000),
  testMode: z.boolean().optional(),
  history: z
    .array(
      z.object({
        role: z.nativeEnum(MessageRole),
        content: z.string(),
        toolName: z.string().optional(),
        toolResult: z.unknown().optional(),
        durationMs: z.number().optional(),
      }),
    )
    .optional(),
  draft: agentDraftSchema.optional(),
}).superRefine((value, ctx) => {
  if (!value.agentId && !value.draft) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Either a saved agent or a draft config is required.",
      path: ["draft"],
    });
  }
});

export type SandboxInvokeInput = z.infer<typeof sandboxInvokeSchema>;

export const agentBuilderInclude = {
  channel: true,
  features: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      steps: {
        orderBy: { sortOrder: "asc" as const },
        include: { integration: true },
      },
    },
  },
} satisfies Prisma.AgentInclude;

export type AgentWithBuilderData = Prisma.AgentGetPayload<{
  include: typeof agentBuilderInclude;
}>;

export type HydratedToolStep = Pick<
  Step,
  "id" | "featureId" | "integrationId" | "action" | "params" | "sortOrder" | "createdAt" | "updatedAt"
> & {
  integration: IntegrationConnection;
};

export type HydratedToolFeature = Pick<
  Feature,
  "id" | "agentId" | "name" | "description" | "type" | "sortOrder" | "createdAt" | "updatedAt"
> & {
  type: "TOOL";
  steps: HydratedToolStep[];
};

export function getChannelConfigObject(value: Prisma.JsonValue | null | undefined): Prisma.JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return { ...(value as Prisma.JsonObject) };
}

function normalizeFunctionStepParams(value: Record<string, unknown> | string): Prisma.JsonValue {
  if (typeof value !== "string") {
    return value as Prisma.JsonValue;
  }

  try {
    const parsed = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" ? (parsed as Prisma.JsonValue) : {};
  } catch {
    return {};
  }
}

export function mergeBuilderChannelConfig(
  existing: Prisma.JsonValue | null | undefined,
  patch: AgentDraftInput["channelConfig"] | undefined,
): Prisma.InputJsonValue {
  const nextConfig = getChannelConfigObject(existing);

  for (const key of builderManagedChannelConfigKeys) {
    if (!patch || !(key in patch)) {
      continue;
    }

    const value = patch?.[key];

    if (typeof value === "string" && value.trim()) {
      nextConfig[key] = value;
      continue;
    }

    if (value && typeof value === "object" && !Array.isArray(value)) {
      nextConfig[key] = value as Prisma.JsonObject;
      continue;
    }

    if (typeof value === "boolean") {
      nextConfig[key] = value;
      continue;
    }

    if (Array.isArray(value)) {
      nextConfig[key] = value as Prisma.JsonArray;
      continue;
    }

    delete nextConfig[key];
  }

  return nextConfig;
}

export function mergeChannelConfig(
  existing: Prisma.JsonValue | null | undefined,
  patch: Prisma.JsonObject,
): Prisma.JsonObject {
  return {
    ...getChannelConfigObject(existing),
    ...patch,
  };
}

export function mapAgentToDraft(agent: AgentWithBuilderData) {
  const rawChannelConfig = getChannelConfigObject(agent.channelConfig);

  return {
    id: agent.id,
    tenantId: agent.tenantId,
    name: agent.name,
    persona: agent.persona,
    tone: agent.tone,
    languagePreference: agent.languagePreference,
    status: agent.status,
    channelId: agent.channelId,
    channelConfig: rawChannelConfig,
    channel: agent.channel,
    functionBlocks: normalizeFunctionBlocks(
      Array.isArray(rawChannelConfig.functionBlocks)
        ? (rawChannelConfig.functionBlocks as Partial<FunctionBlockConfig>[])
        : [],
    ),
    knowledgeBlocks: agent.features
      .filter((feature) => feature.type === FeatureType.KNOWLEDGE)
      .map((feature) => ({
        id: feature.id,
        name: feature.name,
        description: feature.description,
        knowledgeContent: feature.knowledgeContent ?? "",
        sortOrder: feature.sortOrder,
      })),
  };
}

export function deriveFunctionBlocksFromAgent(agent: AgentWithBuilderData) {
  const rawChannelConfig =
    agent.channelConfig && typeof agent.channelConfig === "object" && !Array.isArray(agent.channelConfig)
      ? (agent.channelConfig as Record<string, unknown>)
      : {};

  const toolBlocks = agent.features
    .filter((feature) => feature.type === FeatureType.TOOL)
    .map((feature) => ({
      name: feature.name,
      description: feature.description,
      steps: feature.steps.map((step) => ({
        integrationId: step.integrationId,
        action: step.action,
        params: step.params,
      })),
    }));

  return normalizeFunctionBlocks(
    rawChannelConfig.functionBlocks &&
      Array.isArray(rawChannelConfig.functionBlocks)
      ? (rawChannelConfig.functionBlocks as Partial<FunctionBlockConfig>[])
      : toolBlocks.map((tool) =>
          toolBlockToFunctionBlock({
            name: tool.name,
            description: tool.description,
            steps: tool.steps.map((step) => ({
              integrationId: step.integrationId,
              action: step.action,
              params:
                step.params &&
                typeof step.params === "object" &&
                !Array.isArray(step.params)
                  ? step.params
                  : {},
            })),
          }),
        ),
  );
}

export async function hydrateFunctionBlocksForRuntime(
  agent: Pick<AgentWithBuilderData, "id" | "tenantId" | "channelConfig">,
  database: PrismaClient,
): Promise<HydratedToolFeature[]> {
  const rawChannelConfig = getChannelConfigObject(agent.channelConfig);
  const functionBlocks = normalizeFunctionBlocks(
    Array.isArray(rawChannelConfig.functionBlocks)
      ? (rawChannelConfig.functionBlocks as Partial<FunctionBlockConfig>[])
      : [],
  );

  if (functionBlocks.length === 0) {
    return [];
  }

  const integrationIds = Array.from(
    new Set(
      functionBlocks.flatMap((block) =>
        block.steps
          .map((step) => step.integrationId.trim())
          .filter((integrationId) => integrationId.length > 0),
      ),
    ),
  );

  const integrations =
    integrationIds.length > 0
      ? await database.integrationConnection.findMany({
          where: {
            tenantId: agent.tenantId,
            id: { in: integrationIds },
          },
        })
      : [];

  const integrationsById = new Map(integrations.map((integration) => [integration.id, integration]));
  const now = new Date();

  return functionBlocks.map((block, blockIndex) => {
    const featureId = `synthetic:fb:${blockIndex}`;

    return {
      id: featureId,
      agentId: agent.id,
      name: block.name,
      description: block.description,
      type: FeatureType.TOOL,
      sortOrder: blockIndex,
      createdAt: now,
      updatedAt: now,
      steps: block.steps.flatMap((step, stepIndex) => {
        const integration = integrationsById.get(step.integrationId);

        if (!integration) {
          console.warn(
            `[hydrateFunctionBlocksForRuntime] Agent ${agent.id} skipped step ${blockIndex}:${stepIndex} because integration ${step.integrationId} was not found for tenant ${agent.tenantId}.`,
          );
          return [];
        }

        return [
          {
            id: step.id ?? `synthetic:step:${blockIndex}:${stepIndex}`,
            featureId,
            integrationId: step.integrationId,
            action: step.action,
            params: normalizeFunctionStepParams(step.params),
            sortOrder: stepIndex,
            createdAt: now,
            updatedAt: now,
            integration,
          },
        ];
      }),
    };
  });
}

export function serializeBuilderAgent(agent: AgentWithBuilderData) {
  return {
    id: agent.id,
    tenantId: agent.tenantId,
    status: agent.status,
    deployedAt: agent.deployedAt,
    createdAt: agent.createdAt,
    updatedAt: agent.updatedAt,
    draft: mapAgentToDraft(agent),
  };
}

export function buildFeatureCreateInput(input: AgentDraftInput): Prisma.FeatureCreateWithoutAgentInput[] {
  const knowledgeFeatures: Prisma.FeatureCreateWithoutAgentInput[] =
    input.knowledgeBlocks.map((block, index) => ({
      name: block.name,
      description: block.description,
      type: FeatureType.KNOWLEDGE,
      sortOrder: index,
      knowledgeContent: block.knowledgeContent,
    }));

  return knowledgeFeatures;
}

export function getToolIntegrationIds(input: AgentDraftInput) {
  const toolBlocks = deriveToolBlocksFromDraft(input);

  return Array.from(
    new Set(
      toolBlocks.flatMap((block) => block.steps.map((step) => step.integrationId)),
    ),
  );
}

export function buildMultilingualGuidance(input: {
  languagePreference?: string | null;
  channel?: Pick<ChannelConnection, "type"> | null;
}) {
  const parts = [
    "The agent must remain comfortable responding in the customer's language when possible.",
  ];

  if (input.languagePreference) {
    parts.push(
      `Preferred default response language: ${input.languagePreference}. Use it as the default business voice unless the customer clearly uses another language.`,
    );
  } else {
    parts.push(
      "No default response language is pinned. Match the customer's language and keep replies operationally clear.",
    );
  }

  if (input.channel?.type) {
    parts.push(`Primary business channel: ${formatEnumLabel(input.channel.type)}.`);
  }

  return parts.join(" ");
}

export function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export async function validateBuilderReferences(args: {
  tx: Prisma.TransactionClient;
  tenantId: string;
  channelId: string;
  agentId?: string;
  integrationIds: string[];
}) {
  const channel = await args.tx.channelConnection.findFirst({
    where: {
      id: args.channelId,
      tenantId: args.tenantId,
      status: ConnectionStatus.CONNECTED,
    },
  });

  if (!channel) {
    return { error: "Select a connected tenant channel before saving this agent." } as const;
  }

  const conflictingAgent = await args.tx.agent.findFirst({
    where: {
      channelId: args.channelId,
      ...(args.agentId ? { id: { not: args.agentId } } : {}),
    },
    select: { id: true, name: true },
  });

  if (conflictingAgent) {
    return {
      error: `This channel is already assigned to ${conflictingAgent.name}.`,
    } as const;
  }

  if (args.integrationIds.length === 0) {
    return { channel } as const;
  }

  const integrations = await args.tx.integrationConnection.findMany({
    where: {
      id: { in: args.integrationIds },
      tenantId: args.tenantId,
      status: ConnectionStatus.CONNECTED,
    },
  });

  if (integrations.length !== args.integrationIds.length) {
    return {
      error: "Tool steps must reference connected integrations owned by this tenant.",
    } as const;
  }

  return { channel, integrations } as const;
}

export type BuilderPreviewInput = {
  name: string;
  persona: string;
  tone: string;
  languagePreference?: string | null;
  channel?: Pick<ChannelConnection, "type"> | null;
  channelBehavior?: ChannelBehaviorConfig | null;
  conversationPlaybook?: ConversationPlaybookConfig | null;
  prompting?: PromptingConfig | null;
  knowledgeBlocks?: Array<{
    name: string;
    description: string;
    knowledgeContent?: string | null;
  }>;
  functionBlocks?: Array<{
    name: string;
    description: string;
    active?: boolean;
    parameters?: Array<{
      name: string;
      type: FunctionParameterConfig["type"];
      instruction?: string | null;
      allowedValues?: string[];
      required?: boolean;
    }>;
    reactionAction?: FunctionBlockConfig["reactionAction"];
    postAction?: FunctionBlockConfig["postAction"];
    disableDelayedMessages?: boolean;
    resultTargets?: Array<{
      type: FunctionResultTargetConfig["type"];
      label: string;
    }>;
    steps?: Array<{
      integrationType?: IntegrationConnection["type"] | ChannelType | string;
      action: string;
    }>;
  }>;
};
