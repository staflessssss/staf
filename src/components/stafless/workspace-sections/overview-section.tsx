import type { SafeChannelConnection } from "@/components/stafless/agent-editor-shared";
import { SurfaceCard } from "@/components/stafless/foundation";
import { humanizeWorkspaceToken } from "@/components/stafless/workspace-sections/utils";

export function WorkspaceOverviewSection({
  agentName,
  selectedChannel,
  isDirty,
  knowledgeCount,
  functionCount,
  softInfoPanelClassName,
}: {
  agentName: string;
  selectedChannel: SafeChannelConnection | null;
  isDirty: boolean;
  knowledgeCount: number;
  functionCount: number;
  softInfoPanelClassName: string;
}) {
  return (
    <SurfaceCard
      className="rounded-[30px] bg-[linear-gradient(180deg,#fffdf9_0%,#f7efe2_100%)] shadow-[0_16px_34px_rgba(31,23,40,0.05)]"
      title="Agent overview"
      description="Use this as the operator's control room: what the agent is, where it runs, and what is already stable enough to trust."
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-[20px] bg-white/80 p-5 ring-1 ring-[#eadccc]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8d7762]">
            Current posture
          </p>
          <p className="mt-3 text-lg font-semibold text-foreground">{agentName}</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {selectedChannel
              ? `${humanizeWorkspaceToken(selectedChannel.type)} is the current operating channel.`
              : "No operating channel has been assigned yet."}
          </p>
        </div>
        <div className="rounded-[20px] bg-white/80 p-5 ring-1 ring-[#eadccc]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8d7762]">
            Configuration footprint
          </p>
          <p className="mt-3 text-lg font-semibold text-foreground">
            {knowledgeCount} knowledge / {functionCount} actions
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            The agent has dedicated homes for behavior, delivery, control, and execution.
          </p>
        </div>
        <div className="rounded-[20px] bg-white/80 p-5 ring-1 ring-[#eadccc]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8d7762]">
            Recommended next pass
          </p>
          <p className="mt-3 text-lg font-semibold text-foreground">
            {isDirty ? "Save the latest edits" : "Tune functions and control"}
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Messages, control, integrations, and test are section-based surfaces with their own operating context.
          </p>
        </div>
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className={softInfoPanelClassName}>
          <p className="text-sm font-semibold text-foreground">What is live now</p>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
            <li>Overview is now the landing surface for existing agents.</li>
            <li>Settings, Prompting, Messages, Control, Channels, Playbook, Knowledge, and Functions have explicit homes.</li>
            <li>Testing remains operator-safe and deploy-aware.</li>
          </ul>
        </div>
        <div className={softInfoPanelClassName}>
          <p className="text-sm font-semibold text-foreground">What this unlocks</p>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
            <li>New channels can land as focused workspace sections.</li>
            <li>Integrations stay execution dependencies instead of leaking into every behavior screen.</li>
            <li>Functions can evolve into true business action contracts.</li>
          </ul>
        </div>
      </div>
    </SurfaceCard>
  );
}
