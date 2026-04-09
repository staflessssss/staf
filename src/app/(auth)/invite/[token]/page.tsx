import { notFound } from "next/navigation";

import { InviteAcceptForm } from "@/components/auth/invite-accept-form";
import { db } from "@/lib/db";

type InviteAcceptPageProps = {
  params: Promise<{ token: string }>;
};

export default async function InviteAcceptPage({
  params,
}: InviteAcceptPageProps) {
  const { token } = await params;
  const invite = await db.inviteToken.findUnique({
    where: { token },
    include: { tenant: true },
  });

  if (!invite) {
    notFound();
  }

  const isExpired = invite.usedAt !== null || invite.expiresAt < new Date();

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <div className="w-full max-w-lg rounded-[32px] border border-border bg-[rgba(255,255,255,0.86)] p-8 shadow-[0_24px_80px_rgba(31,23,40,0.12)]">
        <div className="mb-8 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            Tenant Invite
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Join {invite.tenant.name}
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Accept your invite and create a password for {invite.email}.
          </p>
        </div>
        {isExpired ? (
          <div className="rounded-[20px] border border-[#f0d2b8] bg-[#fff6ee] p-4 text-sm text-[#b54708]">
            This invite is no longer valid. Ask the operator for a new invite.
          </div>
        ) : (
          <InviteAcceptForm
            defaultEmail={invite.email}
            role={invite.role}
            tenantName={invite.tenant.name}
            token={invite.token}
          />
        )}
      </div>
    </main>
  );
}
