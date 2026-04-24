import { IntegrationConnection } from "@prisma/client";

import { EmptyState, StatusBadge, SurfaceCard } from "@/components/stafless/foundation";

type IntegrationDependency = {
  functionNames: string[];
  stepCount: number;
};

function readIntegrationIdentityHint(integration: IntegrationConnection) {
  if (!integration.metadata || typeof integration.metadata !== "object" || Array.isArray(integration.metadata)) {
    return null;
  }

  const metadata = integration.metadata as Record<string, unknown>;
  const provider = typeof metadata.provider === "string" ? metadata.provider : null;
  const via = typeof metadata.via === "string" ? metadata.via : null;

  if (provider && via) {
    return `${provider} via ${via}`;
  }

  if (provider) {
    return provider;
  }

  if (via) {
    return `via ${via}`;
  }

  return null;
}

function sortIntegrations(
  integrations: IntegrationConnection[],
  dependencies: Map<string, IntegrationDependency>,
) {
  return [...integrations].sort((left, right) => {
    const leftDependency = dependencies.get(left.id);
    const rightDependency = dependencies.get(right.id);
    const leftBlocking = left.status !== "CONNECTED" && leftDependency;
    const rightBlocking = right.status !== "CONNECTED" && rightDependency;

    if (leftBlocking && !rightBlocking) {
      return -1;
    }

    if (!leftBlocking && rightBlocking) {
      return 1;
    }

    if (leftDependency && !rightDependency) {
      return -1;
    }

    if (!leftDependency && rightDependency) {
      return 1;
    }

    return String(left.type).localeCompare(String(right.type));
  });
}

export function IntegrationsSection({
  integrations,
  dependencies,
  sectionCanvasClassName,
  softInfoPanelClassName,
}: {
  integrations: IntegrationConnection[];
  dependencies: Map<string, IntegrationDependency>;
  sectionCanvasClassName: string;
  softInfoPanelClassName: string;
}) {
  const sortedIntegrations = sortIntegrations(integrations, dependencies);
  const blockingCount = sortedIntegrations.filter(
    (integration) => integration.status !== "CONNECTED" && dependencies.has(integration.id),
  ).length;
  const usedCount = sortedIntegrations.filter((integration) => dependencies.has(integration.id)).length;
  const idleCount = sortedIntegrations.length - usedCount;

  return (
    <SurfaceCard
      className="rounded-[30px] bg-[linear-gradient(180deg,#fffdf9_0%,#f7efe2_100%)] shadow-[0_16px_34px_rgba(31,23,40,0.05)]"
      title="Integration dependencies"
      description="See which tenant systems are connected, which ones this agent depends on, and where missing connections will block function execution. Connection management remains a separate surface for now."
    >
      <div className={sectionCanvasClassName}>
        <div className="mb-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-[20px] bg-white/82 p-4 ring-1 ring-[#eadccc]">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8c745b]">
              Used now
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{usedCount}</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Integrations currently referenced by this agent&apos;s function steps.
            </p>
          </div>
          <div className="rounded-[20px] bg-white/82 p-4 ring-1 ring-[#eadccc]">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8c745b]">
              Blocking
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{blockingCount}</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Dependencies that active runtime paths rely on but are not connected.
            </p>
          </div>
          <div className="rounded-[20px] bg-white/82 p-4 ring-1 ring-[#eadccc]">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8c745b]">
              Connected but idle
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{idleCount}</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Available tenant systems that this agent is not using yet.
            </p>
          </div>
        </div>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_320px]">
          <div className="space-y-4">
            {sortedIntegrations.length === 0 ? (
              <EmptyState
                title="No integrations connected yet"
                description="Functions can still be designed first, but real execution needs tenant integrations to be connected."
              />
            ) : (
              sortedIntegrations.map((integration) => {
                const dependency = dependencies.get(integration.id);
                const isConnected = integration.status === "CONNECTED";
                const identityHint = readIntegrationIdentityHint(integration);

                return (
                  <div
                    key={integration.id}
                    className="rounded-[24px] bg-white/80 p-5 ring-1 ring-[#eadccc]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold text-foreground">{integration.type}</p>
                        {identityHint ? (
                          <p className="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-[#8c745b]">
                            {identityHint}
                          </p>
                        ) : null}
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          {dependency
                            ? `Used by ${dependency.functionNames.length} function${dependency.functionNames.length === 1 ? "" : "s"} across ${dependency.stepCount} execution step${dependency.stepCount === 1 ? "" : "s"}.`
                            : "Available to bind, but not used by any function yet."}
                        </p>
                      </div>
                      <StatusBadge status={integration.status} />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-full bg-[#f7efe2] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6d5c4d] ring-1 ring-[#eadccc]">
                        {dependency ? "Function dependency" : "Idle connection"}
                      </span>
                      {!isConnected && dependency ? (
                        <span className="rounded-full bg-[#fff2ef] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#b14a34] ring-1 ring-[#efc0b5]">
                          Blocking runtime execution
                        </span>
                      ) : null}
                      {isConnected && dependency ? (
                        <span className="rounded-full bg-[#eefbf3] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#2d7a4b] ring-1 ring-[#cbe8d5]">
                          Ready for runtime execution
                        </span>
                      ) : null}
                    </div>
                    {dependency ? (
                      <div className="mt-4 rounded-[18px] bg-[#fff9f1] p-4 ring-1 ring-[#eadccc]">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8c745b]">
                          Bound functions
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {dependency.functionNames.map((name) => (
                            <span
                              key={`${integration.id}-${name}`}
                              className="rounded-full bg-white px-3 py-1 text-xs font-medium text-foreground ring-1 ring-[#e4d4c0]"
                            >
                              {name}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>

          <div className="space-y-4">
            <div className={softInfoPanelClassName}>
              <p className="text-sm font-semibold text-foreground">Dependency posture</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Functions describe what the agent does. Integrations describe where those actions
                execute. Keeping them separate makes new channels and new business systems easier
                to add without rewriting the whole workspace.
              </p>
            </div>
            <div className={softInfoPanelClassName}>
              <p className="text-sm font-semibold text-foreground">What to check before deploy</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                <li>Every function step should point to a connected tenant integration.</li>
                <li>Idle integrations are fine; missing dependencies on active functions are not.</li>
                <li>Channels stay separate so delivery setup does not get mixed into business execution logic.</li>
                <li>This section is dependency status today, not connection setup.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </SurfaceCard>
  );
}
