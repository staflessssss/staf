import { AgentCreateWizardClient } from "@/components/stafless/agent-create-wizard-client";
import {
  SerializableEditorTenant,
} from "@/components/stafless/agent-editor-shared";

export function AgentCreateFlow({
  tenant,
}: {
  tenant: SerializableEditorTenant;
}) {
  return (
    <AgentCreateWizardClient
      tenant={{
        ...tenant,
        agents: tenant.agents ?? [],
      }}
    />
  );
}
