"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function AgentStatusToggle({
  agentId,
  initialStatus,
}: {
  agentId: string;
  initialStatus: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isActive = status === "ACTIVE";
  const canToggle = status === "ACTIVE" || status === "PAUSED";

  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  async function updateStatus() {
    if (!canToggle || isUpdating) {
      return;
    }

    const nextStatus = isActive ? "PAUSED" : "ACTIVE";

    if (
      nextStatus === "PAUSED" &&
      !window.confirm(
        "Pause this agent? It will stop replying and all pending follow-ups will be canceled.",
      )
    ) {
      return;
    }

    setIsUpdating(true);
    setError(null);

    try {
      const response = await fetch(`/api/client/agents/${agentId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      const result = (await response.json().catch(() => null)) as
        | { error?: string; item?: { status?: string } }
        | null;

      if (!response.ok || !result?.item?.status) {
        throw new Error(result?.error ?? "Could not update the agent.");
      }

      setStatus(result.item.status);
      router.refresh();
    } catch (statusError) {
      setError(
        statusError instanceof Error
          ? statusError.message
          : "Could not update the agent.",
      );
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1.5 md:items-end">
      <div className="flex items-center gap-2.5">
        <span className="text-xs font-medium text-white/52">
          {isActive ? "Agent on" : "Agent paused"}
        </span>
        <button
          aria-checked={isActive}
          aria-label={isActive ? "Pause agent" : "Resume agent"}
          className={[
            "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e9be86]/70",
            "disabled:cursor-not-allowed disabled:opacity-50",
            isActive
              ? "border-[#47c978]/50 bg-[#2f8f56]"
              : "border-white/[0.16] bg-white/[0.07]",
          ].join(" ")}
          disabled={!canToggle || isUpdating}
          onClick={updateStatus}
          role="switch"
          type="button"
        >
          <span
            className={[
              "pointer-events-none inline-block size-5 rounded-full bg-white shadow transition-transform",
              isActive ? "translate-x-6" : "translate-x-1",
            ].join(" ")}
          />
        </button>
      </div>
      <span className="text-[11px] text-white/38">
        {isUpdating
          ? "Updating..."
          : isActive
            ? "Replies and follow-ups enabled"
            : "No replies or follow-ups"}
      </span>
      {error ? (
        <span className="max-w-64 text-right text-[11px] text-[#ff9b7a]">{error}</span>
      ) : null}
    </div>
  );
}
