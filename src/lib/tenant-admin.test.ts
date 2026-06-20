import assert from "node:assert/strict";
import test from "node:test";
import { TenantStatus, UserRole } from "@prisma/client";

import {
  buildCreateInviteData,
  buildCreateTenantData,
  buildUpdateTenantData,
  createInviteWithDeps,
  createTenantWithDeps,
  updateTenantWithDeps,
  type CreateInviteData,
  type CreateTenantData,
  type UpdateTenantData,
} from "@/lib/tenant-admin";

function createDbStub(options?: { tenantExists?: boolean }) {
  const calls: {
    tenantCreate?: { data: CreateTenantData };
    tenantUpdate?: { where: { id: string }; data: UpdateTenantData };
    tenantFindUnique?: { where: { id: string } };
    inviteCreate?: { data: CreateInviteData };
  } = {};

  return {
    calls,
    db: {
      tenant: {
        async create(args: { data: CreateTenantData }) {
          calls.tenantCreate = args;
          return { id: "tenant-created", ...args.data };
        },
        async update(args: { where: { id: string }; data: UpdateTenantData }) {
          calls.tenantUpdate = args;
          return { id: args.where.id, ...args.data };
        },
        async findUnique(args: { where: { id: string } }) {
          calls.tenantFindUnique = args;
          return options?.tenantExists === false ? null : { id: args.where.id };
        },
      },
      inviteToken: {
        async create(args: { data: CreateInviteData }) {
          calls.inviteCreate = args;
          return { id: "invite-created", ...args.data };
        },
      },
    },
  };
}

test("buildCreateTenantData trims input, defaults timezone, and derives slug from name", () => {
  const result = buildCreateTenantData({
    name: "  Acme Dental  ",
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.value, {
    name: "Acme Dental",
    slug: "acme-dental",
    timezone: "UTC",
    status: TenantStatus.ONBOARDING,
  });
});

test("buildCreateTenantData uses a normalized custom slug capped at 64 characters", () => {
  const result = buildCreateTenantData({
    name: "Acme Dental",
    slug: `custom ${"x".repeat(80)}`,
    timezone: " Europe/Moscow ",
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.slug, `custom-${"x".repeat(57)}`);
  assert.equal(result.value.slug.length, 64);
  assert.equal(result.value.timezone, "Europe/Moscow");
});

test("buildCreateTenantData rejects invalid payloads and empty normalized slugs", () => {
  assert.deepEqual(buildCreateTenantData({ name: "A" }), {
    ok: false,
    status: 400,
    error: "Invalid tenant payload.",
  });
  assert.deepEqual(buildCreateTenantData({ name: "Valid Name", slug: "!!!" }), {
    ok: false,
    status: 400,
    error: "Invalid slug.",
  });
});

test("buildUpdateTenantData allows only editable tenant fields and status values", () => {
  const result = buildUpdateTenantData({
    id: "should-not-pass",
    slug: "should-not-pass",
    name: "  Renamed Client  ",
    status: TenantStatus.ACTIVE,
    timezone: "America/New_York",
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.value, {
    name: "Renamed Client",
    status: TenantStatus.ACTIVE,
    timezone: "America/New_York",
  });

  assert.deepEqual(buildUpdateTenantData({ status: "DELETED" }), {
    ok: false,
    status: 400,
    error: "Invalid tenant payload.",
  });
});

test("buildCreateInviteData binds tenant id, client role, and seven-day expiration", () => {
  const now = new Date("2026-06-20T10:00:00.000Z");
  const result = buildCreateInviteData(
    "tenant-1",
    { tenantId: "attacker-tenant", email: "client@example.com" },
    now,
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.value, {
    tenantId: "tenant-1",
    email: "client@example.com",
    role: UserRole.CLIENT,
    expiresAt: new Date("2026-06-27T10:00:00.000Z"),
  });
});

test("buildCreateInviteData rejects invalid email payloads", () => {
  assert.deepEqual(buildCreateInviteData("tenant-1", { email: "invalid" }), {
    ok: false,
    status: 400,
    error: "Invalid invite payload.",
  });
});

test("tenant admin service writes create, update, and invite data through delegates", async () => {
  const { db, calls } = createDbStub();
  const created = await createTenantWithDeps(db, {
    name: "Acme Dental",
    timezone: "UTC",
  });
  const updated = await updateTenantWithDeps(db, "tenant-1", {
    status: TenantStatus.PAUSED,
  });
  const invited = await createInviteWithDeps(
    db,
    "tenant-1",
    { email: "client@example.com" },
    new Date("2026-06-20T10:00:00.000Z"),
  );

  assert.equal(created.ok, true);
  assert.equal(updated.ok, true);
  assert.equal(invited.ok, true);
  assert.deepEqual(calls.tenantCreate?.data, {
    name: "Acme Dental",
    slug: "acme-dental",
    timezone: "UTC",
    status: TenantStatus.ONBOARDING,
  });
  assert.deepEqual(calls.tenantUpdate, {
    where: { id: "tenant-1" },
    data: { status: TenantStatus.PAUSED },
  });
  assert.deepEqual(calls.tenantFindUnique, {
    where: { id: "tenant-1" },
  });
  assert.deepEqual(calls.inviteCreate?.data, {
    tenantId: "tenant-1",
    email: "client@example.com",
    role: UserRole.CLIENT,
    expiresAt: new Date("2026-06-27T10:00:00.000Z"),
  });
});

test("updateTenantWithDeps returns not found before updating a missing tenant", async () => {
  const { db, calls } = createDbStub({ tenantExists: false });
  const result = await updateTenantWithDeps(db, "missing-tenant", {
    status: TenantStatus.ACTIVE,
  });

  assert.deepEqual(result, {
    ok: false,
    status: 404,
    error: "Tenant not found.",
  });
  assert.equal(calls.tenantUpdate, undefined);
});

test("createInviteWithDeps returns not found before creating an invite for a missing tenant", async () => {
  const { db, calls } = createDbStub({ tenantExists: false });
  const result = await createInviteWithDeps(db, "missing-tenant", {
    email: "client@example.com",
  });

  assert.deepEqual(result, {
    ok: false,
    status: 404,
    error: "Tenant not found.",
  });
  assert.equal(calls.inviteCreate, undefined);
});
