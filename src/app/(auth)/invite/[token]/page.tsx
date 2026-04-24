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
      <div className="relative w-full max-w-lg overflow-hidden rounded-[28px] bg-white/88 p-8 shadow-[0_28px_80px_rgba(24,24,54,0.12)] ring-1 ring-[#d8d6fe]/80 backdrop-blur-xl">
        <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(135deg,#4648d4_0%,#6063ee_100%)]" />
        <div className="mb-8 space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#5c5c7e]">
            Tenant Invite
          </p>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-[#181836]">
            Join {invite.tenant.name}
          </h1>
          <p className="max-w-sm text-sm leading-6 text-[#464554]">
            Accept your invite and create a password for {invite.email}.
          </p>
        </div>
        {isExpired ? (
          <div className="rounded-[24px] bg-[#fff5ef] p-5 text-sm leading-6 text-[#9f3a16] shadow-[0_10px_26px_rgba(24,24,54,0.04)] ring-1 ring-[#f1d1c2]">
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
