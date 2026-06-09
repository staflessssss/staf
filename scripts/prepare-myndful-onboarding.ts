import {
  ChannelType,
  ConnectionStatus,
  IntegrationType,
  TenantStatus,
  UserRole,
} from "@prisma/client";

import { db } from "@/lib/db";

const tenantSlug = "myndful-films";
const tenantName = "MYNDFUL Films";
const tenantTimezone = "America/New_York";
const requiredChannels = [ChannelType.GMAIL, ChannelType.INSTAGRAM];
const requiredIntegrations = [
  IntegrationType.GOOGLE_CALENDAR,
  IntegrationType.GOOGLE_SHEETS,
  IntegrationType.GOOGLE_DRIVE,
];

function readEnv(name: string) {
  return process.env[name]?.trim() || "";
}

async function main() {
  const customerEmail = readEnv("CUSTOMER_EMAIL").toLowerCase();
  const appBaseUrl = readEnv("APP_BASE_URL") || "https://behalfy.io";

  const tenant = await db.tenant.upsert({
    where: { slug: tenantSlug },
    create: {
      name: tenantName,
      slug: tenantSlug,
      timezone: tenantTimezone,
      status: TenantStatus.ONBOARDING,
    },
    update: {
      name: tenantName,
      timezone: tenantTimezone,
    },
  });

  let inviteUrl: string | null = null;
  let inviteStatus = customerEmail ? "not-created" : "customer-email-required";

  if (customerEmail) {
    const existingUser = await db.user.findUnique({
      where: { email: customerEmail },
      select: { id: true, tenantId: true },
    });

    if (existingUser && existingUser.tenantId !== tenant.id) {
      throw new Error(`User ${customerEmail} already belongs to another tenant.`);
    }

    if (existingUser) {
      inviteStatus = "accepted";
    } else {
      const now = new Date();
      const existingInvite = await db.inviteToken.findFirst({
        where: {
          tenantId: tenant.id,
          email: customerEmail,
          usedAt: null,
          expiresAt: { gt: now },
        },
        orderBy: { createdAt: "desc" },
      });
      const invite =
        existingInvite ??
        (await db.inviteToken.create({
          data: {
            tenantId: tenant.id,
            email: customerEmail,
            role: UserRole.CLIENT,
            expiresAt: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 7),
          },
        }));

      inviteUrl = `${appBaseUrl.replace(/\/$/, "")}/invite/${invite.token}`;
      inviteStatus = existingInvite ? "existing" : "created";
    }
  }

  const [channels, integrations, agents] = await Promise.all([
    db.channelConnection.findMany({
      where: { tenantId: tenant.id },
      select: { type: true, status: true },
    }),
    db.integrationConnection.findMany({
      where: { tenantId: tenant.id },
      select: { type: true, status: true },
    }),
    db.agent.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, name: true, status: true, channel: { select: { type: true } } },
    }),
  ]);

  const connectedChannelTypes = new Set(
    channels
      .filter((connection) => connection.status === ConnectionStatus.CONNECTED)
      .map((connection) => connection.type),
  );
  const connectedIntegrationTypes = new Set(
    integrations
      .filter((connection) => connection.status === ConnectionStatus.CONNECTED)
      .map((connection) => connection.type),
  );
  const missingChannels = requiredChannels.filter((type) => !connectedChannelTypes.has(type));
  const missingIntegrations = requiredIntegrations.filter(
    (type) => !connectedIntegrationTypes.has(type),
  );

  console.log(
    JSON.stringify(
      {
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          status: tenant.status,
        },
        invite: {
          email: customerEmail || null,
          status: inviteStatus,
          url: inviteUrl,
        },
        readiness: {
          readyToClone: missingChannels.length === 0 && missingIntegrations.length === 0,
          missingChannels,
          missingIntegrations,
        },
        agents,
        nextCommand:
          missingChannels.length === 0 && missingIntegrations.length === 0
            ? `$env:TARGET_TENANT_ID="${tenant.id}"; $env:APPLY="1"; npm run clone:agents-to-tenant`
            : null,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
