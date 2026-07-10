import type { SafeChannelConnection } from "@/components/stafless/agent-editor-shared";
import { SurfaceCard } from "@/components/stafless/foundation";
import type { AgentRuntimeProfile } from "@/lib/agent-runtime-profile";
import { humanizeWorkspaceToken } from "@/components/stafless/workspace-sections/utils";

export function WorkspaceOverviewSection({
  agentName,
  selectedChannel,
  isDirty,
  knowledgeCount,
  functionCount,
  runtimeProfile,
  softInfoPanelClassName,
  status,
}: {
  agentName: string;
  selectedChannel: SafeChannelConnection | null;
  isDirty: boolean;
  knowledgeCount: number;
  functionCount: number;
  runtimeProfile: AgentRuntimeProfile;
  softInfoPanelClassName: string;
  status: string;
}) {
  const modeLabel = runtimeProfile.mode === "voice_first" ? "Voice-first GPT" : "Guided GPT";
  const behaviorLabel =
    runtimeProfile.conversationConfiguration === "prompting"
      ? "Prompting controls the conversation. Playbook is inactive."
      : "Prompting and Playbook both guide the conversation.";

  return (
    <SurfaceCard
      className="rounded-[16px] border border-[#e6ebf2] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
      title="Agent overview"
      description="The saved configuration that is currently applied when this agent receives a message."
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-[12px] border border-[#e6ebf2] bg-[#fbfcfe] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#667085]">
            Status
          </p>
          <p className="mt-3 text-lg font-semibold text-foreground">{agentName}</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {selectedChannel
              ? `${humanizeWorkspaceToken(selectedChannel.type)} - ${status.toLowerCase()}`
              : "No operating channel has been assigned yet."}
          </p>
        </div>
        <div className="rounded-[12px] border border-[#e6ebf2] bg-[#fbfcfe] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#667085]">
            Runtime
          </p>
          <p className="mt-3 text-lg font-semibold text-foreground">
            {modeLabel}
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {behaviorLabel}
          </p>
        </div>
        <div className="rounded-[12px] border border-[#e6ebf2] bg-[#fbfcfe] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#667085]">
            Knowledge and actions
          </p>
          <p className="mt-3 text-lg font-semibold text-foreground">
            {knowledgeCount} knowledge / {runtimeProfile.actions.length} actions
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {runtimeProfile.configuredActionCount} configured action{runtimeProfile.configuredActionCount === 1 ? "" : "s"} and {runtimeProfile.systemActionCount} system action{runtimeProfile.systemActionCount === 1 ? "" : "s"} are available.
          </p>
        </div>
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className={softInfoPanelClassName}>
          <p className="text-sm font-semibold text-foreground">What the model receives</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {runtimeProfile.knowledgeDelivery === "full_prompt"
              ? "All saved knowledge blocks are provided to the model on every turn. Keep facts current and remove conflicting instructions."
              : "Knowledge is loaded selectively for each request."}
          </p>
        </div>
        <div className={softInfoPanelClassName}>
          <p className="text-sm font-semibold text-foreground">Unsaved changes</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {isDirty
              ? "This workspace has edits that are not applied to new messages yet."
              : `${functionCount} integration-backed action${functionCount === 1 ? " is" : "s are"} saved in the current configuration.`}
          </p>
        </div>
      </div>
    </SurfaceCard>
  );
}
