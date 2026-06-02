import { ChannelType, ConnectionStatus } from "@prisma/client";

import {
  getInstagramCredentialsValidationError,
  parseInstagramCredentials,
} from "@/lib/channels/instagram";
import { upsertChannelConnection } from "@/lib/connection-store";
import { db } from "@/lib/db";

function readRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function readOptionalEnv(name: string) {
  return process.env[name]?.trim() || undefined;
}

async function main() {
  const tenantId = readRequiredEnv("TENANT_ID");
  const credentials = {
    pageAccessToken: readRequiredEnv("META_PAGE_ACCESS_TOKEN"),
    pageId: readRequiredEnv("META_PAGE_ID"),
    igBusinessAccountId: readRequiredEnv("META_IG_BUSINESS_ACCOUNT_ID"),
    graphApiVersion: readOptionalEnv("META_GRAPH_API_VERSION") ?? "v21.0",
  };
  const serializedCredentials = JSON.stringify(credentials);
  const credentialsError = getInstagramCredentialsValidationError(serializedCredentials);
  const dryRun = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

  if (credentialsError) {
    throw new Error(credentialsError);
  }

  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true },
  });

  if (!tenant) {
    throw new Error(`Tenant ${tenantId} was not found.`);
  }

  const parsed = parseInstagramCredentials(serializedCredentials);
  const metadata = {
    provider: "meta",
    source: "operator_script",
    instagramUsername: readOptionalEnv("META_INSTAGRAM_USERNAME"),
    pageId: parsed.pageId,
    igBusinessAccountId: parsed.igBusinessAccountId,
    graphApiVersion: parsed.graphApiVersion,
  };

  console.log(`Tenant: ${tenant.name} (${tenant.id})`);
  console.log(`Instagram Page ID: ${parsed.pageId}`);
  console.log(`Instagram Business Account ID: ${parsed.igBusinessAccountId}`);
  console.log(`Graph API version: ${parsed.graphApiVersion}`);

  if (dryRun) {
    console.log("DRY_RUN enabled. No database changes were written.");
    return;
  }

  await upsertChannelConnection({
    tenantId,
    type: ChannelType.INSTAGRAM,
    status: ConnectionStatus.CONNECTED,
    credentials: serializedCredentials,
    metadata,
  });

  console.log("Instagram channel connection saved.");
  console.log("Next: create a separate Instagram agent and deploy it to generate webhookUrl/webhookSecret.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
