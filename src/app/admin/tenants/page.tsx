import { redirect } from "next/navigation";

export default function LegacyTenantsListRedirect() {
  redirect("/admin/clients");
}
