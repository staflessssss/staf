import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/current-session";

export async function requireClientSession() {
  const session = await getCurrentSession();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "CLIENT" || !session.user.tenantId) {
    redirect("/admin");
  }

  return {
    ...session,
    user: {
      ...session.user,
      tenantId: session.user.tenantId,
    },
  };
}
