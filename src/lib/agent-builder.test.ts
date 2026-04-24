import test from "node:test";
import assert from "node:assert/strict";
import { AgentStatus, FeatureType } from "@prisma/client";

import {
  agentDraftSchema,
  buildFeatureCreateInput,
  buildMultilingualGuidance,
  formatEnumLabel,
  getToolIntegrationIds,
  normalizeAgentSettings,
  normalizePromptingConfig,
  resolvePromptingIdentity,
} from "@/lib/agent-builder";

test("agentDraftSchema normalizes empty language preference to null", () => {
  const parsed = agentDraftSchema.parse({
    name: "Studio Concierge",
    persona: "Helpful assistant",
    tone: "friendly",
    languagePreference: "",
    channelId: "channel-1",
  });

  assert.equal(parsed.languagePreference, null);
  assert.equal(parsed.status, AgentStatus.DRAFT);
});

test("buildFeatureCreateInput preserves knowledge before tools and creates tool steps", () => {
  const input = agentDraftSchema.parse({
    name: "Studio Concierge",
    persona: "Helpful assistant",
    tone: "friendly",
    channelId: "channel-1",
    knowledgeBlocks: [
      {
        name: "Services",
        description: "What the studio offers",
        knowledgeContent: "Wedding films and highlight edits.",
      },
    ],
    toolBlocks: [
      {
        name: "Calendar check",
        description: "Verify availability",
        steps: [
          {
            integrationId: "integration-1",
            action: "check calendar",
            params: { window: "30d" },
          },
        ],
      },
    ],
  });

  const features = buildFeatureCreateInput(input);

  assert.equal(features.length, 2);
  assert.equal(features[0]?.type, FeatureType.KNOWLEDGE);
  assert.equal(features[0]?.sortOrder, 0);
  assert.equal(features[1]?.type, FeatureType.TOOL);
  assert.equal(features[1]?.sortOrder, 1);

  const createdSteps = features[1]?.steps;
  assert.ok(createdSteps && "create" in createdSteps);
});

test("getToolIntegrationIds returns unique ids only", () => {
  const input = agentDraftSchema.parse({
    name: "Studio Concierge",
    persona: "Helpful assistant",
    tone: "friendly",
    channelId: "channel-1",
    toolBlocks: [
      {
        name: "Calendar check",
        description: "Verify availability",
        steps: [
          {
            integrationId: "integration-1",
            action: "check calendar",
            params: {},
          },
          {
            integrationId: "integration-1",
            action: "create hold",
            params: {},
          },
        ],
      },
    ],
  });

  assert.deepEqual(getToolIntegrationIds(input), ["integration-1"]);
});

test("buildMultilingualGuidance defaults to multilingual-first behavior", () => {
  const guidance = buildMultilingualGuidance({
    channel: { type: "TELEGRAM" },
  });

  assert.match(guidance, /customer's language/i);
  assert.match(guidance, /No default response language is pinned/i);
  assert.match(guidance, /Telegram/);
});

test("formatEnumLabel humanizes enum-like strings", () => {
  assert.equal(formatEnumLabel("GOOGLE_CALENDAR"), "Google Calendar");
});

test("normalizeAgentSettings falls back to UTC for invalid legacy timezones", () => {
  const normalized = normalizeAgentSettings({
    defaultChatEnabled: true,
    timezone: "Mars/Phobos",
    scheduleEnabled: true,
    weeklySchedule: [
      { day: "monday", enabled: true, start: "09:00", end: "18:00" },
      { day: "tuesday", enabled: true, start: "09:00", end: "18:00" },
      { day: "wednesday", enabled: true, start: "09:00", end: "18:00" },
      { day: "thursday", enabled: true, start: "09:00", end: "18:00" },
      { day: "friday", enabled: true, start: "09:00", end: "18:00" },
      { day: "saturday", enabled: false, start: "09:00", end: "18:00" },
      { day: "sunday", enabled: false, start: "09:00", end: "18:00" },
    ],
  });

  assert.equal(normalized.timezone, "UTC");
});

test("agentDraftSchema preserves prompting config in channelConfig", () => {
  const parsed = agentDraftSchema.parse({
    name: "Studio Concierge",
    persona: "Helpful assistant",
    tone: "friendly",
    channelId: "channel-1",
    channelConfig: {
      prompting: {
        persona: "Studio concierge",
        tone: "premium",
        languagePreference: "Russian",
        instruction: "Keep answers brief and practical.",
        showContactIdentity: true,
        showChannelContext: false,
        notes: "Operator-only note.",
      },
    },
  });

  assert.deepEqual(parsed.channelConfig.prompting, {
    persona: "Studio concierge",
    tone: "premium",
    languagePreference: "Russian",
    instruction: "Keep answers brief and practical.",
    showContactIdentity: true,
    showChannelContext: false,
    notes: "Operator-only note.",
  });
});

test("agentDraftSchema preserves conversation playbook config in channelConfig", () => {
  const parsed = agentDraftSchema.parse({
    name: "Studio Concierge",
    persona: "Helpful assistant",
    tone: "friendly",
    channelId: "channel-1",
    channelConfig: {
      conversationPlaybook: {
        preset: "faq_then_convert",
        primaryGoal: "answer_faq",
        successAction: "qualified_lead_created",
        openingStrategy: "ask_for_whatever_is_missing",
        openingFields: ["service_needed"],
        discoveryFields: ["service_needed", "preferred_date", "preferred_time"],
        discoveryOrder: ["service_needed", "preferred_date", "preferred_time"],
        minInfoBeforeAvailability: ["service_needed", "preferred_date", "preferred_time"],
        minInfoBeforePricing: ["service_needed"],
        pricingBehavior: "only_when_asked",
        unavailableBehavior: "ask_the_customer_for_other_options",
        bookingBehavior: "request_confirmation_before_booking",
        afterFaqBehavior: "return_to_qualification",
        conversationMomentum: "end_with_next_step_or_question",
        fallbackBehavior: "ask_a_clarifying_question",
        notes: "Answer the FAQ, then bring the dialog back to qualification.",
      },
    },
  });

  assert.deepEqual(parsed.channelConfig.conversationPlaybook, {
    preset: "faq_then_convert",
    primaryGoal: "answer_faq",
    successAction: "qualified_lead_created",
    openingStrategy: "ask_for_whatever_is_missing",
    openingFields: ["service_needed"],
    discoveryFields: ["service_needed", "preferred_date", "preferred_time"],
    discoveryOrder: ["service_needed", "preferred_date", "preferred_time"],
    minInfoBeforeAvailability: ["service_needed", "preferred_date", "preferred_time"],
    minInfoBeforePricing: ["service_needed"],
    pricingBehavior: "only_when_asked",
    unavailableBehavior: "ask_the_customer_for_other_options",
    bookingBehavior: "request_confirmation_before_booking",
    afterFaqBehavior: "return_to_qualification",
    conversationMomentum: "end_with_next_step_or_question",
    fallbackBehavior: "ask_a_clarifying_question",
    notes: "Answer the FAQ, then bring the dialog back to qualification.",
  });
});

test("normalizePromptingConfig trims text and defaults visibility flags to false", () => {
  const normalized = normalizePromptingConfig({
    instruction: "  Be concise.  ",
    notes: "  Keep a premium tone.  ",
  });

  assert.deepEqual(normalized, {
    persona: null,
    tone: null,
    languagePreference: null,
    instruction: "Be concise.",
    showContactIdentity: false,
    showChannelContext: false,
    notes: "Keep a premium tone.",
  });
});

test("agentDraftSchema accepts prompting nulls from editor state and normalizes them away", () => {
  const parsed = agentDraftSchema.parse({
    name: "Studio Concierge",
    persona: "Helpful assistant",
    tone: "friendly",
    channelId: "channel-1",
    channelConfig: {
      prompting: {
        persona: null,
        tone: null,
        languagePreference: null,
        instruction: null,
        showContactIdentity: false,
        showChannelContext: true,
        notes: null,
      },
    },
  });

  assert.deepEqual(parsed.channelConfig.prompting, {
    persona: undefined,
    tone: undefined,
    languagePreference: undefined,
    instruction: undefined,
    showContactIdentity: false,
    showChannelContext: true,
    notes: undefined,
  });
});

test("resolvePromptingIdentity prefers prompting identity fields over legacy top-level ones", () => {
  const resolved = resolvePromptingIdentity({
    persona: "Legacy persona",
    tone: "friendly",
    languagePreference: "English",
    prompting: {
      persona: "Prompting persona",
      tone: "premium",
      languagePreference: "Russian",
    },
  });

  assert.equal(resolved.persona, "Prompting persona");
  assert.equal(resolved.tone, "premium");
  assert.equal(resolved.languagePreference, "Russian");
});
