import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import {
  Braces,
  Database,
  FileText,
  Globe2,
  MessageCircle,
  Webhook,
} from "lucide-react";

type ConnectionNode = {
  label: string;
  icon: ReactNode;
  wordmark?: boolean;
};

const channels: ConnectionNode[] = [
  {
    label: "Instagram",
    icon: <Image src="/brands/instagram.svg" alt="" width={30} height={30} style={{ width: 30, height: 30 }} />,
  },
  {
    label: "WhatsApp",
    icon: <Image src="/brands/whatsapp.svg" alt="" width={30} height={30} className="brightness-0 invert" style={{ width: 30, height: 30 }} />,
  },
  {
    label: "Telegram",
    icon: <Image src="/brands/telegram.svg" alt="" width={30} height={30} style={{ width: 30, height: 30 }} />,
  },
  {
    label: "Gmail",
    icon: <Image src="/brands/gmail.svg" alt="" width={30} height={30} style={{ width: 30, height: 30 }} />,
  },
  {
    label: "Website chat",
    icon: <MessageCircle className="size-[30px] stroke-[1.5]" />,
  },
  {
    label: "Any channel API",
    icon: <Braces className="size-[30px] stroke-[1.5]" />,
  },
];

const systems: ConnectionNode[] = [
  {
    label: "amoCRM",
    icon: (
      <span className="relative block h-8 w-[112px] overflow-hidden">
        <Image src="/brands/amocrm.svg" alt="amoCRM" fill sizes="112px" className="object-cover" />
      </span>
    ),
    wordmark: true,
  },
  {
    label: "Bitrix24",
    icon: <Image src="/brands/bitrix24.svg" alt="Bitrix24" width={132} height={25} className="h-auto w-[132px]" />,
    wordmark: true,
  },
  {
    label: "Calendar",
    icon: <Image src="/brands/google-calendar.svg" alt="" width={30} height={30} style={{ width: 30, height: 30 }} />,
  },
  {
    label: "Google Sheets",
    icon: <Image src="/brands/google-sheets.svg" alt="" width={30} height={30} style={{ width: 30, height: 30 }} />,
  },
  {
    label: "Knowledge & files",
    icon: <Image src="/brands/google-drive.svg" alt="" width={30} height={30} style={{ width: 30, height: 30 }} />,
  },
  {
    label: "Custom business API",
    icon: <Database className="size-[30px] stroke-[1.5]" />,
  },
];

const desktopY = [82, 173, 264, 356, 447, 538];
const mobileYTop = [92, 174, 256];
const mobileYBottom = [678, 760, 842];

function NodePill({
  node,
  side,
  style,
}: {
  node: ConnectionNode;
  side: "left" | "right";
  style: CSSProperties;
}) {
  return (
    <div
      style={style}
      className={`absolute z-10 flex min-h-[62px] w-[205px] -translate-y-1/2 items-center rounded-2xl border border-white/[0.1] bg-[#111313]/95 px-5 py-3 shadow-[0_18px_42px_rgba(0,0,0,0.3)] backdrop-blur-sm ${
        node.wordmark ? "justify-center" : "gap-4"
      } ${side === "left" ? "left-[3%]" : "right-[3%]"
      }`}
    >
      <span className="shrink-0 text-behalfy-gold-light">{node.icon}</span>
      {node.wordmark ? <span className="sr-only">{node.label}</span> : <span className="text-[13px] font-extrabold text-white/84">{node.label}</span>}
    </div>
  );
}

function MobileNodePill({
  node,
  side,
  style,
}: {
  node: ConnectionNode;
  side: "left" | "right";
  style: CSSProperties;
}) {
  return (
    <div
      style={style}
      className={`absolute z-10 flex min-h-[58px] w-[calc(50%_-_6px)] -translate-y-1/2 items-center rounded-xl border border-white/[0.1] bg-[#111313]/95 px-3 py-2.5 shadow-[0_14px_32px_rgba(0,0,0,0.3)] ${
        node.wordmark ? "justify-center" : "gap-2.5"
      } ${side === "left" ? "left-0" : "right-0"
      }`}
    >
      <span className={`shrink-0 text-behalfy-gold-light ${node.wordmark ? "max-w-full scale-90" : "[&_svg]:size-7"}`}>{node.icon}</span>
      {node.wordmark ? <span className="sr-only">{node.label}</span> : <span className="min-w-0 text-[10px] font-extrabold leading-4 text-white/82">{node.label}</span>}
    </div>
  );
}

function BeamPath({ d, delay = 0 }: { d: string; delay?: number }) {
  return (
    <>
      <path d={d} fill="none" stroke="rgba(255,255,255,0.11)" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
      <path
        d={d}
        pathLength="1"
        fill="none"
        stroke="#d4a66f"
        strokeWidth="1.8"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        className="behalfy-beam-path"
        style={{ animationDelay: `${delay}s` }}
      />
    </>
  );
}

function BehalfyCore({ mobile = false }: { mobile?: boolean }) {
  return (
    <div
      className={`absolute z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-behalfy-gold/35 bg-[#12100d]/95 text-center shadow-[0_0_0_10px_rgba(212,166,111,0.035),0_30px_80px_rgba(0,0,0,0.52)] backdrop-blur-md ${
        mobile ? "left-1/2 top-[47%] size-44" : "left-1/2 top-1/2 size-52"
      }`}
    >
      <Image
        src="/assets/landing/behalfy-gold-mark.png"
        alt="Behalfy"
        width={96}
        height={96}
        className={`${mobile ? "size-20" : "size-24"} object-contain drop-shadow-[0_12px_28px_rgba(212,166,111,0.3)]`}
      />
    </div>
  );
}

function DesktopBeamNetwork() {
  return (
    <div className="relative hidden h-[620px] lg:block">
      <p className="absolute left-[3%] top-7 z-10 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-white/48">Customer channels</p>
      <p className="absolute right-[3%] top-7 z-10 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-white/48">Business systems</p>

      <svg className="pointer-events-none absolute inset-0 size-full" viewBox="0 0 1200 620" preserveAspectRatio="none" aria-hidden="true">
        {desktopY.map((y, index) => (
          <BeamPath key={`channel-${y}`} d={`M 235 ${y} C 360 ${y}, 405 310, 493 310`} delay={-index * 1.05} />
        ))}
        {desktopY.map((y, index) => (
          <BeamPath key={`system-${y}`} d={`M 707 310 C 795 310, 840 ${y}, 965 ${y}`} delay={-index * 0.9 - 2.4} />
        ))}
      </svg>

      {channels.map((node, index) => (
        <NodePill key={node.label} node={node} side="left" style={{ top: `${(desktopY[index] / 620) * 100}%` }} />
      ))}
      {systems.map((node, index) => (
        <NodePill key={node.label} node={node} side="right" style={{ top: `${(desktopY[index] / 620) * 100}%` }} />
      ))}
      <BehalfyCore />
    </div>
  );
}

function MobileBeamNetwork() {
  return (
    <div className="relative h-[930px] lg:hidden">
      <p className="absolute left-0 top-5 z-10 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-white/48">Customer channels</p>
      <p className="absolute left-0 top-[600px] z-10 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-white/48">Business systems</p>

      <svg className="pointer-events-none absolute inset-0 size-full" viewBox="0 0 360 930" preserveAspectRatio="none" aria-hidden="true">
        {mobileYTop.flatMap((y, row) => [
          <BeamPath key={`mobile-channel-left-${y}`} d={`M 76 ${y} C 76 330, 150 330, 180 365`} delay={-row * 1.1} />,
          <BeamPath key={`mobile-channel-right-${y}`} d={`M 284 ${y} C 284 330, 210 330, 180 365`} delay={-row * 1.1 - 0.55} />,
        ])}
        {mobileYBottom.flatMap((y, row) => [
          <BeamPath key={`mobile-system-left-${y}`} d={`M 180 525 C 150 575, 76 575, 76 ${y}`} delay={-row * 1.05 - 2.1} />,
          <BeamPath key={`mobile-system-right-${y}`} d={`M 180 525 C 210 575, 284 575, 284 ${y}`} delay={-row * 1.05 - 2.65} />,
        ])}
      </svg>

      {channels.map((node, index) => {
        const row = Math.floor(index / 2);
        return <MobileNodePill key={node.label} node={node} side={index % 2 === 0 ? "left" : "right"} style={{ top: mobileYTop[row] }} />;
      })}
      {systems.map((node, index) => {
        const row = Math.floor(index / 2);
        return <MobileNodePill key={node.label} node={node} side={index % 2 === 0 ? "left" : "right"} style={{ top: mobileYBottom[row] }} />;
      })}
      <BehalfyCore mobile />
    </div>
  );
}

export function ConnectionEcosystem() {
  return (
    <div id="connections" className="border-b border-white/[0.08] pb-24 md:pb-32">
      <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
        <div>
          <p className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-behalfy-gold">
            <span className="size-2 rounded-full bg-behalfy-gold" />
            Connected around your workflow
          </p>
          <h2 className="mt-7 max-w-[12ch] font-serif text-5xl font-normal leading-[0.98] tracking-[-0.055em] text-white md:text-6xl">
            Any channel. Any system. One managed assistant.
          </h2>
        </div>
        <div className="max-w-2xl lg:justify-self-end">
          <p className="text-lg leading-8 text-white/68">
            Behalfy is not limited to a fixed connector list. We connect the places customers contact you with the systems your team uses to complete the work.
          </p>
          <p className="mt-4 text-sm leading-7 text-white/56">
            Use a native connection where it fits, or connect directly through an API or webhook for a workflow specific to your business.
          </p>
        </div>
      </div>

      <div className="relative mt-12 overflow-hidden rounded-[1.75rem] border border-white/[0.09] bg-[#090a0a] p-4 shadow-[0_36px_120px_rgba(0,0,0,0.38)] sm:p-6 lg:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(212,166,111,0.13),transparent_24%),linear-gradient(rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:auto,42px_42px,42px_42px]" />

        <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-black/15 px-3 sm:px-5">
          <DesktopBeamNetwork />
          <MobileBeamNetwork />
        </div>

        <div className="relative mt-4 grid gap-4 rounded-2xl border border-white/[0.09] bg-white/[0.025] p-6 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:gap-6">
          <span className="grid size-11 place-items-center rounded-full border border-white/10 bg-white/[0.035] text-behalfy-gold-light">
            <Braces className="size-4" />
          </span>
          <div>
            <p className="text-sm font-extrabold text-white">Native integrations, direct APIs, and webhooks</p>
            <p className="mt-2 text-sm leading-6 text-white/58">If a system exposes a usable API or webhook, Behalfy can connect it to the customer conversation and the actions that follow.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-white/52 sm:justify-end">
            <Globe2 className="size-3.5 text-behalfy-gold" /> API
            <Webhook className="ml-2 size-3.5 text-behalfy-gold" /> Webhooks
            <FileText className="ml-2 size-3.5 text-behalfy-gold" /> Files
          </div>
        </div>
      </div>

      <p className="mt-5 text-xs leading-5 text-white/52">
        Connection scope depends on the API, permissions, and delivery rules exposed by each service.
      </p>
    </div>
  );
}
