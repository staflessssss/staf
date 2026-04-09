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
        <span className="text-sm font-semibold text-foreground">Email</span>
        <input
          autoComplete="email"
          className="w-full rounded-[20px] border border-input bg-white px-4 py-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-4 focus:ring-ring/10"
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
      </label>
      <label className="block space-y-2">
        <span className="text-sm font-semibold text-foreground">Password</span>
        <input
          autoComplete="current-password"
          className="w-full rounded-[20px] border border-input bg-white px-4 py-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-4 focus:ring-ring/10"
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </label>
      {error ? (
        <div className="rounded-[20px] border border-[#efc4c1] bg-[#fff0ef] px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      <button
        className="w-full rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-[#b85427] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
