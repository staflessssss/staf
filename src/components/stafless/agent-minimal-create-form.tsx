"use client";

import { AgentStatus, type ChannelConnection } from "@prisma/client";
import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useMemo, useState } from "react";

import {
  FormField,
  inputClassName,
  primaryButtonClassName,
  selectClassName,
} from "@/components/stafless/foundation";
import { getDefaultAgentPersona } from "@/lib/agent-defaults";

type MinimalTenant = {
  id: string;
  name: string;
};

type AgentMinimalCreateFormProps = {
  tenant: MinimalTenant;
  availableChannels: ChannelConnection[];
};

export function AgentMinimalCreateForm({
  tenant,
  availableChannels,
}: AgentMinimalCreateFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [channelId, setChannelId] = useState(availableChannels[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedChannel = useMemo(
    () => availableChannels.find((channel) => channel.id === channelId) ?? null,
    [availableChannels, channelId],
  );
  const canSubmit = Boolean(name.trim() && channelId && !isSubmitting);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/tenants/${tenant.id}/agents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          channelId,
          persona: getDefaultAgentPersona(tenant.name),
          tone: "friendly",
          status: AgentStatus.ACTIVE,
          channelConfig: {
            functionBlocks: [],
          },
          knowledgeBlocks: [],
        }),
      });
      const result = (await response.json().catch(() => null)) as
        | { error?: string; item?: { id?: string } }
        | null;

      if (!response.ok || !result?.item?.id) {
        setError(result?.error || "Could not create agent draft.");
        return;
      }

      router.push(`/admin/tenants/${tenant.id}/agents/${result.item.id}?section=settings`);
      router.refresh();
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Could not create agent draft.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      className="max-w-3xl rounded-[20px] border border-border bg-card p-6 shadow-[0_12px_30px_rgba(24,24,54,0.06)]"
      onSubmit={handleSubmit}
    >
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          New draft
        </p>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Create an agent draft
        </h2>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Choose the runtime channel and name the agent. The workspace opens next for
          prompting, functions, knowledge, and launch checks.
        </p>
      </div>

      <div className="mt-8 grid gap-5">
        <FormField
          hint="Use a short operational name. You can rename it later in the workspace."
          label="Agent name"
        >
          <input
            className={inputClassName}
            disabled={isSubmitting}
            onChange={(event) => setName(event.target.value)}
            placeholder="Agent name"
            type="text"
            value={name}
          />
        </FormField>

        <FormField
          hint={
            selectedChannel
              ? "Only connected channels without an assigned agent are shown."
              : "Select the connected channel this agent will operate on."
          }
          label="Channel"
        >
          <select
            className={selectClassName}
            disabled={isSubmitting}
            onChange={(event) => setChannelId(event.target.value)}
            value={channelId}
          >
            {availableChannels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channel.type}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      {error ? (
        <div className="mt-6 rounded-[14px] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <button className={primaryButtonClassName} disabled={!canSubmit} type="submit">
          {isSubmitting ? "Creating..." : "Create draft"}
          <ArrowRight className="ml-2 size-4" />
        </button>
        <p className="text-xs leading-5 text-muted-foreground">
          Creates an active agent that can be paused from Settings.
        </p>
      </div>
    </form>
  );
}
