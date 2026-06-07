"use client";

import { useMemo, useState } from "react";
import { IntegrationType } from "@prisma/client";
import type { SafeIntegrationConnection } from "@/components/stafless/agent-editor-shared";
import {
  BriefcaseBusiness,
  CalendarDays,
  Database,
  FileText,
  Table2,
} from "lucide-react";

import {
  EmptyState,
  SurfaceCard,
  ToggleSwitch,
  formatEnumLabel,
} from "@/components/stafless/foundation";
import { cn } from "@/lib/utils";

type IntegrationDependency = {
  functionNames: string[];
  stepCount: number;
};

type IntegrationTab = "available" | "not_connected";
type IntegrationCardModel = {
  id?: string;
  type: IntegrationType;
  status: SafeIntegrationConnection["status"] | "NOT_CONNECTED";
  connection?: SafeIntegrationConnection;
};

const integrationDescriptions: Partial<Record<IntegrationType, string>> = {
  GOOGLE_SHEETS:
    "Shared tables and operational databases the agent can read from or write to in Functions.",
  GOOGLE_CALENDAR:
    "Calendar availability and booking actions for consultations, visits, calls, or appointments.",
  GOOGLE_DRIVE:
    "Drive files the agent can retrieve, attach, or use as reusable business assets.",
  HONEYBOOK:
    "Client records, projects, and workflow data for HoneyBook-backed businesses.",
  HUBSPOT:
    "CRM records, lead updates, and pipeline movement for HubSpot-backed sales flows.",
};

const integrationIconMap: Partial<Record<IntegrationType, typeof Database>> = {
  GOOGLE_SHEETS: Table2,
  GOOGLE_CALENDAR: CalendarDays,
  GOOGLE_DRIVE: FileText,
  HONEYBOOK: BriefcaseBusiness,
  HUBSPOT: Database,
};

function readIntegrationIdentityHint(integration?: SafeIntegrationConnection) {
  if (!integration?.metadata || typeof integration.metadata !== "object" || Array.isArray(integration.metadata)) {
    return null;
  }

  const metadata = integration.metadata as Record<string, unknown>;
  const email = typeof metadata.email === "string" ? metadata.email : null;
  const provider = typeof metadata.provider === "string" ? metadata.provider : null;
  const via = typeof metadata.via === "string" ? metadata.via : null;

  if (email) {
    return email;
  }

  if (provider && via) {
    return `${provider} via ${via}`;
  }

  return provider ?? (via ? `via ${via}` : null);
}

function sortIntegrationCards(integrations: IntegrationCardModel[]) {
  return [...integrations].sort((left, right) =>
    String(left.type).localeCompare(String(right.type)),
  );
}

export function IntegrationsSection({
  dependencies,
  enabledIntegrationIds,
  integrations,
  onIntegrationEnabledChange,
  sectionCanvasClassName,
}: {
  integrations: SafeIntegrationConnection[];
  dependencies: Map<string, IntegrationDependency>;
  enabledIntegrationIds: string[];
  onIntegrationEnabledChange: (integrationId: string, enabled: boolean) => void;
  sectionCanvasClassName: string;
  softInfoPanelClassName: string;
}) {
  const [activeTab, setActiveTab] = useState<IntegrationTab>("available");
  const enabledIds = useMemo(() => new Set(enabledIntegrationIds), [enabledIntegrationIds]);
  const integrationCards = useMemo(() => {
    const byType = new Map(integrations.map((integration) => [integration.type, integration]));

    return Object.values(IntegrationType).map((type) => {
      const connection = byType.get(type);

      return {
        id: connection?.id,
        type,
        status: connection?.status ?? "NOT_CONNECTED",
        connection,
      } satisfies IntegrationCardModel;
    });
  }, [integrations]);
  const availableIntegrations = useMemo(
    () => sortIntegrationCards(integrationCards.filter((integration) => integration.status === "CONNECTED")),
    [integrationCards],
  );
  const notConnectedIntegrations = useMemo(
    () => sortIntegrationCards(integrationCards.filter((integration) => integration.status !== "CONNECTED")),
    [integrationCards],
  );
  const visibleIntegrations =
    activeTab === "available" ? availableIntegrations : notConnectedIntegrations;

  return (
    <SurfaceCard
      className="rounded-[20px] bg-white shadow-[0_10px_24px_rgba(24,24,54,0.04)]"
      title="Integrations"
      description="Choose which connected tenant systems this agent can use inside Functions. Physical account access stays tenant-level and can be reused by other agents for the same client."
    >
      <div className={sectionCanvasClassName}>
        <div className="mb-5 grid rounded-[12px] bg-[#eef2f7] p-1 sm:grid-cols-2">
          <button
            className={cn(
              "rounded-[9px] px-4 py-2.5 text-sm font-semibold transition",
              activeTab === "available"
                ? "bg-white text-foreground shadow-[0_1px_2px_rgba(16,24,40,0.08)]"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setActiveTab("available")}
            type="button"
          >
            Доступные <span className="ml-1 rounded-md bg-foreground px-1.5 py-0.5 text-xs text-white">{availableIntegrations.length}</span>
          </button>
          <button
            className={cn(
              "rounded-[9px] px-4 py-2.5 text-sm font-semibold transition",
              activeTab === "not_connected"
                ? "bg-white text-foreground shadow-[0_1px_2px_rgba(16,24,40,0.08)]"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setActiveTab("not_connected")}
            type="button"
          >
            Не подключены <span className="ml-1 rounded-md bg-[#a9b4c4] px-1.5 py-0.5 text-xs text-white">{notConnectedIntegrations.length}</span>
          </button>
        </div>

        {visibleIntegrations.length === 0 ? (
          <EmptyState
            title={activeTab === "available" ? "No available integrations" : "No disconnected integrations"}
            description={
              activeTab === "available"
                ? "When the client connects business systems, they will appear here as selectable agent resources."
                : "Every known tenant integration is currently connected."
            }
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {visibleIntegrations.map((integration) => {
              const isAvailable = integration.status === "CONNECTED";
              const isEnabled = Boolean(integration.id && enabledIds.has(integration.id));
              const dependency = integration.id ? dependencies.get(integration.id) : undefined;
              const Icon = integrationIconMap[integration.type] ?? Database;
              const identityHint = readIntegrationIdentityHint(integration.connection);

              return (
                <div
                  key={integration.id ?? integration.type}
                  className={cn(
                    "rounded-[16px] border p-4 transition",
                    isAvailable
                      ? "border-[#d9e1ec] bg-white shadow-[0_6px_16px_rgba(24,24,54,0.04)]"
                      : "border-[#d9e1ec] bg-[#f3f5f8] opacity-75",
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <div
                        className={cn(
                          "flex size-12 shrink-0 items-center justify-center rounded-[12px] border",
                          isAvailable
                            ? "border-[#d9e1ec] bg-white text-primary"
                            : "border-[#d9e1ec] bg-[#edf1f5] text-[#8b98aa]",
                        )}
                      >
                        <Icon className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-foreground">
                            {formatEnumLabel(integration.type)}
                          </h3>
                          <span
                            className={cn(
                              "rounded-[8px] px-2 py-1 text-xs font-semibold",
                              isEnabled
                                ? "bg-[#e8f2ff] text-[#175cd3]"
                                : isAvailable
                                  ? "bg-[#eef2f7] text-[#526173]"
                                  : "bg-[#e4e9f0] text-[#7a8798]",
                            )}
                          >
                            {isEnabled ? "Подключено" : isAvailable ? "Доступно" : "Не подключено"}
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          {integrationDescriptions[integration.type] ??
                            "External business system available for future function bindings."}
                        </p>
                        {identityHint ? (
                          <p className="mt-2 truncate text-xs font-medium uppercase tracking-[0.14em] text-[#7a8798]">
                            {identityHint}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <ToggleSwitch
                      checked={isEnabled}
                      disabled={!isAvailable || !integration.id}
                      onCheckedChange={(checked) =>
                        integration.id ? onIntegrationEnabledChange(integration.id, checked) : undefined
                      }
                    />
                  </div>

                  <div className="mt-4 border-t border-[#eef2f7] pt-3">
                    <p className="text-xs leading-5 text-muted-foreground">
                      {dependency
                        ? `Used by ${dependency.functionNames.length || 1} function${dependency.functionNames.length === 1 ? "" : "s"} across ${dependency.stepCount} step${dependency.stepCount === 1 ? "" : "s"}.`
                        : isEnabled
                          ? "Available in Functions, not used yet."
                          : isAvailable
                            ? "Turn on to make it selectable in Functions."
                            : "Ask the client to connect this system before it can be selected."}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </SurfaceCard>
  );
}
