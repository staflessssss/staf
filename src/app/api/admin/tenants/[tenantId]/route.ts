import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";

type TenantRouteContext = {
  params: Promise<{ tenantId: string }>;
};

const updateTenantSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  timezone: z.string().trim().min(2).max(100).optional(),
  status: z.enum(["ONBOARDING", "ACTIVE", "PAUSED", "CHURNED"]).optional(),
});

export async function GET(_: Request, context: TenantRouteContext) {
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
  const { tenantId } = await context.params;
  const json = await request.json().catch(() => null);
  const parsed = updateTenantSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid tenant payload." }, { status: 400 });
  }

  const tenant = await db.tenant.update({
    where: { id: tenantId },
    data: parsed.data,
  });

  return NextResponse.json({ item: tenant });
}
