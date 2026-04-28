import { AgentWorkspaceClient } from "@/components/stafless/agent-workspace-client";
import {
  SerializableEditorAgent,
  SerializableEditorTenant,
  serializeEditorAgent,
} from "@/components/stafless/agent-editor-shared";

export function AgentWorkspace({
  tenant,
  agent,
  initialWorkspaceSection,
}: {
  tenant: SerializableEditorTenant;
  agent: SerializableEditorAgent;
  initialWorkspaceSection?: string;
}) {
  return (
    <AgentWorkspaceClient
      agent={serializeEditorAgent(agent)}
      initialWorkspaceSection={initialWorkspaceSection}
      tenant={{
        ...tenant,
        agents: tenant.agents ?? [],
      }}
    />
  );
}
