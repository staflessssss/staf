import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

export async function requireClientSession() {
  const session = await auth();

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
