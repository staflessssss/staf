import test from "node:test";
import assert from "node:assert/strict";

import { buildRuntimeExecutionPolicy, buildSystemPrompt } from "@/lib/prompt-composer";

test("buildSystemPrompt includes multilingual behavior, playbook, channel behavior, knowledge, and functions", () => {
  const prompt = buildSystemPrompt({
    name: "Studio Concierge",
    persona: "A premium front-desk operator",
    tone: "calm",
    languagePreference: "Russian",
    channel: { type: "INSTAGRAM" },
    prompting: {
      persona: "Moon-style studio assistant",
      tone: "premium",
      languagePreference: "Russian",
      instruction:
        "You are the AI assistant for the studio. Reply briefly, clearly, and keep the dialog moving.",
      showContactIdentity: true,
      showChannelContext: false,
      notes: "Keep operator visibility in mind.",
    },
    channelBehavior: {
      preset: "instagram_recommended",
      responseLength: "short",
      messageFormat: "split_into_2_3_messages",
      tonePace: "fast",
      ctaStyle: "offer_options",
      emojiUsage: "limited",
      splitMessageDelaySeconds: 2,
      bufferDelaySeconds: 1,
      useSignature: false,
      useRichFormatting: false,
      allowAttachments: false,
      followUpEnabled: true,
      followUpRules: [
        {
          delayDays: 0,
          delayHours: 4,
          delayMinutes: 0,
          sendLimit: "once_per_dialog",
          outOfHoursBehavior: "send_immediately_ignore_schedule",
          instruction: "Checking in in case you still need pricing details.",
        },
      ],
      notes: "Keep it quick.",
    },
    conversationPlaybook: {
      preset: "beauty_salon_lead_capture",
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
      notes: "Ask what service they want before talking about specialists.",
    },
    knowledgeBlocks: [
      {
        name: "Services",
        description: "What the studio offers",
        knowledgeContent: "Wedding films and highlight edits.",
      },
    ],
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
        steps: [{ integrationType: "GOOGLE_CALENDAR", action: "check calendar" }],
      },
    ],
  });

  assert.match(prompt, /Agent identity: Studio Concierge/);
  assert.match(prompt, /reply in the customer's language by default/);
  assert.match(prompt, /Channel: Instagram/);
  assert.match(prompt, /Prompting/);
  assert.match(prompt, /Persona: Moon-style studio assistant/);
  assert.match(prompt, /Tone: premium/);
  assert.match(prompt, /Instruction:\nYou are the AI assistant for the studio/);
  assert.doesNotMatch(prompt, /Show client identity in runtime context/);
  assert.doesNotMatch(prompt, /Show channel context in runtime prompt/);
  assert.doesNotMatch(prompt, /Preferred language:/);
  assert.match(prompt, /Operator notes: Keep operator visibility in mind\./);
  assert.match(prompt, /Channel behavior/);
  assert.match(prompt, /Conversation playbook/);
  assert.match(
    prompt,
    /Opening rule: In the first reply of a new conversation, greet the customer naturally/i,
  );
  assert.match(prompt, /Emoji rule: Use only these emojis when needed: 🤍 ✨ 🎥/);
  assert.match(prompt, /Primary goal: capture_lead/);
  assert.match(prompt, /Playbook runtime guidance/);
  assert.match(prompt, /Opening strategy: Ask Two Things Together\./);
  assert.match(
    prompt,
    /Availability gate: Do not check availability until you know service needed, preferred date, preferred time\./,
  );
  assert.match(
    prompt,
    /Pricing gate: After Qualification\. Do not send pricing before you know service needed\./,
  );
  assert.match(prompt, /After FAQ: Return To Qualification\./);
  assert.match(prompt, /Response length: short/);
  assert.match(prompt, /Message buffer delay \(seconds\): 1/);
  assert.match(prompt, /Follow-up enabled: yes/);
  assert.match(prompt, /Knowledge/);
  assert.match(prompt, /When to use: What the studio offers/);
  assert.match(prompt, /Knowledge: Wedding films and highlight edits\./);
  assert.match(prompt, /Functions/);
  assert.match(prompt, /Google Calendar: check calendar/);
  assert.match(prompt, /Runtime execution policy/);
  assert.match(prompt, /Never invent integration results/);
});

test("buildSystemPrompt defaults prompting visibility flags to no when not configured", () => {
  const prompt = buildSystemPrompt({
    name: "Studio Concierge",
    persona: "Helpful assistant",
    tone: "friendly",
    channel: { type: "TELEGRAM" },
  });

  assert.match(prompt, /Instruction: none configured/);
  assert.doesNotMatch(prompt, /Show client identity in runtime context/);
  assert.doesNotMatch(prompt, /Show channel context in runtime prompt/);
});

test("buildSystemPrompt keeps a preserve-model-voice agent focused on prompt, knowledge, and functions", () => {
  const prompt = buildSystemPrompt({
    name: "Myndful Instagram Agent",
    persona: "Taras",
    tone: "warm",
    channel: { type: "INSTAGRAM" },
    prompting: {
      instruction: "Speak naturally as Taras.",
      preserveModelVoice: true,
      showContactIdentity: false,
      showChannelContext: false,
    },
    channelBehavior: {
      followUpEnabled: true,
      followUpRules: [
        {
          delayDays: 1,
          delayHours: 0,
          delayMinutes: 0,
          sendLimit: "once_per_dialog",
          outOfHoursBehavior: "send_immediately_ignore_schedule",
          instruction: "Long delayed follow-up that does not belong in every reply.",
        },
      ],
    },
    knowledgeBlocks: [
      {
        name: "Pricing",
        description: "Regional collections",
        knowledgeContent: "Florida starts at $2,800.",
      },
    ],
    functionBlocks: [
      {
        name: "Check availability",
        description: "Verify the wedding date.",
        active: true,
        parameters: [],
        reactionAction: "ai_agent_decides",
        postAction: "continue_dialog",
        disableDelayedMessages: false,
        resultTargets: [],
        steps: [],
      },
    ],
  });

  assert.match(prompt, /Speak naturally as Taras/);
  assert.match(prompt, /Florida starts at \$2,800/);
  assert.match(prompt, /Check availability: Verify the wedding date/);
  assert.doesNotMatch(prompt, /Channel behavior/);
  assert.doesNotMatch(prompt, /Follow-up rules/);
  assert.doesNotMatch(prompt, /Conversation playbook/);
  assert.doesNotMatch(prompt, /Runtime execution policy/);
});

test("buildRuntimeExecutionPolicy exposes shared live-prompt rules in one place", () => {
  const policy = buildRuntimeExecutionPolicy();

  assert.match(policy, /Use configured tools when they materially help/);
  assert.match(policy, /Never say a call is booked, reserved, confirmed/);
  assert.match(policy, /If the current channel already provides the customer's email/);
});
