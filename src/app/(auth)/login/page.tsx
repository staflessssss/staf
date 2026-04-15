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
      <div className="w-full max-w-md rounded-[32px] border border-border bg-[rgba(255,255,255,0.86)] p-8 shadow-[0_24px_80px_rgba(31,23,40,0.12)]">
        <div className="mb-8 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            Behalfy
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Login
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Invite-only access for admins and client users.
          </p>
        </div>
        <LoginForm callbackUrl={callbackUrl} />
      </div>
    </main>
  );
}
