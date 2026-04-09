import { redirect } from "next/navigation";

export default async function AdminClientCreateAgentRedirect({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  redirect(`/admin/tenants/${clientId}/agents/new`);
}
