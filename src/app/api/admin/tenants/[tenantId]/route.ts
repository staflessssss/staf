import { NextResponse } from "next/server";

import { requireAdminApiSession } from "@/lib/admin-api-auth";
import { db } from "@/lib/db";
import { updateTenantWithDeps } from "@/lib/tenant-admin";

type TenantRouteContext = {
  params: Promise<{ tenantId: string }>;
};

export async function GET(_: Request, context: TenantRouteContext) {
  const session = await requireAdminApiSession();

  if (session instanceof NextResponse) {
    return session;
  }

  const { tenantId } = await context.params;

  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
  });

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }

  return NextResponse.json({ item: tenant });
}

export async function PATCH(request: Request, context: TenantRouteContext) {
  const session = await requireAdminApiSession();

  if (session instanceof NextResponse) {
    return session;
  }

  const { tenantId } = await context.params;
  const json = await request.json().catch(() => null);
  const tenant = await updateTenantWithDeps(db, tenantId, json);

  if (!tenant.ok) {
    return NextResponse.json({ error: tenant.error }, { status: tenant.status });
  }

  return NextResponse.json({ item: tenant.value });
}
