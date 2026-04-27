import test from "node:test";
import assert from "node:assert/strict";
import { AgentStatus, FeatureType } from "@prisma/client";

import {
  agentDraftSchema,
  buildFeatureCreateInput,
  buildMultilingualGuidance,
  formatEnumLabel,
  getToolIntegrationIds,
  mapAgentToDraft,
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

test("buildFeatureCreateInput creates only KNOWLEDGE features", () => {
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

  assert.equal(features.length, 1);
  assert.equal(features[0]?.type, FeatureType.KNOWLEDGE);
  assert.equal(features[0]?.sortOrder, 0);
  assert.equal(features[0]?.knowledgeContent, "Wedding films and highlight edits.");
  assert.equal(features.some((feature) => feature.type === FeatureType.TOOL), false);
  assert.equal("steps" in features[0]!, false);
});

test("buildFeatureCreateInput ignores channelConfig.functionBlocks for Feature writes", () => {
  const input = agentDraftSchema.parse({
    name: "Studio Concierge",
    persona: "Helpful assistant",
    tone: "friendly",
    channelId: "channel-1",
    channelConfig: {
      functionBlocks: [
        {
          name: "Calendar check",
          description: "Verify availability",
          active: true,
          parameters: [],
          reactionAction: "ai_agent_decides",
          postAction: "continue_dialog",
          disableDelayedMessages: false,
          resultTargets: [],
          steps: [
            {
              integrationId: "integration-1",
              action: "check calendar",
              params: {},
            },
          ],
        },
      ],
    },
  });

  const features = buildFeatureCreateInput(input);

  assert.deepEqual(features, []);
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

test("getToolIntegrationIds reads from channelConfig.functionBlocks", () => {
  const input = agentDraftSchema.parse({
    name: "Studio Concierge",
    persona: "Helpful assistant",
    tone: "friendly",
    channelId: "channel-1",
    channelConfig: {
      functionBlocks: [
        {
          name: "Calendar check",
          description: "Verify availability",
          active: true,
          parameters: [],
          reactionAction: "ai_agent_decides",
          postAction: "continue_dialog",
          disableDelayedMessages: false,
          resultTargets: [],
          steps: [
            {
              integrationId: "int1",
              action: "check calendar",
              params: {},
            },
          ],
        },
      ],
    },
  });

  assert.deepEqual(getToolIntegrationIds(input), ["int1"]);
});

test("mapAgentToDraft exposes functionBlocks from channelConfig", () => {
  const createAgent = (
    channelConfig: Parameters<typeof mapAgentToDraft>[0]["channelConfig"],
  ): Parameters<typeof mapAgentToDraft>[0] =>
    ({
      id: "agent-1",
      tenantId: "tenant-1",
      name: "Studio Concierge",
      persona: "Helpful assistant",
      tone: "friendly",
      languagePreference: null,
      status: AgentStatus.DRAFT,
      channelId: "channel-1",
      channelConfig,
      channel: null,
      features: [],
    }) as unknown as Parameters<typeof mapAgentToDraft>[0];

  const draft = mapAgentToDraft(
    createAgent({
      functionBlocks: [
        {
          name: "fn1",
          description: "Create a row",
          active: true,
          parameters: [],
          reactionAction: "ai_agent_decides",
          postAction: "continue_dialog",
          disableDelayedMessages: false,
          resultTargets: [
            {
              type: "integration_step",
              label: "Sheet row",
              primaryStepId: "s1",
            },
          ],
          steps: [
            {
              id: "s1",
              integrationId: "integration-1",
              action: "append row",
              params: "{}",
            },
          ],
        },
      ],
    }),
  );

  assert.equal(draft.functionBlocks.length, 1);
  assert.equal(draft.functionBlocks[0]?.name, "fn1");
  assert.equal(draft.functionBlocks[0]?.steps[0]?.id, "s1");
  assert.equal(draft.functionBlocks[0]?.resultTargets[0]?.primaryStepId, "s1");
  assert.equal((draft as any).toolBlocks, undefined);
  assert.equal("toolBlocks" in draft, false);

  assert.deepEqual(mapAgentToDraft(createAgent(null)).functionBlocks, []);
  assert.deepEqual(mapAgentToDraft(createAgent({})).functionBlocks, []);
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
