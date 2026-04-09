import { ChannelType, ConnectionStatus, IntegrationType, Prisma } from "@prisma/client";

import { encrypt } from "@/lib/crypto";
import { db } from "@/lib/db";

export async function upsertChannelConnection(input: {
  tenantId: string;
  type: ChannelType;
  status: ConnectionStatus;
  credentials: string;
  metadata?: Prisma.InputJsonValue;
}) {
  await db.channelConnection.upsert({
    where: {
      tenantId_type: {
        tenantId: input.tenantId,
        type: input.type,
      },
    },
    update: {
      status: input.status,
      credentialsEnc: encrypt(input.credentials),
      metadata: input.metadata,
    },
    create: {
      tenantId: input.tenantId,
      type: input.type,
      status: input.status,
      credentialsEnc: encrypt(input.credentials),
      metadata: input.metadata,
    },
  });
}

export async function upsertIntegrationConnection(input: {
  tenantId: string;
  type: IntegrationType;
  status: ConnectionStatus;
  credentials: string;
  metadata?: Prisma.InputJsonValue;
}) {
  await db.integrationConnection.upsert({
    where: {
      tenantId_type: {
        tenantId: input.tenantId,
        type: input.type,
      },
    },
    update: {
      status: input.status,
      credentialsEnc: encrypt(input.credentials),
      metadata: input.metadata,
    },
    create: {
      tenantId: input.tenantId,
      type: input.type,
      status: input.status,
      credentialsEnc: encrypt(input.credentials),
      metadata: input.metadata,
    },
  });
}
