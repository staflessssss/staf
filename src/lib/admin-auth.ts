import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/current-session";

export async function requireAdminSession() {
  const session = await getCurrentSession();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/client");
  }

  return session;
}
