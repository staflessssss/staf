import assert from "node:assert/strict";
import test from "node:test";

import { ChannelType } from "@prisma/client";

import { buildAgentRuntimeProfile } from "@/lib/agent-runtime-profile";

test("voice-first profile exposes configured and system actions", () => {
  const profile = buildAgentRuntimeProfile({
    agent: {
      channel: { type: ChannelType.INSTAGRAM },
      channelConfig: {
        prompting: { preserveModelVoice: true },
        functionBlocks: [
          {
            name: "Check availability",
            description: "Checks the wedding date.",
            active: true,
            parameters: [{ name: "date", type: "date", required: true, allowedValues: [] }],
            steps: [{ integrationId: "sheets", action: "check availability", params: {} }],
          },
        ],
        priceAttachmentsByRegion: {
          FL: { imageUrl: "https://cdn.example.com/fl-guide.png" },
        },
      },
    },
    channels: [
      {
        type: ChannelType.TELEGRAM,
        metadata: { ownerHandoff: { enabled: true, ownerChatId: "123" } },
      },
    ],
  });

  assert.equal(profile.mode, "voice_first");
  assert.equal(profile.conversationConfiguration, "prompting");
  assert.deepEqual(
    profile.actions.map((action) => action.name),
    ["Check availability", "Send collections guide", "Request owner handoff"],
  );
  assert.equal(profile.configuredActionCount, 1);
  assert.equal(profile.systemActionCount, 2);
});

test("guided profile does not advertise unavailable system actions", () => {
  const profile = buildAgentRuntimeProfile({
    agent: {
      channel: { type: ChannelType.TELEGRAM },
      channelConfig: {
        prompting: { preserveModelVoice: false },
        functionBlocks: [],
      },
    },
  });

  assert.equal(profile.mode, "guided");
  assert.equal(profile.conversationConfiguration, "prompting_and_playbook");
  assert.deepEqual(profile.actions, []);
});
