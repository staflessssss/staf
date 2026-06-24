import test from "node:test";
import assert from "node:assert/strict";
import { AgentStatus, ChannelType, ConnectionStatus, FeatureType, IntegrationType } from "@prisma/client";

import {
  agentDraftSchema,
  buildFeatureCreateInput,
  buildMultilingualGuidance,
  formatAgentDraftValidationError,
  formatEnumLabel,
  getDefaultChannelBehaviorConfig,
  getDefaultControlConfig,
  getEnabledIntegrationIds,
  getFunctionExecutionViolation,
  getFunctionIntegrationAllowlistViolation,
  getConversationPlaybookPreset,
  getFunctionIntegrationIds,
  getFunctionStepValidationViolation,
  getUnsupportedFunctionIntegrationViolation,
  hydrateFunctionBlocksForRuntime,
  mapAgentToDraft,
  normalizeAgentSettings,
  normalizeIntegrationsConfig,
  normalizePromptingConfig,
  resolvePromptingIdentity,
} from "@/lib/agent-config";

test("formatAgentDraftValidationError explains incomplete Knowledge items", () => {
  const parsed = agentDraftSchema.safeParse({
    name: "Studio Concierge",
    persona: "Helpful assistant",
    tone: "friendly",
    channelId: "channel-1",
    knowledgeBlocks: [
      {
        name: "Pricing",
        description: "Use for price questions",
        knowledgeContent: "Starter package is $100.",
      },
      {
        name: "item",
        description: "Use for item questions",
        knowledgeContent: "",
      },
    ],
  });

  assert.equal(parsed.success, false);

  if (!parsed.success) {
    assert.equal(
      formatAgentDraftValidationError(parsed.error),
      "Knowledge item 2: facts are required.",
    );
  }
});

test("agentDraftSchema accepts hidden null fields from workspace defaults", () => {
  const parsed = agentDraftSchema.parse({
    name: "Studio Concierge",
    persona: "Helpful assistant",
    tone: "friendly",
    languagePreference: null,
    channelId: "channel-1",
    channelConfig: {
      channelBehavior: getDefaultChannelBehaviorConfig(null),
      conversationPlaybook: getConversationPlaybookPreset("general_lead_capture"),
      control: getDefaultControlConfig(),
    },
    knowledgeBlocks: [
      {
        name: "Pricing",
        description: "Use for price questions",
        knowledgeContent: "Starter package is $100.",
      },
    ],
  });

  assert.equal(parsed.languagePreference, null);
  assert.equal(parsed.channelConfig.channelBehavior?.notes, undefined);
  assert.equal(parsed.channelConfig.conversationPlaybook?.notes, undefined);
  assert.equal(parsed.channelConfig.control?.antiSpamAutoReply, undefined);
  assert.equal(parsed.channelConfig.control?.resumeMessage, undefined);
  assert.equal(parsed.knowledgeBlocks[0]?.name, "Pricing");
});

test("buildFeatureCreateInput creates a new simple Knowledge item after workspace validation", () => {
  const parsed = agentDraftSchema.parse({
    name: "Knowledge Agent",
    persona: "Answer from saved facts.",
    tone: "friendly",
    languagePreference: null,
    channelId: "channel-1",
    channelConfig: {
      channelBehavior: getDefaultChannelBehaviorConfig(null),
      conversationPlaybook: getConversationPlaybookPreset("general_lead_capture"),
      control: getDefaultControlConfig(),
    },
    knowledgeBlocks: [
      {
        name: "awd",
        description: "da",
        knowledgeContent: "da",
      },
    ],
  });

  assert.deepEqual(buildFeatureCreateInput(parsed), [
    {
      name: "awd",
      description: "da",
      type: FeatureType.KNOWLEDGE,
      sortOrder: 0,
      knowledgeContent: "da",
    },
  ]);
});

test("agentDraftSchema normalizes empty language preference to null", () => {
  const parsed = agentDraftSchema.parse({
    name: "Studio Concierge",
    persona: "Helpful assistant",
    tone: "friendly",
    languagePreference: "",
    channelId: "channel-1",
  });

  assert.equal(parsed.languagePreference, null);
  assert.equal(parsed.status, AgentStatus.ACTIVE);
});

test("instagram default behavior buffers rapid messages and spaces split replies", () => {
  const behavior = getDefaultChannelBehaviorConfig(ChannelType.INSTAGRAM);

  assert.equal(behavior.messageFormat, "split_into_2_3_messages");
  assert.equal(behavior.bufferDelaySeconds, 8);
  assert.equal(behavior.splitMessageDelaySeconds, 6);
});

test("agentDraftSchema accepts explicit active and paused statuses", () => {
  const createPayload = (status: AgentStatus) => ({
    name: "Studio Concierge",
    persona: "Helpful assistant",
    tone: "friendly",
    channelId: "channel-1",
    status,
  });

  assert.equal(
    agentDraftSchema.parse(createPayload(AgentStatus.ACTIVE)).status,
    AgentStatus.ACTIVE,
  );
  assert.equal(
    agentDraftSchema.parse(createPayload(AgentStatus.PAUSED)).status,
    AgentStatus.PAUSED,
  );
});

test("agentDraftSchema allows disabled schedules to keep invalid legacy windows", () => {
  const parsed = agentDraftSchema.parse({
    name: "Studio Concierge",
    persona: "Helpful assistant",
    tone: "friendly",
    channelId: "channel-1",
    channelConfig: {
      agentSettings: {
        defaultChatEnabled: true,
        timezone: "UTC",
        scheduleEnabled: false,
        weeklySchedule: [
          { day: "monday", enabled: true, start: "18:00", end: "09:00" },
        ],
      },
    },
  });

  assert.equal(parsed.channelConfig.agentSettings?.scheduleEnabled, false);
  assert.equal(parsed.channelConfig.agentSettings?.weeklySchedule[0]?.start, "18:00");
});

test("agentDraftSchema rejects enabled schedules with invalid windows", () => {
  const parsed = agentDraftSchema.safeParse({
    name: "Studio Concierge",
    persona: "Helpful assistant",
    tone: "friendly",
    channelId: "channel-1",
    channelConfig: {
      agentSettings: {
        defaultChatEnabled: true,
        timezone: "UTC",
        scheduleEnabled: true,
        weeklySchedule: [
          { day: "monday", enabled: true, start: "18:00", end: "09:00" },
        ],
      },
    },
  });

  assert.equal(parsed.success, false);
});

test("agentDraftSchema rejects impossible schedule times", () => {
  const parsed = agentDraftSchema.safeParse({
    name: "Studio Concierge",
    persona: "Helpful assistant",
    tone: "friendly",
    channelId: "channel-1",
    channelConfig: {
      agentSettings: {
        defaultChatEnabled: true,
        timezone: "UTC",
        scheduleEnabled: true,
        weeklySchedule: [
          { day: "monday", enabled: true, start: "25:00", end: "26:00" },
        ],
      },
    },
  });

  assert.equal(parsed.success, false);
});

test("normalizeAgentSettings falls back when legacy schedule times are impossible", () => {
  const normalized = normalizeAgentSettings({
    weeklySchedule: [
      { day: "monday", enabled: true, start: "25:00", end: "26:00" },
    ],
  });

  assert.equal(normalized.weeklySchedule[0]?.start, "09:00");
  assert.equal(normalized.weeklySchedule[0]?.end, "18:00");
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
  });

  const features = buildFeatureCreateInput(input);

  assert.equal(features.length, 1);
  assert.equal(features[0]?.type, FeatureType.KNOWLEDGE);
  assert.equal(features[0]?.sortOrder, 0);
  assert.equal(features[0]?.knowledgeContent, "Wedding films and highlight edits.");
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

test("getFunctionIntegrationIds reads from channelConfig.functionBlocks", () => {
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

  assert.deepEqual(getFunctionIntegrationIds(input), ["int1"]);
});

test("agentDraftSchema preserves per-agent enabled integration ids", () => {
  const input = agentDraftSchema.parse({
    name: "Studio Concierge",
    persona: "Helpful assistant",
    tone: "friendly",
    channelId: "channel-1",
    channelConfig: {
      integrations: {
        enabledIds: ["integration_sheets", "integration_sheets", " integration_calendar "],
      },
    },
  });

  assert.deepEqual(input.channelConfig.integrations?.enabledIds, [
    "integration_sheets",
    "integration_calendar",
  ]);
  assert.deepEqual(getEnabledIntegrationIds(input), [
    "integration_sheets",
    "integration_calendar",
  ]);
});

test("normalizeIntegrationsConfig drops empty ids and keeps tenant integrations reusable", () => {
  assert.deepEqual(
    normalizeIntegrationsConfig({
      enabledIds: [" integration_shared ", "", "integration_shared", "integration_crm"],
    }),
    {
      enabledIds: ["integration_shared", "integration_crm"],
    },
  );
});

test("getFunctionIntegrationAllowlistViolation blocks function steps outside per-agent allowlist", () => {
  const input = agentDraftSchema.parse({
    name: "Studio Concierge",
    persona: "Helpful assistant",
    tone: "friendly",
    channelId: "channel-1",
    channelConfig: {
      integrations: {
        enabledIds: ["integration_sheets"],
      },
      functionBlocks: [
        {
          name: "Calendar check",
          description: "Verify availability",
          active: false,
          parameters: [],
          reactionAction: "ai_agent_decides",
          postAction: "continue_dialog",
          disableDelayedMessages: false,
          resultTargets: [],
          steps: [
            {
              integrationId: "integration_calendar",
              action: "check calendar",
              params: {},
            },
          ],
        },
      ],
    },
  });

  assert.deepEqual(getFunctionIntegrationAllowlistViolation(input), {
    integrationIds: ["integration_calendar"],
    error: "Function steps must reference integrations enabled for this agent.",
  });
});

test("hydrateFunctionBlocksForRuntime skips connected integrations disabled for the agent", async () => {
  const fakeDatabase = {
    integrationConnection: {
      findMany: async () => [
        {
          id: "integration_sheets",
          tenantId: "tenant-1",
          type: IntegrationType.GOOGLE_SHEETS,
          status: ConnectionStatus.CONNECTED,
          credentialsEnc: "enc",
          metadata: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "integration_calendar",
          tenantId: "tenant-1",
          type: IntegrationType.GOOGLE_CALENDAR,
          status: ConnectionStatus.CONNECTED,
          credentialsEnc: "enc",
          metadata: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    },
  };

  const [feature] = await hydrateFunctionBlocksForRuntime(
    {
      id: "agent-1",
      tenantId: "tenant-1",
      channelConfig: {
        integrations: { enabledIds: ["integration_sheets"] },
        functionBlocks: [
          {
            name: "Lead routing",
            description: "Route leads",
            active: true,
            parameters: [],
            reactionAction: "ai_agent_decides",
            postAction: "continue_dialog",
            disableDelayedMessages: false,
            resultTargets: [],
            steps: [
              {
                integrationId: "integration_sheets",
                action: "append row",
                params: {},
              },
              {
                integrationId: "integration_calendar",
                action: "check calendar",
                params: {},
              },
            ],
          },
        ],
      },
    },
    fakeDatabase as never,
  );

  assert.deepEqual(
    feature?.steps.map((step) => step.integrationId),
    ["integration_sheets"],
  );
});

test("hydrateFunctionBlocksForRuntime does not expose inactive functions as runtime tools", async () => {
  const fakeDatabase = {
    integrationConnection: {
      findMany: async () => [
        {
          id: "integration_sheets",
          tenantId: "tenant-1",
          type: IntegrationType.GOOGLE_SHEETS,
          status: ConnectionStatus.CONNECTED,
          credentialsEnc: "enc",
          metadata: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    },
  };

  const features = await hydrateFunctionBlocksForRuntime(
    {
      id: "agent-1",
      tenantId: "tenant-1",
      channelConfig: {
        integrations: { enabledIds: ["integration_sheets"] },
        functionBlocks: [
          {
            name: "Inactive sheet action",
            description: "Should not be callable",
            active: false,
            parameters: [],
            reactionAction: "ai_agent_decides",
            postAction: "continue_dialog",
            disableDelayedMessages: false,
            resultTargets: [],
            steps: [
              {
                integrationId: "integration_sheets",
                action: "append row",
                params: {},
              },
            ],
          },
        ],
      },
    },
    fakeDatabase as never,
  );

  assert.deepEqual(features, []);
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

  assert.deepEqual(mapAgentToDraft(createAgent(null)).functionBlocks, []);
  assert.deepEqual(mapAgentToDraft(createAgent({})).functionBlocks, []);
});

test("buildMultilingualGuidance defaults to multilingual-first behavior", () => {
  const guidance = buildMultilingualGuidance({
    channel: { type: "TELEGRAM" },
  });

  assert.match(guidance, /customer's language/i);
  assert.match(guidance, /remain multilingual/i);
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

test("normalizePromptingConfig preserves structured simple-runtime reply copy", () => {
  const normalized = normalizePromptingConfig({
    replyStyle: {
      greetingOpening: "  Welcome 🤍  ",
      venueAcknowledgement: "  {{venue}} looks beautiful.  ",
      calendarAlternativesQuestion: "  Which time works?  ",
    },
  });

  assert.deepEqual(normalized.replyStyle, {
    greetingOpening: "Welcome 🤍",
    venueAcknowledgement: "{{venue}} looks beautiful.",
    calendarAlternativesQuestion: "Which time works?",
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

test("getFunctionExecutionViolation blocks active functions without an execution backend", () => {
  const draft = agentDraftSchema.parse({
    name: "Studio Concierge",
    persona: "Helpful assistant",
    tone: "friendly",
    channelId: "channel-1",
    channelConfig: {
      functionBlocks: [
        {
          name: "Book consultation",
          description: "Book a consultation when the customer chooses a time.",
          active: true,
          parameters: [],
          reactionAction: "ai_agent_decides",
          postAction: "continue_dialog",
          disableDelayedMessages: false,
          resultTargets: [],
          steps: [],
        },
      ],
    },
  });

  assert.deepEqual(getFunctionExecutionViolation(draft), {
    functionName: "Book consultation",
    error:
      'Function "Book consultation" needs a result delivery backend before it can be active.',
  });

  draft.channelConfig.functionBlocks![0]!.active = false;
  assert.equal(getFunctionExecutionViolation(draft), null);
});

test("getUnsupportedFunctionIntegrationViolation blocks integrations without live executors", () => {
  const draft = agentDraftSchema.parse({
    name: "Studio Concierge",
    persona: "Helpful assistant",
    tone: "friendly",
    channelId: "channel-1",
    channelConfig: {
      integrations: {
        enabledIds: ["hubspot-1"],
      },
      functionBlocks: [
        {
          name: "Create CRM lead",
          description: "Create a lead record in the CRM.",
          active: true,
          parameters: [],
          reactionAction: "ai_agent_decides",
          postAction: "continue_dialog",
          disableDelayedMessages: false,
          resultTargets: [],
          steps: [
            {
              integrationId: "hubspot-1",
              action: "create lead",
              params: {},
            },
          ],
        },
      ],
    },
  });

  const violation = getUnsupportedFunctionIntegrationViolation(draft, [
    { id: "hubspot-1", type: IntegrationType.HUBSPOT },
  ]);

  assert.deepEqual(violation, {
    integrationId: "hubspot-1",
    integrationType: IntegrationType.HUBSPOT,
    error: "Hubspot does not have a live Function executor yet.",
  });

  assert.equal(
    getUnsupportedFunctionIntegrationViolation(draft, [
      { id: "hubspot-1", type: IntegrationType.GOOGLE_SHEETS },
    ]),
    null,
  );
});

test("getFunctionStepValidationViolation blocks invalid typed execution params", () => {
  const draft = agentDraftSchema.parse({
    name: "Studio Concierge",
    persona: "Helpful assistant",
    tone: "friendly",
    channelId: "channel-1",
    channelConfig: {
      integrations: {
        enabledIds: ["calendar-1", "sheets-1"],
      },
      functionBlocks: [
        {
          name: "Check sheet",
          description: "Look up a row in Google Sheets.",
          active: true,
          parameters: [],
          reactionAction: "ai_agent_decides",
          postAction: "continue_dialog",
          disableDelayedMessages: false,
          resultTargets: [],
          steps: [
            {
              integrationId: "sheets-1",
              action: "lookup rows in sheet",
              params: {
                operation: "get_rows",
                spreadsheetId: "",
                sheetName: "Leads",
                filters: [{ column: "Email", operator: "equals", valueSource: "email", value: "" }],
              },
            },
          ],
        },
      ],
    },
  });

  assert.deepEqual(getFunctionStepValidationViolation(draft, [
    { id: "sheets-1", type: IntegrationType.GOOGLE_SHEETS },
  ]), {
    functionName: "Check sheet",
    integrationId: "sheets-1",
    error: "Check sheet: Google Sheets needs a selected spreadsheet.",
  });
});
