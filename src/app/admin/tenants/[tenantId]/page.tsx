import { redirect } from "next/navigation";

export default async function LegacyTenantDetailRedirect({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  redirect(`/admin/clients/${tenantId}`);
}
