"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { slugify } from "@/lib/slug";

const createTenantSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().max(64).optional(),
  timezone: z.string().trim().min(2).max(100),
});

const inviteSchema = z.object({
  tenantId: z.string().min(1),
  email: z.string().email(),
});

export async function createTenantAction(formData: FormData) {
  await requireAdminSession();

  const parsed = createTenantSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug") || undefined,
    timezone: formData.get("timezone"),
  });

  if (!parsed.success) {
    redirect("/admin/tenants/new?error=invalid");
  }

  const slug = slugify(parsed.data.slug || parsed.data.name);

  if (!slug) {
    redirect("/admin/tenants/new?error=slug");
  }

  const tenant = await db.tenant.create({
    data: {
      name: parsed.data.name,
      slug,
      timezone: parsed.data.timezone,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/tenants");
  redirect(`/admin/tenants/${tenant.id}`);
}

export async function createInviteAction(formData: FormData) {
  await requireAdminSession();

  const parsed = inviteSchema.safeParse({
    tenantId: formData.get("tenantId"),
    email: formData.get("email"),
  });

  if (!parsed.success) {
    redirect(`/admin/tenants/${formData.get("tenantId")}?error=invite`);
  }

  const tenant = await db.tenant.findUnique({
    where: { id: parsed.data.tenantId },
  });

  if (!tenant) {
    redirect("/admin/tenants");
  }

  await db.inviteToken.create({
    data: {
      tenantId: tenant.id,
      email: parsed.data.email,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    },
  });

  revalidatePath(`/admin/tenants/${tenant.id}`);
  redirect(`/admin/tenants/${tenant.id}`);
}
