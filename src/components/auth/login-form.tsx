"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getSession, signIn } from "next-auth/react";

import { getDefaultRedirectForRole } from "@/lib/auth-redirect";

type LoginFormProps = {
  callbackUrl?: string;
};

export function LoginForm({ callbackUrl }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setError(null);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (!result || result.error) {
      setError("Invalid email or password.");
      setIsPending(false);
      return;
    }

    const session = await getSession();
    const destination =
      callbackUrl || getDefaultRedirectForRole(session?.user?.role);

    router.push(destination);
    router.refresh();
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <label className="block space-y-2">
        <span className="text-sm font-semibold text-[#181836]">Email</span>
        <input
          autoComplete="email"
          className="w-full rounded-[18px] border border-[#d8d6fe] bg-[#f8f8ff] px-4 py-3 text-sm text-[#181836] outline-none transition placeholder:text-[#5c5c7e]/60 focus:border-[#4648d4]/40 focus:bg-white focus:ring-4 focus:ring-[#4648d4]/10"
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
      </label>
      <label className="block space-y-2">
        <span className="text-sm font-semibold text-[#181836]">Password</span>
        <input
          autoComplete="current-password"
          className="w-full rounded-[18px] border border-[#d8d6fe] bg-[#f8f8ff] px-4 py-3 text-sm text-[#181836] outline-none transition placeholder:text-[#5c5c7e]/60 focus:border-[#4648d4]/40 focus:bg-white focus:ring-4 focus:ring-[#4648d4]/10"
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </label>
      {error ? (
        <div className="rounded-[18px] bg-[#fff0ef] px-4 py-3 text-sm text-destructive ring-1 ring-[#efc4c1]">
          {error}
        </div>
      ) : null}
      <button
        className="w-full rounded-xl bg-[linear-gradient(135deg,#4648d4_0%,#6063ee_100%)] px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(70,72,212,0.18)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
