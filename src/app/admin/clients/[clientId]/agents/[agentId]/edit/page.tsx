import { redirect } from "next/navigation";

export default async function AdminClientAgentEditRedirect({
  params,
}: {
  params: Promise<{ clientId: string; agentId: string }>;
}) {
  const { clientId, agentId } = await params;
  redirect(`/admin/tenants/${clientId}/agents/${agentId}`);
}
