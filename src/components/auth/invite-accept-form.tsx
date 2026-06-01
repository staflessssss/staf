"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { signIn } from "next-auth/react";

import { getDefaultRedirectForRole } from "@/lib/auth-redirect";

type InviteAcceptFormProps = {
  defaultEmail: string;
  role: string;
  tenantName: string;
  token: string;
};

export function InviteAcceptForm({
  defaultEmail,
  role,
  tenantName,
  token,
}: InviteAcceptFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setError(null);

    const response = await fetch("/api/auth/invite/accept", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token,
        name,
        password,
      }),
    });

    const result = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;

    if (!response.ok) {
      setError(result?.error || "Could not accept invite.");
      setIsPending(false);
      return;
    }

    const signInResult = await signIn("credentials", {
      email: defaultEmail,
      password,
      redirect: false,
    });

    if (!signInResult || signInResult.error) {
      setError("Invite accepted, but automatic sign-in failed.");
      setIsPending(false);
      return;
    }

    router.push(getDefaultRedirectForRole(role));
    router.refresh();
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="rounded-[1.15rem] border border-white/[0.1] bg-white/[0.045] px-4 py-4 text-sm text-white/52 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="font-semibold text-white">{tenantName}</div>
        <div className="mt-1 truncate">{defaultEmail}</div>
      </div>
      <label className="block space-y-2">
        <span className="text-sm font-semibold text-white/74">Your name</span>
        <input
          className="w-full rounded-[1rem] border border-white/[0.1] bg-black/22 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[#d4a66f]/46 focus:bg-black/32 focus:ring-4 focus:ring-[#d4a66f]/10"
          name="name"
          onChange={(event) => setName(event.target.value)}
          required
          type="text"
          value={name}
        />
      </label>
      <label className="block space-y-2">
        <span className="text-sm font-semibold text-white/74">Create password</span>
        <input
          className="w-full rounded-[1rem] border border-white/[0.1] bg-black/22 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[#d4a66f]/46 focus:bg-black/32 focus:ring-4 focus:ring-[#d4a66f]/10"
          minLength={8}
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
        {isPending ? "Creating account..." : "Accept invite"}
      </button>
    </form>
  );
}
