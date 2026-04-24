import { SurfaceCard } from "@/components/stafless/foundation";

type DeployReadinessResult = {
  summary: string;
  items: Array<{
    key: string;
    label: string;
    done: boolean;
    detail: string;
  }>;
  channelConfig?: {
    webhookPath?: string | null;
    webhookUrl?: string | null;
    webhookRegistration?: "pending_public_url" | "ready_to_register" | "registered" | string;
    outboundMode?: string | null;
    channelType?: string | null;
  } | null;
};

export function WorkspaceTestSection({
  isDirty,
  hasAgent,
  deployReadiness,
}: {
  isDirty: boolean;
  hasAgent: boolean;
  deployReadiness: DeployReadinessResult | null;
}) {
  return (
    <div className="rounded-[32px] bg-[linear-gradient(180deg,#fffdf9_0%,#f7efe2_100%)] p-8 ring-1 ring-[#e6d7c5] shadow-[0_18px_40px_rgba(31,23,40,0.06)]">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
        Test
      </p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
        Run the operator-safe test path before launch
      </h2>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
        Testing is now a real workspace section. Use it to validate the saved agent path without turning the whole page back into a wizard.
      </p>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <div className="rounded-[20px] bg-white/78 p-5 ring-1 ring-[#ece0d2]">
          <p className="text-sm font-semibold text-foreground">Workspace status</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {isDirty
              ? "There are unsaved edits. Save once before moving into full-cycle testing."
              : "This workspace is in sync with the latest saved state."}
          </p>
        </div>
        <div className="rounded-[20px] bg-white/78 p-5 ring-1 ring-[#ece0d2]">
          <p className="text-sm font-semibold text-foreground">Test path</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Use the saved-agent test chat for a realistic conversation cycle without live outbound side effects.
          </p>
        </div>
        <div className="rounded-[20px] bg-white/78 p-5 ring-1 ring-[#ece0d2]">
          <p className="text-sm font-semibold text-foreground">Prompt shape</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Keep the preview readable enough that an operator can sanity-check tone, rules, and function posture quickly.
          </p>
        </div>
      </div>

      <SurfaceCard
        className="mt-6 bg-[#fcfaf6]"
        title="Testing flow"
        description="The draft work happens here. The real conversation cycle belongs to the saved agent workspace."
      >
        <div className="rounded-[20px] border border-border bg-[#faf6f0] p-5">
          <p className="text-sm leading-6 text-[#433a49]">
            Full-cycle testing now belongs in the saved agent workspace. Open the test section to use the right-side test chat with persistent memory and tool execution.
          </p>
          {!hasAgent ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Save the agent first, then continue testing from the workspace.
            </p>
          ) : null}
          {deployReadiness ? (
            <div className="mt-4 rounded-[16px] border border-border bg-white p-4">
              <p className="text-sm font-semibold text-foreground">Deploy readiness</p>
              <p className="mt-2 text-sm leading-6 text-[#433a49]">
                {deployReadiness.summary}
              </p>
              <div className="mt-3 space-y-2">
                {deployReadiness.items.map((item) => (
                  <div
                    key={item.key}
                    className="rounded-[14px] border border-border bg-[#faf6f0] px-3 py-2"
                  >
                    <p className="text-sm font-medium text-foreground">
                      {item.done ? "Ready" : "Needs work"}: {item.label}
                    </p>
                    <p className="text-xs leading-5 text-muted-foreground">{item.detail}</p>
                  </div>
                ))}
              </div>
              {deployReadiness.channelConfig ? (
                <div className="mt-4 rounded-[14px] border border-border bg-[#f7f2ea] px-3 py-3">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#636563]">
                    Webhook status
                  </p>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {deployReadiness.channelConfig.webhookRegistration === "registered"
                      ? "Registered and ready to receive live traffic."
                      : deployReadiness.channelConfig.webhookRegistration === "pending_public_url"
                        ? "Waiting for a public HTTPS app URL before Telegram webhook registration can complete."
                        : deployReadiness.channelConfig.webhookRegistration === "ready_to_register"
                          ? "Ready to register on the next live deploy."
                          : "Webhook registration state is available."}
                  </p>
                  <div className="mt-3 space-y-1 text-xs leading-5 text-[#554336]">
                    <p>Channel: {deployReadiness.channelConfig.channelType ?? "Unknown"}</p>
                    <p>Outbound mode: {deployReadiness.channelConfig.outboundMode ?? "Unknown"}</p>
                    {deployReadiness.channelConfig.webhookPath ? (
                      <p>Route: {deployReadiness.channelConfig.webhookPath}</p>
                    ) : null}
                    {deployReadiness.channelConfig.webhookUrl ? (
                      <p>Public URL: {deployReadiness.channelConfig.webhookUrl}</p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </SurfaceCard>
    </div>
  );
}
