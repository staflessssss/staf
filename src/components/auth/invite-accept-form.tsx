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
      <div className="rounded-[20px] bg-[#f5f2ff] px-4 py-4 text-sm text-[#5c5c7e] ring-1 ring-[#d8d6fe]">
        <div className="font-semibold text-[#181836]">{tenantName}</div>
        <div className="mt-1">{defaultEmail}</div>
      </div>
      <label className="block space-y-2">
        <span className="text-sm font-semibold text-[#181836]">Your name</span>
        <input
          className="w-full rounded-[18px] border border-[#d8d6fe] bg-[#f8f8ff] px-4 py-3 text-sm text-[#181836] outline-none transition placeholder:text-[#5c5c7e]/60 focus:border-[#4648d4]/40 focus:bg-white focus:ring-4 focus:ring-[#4648d4]/10"
          name="name"
          onChange={(event) => setName(event.target.value)}
          required
          type="text"
          value={name}
        />
      </label>
      <label className="block space-y-2">
        <span className="text-sm font-semibold text-[#181836]">Create password</span>
        <input
          className="w-full rounded-[18px] border border-[#d8d6fe] bg-[#f8f8ff] px-4 py-3 text-sm text-[#181836] outline-none transition placeholder:text-[#5c5c7e]/60 focus:border-[#4648d4]/40 focus:bg-white focus:ring-4 focus:ring-[#4648d4]/10"
          minLength={8}
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
        {isPending ? "Creating account..." : "Accept invite"}
      </button>
    </form>
  );
}
