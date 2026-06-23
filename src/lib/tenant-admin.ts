import { TenantStatus, UserRole } from "@prisma/client";
import { z } from "zod";

import { slugify } from "@/lib/slug";

const inviteTtlMs = 1000 * 60 * 60 * 24 * 7;

const createTenantSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().max(200).optional(),
  timezone: z.string().trim().min(2).max(100).default("UTC"),
});

const updateTenantSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  timezone: z.string().trim().min(2).max(100).optional(),
  status: z.enum([
    TenantStatus.ONBOARDING,
    TenantStatus.ACTIVE,
    TenantStatus.PAUSED,
    TenantStatus.CHURNED,
  ]).optional(),
});

const createInviteSchema = z.object({
  email: z.string().email(),
});

type TenantRecord = {
  id: string;
};

type InviteRecord = {
  id: string;
};

type TenantAdminDb = {
  tenant: {
    create(args: { data: CreateTenantData }): Promise<TenantRecord>;
    update(args: { where: { id: string }; data: UpdateTenantData }): Promise<TenantRecord>;
    findUnique(args: { where: { id: string } }): Promise<TenantRecord | null>;
  };
  inviteToken: {
    create(args: { data: CreateInviteData }): Promise<InviteRecord>;
  };
};

type TenantAdminResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: 400 | 404; error: string };

export type CreateTenantData = {
  name: string;
  slug: string;
  timezone: string;
  status: TenantStatus;
};

export type UpdateTenantData = {
  name?: string;
  timezone?: string;
  status?: TenantStatus;
};

export type CreateInviteData = {
  tenantId: string;
  email: string;
  role: UserRole;
  expiresAt: Date;
};

export function buildCreateTenantData(input: unknown): TenantAdminResult<CreateTenantData> {
  const parsed = createTenantSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, status: 400, error: "Invalid tenant payload." };
  }

  const slug = slugify(parsed.data.slug || parsed.data.name);

  if (!slug) {
    return { ok: false, status: 400, error: "Invalid slug." };
  }

  return {
    ok: true,
    value: {
      name: parsed.data.name,
      slug,
      timezone: parsed.data.timezone,
      status: TenantStatus.ONBOARDING,
    },
  };
}

export function buildUpdateTenantData(input: unknown): TenantAdminResult<UpdateTenantData> {
  const parsed = updateTenantSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, status: 400, error: "Invalid tenant payload." };
  }

  return { ok: true, value: parsed.data };
}

export function buildCreateInviteData(
  tenantId: string,
  input: unknown,
  now = new Date(),
): TenantAdminResult<CreateInviteData> {
  const parsed = createInviteSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, status: 400, error: "Invalid invite payload." };
  }

  return {
    ok: true,
    value: {
      tenantId,
      email: parsed.data.email,
      role: UserRole.CLIENT,
      expiresAt: new Date(now.getTime() + inviteTtlMs),
    },
  };
}

export async function createTenantWithDeps(db: TenantAdminDb, input: unknown) {
  const data = buildCreateTenantData(input);

  if (!data.ok) {
    return data;
  }

  return {
    ok: true as const,
    value: await db.tenant.create({ data: data.value }),
  };
}

export async function updateTenantWithDeps(
  db: TenantAdminDb,
  tenantId: string,
  input: unknown,
) {
  const tenant = await db.tenant.findUnique({ where: { id: tenantId } });

  if (!tenant) {
    return { ok: false as const, status: 404 as const, error: "Tenant not found." };
  }

  const data = buildUpdateTenantData(input);

  if (!data.ok) {
    return data;
  }

  return {
    ok: true as const,
    value: await db.tenant.update({
      where: { id: tenantId },
      data: data.value,
    }),
  };
}

export async function createInviteWithDeps(
  db: TenantAdminDb,
  tenantId: string,
  input: unknown,
  now = new Date(),
) {
  const tenant = await db.tenant.findUnique({ where: { id: tenantId } });

  if (!tenant) {
    return { ok: false as const, status: 404 as const, error: "Tenant not found." };
  }

  const data = buildCreateInviteData(tenant.id, input, now);

  if (!data.ok) {
    return data;
  }

  return {
    ok: true as const,
    value: await db.inviteToken.create({ data: data.value }),
  };
}
