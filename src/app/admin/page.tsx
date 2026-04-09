import { redirect } from "next/navigation";

import { requireAdminSession } from "@/lib/admin-auth";

export default async function AdminDashboardPage() {
  await requireAdminSession();
  redirect("/admin/clients");
}
