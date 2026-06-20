import { NextResponse } from "next/server";

import { requireAdminApiSession } from "@/lib/admin-api-auth";
import { db } from "@/lib/db";
import { createInviteWithDeps } from "@/lib/tenant-admin";

type InviteRouteContext = {
  params: Promise<{ tenantId: string }>;
};

export async function POST(request: Request, context: InviteRouteContext) {
  const session = await requireAdminApiSession();

  if (session instanceof NextResponse) {
    return session;
  }

  const { tenantId } = await context.params;
  const json = await request.json().catch(() => null);
  const invite = await createInviteWithDeps(db, tenantId, json);

  if (!invite.ok) {
    return NextResponse.json({ error: invite.error }, { status: invite.status });
  }

  return NextResponse.json({ item: invite.value }, { status: 201 });
}
