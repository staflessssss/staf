import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

export async function requireClientApiSession() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (session.user.role !== "CLIENT" || !session.user.tenantId) {
    return NextResponse.json({ error: "Client access required." }, { status: 403 });
  }

  return session;
}
