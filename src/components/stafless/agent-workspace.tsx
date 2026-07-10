import { AgentWorkspaceClient } from "@/components/stafless/agent-workspace-client";
import {
  SerializableEditorAgent,
  SerializableEditorTenant,
  serializeEditorAgent,
} from "@/components/stafless/agent-editor-shared";
import type { AgentRuntimeProfile } from "@/lib/agent-runtime-profile";

export function AgentWorkspace({
  tenant,
  agent,
  initialWorkspaceSection,
  runtimeProfile,
}: {
  tenant: SerializableEditorTenant;
  agent: SerializableEditorAgent;
  initialWorkspaceSection?: string;
  runtimeProfile: AgentRuntimeProfile;
}) {
  return (
    <AgentWorkspaceClient
      agent={serializeEditorAgent(agent)}
      initialWorkspaceSection={initialWorkspaceSection}
      runtimeProfile={runtimeProfile}
      tenant={{
        ...tenant,
        agents: tenant.agents ?? [],
      }}
    />
  );
}
