import { PageHeader, SurfaceCard } from "@/components/stafless/foundation";

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        title="Admin settings"
        description="Operational configuration remains intentionally small for now. This page is a reserved surface for later policy, runtime, and security controls."
      />
      <SurfaceCard
        title="Reserved for later phases"
        description="Phase 4 keeps the shell ready so future settings do not appear as one-off pages with unrelated UI patterns."
      >
        <div className="rounded-[20px] border border-border bg-[#faf6f0] px-4 py-4 text-sm leading-6 text-muted-foreground">
          Runtime, deploy, and security controls will land here once the builder and shared runtime phases are wired end to end.
        </div>
      </SurfaceCard>
    </div>
  );
}
