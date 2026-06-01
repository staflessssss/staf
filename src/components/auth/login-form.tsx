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
        <span className="text-sm font-semibold text-white/74">Email</span>
        <input
          autoComplete="email"
          className="w-full rounded-[1rem] border border-white/[0.1] bg-black/22 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[#d4a66f]/46 focus:bg-black/32 focus:ring-4 focus:ring-[#d4a66f]/10"
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
      </label>
      <label className="block space-y-2">
        <span className="text-sm font-semibold text-white/74">Password</span>
        <input
          autoComplete="current-password"
          className="w-full rounded-[1rem] border border-white/[0.1] bg-black/22 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[#d4a66f]/46 focus:bg-black/32 focus:ring-4 focus:ring-[#d4a66f]/10"
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </label>
      {error ? (
        <div className="rounded-[1rem] border border-[#d4a66f]/22 bg-[#1b1410]/72 px-4 py-3 text-sm text-[#f0b58b]">
          {error}
        </div>
      ) : null}
      <button
        className="w-full rounded-xl bg-[linear-gradient(135deg,#f1c88d_0%,#b98245_52%,#6b4424_100%)] px-4 py-3 text-sm font-black text-black shadow-[0_18px_42px_rgba(212,166,111,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_52px_rgba(212,166,111,0.28)] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
