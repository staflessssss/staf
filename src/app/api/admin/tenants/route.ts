import { NextResponse } from "next/server";

import { requireAdminApiSession } from "@/lib/admin-api-auth";
import { db } from "@/lib/db";
import { createTenantWithDeps } from "@/lib/tenant-admin";

export async function GET() {
  const session = await requireAdminApiSession();

  if (session instanceof NextResponse) {
    return session;
  }

  const items = await db.tenant.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const session = await requireAdminApiSession();

  if (session instanceof NextResponse) {
    return session;
  }

  const json = await request.json().catch(() => null);
  const tenant = await createTenantWithDeps(db, json);

  if (!tenant.ok) {
    return NextResponse.json({ error: tenant.error }, { status: tenant.status });
  }

  return NextResponse.json({ item: tenant.value }, { status: 201 });
}
