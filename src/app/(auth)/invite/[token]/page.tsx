import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

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
    <main className="relative flex min-h-screen min-h-[112vh] items-center justify-center overflow-hidden bg-[#070908] px-6 py-10 text-white">
      <Image src="/assets/behalfy-hero-coast.png" alt="" fill priority sizes="100vw" className="object-cover opacity-42" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,9,8,0.38),rgba(7,9,8,0.88)),radial-gradient(circle_at_50%_35%,rgba(212,166,111,0.16),transparent_34%)]" />
      <div className="absolute inset-x-0 bottom-0 h-56 bg-[linear-gradient(180deg,rgba(7,9,8,0),#070908_86%)]" />

      <div className="relative w-full max-w-lg overflow-hidden rounded-[1.7rem] border border-[#d4a66f]/32 bg-[#0c0f0e]/88 p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.035),0_32px_100px_rgba(0,0,0,0.58),0_0_70px_rgba(212,166,111,0.12)] backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(212,166,111,0.11),transparent_34%),linear-gradient(120deg,rgba(255,255,255,0.045),transparent_38%)]" />
        <div className="relative">
          <Link href="/" className="mb-10 inline-flex items-center gap-3">
            <Image
              src="/assets/landing/behalfy-gold-mark.png"
              alt=""
              width={34}
              height={34}
              className="size-[34px] object-contain drop-shadow-[0_6px_18px_rgba(212,166,111,0.32)]"
            />
            <span className="font-serif text-[1.9rem] font-semibold tracking-[-0.06em] text-white">
              Behalfy
            </span>
          </Link>

          <div className="mb-8 space-y-3">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#d4a66f]/72">
              Tenant invite
            </p>
            <h1 className="font-serif text-5xl font-normal leading-none tracking-[-0.065em] text-white">
              Join {invite.tenant.name}
            </h1>
            <p className="max-w-sm text-sm leading-6 text-white/52">
              Accept your invite and create secure access for {invite.email}.
            </p>
          </div>
          {isExpired ? (
            <div className="rounded-[1.2rem] border border-[#d4a66f]/22 bg-[#1b1410]/72 p-5 text-sm leading-6 text-[#f0b58b] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
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
      </div>
    </main>
  );
}
