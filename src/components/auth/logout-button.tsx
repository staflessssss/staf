"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

import { cn } from "@/lib/utils";

type LogoutButtonProps = {
  label?: string;
  variant?: "sidebar" | "header" | "rail";
};

export function LogoutButton({
  label = "Logout",
  variant = "header",
}: LogoutButtonProps) {
  const [isPending, setIsPending] = useState(false);

  async function handleLogout() {
    setIsPending(true);
    await signOut({ callbackUrl: "/login" });
  }

  if (variant === "rail") {
    return (
      <button
        type="button"
        onClick={handleLogout}
        disabled={isPending}
        title={label}
        aria-label={label}
        className="grid size-11 place-items-center rounded-xl text-white/55 transition hover:bg-white/[0.05] hover:text-[#e9be86] disabled:opacity-60"
      >
        <LogOut className="size-5" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isPending}
      className={cn(
        "inline-flex items-center justify-center rounded-xl border text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c7d2fe]",
        variant === "sidebar"
          ? "w-full border-[#d8d6fe]/70 bg-white px-4 py-3 text-[11px] uppercase tracking-[0.22em] text-[#181836] hover:bg-[#f6f5ff]"
          : "border-[#d8d6fe]/70 bg-white px-4 py-2 text-[#181836] hover:bg-[#f6f5ff]",
      )}
    >
      {isPending ? "Signing out..." : label}
    </button>
  );
}
