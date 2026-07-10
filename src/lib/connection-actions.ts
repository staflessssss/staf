"use server";

import { randomBytes } from "crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  ChannelType,
  ConnectionStatus,
  IntegrationType,
} from "@prisma/client";
import { z } from "zod";

import { requireClientSession } from "@/lib/client-auth";
import { normalizeInternalRedirect } from "@/lib/auth-redirect";
import { getInstagramCredentialsValidationError } from "@/lib/channels/instagram";
import { parseTelegramBotToken, registerTelegramWebhook } from "@/lib/channels/telegram";
import {
  revokeChannelConnection,
  upsertChannelConnection,
  upsertIntegrationConnection,
} from "@/lib/connection-store";
import {
  buildGmailWorkspacePresetIntegrations,
  buildPresetChannelConnection,
} from "@/lib/connection-presets";
import { db } from "@/lib/db";
import { mergeOwnerHandoffMetadata } from "@/lib/owner-handoff";

const channelSchema = z.object({
  type: z.nativeEnum(ChannelType),
  status: z.nativeEnum(ConnectionStatus),
  credentials: z.string().trim().min(2),
  metadata: z.string().trim().optional(),
});

const integrationSchema = z.object({
  type: z.nativeEnum(IntegrationType),
  status: z.nativeEnum(ConnectionStatus),
  credentials: z.string().trim().min(2),
  metadata: z.string().trim().optional(),
});

const presetChannelSchema = z.object({
  type: z.nativeEnum(ChannelType),
});

const presetIntegrationSchema = z.object({
  type: z.nativeEnum(IntegrationType),
});

const revokeChannelSchema = z.object({
  type: z.nativeEnum(ChannelType),
});

function parseMetadata(metadata?: string) {
  if (!metadata) {
    return undefined;
  }

  try {
    return JSON.parse(metadata);
  } catch {
    return null;
  }
}

function getPublicBaseUrl() {
  const publicBaseUrl =
    process.env.APP_BASE_URL?.trim() || process.env.NEXTAUTH_URL?.trim() || "";

  return publicBaseUrl.startsWith("https://") && !publicBaseUrl.includes("localhost")
    ? publicBaseUrl
    : "";
}

export async function saveChannelConnectionAction(formData: FormData) {
  const session = await requireClientSession();
  const tenantId = session.user.tenantId;
  const parsed = channelSchema.safeParse({
    type: formData.get("type"),
    status: formData.get("status"),
    credentials: formData.get("credentials"),
    metadata: formData.get("metadata") || undefined,
  });

  if (!parsed.success) {
    redirect("/client/connections?error=channel");
  }

  const metadata = parseMetadata(parsed.data.metadata);

  if (metadata === null) {
    redirect("/client/connections?error=channel-metadata");
  }

  if (parsed.data.type === ChannelType.INSTAGRAM && parsed.data.status === ConnectionStatus.CONNECTED) {
    const credentialsError = getInstagramCredentialsValidationError(parsed.data.credentials);

    if (credentialsError) {
      redirect("/client/connections?error=instagram-credentials");
    }
  }

  let channelMetadata = metadata;

  if (parsed.data.type === ChannelType.TELEGRAM && parsed.data.status === ConnectionStatus.CONNECTED) {
    const botToken = parseTelegramBotToken(parsed.data.credentials);
    const publicBaseUrl = getPublicBaseUrl();

    if (!botToken || !publicBaseUrl) {
      redirect("/client/connections/telegram?error=telegram-config");
    }

    const existingConnection = await db.channelConnection.findUnique({
      where: {
        tenantId_type: {
          tenantId,
          type: ChannelType.TELEGRAM,
        },
      },
      select: {
        metadata: true,
      },
    });
    const webhookSecret = randomBytes(24).toString("hex");
    const startToken = randomBytes(6).toString("hex");
    const webhookUrl = `${publicBaseUrl}/api/webhooks/telegram/handoff?tenantId=${tenantId}`;

    await registerTelegramWebhook({
      credentials: parsed.data.credentials,
      webhookUrl,
      secretToken: webhookSecret,
    }).catch(() => {
      redirect("/client/connections/telegram?error=telegram-webhook");
    });

    channelMetadata = mergeOwnerHandoffMetadata({
      metadata: existingConnection?.metadata ?? metadata,
      webhookSecret,
      webhookUrl,
      startToken,
    });
  }

  await upsertChannelConnection({
    tenantId,
    type: parsed.data.type,
    status: parsed.data.status,
    credentials: parsed.data.credentials,
    metadata: channelMetadata,
  });

  revalidatePath("/client");
  revalidatePath("/client/connections");
  if (parsed.data.type === ChannelType.TELEGRAM) {
    revalidatePath("/client/connections/telegram");
  }
  revalidatePath("/admin");
  redirect(
    parsed.data.type === ChannelType.TELEGRAM
      ? "/client/connections/telegram?saved=channel"
      : "/client/connections?saved=channel",
  );
}

export async function saveIntegrationConnectionAction(formData: FormData) {
  const session = await requireClientSession();
  const tenantId = session.user.tenantId;
  const parsed = integrationSchema.safeParse({
    type: formData.get("type"),
    status: formData.get("status"),
    credentials: formData.get("credentials"),
    metadata: formData.get("metadata") || undefined,
  });

  if (!parsed.success) {
    redirect("/client/connections?error=integration");
  }

  const metadata = parseMetadata(parsed.data.metadata);

  if (metadata === null) {
    redirect("/client/connections?error=integration-metadata");
  }

  await upsertIntegrationConnection({
    tenantId,
    type: parsed.data.type,
    status: parsed.data.status,
    credentials: parsed.data.credentials,
    metadata,
  });

  revalidatePath("/client");
  revalidatePath("/client/connections");
  revalidatePath("/admin");
  redirect("/client/connections?saved=integration");
}

export async function connectPresetChannelAction(formData: FormData) {
  const session = await requireClientSession();
  const tenantId = session.user.tenantId;
  const parsed = presetChannelSchema.safeParse({
    type: formData.get("type"),
  });
  const redirectTo = normalizeInternalRedirect(
    String(formData.get("redirectTo") || ""),
    "/client/connections",
  );

  if (!parsed.success) {
    redirect("/client/connections?error=channel");
  }

  const type = parsed.data.type;

  if (type === ChannelType.INSTAGRAM) {
    redirect(`${redirectTo}?error=instagram-operator-managed`);
  }

  await upsertChannelConnection(buildPresetChannelConnection(tenantId, type));

  if (type === ChannelType.GMAIL) {
    for (const integration of buildGmailWorkspacePresetIntegrations(tenantId)) {
      await upsertIntegrationConnection(integration);
    }
  }

  revalidatePath("/client");
  revalidatePath("/client/connections");
  revalidatePath("/admin");
  redirect(`${redirectTo}?saved=channel`);
}

export async function connectPresetIntegrationAction(formData: FormData) {
  const session = await requireClientSession();
  const tenantId = session.user.tenantId;
  const parsed = presetIntegrationSchema.safeParse({
    type: formData.get("type"),
  });
  const redirectTo = normalizeInternalRedirect(
    String(formData.get("redirectTo") || ""),
    "/client/connections",
  );

  if (!parsed.success) {
    redirect("/client/connections?error=integration");
  }

  await upsertIntegrationConnection({
    tenantId,
    type: parsed.data.type,
    status: ConnectionStatus.CONNECTED,
    credentials: `preset:${parsed.data.type.toLowerCase()}:connected`,
    metadata: { provider: "preset" },
  });

  revalidatePath("/client");
  revalidatePath("/client/connections");
  revalidatePath("/admin");
  redirect(`${redirectTo}?saved=integration`);
}

export async function revokeChannelConnectionAction(formData: FormData) {
  const session = await requireClientSession();
  const tenantId = session.user.tenantId;
  const parsed = revokeChannelSchema.safeParse({
    type: formData.get("type"),
  });
  const redirectTo = normalizeInternalRedirect(
    String(formData.get("redirectTo") || ""),
    "/client/connections",
  );

  if (!parsed.success) {
    redirect(`${redirectTo}?error=channel`);
  }

  await revokeChannelConnection({
    tenantId,
    type: parsed.data.type,
  });

  revalidatePath("/client");
  revalidatePath("/client/connections");
  revalidatePath("/admin");
  redirect(`${redirectTo}?saved=channel`);
}
