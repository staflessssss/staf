import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/current-session";

export async function requireAdminApiSession() {
  const session = await getCurrentSession();

  if (!session?.user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  return session;
}
