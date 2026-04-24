import { redirect } from "next/navigation";

export default async function EditAgentPage({
  params,
}: {
  params: Promise<{ tenantId: string; agentId: string }>;
}) {
  const { tenantId, agentId } = await params;
  redirect(`/admin/tenants/${tenantId}/agents/${agentId}`);
}
