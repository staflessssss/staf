"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ChannelType, ConnectionStatus } from "@prisma/client";
import { z } from "zod";

import { requireAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { upsertChannelConnection } from "@/lib/connection-store";

const telegramConnectionSchema = z.object({
  clientId: z.string().min(1),
  credentials: z.string().trim().min(2),
});

const revokeChannelSchema = z.object({
  clientId: z.string().min(1),
  type: z.nativeEnum(ChannelType),
});

export async function saveAdminTelegramConnectionAction(formData: FormData) {
  await requireAdminSession();
  const parsed = telegramConnectionSchema.safeParse({
    clientId: formData.get("clientId"),
    credentials: formData.get("credentials"),
  });

  if (!parsed.success) {
    redirect("/admin/clients?error=channel");
  }

  await upsertChannelConnection({
    tenantId: parsed.data.clientId,
    type: ChannelType.TELEGRAM,
    status: ConnectionStatus.CONNECTED,
    credentials: parsed.data.credentials,
    metadata: { provider: "telegram", source: "botfather", connectedBy: "admin" },
  });

  revalidatePath(`/admin/clients/${parsed.data.clientId}`);
  revalidatePath(`/admin/clients/${parsed.data.clientId}/connections/telegram`);
  redirect(`/admin/clients/${parsed.data.clientId}/connections/telegram?saved=channel`);
}

export async function revokeAdminChannelConnectionAction(formData: FormData) {
  await requireAdminSession();
  const parsed = revokeChannelSchema.safeParse({
    clientId: formData.get("clientId"),
    type: formData.get("type"),
  });

  if (!parsed.success) {
    redirect("/admin/clients?error=channel");
  }

  await db.channelConnection.updateMany({
    where: {
      tenantId: parsed.data.clientId,
      type: parsed.data.type,
    },
    data: {
      status: ConnectionStatus.REVOKED,
    },
  });

  revalidatePath(`/admin/clients/${parsed.data.clientId}`);
  redirect(`/admin/clients/${parsed.data.clientId}/connections?revoked=channel`);
}
