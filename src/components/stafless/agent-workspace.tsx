import { AgentWorkspaceClient } from "@/components/stafless/agent-workspace-client";
import {
  SerializableEditorAgent,
  SerializableEditorTenant,
  serializeEditorAgent,
} from "@/components/stafless/agent-editor-shared";

export function AgentWorkspace({
  tenant,
  agent,
}: {
  tenant: SerializableEditorTenant;
  agent: SerializableEditorAgent;
}) {
  return (
    <AgentWorkspaceClient
      agent={serializeEditorAgent(agent)}
      tenant={{
        ...tenant,
        agents: tenant.agents ?? [],
      }}
    />
  );
}
