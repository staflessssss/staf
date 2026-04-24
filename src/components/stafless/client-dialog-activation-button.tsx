"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { primaryButtonClassName, secondaryButtonClassName } from "@/components/stafless/foundation";

type ClientDialogActivationButtonProps = {
  conversationId: string;
  disabled?: boolean;
};

export function ClientDialogActivationButton({
  conversationId,
  disabled = false,
}: ClientDialogActivationButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isActivating, setIsActivating] = useState(false);

  async function activateDialog() {
    if (disabled || isPending || isActivating) {
      return;
    }

    setIsActivating(true);
    setError(null);

    try {
      const response = await fetch(`/api/client/conversations/${conversationId}/activate`, {
        method: "POST",
      });
      const result = (await response.json().catch(() => null)) as
        | { item?: { id: string; status: string }; error?: string }
        | null;

      if (!response.ok || !result?.item) {
        setError(result?.error ?? "Could not activate this dialog.");
        return;
      }

      startTransition(() => {
        router.refresh();
      });
    } catch (activationError) {
      setError(
        activationError instanceof Error
          ? activationError.message
          : "Could not activate this dialog.",
      );
    } finally {
      setIsActivating(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        className={disabled ? secondaryButtonClassName : primaryButtonClassName}
        disabled={disabled || isPending || isActivating}
        onClick={activateDialog}
      >
        {isActivating || isPending ? "Activating..." : "Activate dialog"}
      </button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
