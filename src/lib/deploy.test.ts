import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  AgentStatus,
  ChannelType,
  ConnectionStatus,
  FeatureType,
  IntegrationType,
} from "@prisma/client";

import type { AgentWithConfigData } from "@/lib/agent-config";
import { assessAgentReadiness } from "@/lib/deploy";

const originalAppBaseUrl = process.env.APP_BASE_URL;
const originalNextAuthUrl = process.env.NEXTAUTH_URL;

afterEach(() => {
  if (originalAppBaseUrl === undefined) {
    delete process.env.APP_BASE_URL;
  } else {
    process.env.APP_BASE_URL = originalAppBaseUrl;
  }

  if (originalNextAuthUrl === undefined) {
    delete process.env.NEXTAUTH_URL;
  } else {
    process.env.NEXTAUTH_URL = originalNextAuthUrl;
  }
});

function createAgentFixture(): AgentWithConfigData {
  return {
    id: "agent-1",
    tenantId: "tenant-1",
    channelId: "channel-1",
    name: "Studio Concierge",
    persona: "Helpful front desk operator",
    tone: "friendly",
    languagePreference: "Russian",
    status: AgentStatus.DRAFT,
    channelConfig: {
      functionBlocks: [
        {
          name: "Calendar check",
          description: "Check availability",
          active: true,
          parameters: [],
          reactionAction: "ai_agent_decides",
          postAction: "continue_dialog",
          disableDelayedMessages: false,
          resultTargets: [],
          steps: [
            {
              id: "step-1",
              integrationId: "integration-1",
              action: "check calendar",
              params: {},
            },
          ],
        },
      ],
    },
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
      },
    ],
  };
}

function createIntegration(tenantId = "tenant-1") {
  return {
    id: "integration-1",
    tenantId,
    type: IntegrationType.GOOGLE_CALENDAR,
    status: ConnectionStatus.CONNECTED,
    credentialsEnc: "enc",
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function createDbStub(integration = createIntegration()) {
  return {
    integrationConnection: {
      findMany: async ({
        where,
      }: {
        where: { tenantId: string; id: { in: string[] } };
      }) =>
        integration.tenantId === where.tenantId && where.id.in.includes(integration.id)
          ? [integration]
          : [],
    },
  } as never;
}

test("assessAgentReadiness reports ready draft when all workspace essentials exist", async () => {
  const fixture = createAgentFixture();
  const report = await assessAgentReadiness(fixture, createDbStub());

  assert.equal(report.ready, true);
  assert.equal(report.status, "ready_for_phase_6");
  assert.match(report.summary, /ready for Phase 6/i);
});

test("assessAgentReadiness reports missing tool readiness when tool steps are invalid", async () => {
  const fixture = createAgentFixture();

  const report = await assessAgentReadiness(fixture, createDbStub(createIntegration("other-tenant")));

  assert.equal(report.ready, false);
  assert.equal(report.status, "needs_changes");
  assert.equal(
    report.items.find((item) => item.key === "tools")?.done,
    false,
  );
});

test("assessAgentReadiness requires at least one executable tool step", async () => {
  const fixture = createAgentFixture();
  (
    ((fixture.channelConfig as Record<string, unknown>).functionBlocks as Array<Record<string, unknown>>)[0]
      .steps as Array<Record<string, unknown>>
  ) = [];

  const report = await assessAgentReadiness(fixture, createDbStub());

  assert.equal(report.ready, false);
  assert.equal(report.items.find((item) => item.key === "tools")?.done, false);
});

test("assessAgentReadiness allows deploys without tools for reply-only agents", async () => {
  const fixture = createAgentFixture();
  (fixture.channelConfig as Record<string, unknown>).functionBlocks = [];

  const report = await assessAgentReadiness(fixture, createDbStub());

  assert.equal(report.ready, true);
  assert.equal(report.items.find((item) => item.key === "tools")?.done, true);
});

test("getDeployStatus keeps Instagram webhook paths free of embedded secrets", async () => {
  const { getDeployStatus } = await import("@/lib/deploy");
  process.env.APP_BASE_URL = "https://app.stafless.test";
  const fixture = createAgentFixture();
  fixture.channel.type = ChannelType.INSTAGRAM;
  fixture.webhookSecret = "preview-secret";

  const report = await getDeployStatus(fixture, createDbStub());
  const channelConfig =
    report.channelConfig && typeof report.channelConfig === "object" && !Array.isArray(report.channelConfig)
      ? (report.channelConfig as Record<string, unknown>)
      : {};

  assert.equal(channelConfig.webhookPath, "/api/webhooks/instagram?agentId=agent-1");
  assert.equal(
    channelConfig.webhookUrl,
    "https://app.stafless.test/api/webhooks/instagram?agentId=agent-1",
  );
  assert.equal(channelConfig.webhookRegistration, "ready_to_register");
  assert.equal(channelConfig.outboundMode, "meta_graph_api");
});

test("getDeployStatus keeps Gmail webhook paths authenticated for the relay boundary", async () => {
  const { getDeployStatus } = await import("@/lib/deploy");
  const fixture = createAgentFixture();
  fixture.channel.type = ChannelType.GMAIL;
  fixture.webhookSecret = "preview-secret";

  const report = await getDeployStatus(fixture, createDbStub());
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
