import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/current-session";

export async function requireClientApiSession() {
  const session = await getCurrentSession();

  if (!session?.user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (session.user.role !== "CLIENT" || !session.user.tenantId) {
    return NextResponse.json({ error: "Client access required." }, { status: 403 });
  }

  return session;
}
