import assert from "node:assert/strict";
import test from "node:test";
import { ChannelType, ConnectionStatus, IntegrationType } from "@prisma/client";

import {
  revokeChannelConnectionWithDeps,
  safeConnectionSelect,
  upsertChannelConnectionWithDeps,
  upsertIntegrationConnectionWithDeps,
} from "@/lib/connection-store";

function createDbStub() {
  const calls: {
    channelUpsert?: unknown;
    integrationUpsert?: unknown;
  } = {};

  return {
    calls,
    db: {
      channelConnection: {
        async upsert(args: unknown) {
          calls.channelUpsert = args;
          return { id: "channel-1" };
        },
      },
      integrationConnection: {
        async upsert(args: unknown) {
          calls.integrationUpsert = args;
          return { id: "integration-1" };
        },
      },
    },
  };
}

function createEncryptSpy() {
  const calls: string[] = [];

  return {
    calls,
    encrypt(value: string) {
      calls.push(value);
      return `encrypted-${calls.length}`;
    },
  };
}

function serialized(value: unknown) {
  return JSON.stringify(value);
}

test("channel vault upsert encrypts once and never persists plaintext credentials", async () => {
  const { db, calls } = createDbStub();
  const encrypt = createEncryptSpy();

  await upsertChannelConnectionWithDeps(
    db,
    encrypt.encrypt,
    {
      tenantId: "tenant-1",
      type: ChannelType.GMAIL,
      status: ConnectionStatus.CONNECTED,
      credentials: "plain-secret",
      metadata: { provider: "google" },
    },
    safeConnectionSelect,
  );

  assert.deepEqual(encrypt.calls, ["plain-secret"]);
  assert.equal(calls.integrationUpsert, undefined);
  assert.deepEqual(calls.channelUpsert, {
    where: {
      tenantId_type: {
        tenantId: "tenant-1",
        type: ChannelType.GMAIL,
      },
    },
    update: {
      status: ConnectionStatus.CONNECTED,
      credentialsEnc: "encrypted-1",
      metadata: { provider: "google" },
    },
    create: {
      tenantId: "tenant-1",
      type: ChannelType.GMAIL,
      status: ConnectionStatus.CONNECTED,
      credentialsEnc: "encrypted-1",
      metadata: { provider: "google" },
    },
    select: safeConnectionSelect,
  });
  assert.equal(serialized(calls.channelUpsert).includes("plain-secret"), false);
});

test("integration vault upsert uses integration scope and never the channel delegate", async () => {
  const { db, calls } = createDbStub();
  const encrypt = createEncryptSpy();

  await upsertIntegrationConnectionWithDeps(db, encrypt.encrypt, {
    tenantId: "tenant-1",
    type: IntegrationType.GOOGLE_CALENDAR,
    status: ConnectionStatus.CONNECTED,
    credentials: "calendar-secret",
    metadata: { provider: "google" },
  });

  assert.deepEqual(encrypt.calls, ["calendar-secret"]);
  assert.equal(calls.channelUpsert, undefined);
  assert.deepEqual(calls.integrationUpsert, {
    where: {
      tenantId_type: {
        tenantId: "tenant-1",
        type: IntegrationType.GOOGLE_CALENDAR,
      },
    },
    update: {
      status: ConnectionStatus.CONNECTED,
      credentialsEnc: "encrypted-1",
      metadata: { provider: "google" },
    },
    create: {
      tenantId: "tenant-1",
      type: IntegrationType.GOOGLE_CALENDAR,
      status: ConnectionStatus.CONNECTED,
      credentialsEnc: "encrypted-1",
      metadata: { provider: "google" },
    },
    select: undefined,
  });
  assert.equal(serialized(calls.integrationUpsert).includes("calendar-secret"), false);
});

test("revoke channel connection scrubs stored credentials on create and update", async () => {
  const { db, calls } = createDbStub();
  const encrypt = createEncryptSpy();

  await revokeChannelConnectionWithDeps(db, encrypt.encrypt, {
    tenantId: "tenant-1",
    type: ChannelType.TELEGRAM,
  });

  assert.deepEqual(encrypt.calls, ["revoked"]);
  assert.deepEqual(calls.channelUpsert, {
    where: {
      tenantId_type: {
        tenantId: "tenant-1",
        type: ChannelType.TELEGRAM,
      },
    },
    update: {
      status: ConnectionStatus.REVOKED,
      credentialsEnc: "encrypted-1",
      metadata: undefined,
    },
    create: {
      tenantId: "tenant-1",
      type: ChannelType.TELEGRAM,
      status: ConnectionStatus.REVOKED,
      credentialsEnc: "encrypted-1",
      metadata: undefined,
    },
  });
});
