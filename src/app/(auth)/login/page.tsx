import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { auth } from "@/lib/auth";
import { getDefaultRedirectForRole } from "@/lib/auth-redirect";

type LoginPageProps = {
  searchParams: Promise<{ callbackUrl?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await auth();

  if (session?.user) {
    redirect(getDefaultRedirectForRole(session.user.role));
  }

  const { callbackUrl } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <div className="relative w-full max-w-md overflow-hidden rounded-[28px] bg-white/88 p-8 shadow-[0_28px_80px_rgba(24,24,54,0.12)] ring-1 ring-[#d8d6fe]/80 backdrop-blur-xl">
        <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(135deg,#4648d4_0%,#6063ee_100%)]" />
        <div className="mb-8 space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#5c5c7e]">
            Behalfy
          </p>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-[#181836]">
            Login
          </h1>
          <p className="max-w-sm text-sm leading-6 text-[#464554]">
            Invite-only access for admins and client users.
          </p>
        </div>
        <LoginForm callbackUrl={callbackUrl} />
      </div>
    </main>
  );
}
