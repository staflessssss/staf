"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import {
  createInviteWithDeps,
  createTenantWithDeps,
} from "@/lib/tenant-admin";

export async function createTenantAction(formData: FormData) {
  await requireAdminSession();

  const tenant = await createTenantWithDeps(db, {
    name: formData.get("name"),
    slug: formData.get("slug") || undefined,
    timezone: formData.get("timezone") || undefined,
  });

  if (!tenant.ok && tenant.error === "Invalid tenant payload.") {
    redirect("/admin/tenants/new?error=invalid");
  }

  if (!tenant.ok) {
    redirect("/admin/tenants/new?error=slug");
  }

  revalidatePath("/admin");
  revalidatePath("/admin/tenants");
  redirect(`/admin/tenants/${tenant.value.id}`);
}

export async function createInviteAction(formData: FormData) {
  await requireAdminSession();

  const tenantId = String(formData.get("tenantId") ?? "");
  const invite = await createInviteWithDeps(db, tenantId, {
    email: formData.get("email"),
  });

  if (!tenantId || (!invite.ok && invite.status === 400)) {
    redirect(`/admin/tenants/${formData.get("tenantId")}?error=invite`);
  }

  if (!invite.ok) {
    redirect("/admin/tenants");
  }

  revalidatePath(`/admin/tenants/${tenantId}`);
  redirect(`/admin/tenants/${tenantId}`);
}
