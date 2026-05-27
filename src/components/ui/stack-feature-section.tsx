"use client";

import Link from "next/link";
import {
  CalendarCheck2,
  Camera,
  Database,
  FileText,
  Mail,
  MessageCircle,
  Send,
  Sparkles,
} from "lucide-react";

import { BehalfyLogo } from "@/components/ui/behalfy-logo";
import { cn } from "@/lib/utils";

const orbitItems = [
  { label: "Gmail", Icon: Mail, color: "#ea4335" },
  { label: "Instagram", Icon: Camera, color: "#d62976" },
  { label: "Telegram", Icon: Send, color: "#229ed9" },
  { label: "Website chat", Icon: MessageCircle, color: "#5468ff" },
  { label: "Calendar", Icon: CalendarCheck2, color: "#14877c" },
  { label: "Sheets", Icon: Database, color: "#0f9d58" },
  { label: "Guides", Icon: FileText, color: "#7c3aed" },
  { label: "Playbook", Icon: Sparkles, color: "#111111" },
];

export function OrbitVisual({ className }: { className?: string }) {
  const orbitCount = 3;
  const iconsPerOrbit = Math.ceil(orbitItems.length / orbitCount);

  return (
    <div className={cn("relative min-h-[27rem] overflow-hidden", className)}>
      <div className="absolute left-[38%] top-1/2 flex size-[42rem] -translate-y-1/2 items-center justify-center lg:left-[6%]">
        <div className="z-20 grid size-28 place-items-center rounded-[2rem] border border-black/[0.08] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.13)]">
          <BehalfyLogo showText={false} markClassName="h-14 w-[85px]" />
        </div>

        {Array.from({ length: orbitCount }).map((_, orbitIndex) => {
          const size = 15 + orbitIndex * 9;
          const items = orbitItems.slice(orbitIndex * iconsPerOrbit, orbitIndex * iconsPerOrbit + iconsPerOrbit);
          const angleStep = (2 * Math.PI) / Math.max(items.length, 1);

          return (
            <div
              key={orbitIndex}
              className="absolute rounded-full border border-dashed border-black/[0.14]"
              style={{
                width: `${size}rem`,
                height: `${size}rem`,
                animation: `behalfy-orbit-spin ${18 + orbitIndex * 8}s linear infinite`,
                animationDirection: orbitIndex % 2 === 0 ? "normal" : "reverse",
              }}
            >
              {items.map(({ label, Icon, color }, itemIndex) => {
                const angle = itemIndex * angleStep - Math.PI / 2;
                const x = 50 + 50 * Math.cos(angle);
                const y = 50 + 50 * Math.sin(angle);

                return (
                  <div
                    key={label}
                    className="absolute grid size-13 place-items-center rounded-2xl border border-black/[0.08] bg-white shadow-[0_12px_34px_rgba(0,0,0,0.12)]"
                    style={{
                      left: `${x}%`,
                      top: `${y}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                    title={label}
                  >
                    <Icon className="size-6" style={{ color }} aria-label={label} />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <style jsx>{`
        @keyframes behalfy-orbit-spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

export function StackFeatureSection() {
  const orbitCount = 3;
  const iconsPerOrbit = Math.ceil(orbitItems.length / orbitCount);

  return (
    <section className="mx-auto my-20 max-w-7xl px-5 md:px-8">
      <div className="relative grid min-h-[30rem] overflow-hidden rounded-[2rem] border border-black/[0.08] bg-white shadow-[0_28px_90px_rgba(0,0,0,0.08)] lg:grid-cols-[0.9fr_1.1fr]">
        <div className="relative z-10 flex flex-col justify-center p-8 md:p-12">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-[#5468ff]">Connected work</p>
          <h2 className="mt-4 max-w-xl font-heading text-4xl font-black tracking-[-0.04em] text-black md:text-6xl">
            Your channels and tools work as one flow.
          </h2>
          <p className="mt-5 max-w-lg text-base leading-8 text-black/56">
            The assistant can answer where customers write, use the business data you connect, and complete the next step without exposing setup details to the client.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-full bg-black px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5"
            >
              Open app
            </Link>
            <a
              href="#portal"
              className="inline-flex items-center justify-center rounded-full border border-black/[0.1] bg-white px-5 py-3 text-sm font-black text-black transition hover:-translate-y-0.5"
            >
              See portal
            </a>
          </div>
        </div>

        <div className="relative min-h-[27rem] overflow-hidden lg:min-h-full">
          <OrbitVisual className="h-full" />

          <div className="absolute bottom-7 left-7 right-7 z-30 rounded-[1.4rem] border border-black/[0.08] bg-white/88 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.1)] backdrop-blur md:left-auto md:w-[23rem]">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-black/36">Live action</p>
            <p className="mt-2 font-heading text-xl font-black tracking-tight text-black">
              Availability checked, consultation booked.
            </p>
            <p className="mt-2 text-sm leading-6 text-black/56">
              The client sees the outcome. The assistant handles the operational steps.
            </p>
          </div>
        </div>
      </div>

    </section>
  );
}
