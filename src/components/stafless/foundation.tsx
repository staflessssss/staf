import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  LucideIcon,
  PauseCircle,
  Rocket,
  Sparkles,
  XCircle,
} from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export const primaryButtonClassName =
  "inline-flex items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-[#3d3fc4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export const secondaryButtonClassName =
  "inline-flex items-center justify-center rounded-xl border border-border bg-secondary px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-[#f2ebe0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export const inputClassName =
  "w-full rounded-[12px] border border-input bg-white px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/80 focus:border-ring focus:ring-4 focus:ring-ring/10";

export const selectClassName = inputClassName;

export const textareaClassName = cn(inputClassName, "min-h-28 resize-y");

const statusToneMap: Record<string, string> = {
  ACTIVE: "border-[#c7d8f2] bg-[#eef5ff] text-[#175cd3]",
  CONNECTED: "border-[#c7d8f2] bg-[#eef5ff] text-[#175cd3]",
  DEPLOYING: "border-[#d8d6fe] bg-[#efecff] text-[#4648d4]",
  PENDING: "border-[#d8d6fe] bg-[#efecff] text-[#4648d4]",
  DRAFT: "border-[#d8d6fe] bg-[#f6f5ff] text-[#5c5c7e]",
  PAUSED: "border-[#d8d6fe] bg-[#f5f4ff] text-[#5f3dc4]",
  ERROR: "border-[#efc4c1] bg-[#fff0ef] text-[#b42318]",
  REVOKED: "border-[#efc4c1] bg-[#fff0ef] text-[#b42318]",
  ONBOARDING: "border-[#d8d6fe] bg-[#f5f4ff] text-[#5f3dc4]",
  CHURNED: "border-[#efc4c1] bg-[#fff0ef] text-[#b42318]",
  CLOSED: "border-[#d8d6fe] bg-[#f6f5ff] text-[#5c5c7e]",
  ESCALATED: "border-[#c7d8f2] bg-[#eef5ff] text-[#175cd3]",
  NEW: "border-[#d8d6fe] bg-[#efecff] text-[#4648d4]",
  NEEDS_SETUP: "border-[#d8d6fe] bg-[#efecff] text-[#4648d4]",
  READY_FOR_AGENT: "border-[#c7d8f2] bg-[#eef5ff] text-[#175cd3]",
  NEEDS_ATTENTION: "border-[#efc4c1] bg-[#fff0ef] text-[#b42318]",
};

const statusIconMap: Record<string, ReactNode> = {
  ACTIVE: <CheckCircle2 className="size-3.5" />,
  CONNECTED: <CheckCircle2 className="size-3.5" />,
  DEPLOYING: <Rocket className="size-3.5" />,
  PENDING: <Clock3 className="size-3.5" />,
  DRAFT: <Clock3 className="size-3.5" />,
  PAUSED: <PauseCircle className="size-3.5" />,
  ERROR: <XCircle className="size-3.5" />,
  REVOKED: <XCircle className="size-3.5" />,
  ONBOARDING: <Clock3 className="size-3.5" />,
  CHURNED: <AlertCircle className="size-3.5" />,
  CLOSED: <PauseCircle className="size-3.5" />,
  ESCALATED: <AlertCircle className="size-3.5" />,
  NEW: <Clock3 className="size-3.5" />,
  NEEDS_SETUP: <AlertCircle className="size-3.5" />,
  READY_FOR_AGENT: <Rocket className="size-3.5" />,
  NEEDS_ATTENTION: <AlertCircle className="size-3.5" />,
};

export function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  badge,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-[24px] border border-border bg-[linear-gradient(135deg,#ffffff_0%,#efecff_58%,#e8e5ff_100%)] p-6 shadow-[0_18px_40px_rgba(24,24,54,0.06)] sm:p-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
              {eyebrow}
            </p>
            {badge}
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-[2.25rem] lg:text-[2.5rem]">
              {title}
            </h1>
            {description ? (
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                {description}
              </p>
            ) : null}
          </div>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
      </div>
    </div>
  );
}

export function SurfaceCard({
  title,
  description,
  action,
  className,
  children,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-[20px] border border-border bg-card p-6 shadow-[0_12px_30px_rgba(24,24,54,0.06)]",
        className,
      )}
    >
      {title || description || action ? (
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            {title ? <h2 className="text-xl font-semibold text-foreground">{title}</h2> : null}
            {description ? (
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail?: string;
}) {
  return (
    <div className="rounded-[20px] border border-border bg-card p-6 shadow-[0_12px_30px_rgba(24,24,54,0.05)]">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-3 text-4xl font-semibold tracking-tight text-foreground">{value}</p>
      {detail ? <p className="mt-3 text-sm leading-6 text-muted-foreground">{detail}</p> : null}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone = statusToneMap[status] ?? "border-border bg-secondary text-foreground";
  const icon = statusIconMap[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[10px] border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]",
        tone,
      )}
    >
      {icon}
      {formatEnumLabel(status)}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-[20px] border border-dashed border-border bg-[#f8f7ff] p-6">
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function FormField({
  label,
  hint,
  className,
  labelClassName,
  hintClassName,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  labelClassName?: string;
  hintClassName?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn("block space-y-2", className)}>
      <span className={cn("text-sm font-semibold text-foreground", labelClassName)}>{label}</span>
      {children}
      {hint ? (
        <span className={cn("block text-xs leading-5 text-muted-foreground", hintClassName)}>
          {hint}
        </span>
      ) : null}
    </label>
  );
}

export function ToggleSwitch({
  checked,
  disabled,
  onCheckedChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}) {
  return (
    <button
      aria-checked={checked}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "border-[#6c63ff] bg-[#6c63ff]" : "border-[#d7ddea] bg-[#eef2f7]",
      )}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      role="switch"
      type="button"
    >
      <span
        className={cn(
          "pointer-events-none inline-block size-5 rounded-full bg-white shadow-[0_1px_3px_rgba(16,24,40,0.18)] transition-transform",
          checked ? "translate-x-6" : "translate-x-1",
        )}
      />
    </button>
  );
}

export function WizardStepper({
  steps,
  currentStep,
}: {
  steps: { id: string; title: string; question: string }[];
  currentStep: number;
}) {
  return (
    <div className="rounded-[20px] border border-border bg-card p-6 shadow-[0_12px_30px_rgba(24,24,54,0.05)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {steps.map((step, index) => {
          const isActive = index === currentStep;
          const isComplete = index < currentStep;

          return (
            <div
              key={step.id}
              className={cn(
                "flex flex-1 items-start gap-4 rounded-[20px] border p-4 transition",
                isActive
                  ? "border-primary bg-[#fff3ec]"
                  : isComplete
                    ? "border-[#d7e7dd] bg-[#f4fbf6]"
                    : "border-border bg-[#faf6f0]",
              )}
            >
              <div
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                  isActive
                  ? "bg-primary text-primary-foreground"
                  : isComplete
                    ? "bg-[#175cd3] text-white"
                    : "bg-[#e8e5ff] text-muted-foreground",
                )}
              >
                {isComplete ? <CheckCircle2 className="size-4" /> : index + 1}
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">{step.title}</p>
                <p className="text-xs leading-5 text-muted-foreground">{step.question}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Checklist({
  items,
}: {
  items: { label: string; done?: boolean; hint?: string }[];
}) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-[20px] border border-border bg-[#faf6f0] px-4 py-3"
        >
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "mt-0.5 flex size-5 items-center justify-center rounded-full",
                item.done ? "bg-[#157347] text-white" : "bg-[#ede5d8] text-muted-foreground",
              )}
            >
              {item.done ? <CheckCircle2 className="size-3.5" /> : <ArrowRight className="size-3.5" />}
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">{item.label}</p>
              {item.hint ? <p className="text-xs leading-5 text-muted-foreground">{item.hint}</p> : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function SectionIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-2">
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
      {description ? (
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}

export function HighlightPanel({
  icon: Icon = Sparkles,
  eyebrow,
  title,
  description,
  meta,
}: {
  icon?: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
  meta?: string;
}) {
  return (
    <div className="rounded-[22px] border border-border bg-[linear-gradient(145deg,#ffffff_0%,#eff2ff_100%)] p-6 shadow-[0_12px_30px_rgba(24,24,54,0.05)]">
      <div className="flex items-start gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_10px_24px_rgba(70,72,212,0.24)]">
          <Icon className="size-5" />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            {eyebrow}
          </p>
          <h3 className="text-xl font-semibold tracking-tight text-foreground">{title}</h3>
          <p className="text-sm leading-6 text-muted-foreground">{description}</p>
          {meta ? <p className="text-sm font-medium text-foreground">{meta}</p> : null}
        </div>
      </div>
    </div>
  );
}

export function MetricStrip({
  items,
}: {
  items: { label: string; value: ReactNode; detail?: string }[];
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-[18px] border border-border bg-[#fcfaff] p-5 shadow-[0_10px_24px_rgba(24,24,54,0.04)]"
        >
          <p className="text-sm font-medium text-muted-foreground">{item.label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">{item.value}</p>
          {item.detail ? (
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.detail}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function InlineLinkButton({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-2 text-sm font-semibold text-foreground transition hover:text-primary"
    >
      {children}
      <ArrowUpRight className="size-4" />
    </a>
  );
}
