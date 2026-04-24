import test from "node:test";
import assert from "node:assert/strict";
import {
  AgentStatus,
  ChannelType,
  ConnectionStatus,
  FeatureType,
  IntegrationType,
} from "@prisma/client";

import { assessAgentReadiness } from "@/lib/deploy";

function createAgentFixture() {
  return {
    id: "agent-1",
    tenantId: "tenant-1",
    channelId: "channel-1",
    name: "Studio Concierge",
    persona: "Helpful front desk operator",
    tone: "friendly",
    languagePreference: "Russian",
    status: AgentStatus.DRAFT,
    channelConfig: null,
    n8nWorkflowId: null,
    webhookSecret: null,
    deployedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    channel: {
      id: "channel-1",
      tenantId: "tenant-1",
      type: ChannelType.TELEGRAM,
      status: ConnectionStatus.CONNECTED,
      credentialsEnc: "enc",
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    features: [
      {
        id: "feature-k",
        agentId: "agent-1",
        name: "Services",
        description: "What the business offers",
        type: FeatureType.KNOWLEDGE,
        sortOrder: 0,
        knowledgeContent: "Wedding films and edits",
        createdAt: new Date(),
        updatedAt: new Date(),
        steps: [],
      },
      {
        id: "feature-t",
        agentId: "agent-1",
        name: "Calendar check",
        description: "Check availability",
        type: FeatureType.TOOL,
        sortOrder: 1,
        knowledgeContent: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        steps: [
          {
            id: "step-1",
            featureId: "feature-t",
            integrationId: "integration-1",
            action: "check calendar",
            params: {},
            sortOrder: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            integration: {
              id: "integration-1",
              tenantId: "tenant-1",
              type: IntegrationType.GOOGLE_CALENDAR,
              status: ConnectionStatus.CONNECTED,
              credentialsEnc: "enc",
              metadata: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          },
        ],
      },
    ],
    conversations: [],
  };
}

test("assessAgentReadiness reports ready draft when all builder essentials exist", () => {
  const report = assessAgentReadiness(createAgentFixture());

  assert.equal(report.ready, true);
  assert.equal(report.status, "ready_for_phase_6");
  assert.match(report.summary, /ready for Phase 6/i);
});

test("assessAgentReadiness reports missing tool readiness when tool steps are invalid", () => {
  const fixture = createAgentFixture();
  fixture.features[1].steps[0].integration.tenantId = "other-tenant";

  const report = assessAgentReadiness(fixture);

  assert.equal(report.ready, false);
  assert.equal(report.status, "needs_changes");
  assert.equal(
    report.items.find((item) => item.key === "tools")?.done,
    false,
  );
});

test("assessAgentReadiness requires at least one executable tool step", () => {
  const fixture = createAgentFixture();
  fixture.features[1].steps = [];

  const report = assessAgentReadiness(fixture);

  assert.equal(report.ready, false);
  assert.equal(report.items.find((item) => item.key === "tools")?.done, false);
});

test("assessAgentReadiness allows deploys without tools for reply-only agents", () => {
  const fixture = createAgentFixture();
  fixture.features = fixture.features.filter((feature) => feature.type !== FeatureType.TOOL);

  const report = assessAgentReadiness(fixture);

  assert.equal(report.ready, true);
  assert.equal(report.items.find((item) => item.key === "tools")?.done, true);
});

test("getDeployStatus keeps Instagram webhook paths free of embedded secrets", async () => {
  const { getDeployStatus } = await import("@/lib/deploy");
  const fixture = createAgentFixture();
  fixture.channel.type = ChannelType.INSTAGRAM;
  fixture.webhookSecret = "preview-secret";

  const report = getDeployStatus(fixture);
  const channelConfig =
    report.channelConfig && typeof report.channelConfig === "object" && !Array.isArray(report.channelConfig)
      ? (report.channelConfig as Record<string, unknown>)
      : {};

  assert.equal(channelConfig.webhookPath, "/api/webhooks/instagram?agentId=agent-1");
});

test("getDeployStatus keeps Gmail webhook paths authenticated for the relay boundary", async () => {
  const { getDeployStatus } = await import("@/lib/deploy");
  const fixture = createAgentFixture();
  fixture.channel.type = ChannelType.GMAIL;
  fixture.webhookSecret = "preview-secret";

  const report = getDeployStatus(fixture);
  const channelConfig =
    report.channelConfig && typeof report.channelConfig === "object" && !Array.isArray(report.channelConfig)
      ? (report.channelConfig as Record<string, unknown>)
      : {};

  assert.equal(
    channelConfig.webhookPath,
    "/api/webhooks/gmail?agentId=agent-1",
  );
  assert.equal(channelConfig.webhookAuthHeaderName, "x-stafless-webhook-secret");
});
