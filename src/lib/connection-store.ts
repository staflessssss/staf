import { ChannelType, ConnectionStatus, IntegrationType, Prisma } from "@prisma/client";

import { encrypt } from "@/lib/crypto";
import { db } from "@/lib/db";

type EncryptFn = (plaintext: string) => string;

type ConnectionSelect = {
  id: true;
  tenantId: true;
  type: true;
  status: true;
  metadata: true;
  createdAt: true;
  updatedAt: true;
};

type ChannelConnectionDb = {
  channelConnection: {
    upsert(args: {
      where: {
        tenantId_type: {
          tenantId: string;
          type: ChannelType;
        };
      };
      update: {
        status: ConnectionStatus;
        credentialsEnc: string;
        metadata?: Prisma.InputJsonValue;
      };
      create: {
        tenantId: string;
        type: ChannelType;
        status: ConnectionStatus;
        credentialsEnc: string;
        metadata?: Prisma.InputJsonValue;
      };
      select?: ConnectionSelect;
    }): Promise<unknown>;
  };
};

type IntegrationConnectionDb = {
  integrationConnection: {
    upsert(args: {
      where: {
        tenantId_type: {
          tenantId: string;
          type: IntegrationType;
        };
      };
      update: {
        status: ConnectionStatus;
        credentialsEnc: string;
        metadata?: Prisma.InputJsonValue;
      };
      create: {
        tenantId: string;
        type: IntegrationType;
        status: ConnectionStatus;
        credentialsEnc: string;
        metadata?: Prisma.InputJsonValue;
      };
      select?: ConnectionSelect;
    }): Promise<unknown>;
  };
};

export type UpsertChannelConnectionInput = {
  tenantId: string;
  type: ChannelType;
  status: ConnectionStatus;
  credentials: string;
  metadata?: Prisma.InputJsonValue;
};

export type UpsertIntegrationConnectionInput = {
  tenantId: string;
  type: IntegrationType;
  status: ConnectionStatus;
  credentials: string;
  metadata?: Prisma.InputJsonValue;
};

export type RevokeChannelConnectionInput = {
  tenantId: string;
  type: ChannelType;
};

export const safeConnectionSelect = {
  id: true,
  tenantId: true,
  type: true,
  status: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function upsertChannelConnectionWithDeps(
  database: ChannelConnectionDb,
  encryptValue: EncryptFn,
  input: UpsertChannelConnectionInput,
  select?: ConnectionSelect,
) {
  const credentialsEnc = encryptValue(input.credentials);

  return database.channelConnection.upsert({
    where: {
      tenantId_type: {
        tenantId: input.tenantId,
        type: input.type,
      },
    },
    update: {
      status: input.status,
      credentialsEnc,
      metadata: input.metadata,
    },
    create: {
      tenantId: input.tenantId,
      type: input.type,
      status: input.status,
      credentialsEnc,
      metadata: input.metadata,
    },
    select,
  });
}

export async function upsertIntegrationConnectionWithDeps(
  database: IntegrationConnectionDb,
  encryptValue: EncryptFn,
  input: UpsertIntegrationConnectionInput,
  select?: ConnectionSelect,
) {
  const credentialsEnc = encryptValue(input.credentials);

  return database.integrationConnection.upsert({
    where: {
      tenantId_type: {
        tenantId: input.tenantId,
        type: input.type,
      },
    },
    update: {
      status: input.status,
      credentialsEnc,
      metadata: input.metadata,
    },
    create: {
      tenantId: input.tenantId,
      type: input.type,
      status: input.status,
      credentialsEnc,
      metadata: input.metadata,
    },
    select,
  });
}

export async function revokeChannelConnectionWithDeps(
  database: ChannelConnectionDb,
  encryptValue: EncryptFn,
  input: RevokeChannelConnectionInput,
) {
  const credentialsEnc = encryptValue("revoked");

  return database.channelConnection.upsert({
    where: {
      tenantId_type: {
        tenantId: input.tenantId,
        type: input.type,
      },
    },
    update: {
      status: ConnectionStatus.REVOKED,
      credentialsEnc,
      metadata: undefined,
    },
    create: {
      tenantId: input.tenantId,
      type: input.type,
      status: ConnectionStatus.REVOKED,
      credentialsEnc,
      metadata: undefined,
    },
  });
}

export async function upsertChannelConnection(input: UpsertChannelConnectionInput) {
  await upsertChannelConnectionWithDeps(db, encrypt, input);
}

export async function upsertIntegrationConnection(input: UpsertIntegrationConnectionInput) {
  await upsertIntegrationConnectionWithDeps(db, encrypt, input);
}

export async function revokeChannelConnection(input: RevokeChannelConnectionInput) {
  await revokeChannelConnectionWithDeps(db, encrypt, input);
}
