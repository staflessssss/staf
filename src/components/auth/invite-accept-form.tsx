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
      <div className="rounded-[20px] border border-border bg-[#faf6f0] px-4 py-3 text-sm text-muted-foreground">
        <div className="font-medium text-foreground">{tenantName}</div>
        <div>{defaultEmail}</div>
      </div>
      <label className="block space-y-2">
        <span className="text-sm font-semibold text-foreground">Your name</span>
        <input
          className="w-full rounded-[20px] border border-input bg-white px-4 py-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-4 focus:ring-ring/10"
          name="name"
          onChange={(event) => setName(event.target.value)}
          required
          type="text"
          value={name}
        />
      </label>
      <label className="block space-y-2">
        <span className="text-sm font-semibold text-foreground">
          Create password
        </span>
        <input
          className="w-full rounded-[20px] border border-input bg-white px-4 py-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-4 focus:ring-ring/10"
          minLength={8}
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
        {isPending ? "Creating account..." : "Accept invite"}
      </button>
    </form>
  );
}
