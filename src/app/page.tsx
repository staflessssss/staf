import Link from "next/link";

import {
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/components/stafless/foundation";

export default function HomePage() {
  return (
    <main className="min-h-screen px-6 py-10 sm:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl flex-col justify-between rounded-[32px] border border-border bg-[linear-gradient(135deg,rgba(255,255,255,0.85),rgba(244,241,234,0.9))] p-8 shadow-[0_20px_80px_rgba(31,23,40,0.08)] sm:p-12">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              Behalfy
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Operator-managed AI platform for service businesses
            </p>
          </div>
          <Link href="/login" className={secondaryButtonClassName}>
            Login
          </Link>
        </div>
        <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div className="space-y-8">
            <div className="space-y-5">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
                Premium operator console
              </p>
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-[3.7rem] lg:leading-[1.02]">
                Assemble, test, and deploy tenant-specific AI agents without exposing the complexity to the client.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                Operators manage the runtime. Clients complete guided setup. Every tenant stays isolated, observable, and ready for service delivery.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/admin" className={primaryButtonClassName}>
                Open admin dashboard
              </Link>
              <Link href="/client" className={secondaryButtonClassName}>
                Open client portal
              </Link>
            </div>
          </div>
          <div className="grid gap-4">
            {[
              [
                "Admin surface",
                "Control room for onboarding tenants, assembling agents, and managing deploy readiness.",
              ],
              [
                "Client surface",
                "Calm setup experience for channels, integrations, and conversation visibility.",
              ],
              [
                "Agent builder",
                "Five-step editorial workflow covering basics, channel, knowledge, tools, and review.",
              ],
            ].map(([title, description]) => (
              <div
                key={title}
                className="rounded-[24px] border border-border bg-white/80 p-6 shadow-[0_12px_30px_rgba(31,23,40,0.05)]"
              >
                <p className="text-lg font-semibold text-foreground">{title}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
