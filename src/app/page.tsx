"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  Bot,
  CalendarCheck2,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  Eye,
  Globe2,
  Hand,
  Home,
  Inbox,
  LinkIcon,
  Mail,
  MessageSquareText,
  MoreVertical,
  PhoneCall,
  Plug,
  Search,
  ShieldCheck,
  Send,
  Settings,
  Settings2,
  UsersRound,
} from "lucide-react";

import { AnimatedHero } from "@/components/ui/animated-hero";
import { Entropy } from "@/components/ui/entropy";

const channelIcons = [MessageSquareText, Send, Inbox, Mail, PhoneCall];
const demoHref = "mailto:contact@behalfy.io?subject=Book%20a%20Behalfy%20demo";

const cockpitConversations = [
  {
    name: "Sarah Mitchell",
    channel: "Web Chat · 2m",
    preview: "Do you offer installation in my area?",
    status: "New",
  },
  {
    name: "James Carter",
    channel: "WhatsApp · 5m",
    preview: "I'd like a quote for 8 windows.",
    status: "Lead",
  },
  {
    name: "Priya Shah",
    channel: "Instagram · 15m",
    preview: "What's the timeline for a full home install?",
    status: "New",
  },
  {
    name: "Daniel Kim",
    channel: "Email · 28m",
    preview: "Can you send pricing and availability?",
    status: "Lead",
  },
  {
    name: "Olivia Bennett",
    channel: "Phone · 1h",
    preview: "Looking to book a consultation.",
    status: "Booked",
  },
];

export default function HomePage() {
  const [capabilitiesActive, setCapabilitiesActive] = useState(0);
  const [controlInteractiveActive, setControlInteractiveActive] = useState(0);

  return (
    <main className="min-h-screen bg-[#f8f8f6] text-[#111111]">
      <section className="relative min-h-screen overflow-hidden bg-black text-white">
        <Image src="/assets/behalfy-hero-coast.png" alt="" fill priority sizes="100vw" className="object-cover" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,13,16,0.44)_0%,rgba(8,13,16,0.12)_38%,rgba(8,13,16,0.72)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(255,255,255,0.12),transparent_32%)]" />
        <div className="absolute inset-x-0 bottom-0 h-56 bg-[linear-gradient(180deg,rgba(7,7,7,0)_0%,#070707_92%)]" />

        <header className="relative z-10">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-7 md:px-8">
            <Link href="/" className="flex items-center gap-3 text-white">
              <Image
                src="/assets/landing/behalfy-gold-mark.png"
                alt=""
                width={32}
                height={32}
                className="size-8 object-contain drop-shadow-[0_4px_12px_rgba(212,166,111,0.28)]"
              />
              <span className="font-serif text-[1.75rem] font-semibold tracking-[-0.06em] text-white drop-shadow-[0_8px_20px_rgba(0,0,0,0.28)]">Behalfy</span>
            </Link>

            <nav className="hidden items-center gap-9 text-sm font-semibold text-white/78 md:flex">
              <a href="#workflow" className="transition hover:text-white">
                Product
              </a>
              <a href="#portal" className="transition hover:text-white">
                Portal
              </a>
              <a href="#control" className="transition hover:text-white">
                Control
              </a>
            </nav>

            <div className="flex items-center gap-4">
              <Link href="/login" className="hidden text-sm font-semibold text-white/78 transition hover:text-white sm:inline">
                Sign in
              </Link>
              <Link
                href={demoHref}
                className="rounded-full bg-white px-5 py-3 text-sm font-black text-black shadow-[0_18px_48px_rgba(0,0,0,0.18)] transition hover:-translate-y-0.5"
              >
                Book a demo
              </Link>
            </div>
          </div>
        </header>

        <div className="relative z-10 mx-auto flex min-h-[calc(100vh-6.5rem)] max-w-7xl flex-col items-center justify-center px-5 pb-28 text-center md:px-8">
          <div className="rounded-full border border-white/12 bg-white/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/78 backdrop-blur-md">
            A managed AI assistant for your business
          </div>
          <div className="mt-8 [&_h1]:text-white [&_p]:text-white/82 [&_a:first-of-type]:bg-white [&_a:first-of-type]:text-black [&_a:last-of-type]:border-white/18 [&_a:last-of-type]:bg-white/10 [&_a:last-of-type]:text-white [&_a]:backdrop-blur-md [&_span.relative]:text-white">
            <AnimatedHero />
          </div>

        </div>

        <div className="absolute bottom-10 left-1/2 z-10 w-full max-w-4xl -translate-x-1/2 px-5 text-center md:px-8">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/55">
            Works across your connected channels
          </p>
          <div className="mt-5 flex justify-center gap-8 text-white/78">
            {channelIcons.map((Icon, index) => (
              <Icon key={index} className="size-5" />
            ))}
          </div>
        </div>
      </section>

      {/* The Response Gap */}
      <section className="bg-[#070707] px-5 pt-12 pb-24 text-white md:px-8 md:pt-16 md:pb-28">
        <div className="mx-auto max-w-[1440px]">
          {/* Header */}
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-heading text-5xl font-medium tracking-[-0.04em] md:text-[56px]">
              The Response Gap
            </h2>
            <p className="mt-5 text-lg leading-snug text-white/65 md:text-xl">
              Most businesses don&apos;t lose leads because they lack inquiries.<br />
              They lose them in the space between when a message arrives and when someone finally responds.
            </p>
          </div>

          {/* Stats */}
          <div className="mx-auto mt-14 grid max-w-5xl gap-4 md:grid-cols-3">
            {[
              { stat: "30–71%", label: "of leads are lost due to slow or no response" },
              { stat: "21×", label: "more likely to convert when contacted within 5 minutes" },
              { stat: "78%", label: "of buyers choose the first business that responds" },
            ].map((item, index) => (
              <div
                key={index}
                className="rounded-2xl border border-white/[0.07] bg-[#121212] px-8 py-8"
              >
                <div className="text-[56px] leading-none font-medium tracking-[-0.045em] text-[#d4a66f]">
                  {item.stat}
                </div>
                <p className="mt-5 text-[15px] leading-snug text-white/65">
                  {item.label}
                </p>
              </div>
            ))}
          </div>

          {/* Entropy Visualization - The Response Gap */}
          <div className="mt-16">
            <div className="flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-16">
              {/* Left: With Behalfy */}
              <div className="max-w-[240px] text-right">
                <div className="text-sm font-medium text-[#d4a66f] mb-2 tracking-[0.1em] uppercase">With Behalfy</div>
                <div className="text-lg font-medium tracking-tight">Organized. Clear. Handled.</div>
                <p className="mt-3 text-sm text-white/60">
                  Every inquiry is caught and qualified. Only what matters reaches you.
                </p>
              </div>

              {/* Entropy Component */}
              <div>
                <Entropy size={420} className="rounded-2xl" />
              </div>

              {/* Right: Without Behalfy */}
              <div className="max-w-[240px] text-left">
                <div className="text-sm font-medium text-white/50 mb-2 tracking-[0.1em] uppercase">Without Behalfy</div>
                <div className="text-lg font-medium tracking-tight">Scattered. Unanswered. Forgotten.</div>
                <p className="mt-3 text-sm text-white/60">
                  Messages pile up across channels. Most disappear before anyone sees them.
                </p>
              </div>
            </div>

            <p className="mt-10 text-center text-sm text-white/50 max-w-md mx-auto">
              This is the real cost. Not the leads you never got — the ones you already had and quietly lost.
            </p>
          </div>
        </div>
      </section>

      <section id="workflow" className="bg-[#070707] px-5 pb-24 pt-12 text-white md:px-8 md:pb-32 md:pt-16">
        <div className="mx-auto max-w-[1440px]">
          <div className="grid gap-10 border-b border-white/[0.08] pb-20 lg:grid-cols-[minmax(0,1fr)_560px] lg:items-start">
            <p className="max-w-[38ch] font-serif text-2xl font-normal tracking-[-0.03em] leading-relaxed text-white">
              Launch a managed AI assistant that answers customers, qualifies leads, and books the next step without exposing technical setup to your team.
            </p>
            <div className="grid grid-cols-2 border-l border-white/[0.08]">
              {[
                ["Deflection rate", "97%"],
                ["Supported languages", "Many"],
              ].map(([label, value]) => (
                <div key={label} className="border-r border-white/[0.08] px-10">
                  <p className="text-sm font-medium tracking-[0.08em] text-white/60">{label}</p>
                  <p className="mt-3 text-5xl font-serif font-normal leading-[1.02] tracking-[-0.055em] text-white md:text-6xl">{value}</p>
                  <p className="mt-4 text-sm leading-relaxed text-white/55">
                    {label === "Deflection rate"
                      ? "Target automation rate for conversations handled without manual takeover"
                      : "Reply in the customer's language when configured"}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-28 grid gap-10 lg:grid-cols-[0.55fr_1fr] lg:items-end">
            <div>
              <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/62">
                <span className="size-2 rounded-full bg-[#ff6a1a]" />
                Managed agents
              </p>
              <h2 className="mt-7 font-serif text-5xl font-normal leading-[1.02] tracking-[-0.055em] text-white md:text-6xl max-w-[18ch]">
                Built to handle real customer conversations
              </h2>
            </div>

            <div className="grid gap-8 lg:gap-10 md:grid-cols-3">
              {[
                [Settings2, "Business-specific rules", "Tone, timing, handoff, qualification fields, and channel limits."],
                [ClipboardCheck, "Lead data capture", "Names, dates, locations, needs, budget, and next-step readiness."],
                [Bot, "Tool-backed actions", "Calendar checks, availability lookup, guide sending, and booked outcomes."],
              ].map(([Icon, title, body]) => (
                <div key={title as string} className="border-l border-white/[0.1] pl-6">
                  <Icon className="size-5 text-white/72" />
                  <h3 className="mt-5 text-sm font-black text-white">{title as string}</h3>
                  <p className="mt-3 text-sm leading-6 text-white/48">{body as string}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative left-1/2 mt-14 w-[min(1820px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-[1.6rem] border border-[#d7a96d]/55 bg-[#0a0a09] shadow-[0_0_0_1px_rgba(255,255,255,0.035),0_0_46px_rgba(215,169,109,0.18),0_58px_150px_rgba(0,0,0,0.72)]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(215,169,109,0.08),transparent_28%),linear-gradient(120deg,rgba(255,255,255,0.026),transparent_36%)]" />
            <div className="relative grid min-h-[760px] xl:grid-cols-[315px_500px_minmax(520px,1fr)_390px]">
              <aside className="relative hidden bg-[#0d0f0f]/96 p-8 after:absolute after:right-0 after:top-6 after:bottom-6 after:w-px after:rounded-full after:bg-white/[0.085] xl:flex xl:flex-col">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Image
                      src="/assets/landing/behalfy-gold-mark.png"
                      alt=""
                      width={48}
                      height={48}
                      className="size-12 object-contain drop-shadow-[0_6px_16px_rgba(212,166,111,0.3)]"
                    />
                    <span className="font-serif text-[2.2rem] font-normal tracking-[-0.065em] text-white">Behalfy</span>
                  </div>
                  <span className="text-3xl text-white/64">‹</span>
                </div>

                <nav className="mt-14 space-y-3 text-[18px]">
                  {[
                    { label: "Overview", icon: Home, badge: null },
                    { label: "Conversations", icon: MessageSquareText, badge: "24" },
                    { label: "Leads", icon: UsersRound, badge: null },
                    { label: "Bookings", icon: CalendarDays, badge: null },
                    { label: "Outcomes", icon: LinkIcon, badge: null },
                    { label: "Analytics", icon: BarChart3, badge: null },
                  ].map(({ label, icon: Icon, badge }, index) => (
                    <div
                      key={label}
                      className={[
                        "flex items-center gap-5 rounded-xl px-4 py-3.5 transition",
                        index === 1
                          ? "bg-[#3b2d20] text-white ring-1 ring-[#d7a96d]/28 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                          : "text-white/72",
                      ].join(" ")}
                    >
                      <Icon className={index === 1 ? "size-5 text-[#e9be86]" : "size-5 text-white/74"} />
                      <span className="flex-1">{label}</span>
                      {badge ? (
                        <span className="rounded-md border border-[#d7a96d]/48 px-2 py-0.5 text-sm text-[#e9be86]">{badge}</span>
                      ) : null}
                    </div>
                  ))}
                </nav>

                <div className="mt-9 border-t border-white/[0.09] pt-7">
                  <div className="space-y-3 text-[18px] text-white/72">
                    {[
                      { label: "Integrations", icon: Plug },
                      { label: "Settings", icon: Settings },
                    ].map(({ label, icon: Icon }) => (
                      <div key={label} className="flex items-center gap-5 rounded-xl px-4 py-3.5">
                        <Icon className="size-5 text-white/74" />
                        <span>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-auto border-t border-white/[0.09] pt-5">
                  <div className="flex items-center gap-4">
                    <span className="relative grid size-12 place-items-center rounded-full border border-[#d7a96d]/28 bg-[#181a1a] text-sm font-semibold text-white/78">
                      SL
                      <span className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-[#0d0f0f] bg-[#35d37a]" />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-lg font-medium text-white">Samantha Lee</div>
                      <div className="text-base text-white/48">Admin</div>
                    </div>
                    <ChevronDown className="ml-auto size-5 text-white/52" />
                  </div>
                </div>
              </aside>

              <div className="relative bg-[#0c0e0e]/96 after:absolute after:right-0 after:top-6 after:bottom-6 after:w-px after:rounded-full after:bg-white/[0.085]">
                <div className="border-b border-white/[0.08]">
                  <div className="px-9 py-8">
                    <h3 className="text-[2rem] font-medium tracking-[-0.055em] text-white">Conversations</h3>
                  </div>
                  <div className="flex items-center gap-7 border-t border-white/[0.055] px-9 py-5">
                    <span className="inline-flex items-center gap-3 rounded-lg border border-white/[0.1] bg-black/12 px-4 py-2.5 text-lg text-white/70">
                      All channels <ChevronDown className="size-4" />
                    </span>
                    <span className="inline-flex items-center gap-3 rounded-lg border border-white/[0.1] bg-black/12 px-4 py-2.5 text-lg text-white/70">
                      Newest <ChevronDown className="size-4" />
                    </span>
                    <Search className="ml-auto size-6 text-white/58" />
                  </div>
                </div>

                <div>
                  {cockpitConversations.map(({ name, channel, preview, status }, index) => {
                    const initials = name.split(" ").map((part) => part[0]).join("");
                    const hasCrown = name === "Sarah Mitchell" || name === "James Carter";
                    const channelName = channel.split(" · ")[0];
                    const channelTime = channel.split(" · ")[1];

                    return (
                      <div
                        key={name}
                        className={[
                          "relative border-b border-white/[0.065]",
                          index === 0
                            ? "bg-[radial-gradient(circle_at_18%_12%,rgba(255,255,255,0.075),transparent_28%),linear-gradient(115deg,rgba(58,45,32,0.78),rgba(24,24,23,0.82)_54%,rgba(10,12,12,0.94))]"
                            : "bg-[linear-gradient(115deg,rgba(255,255,255,0.018),rgba(255,255,255,0)_45%)]",
                        ].join(" ")}
                      >
                        <div
                          className={[
                            "relative flex min-h-[142px] items-start gap-5 px-9 py-6 pr-28",
                            index === 0 ? "shadow-[inset_0_1px_0_rgba(255,255,255,0.045)]" : "",
                          ].join(" ")}
                        >
                          <span className="mt-0.5 grid size-[52px] shrink-0 place-items-center rounded-full border border-white/[0.1] bg-[#1d1f1f] text-sm font-semibold text-white/78">
                            {initials}
                          </span>

                          <div className="min-w-0 flex-1">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="truncate text-xl font-semibold tracking-[-0.025em] text-white">{name}</span>
                                {hasCrown ? <span className="text-sm text-[#e9be86]">♛</span> : null}
                              </div>
                              <p className="mt-1 text-lg text-white/48">
                                {channelName} · {channelTime}
                              </p>
                            </div>
                            <p className="mt-2 max-w-[245px] text-lg leading-7 text-white/76">{preview}</p>
                          </div>

                          <span
                            className={[
                              "absolute bottom-6 right-8 rounded-md border px-4 py-2 text-lg font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur",
                              status === "Booked"
                                ? "border-[#47c978]/34 bg-[linear-gradient(135deg,rgba(42,119,73,0.34),rgba(15,42,28,0.44))] text-[#62d990]"
                                : status === "Lead"
                                  ? "border-[#4b82d8]/34 bg-[linear-gradient(135deg,rgba(44,87,150,0.34),rgba(14,29,54,0.44))] text-[#7fb0ff]"
                                  : "border-[#d7a96d]/42 bg-[linear-gradient(135deg,rgba(116,78,38,0.4),rgba(45,31,20,0.48))] text-[#e9be86]",
                            ].join(" ")}
                          >
                            {status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="relative flex min-h-[760px] flex-col bg-[#0c0e0e]/96 after:absolute after:right-0 after:top-6 after:bottom-6 after:w-px after:rounded-full after:bg-white/[0.085]">
                <div className="border-b border-white/[0.08] px-8 pb-0 pt-8">
                  <div className="flex items-start justify-between gap-5">
                    <div className="flex items-center gap-5">
                      <span className="grid size-16 shrink-0 place-items-center rounded-full border border-[#d7a96d]/28 bg-[#20201d] text-lg font-semibold text-[#e9be86]">
                        SM
                      </span>
                      <div>
                        <h3 className="text-3xl font-medium tracking-[-0.055em] text-white">Sarah Mitchell</h3>
                        <p className="mt-2 flex items-center gap-2 text-lg text-white/56">
                          <Globe2 className="size-5 text-[#e9be86]" />
                          Web Chat · 2m ago
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="rounded-lg border border-[#d7a96d]/48 px-4 py-2 text-lg text-[#e9be86]">New</span>
                      <span className="grid size-10 place-items-center rounded-full border border-white/[0.1] text-white/54">
                        <MoreVertical className="size-5" />
                      </span>
                    </div>
                  </div>

                  <div className="mt-12 flex gap-14 text-xl">
                    {["Conversation", "Lead details", "Notes", "Activity"].map((tab, index) => (
                      <span
                        key={tab}
                        className={index === 0 ? "border-b-2 border-[#e9be86] pb-5 text-[#e9be86]" : "pb-5 text-white/52"}
                      >
                        {tab}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex-1 space-y-8 px-10 py-9 pb-12 text-[18px]">
                  {[
                    ["Sarah", "Do you offer installation in my area?", "left"],
                    ["Behalfy AI", "Yes! We install in your area. Can I get a few details so I can share the best options?", "right"],
                    ["Sarah", "Sure, what do you need?", "left"],
                    ["Behalfy AI", "Great! What's your property postcode and how many windows are you looking to install?", "right"],
                  ].map(([sender, text, side], index) => (
                    <div key={`${sender}-${index}`} className={side === "right" ? "flex justify-end" : "flex items-start gap-4"}>
                      {side === "left" ? (
                        <span className="mt-1 grid size-12 shrink-0 place-items-center rounded-full border border-white/[0.1] bg-[#20201d] text-sm font-semibold text-white/68">
                          SM
                        </span>
                      ) : null}
                      <div
                        className={[
                          "max-w-[66%] rounded-xl px-5 py-4 leading-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
                          side === "right"
                            ? "bg-[linear-gradient(135deg,#62472d,#3d2c1d)] text-white"
                            : "bg-[#202122] text-white/88",
                        ].join(" ")}
                      >
                        <p className="mb-2 text-base text-white/46">
                          <span className={side === "right" ? "text-[#e9be86]" : ""}>{sender}</span> · 10:2{index + 1} AM
                        </p>
                        <p>{text}</p>
                        {side === "right" ? <p className="mt-1 text-right text-[#e9be86]">✓</p> : null}
                      </div>
                    </div>
                  ))}
                </div>

              </div>

              <aside className="bg-[#0f1111]/96 p-6">
                <div className="rounded-2xl border border-white/[0.09] bg-[#111313] p-6">
                  <div className="flex items-center justify-between">
                    <p className="text-xl font-medium text-white">Lead score</p>
                    <MoreVertical className="size-5 text-white/50" />
                  </div>
                  <div className="mt-8 flex items-center gap-7">
                    <div className="grid size-24 place-items-center rounded-full border-[6px] border-[#d7a96d] text-4xl font-normal tracking-[-0.04em] text-white shadow-[inset_0_0_0_8px_rgba(0,0,0,0.18)]">
                      86
                    </div>
                    <div>
                      <div className="text-2xl font-medium tracking-[-0.04em] text-white">High intent</div>
                      <div className="mt-2 text-xl leading-8 text-white/52">Strong fit<br />Likely to convert</div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-white/[0.09] bg-[#111313] p-6">
                  <p className="text-xl font-medium text-white">Lead details</p>
                  <div className="mt-8 space-y-4 text-lg">
                    {[
                      ["Name", "Sarah Mitchell"],
                      ["Email", "sarah.mitchell@email.com"],
                      ["Phone", "+61 412 555 019"],
                      ["Postcode", "3000"],
                      ["Project type", "Full home installation"],
                      ["Budget", "$8k – $12k"],
                    ].map(([label, value]) => (
                      <div key={label} className="grid grid-cols-[116px_minmax(0,1fr)] gap-4">
                        <span className="text-white/46">{label}</span>
                        <span className="truncate text-white">{value}</span>
                      </div>
                    ))}
                  </div>
                  <button className="mt-8 w-full rounded-lg bg-[linear-gradient(135deg,#3c342c,#2a241f)] px-5 py-4 text-lg font-medium text-white transition-colors">
                    View full profile <span className="ml-3">→</span>
                  </button>
                </div>

                <div className="mt-4 rounded-2xl border border-white/[0.09] bg-[#111313] p-6">
                  <p className="text-xl font-medium text-white">Next step</p>
                  <div className="mt-8 flex gap-5">
                    <div className="grid size-[3.25rem] shrink-0 place-items-center rounded-xl border border-[#d7a96d]/28 bg-[#171716] text-[#e9be86]">
                      <CalendarCheck2 className="size-6" />
                    </div>
                    <div>
                      <div className="text-lg text-white">Book a measure & quote</div>
                      <div className="mt-4 text-lg leading-8 text-white/50">Thu, 23 May 2024<br />10:00 AM AEST</div>
                    </div>
                  </div>
                  <button className="mt-8 w-full rounded-lg bg-[linear-gradient(135deg,#3c342c,#2a241f)] px-5 py-4 text-lg font-medium text-[#e9be86] transition-colors">
                    Booking confirmed <span className="ml-3">→</span>
                  </button>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </section>

      {/* Control Section */}
      <section id="control" className="bg-[#070707] py-20 text-white">
        <div className="mx-auto max-w-[1440px] px-5 md:px-8">
          {/* Надпись и заголовок */}
          <div className="mb-6">
            <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/62 mb-3">
              <span className="size-2 rounded-full bg-[#ff6a1a]" />
              CONTROL
            </p>
            <h2 className="font-serif text-5xl font-normal leading-[1.02] tracking-[-0.055em] md:text-6xl max-w-3xl">
              AI handles the flow.<br />You stay in control when it matters.
            </h2>
          </div>

          {/* 3 пункта под заголовком (как было раньше) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="border-l border-white/[0.1] pl-5">
              <Eye className="size-5 text-white/72 mb-3" />
              <div className="text-sm font-black text-white">Full Visibility</div>
              <p className="mt-2 text-sm leading-6 text-white/48">See every conversation, decision, and outcome in real time.</p>
            </div>
            <div className="border-l border-white/[0.1] pl-5">
              <ShieldCheck className="size-5 text-white/72 mb-3" />
              <div className="text-sm font-black text-white">Rules Enforced</div>
              <p className="mt-2 text-sm leading-6 text-white/48">The agent can only operate inside your approved playbook and tone.</p>
            </div>
            <div className="border-l border-white/[0.1] pl-5">
              <Hand className="size-5 text-white/72 mb-3" />
              <div className="text-sm font-black text-white">Instant Takeover</div>
              <p className="mt-2 text-sm leading-6 text-white/48">Pause the agent and continue the conversation yourself at any moment.</p>
            </div>
          </div>

          {/* Интерактивный блок в стиле Capabilities (кнопки слева) */}
          <div className="mt-10">
            <div className="relative left-1/2 w-[min(1720px,calc(100vw-40px))] -translate-x-1/2 overflow-hidden rounded-3xl border border-white/10 bg-[#0a0a0a]">
              <div className="absolute inset-0 bg-[url('/assets/behalfy-hero-coast.png')] bg-cover bg-center opacity-25" />
              <div className="absolute inset-0 bg-[#070707]/85" />

              <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 min-h-[440px]">
                {/* Левые 3 кнопки */}
                <div className="lg:col-span-5 p-10 md:pr-14 flex flex-col justify-center">
                  <div className="space-y-px text-[15.5px]">
                    {[
                      { num: "1", label: "Full Visibility" },
                      { num: "2", label: "Rules Enforced" },
                      { num: "3", label: "Instant Takeover" },
                    ].map((item, index) => (
                      <button
                        key={index}
                        onClick={() => setControlInteractiveActive(index)}
                        className={`block w-full text-left py-3.5 transition-all duration-200 border-b border-white/10 last:border-b-0
                          ${controlInteractiveActive === index 
                            ? "text-white font-medium" 
                            : "text-white/65 hover:text-white/90"}`}
                      >
                        <span className="font-mono text-white/35 mr-3 tabular-nums">{item.num}.</span>
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Правая большая карточка */}
                <div className="lg:col-span-7 p-10 md:p-14 flex items-center">
                  <div className="bg-[#111111] border border-white/10 rounded-2xl p-9 w-full">
                    <div className="flex items-center gap-2 mb-6">
                      <div className="size-1.5 rounded-full bg-[#d4a66f]" />
                      <span className="text-xs uppercase tracking-[2px] text-white/50">Control</span>
                    </div>

                    <motion.div
                      key={controlInteractiveActive}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 2, ease: [0.25, 0.1, 0.25, 1] }}
                      className="min-h-[130px]"
                    >
                      <div className="text-3xl font-semibold tracking-[-0.4px] mb-5">
                        {[
                          "Full Visibility",
                          "Rules Enforced",
                          "Instant Takeover",
                        ][controlInteractiveActive]}
                      </div>
                      <p className="text-[15.5px] leading-relaxed text-white/70 max-w-[52ch]">
                        {[
                          "See every conversation, decision, and outcome in real time.",
                          "The agent can only operate inside your approved playbook and tone.",
                          "Pause the agent and continue the conversation yourself at any moment.",
                        ][controlInteractiveActive]}
                      </p>
                    </motion.div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities Section */}
      <section id="capabilities" className="bg-[#070707] py-20 text-white">
        <div className="mx-auto max-w-[1440px] px-5 md:px-8">
          {/* Заголовок */}
          <div className="mb-6">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#d4a66f]/70 mb-3">CAPABILITIES</p>
            <h2 className="font-serif text-5xl font-normal leading-[1.02] tracking-[-0.055em] md:text-6xl max-w-3xl">
              The agent can connect to almost any system and handle real business tasks.
            </h2>
          </div>

          {/* 3 статичных трейта (как было) */}
          <div className="mb-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
              <div className="border-l-2 border-white/20 pl-6">
                <div className="text-sm font-semibold">Any System via API</div>
                <p className="text-white/60 text-sm mt-1">Connect to any CRM, ERP, calendar or service that has an API.</p>
              </div>
              <div className="border-l-2 border-white/20 pl-6">
                <div className="text-sm font-semibold">Dedicated Agent per Channel</div>
                <p className="text-white/60 text-sm mt-1">Each channel can have its own agent with separate rules and tone.</p>
              </div>
              <div className="border-l-2 border-white/20 pl-6">
                <div className="text-sm font-semibold">Unlimited Business Logic</div>
                <p className="text-white/60 text-sm mt-1">We can build almost any workflow your business needs through API connections.</p>
              </div>
            </div>

            {/* Интерактивный блок (левая карточка + 3 плоские строки справа) */}
            <div className="mt-10">
              <div className="relative left-1/2 w-[min(1720px,calc(100vw-40px))] -translate-x-1/2 overflow-hidden rounded-3xl border border-white/10 bg-[#0a0a0a]">
                <div className="absolute inset-0 bg-[url('/assets/behalfy-hero-coast.png')] bg-cover bg-center opacity-25" />
                <div className="absolute inset-0 bg-[#070707]/85" />

                <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 min-h-[440px]">
                  {/* Левая большая карточка */}
                  <div className="lg:col-span-7 p-10 md:p-14 flex items-center">
                    <div className="bg-[#111111] border border-white/10 rounded-2xl p-9 w-full">
                      <div className="flex items-center gap-2 mb-6">
                        <div className="size-1.5 rounded-full bg-[#d4a66f]" />
                        <span className="text-xs uppercase tracking-[2px] text-white/50">Capability</span>
                      </div>

                      <motion.div
                        key={capabilitiesActive}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 2, ease: [0.25, 0.1, 0.25, 1] }}
                        className="min-h-[130px]"
                      >
                        <div className="text-3xl font-semibold tracking-[-0.4px] mb-5">
                          {[
                            "CRM & Business Systems",
                            "Calendar & Booking Tools",
                            "Documents & Custom Logic",
                          ][capabilitiesActive]}
                        </div>
                        <p className="text-[15.5px] leading-relaxed text-white/70 max-w-[52ch]">
                          {[
                            "Connect to any system through API (AmoCRM, Bitrix, Google Sheets, Notion and others).",
                            "Work with calendars, check real-time availability, and book appointments instantly.",
                            "Use your data, documents and build any business logic your workflow requires.",
                          ][capabilitiesActive]}
                        </p>
                      </motion.div>
                    </div>
                  </div>

                  {/* Правые 3 плоские строки */}
                  <div className="lg:col-span-5 p-10 md:pr-14 flex flex-col justify-center">
                    <div className="space-y-px text-[15.5px]">
                      {[
                        { num: "1", label: "CRM & Business Systems" },
                        { num: "2", label: "Calendar & Booking Tools" },
                        { num: "3", label: "Documents & Custom Logic" },
                      ].map((item, index) => (
                        <button
                          key={index}
                          onClick={() => setCapabilitiesActive(index)}
                          className={`block w-full text-left py-3.5 transition-all duration-200 border-b border-white/10 last:border-b-0
                            ${capabilitiesActive === index 
                              ? "text-white font-medium" 
                              : "text-white/65 hover:text-white/90"}`}
                        >
                          <span className="font-mono text-white/35 mr-3 tabular-nums">{item.num}.</span>
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="relative overflow-hidden border-t border-white/[0.06] bg-[#070908] text-white">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_50%_0%,rgba(212,166,111,0.1),transparent_44%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center overflow-hidden pt-4 select-none">
          <span className="font-serif text-[150px] font-normal leading-none tracking-[-0.08em] text-white/[0.045] md:text-[280px] lg:text-[360px]">
            Behalfy
          </span>
        </div>

        <div className="relative mt-36 border-t border-white/[0.07] bg-[linear-gradient(180deg,rgba(18,21,20,0.94),rgba(10,12,11,0.98))] shadow-[0_-40px_120px_rgba(0,0,0,0.46)] md:mt-52">
          <div className="mx-auto max-w-[1440px] px-5 py-12 md:px-8 md:py-16">
            <div className="grid gap-14 lg:grid-cols-[1fr_1.15fr]">
              <div className="flex min-h-[270px] flex-col justify-between">
                <div>
                  <Link href="/" className="inline-flex items-center gap-3">
                    <Image
                      src="/assets/landing/behalfy-gold-mark.png"
                      alt=""
                      width={32}
                      height={32}
                      className="size-8 object-contain drop-shadow-[0_4px_14px_rgba(212,166,111,0.28)]"
                    />
                    <span className="font-serif text-2xl font-normal tracking-[-0.055em]">Behalfy</span>
                  </Link>
                  <p className="mt-6 max-w-sm text-sm leading-7 text-white/48">
                    Managed AI assistants for customer conversations, qualified leads, and booked next steps.
                  </p>
                </div>

                <div className="mt-10">
                  <div className="mb-5 flex items-center gap-2">
                    <span className="size-2 rounded-full bg-[#b8f56a] shadow-[0_0_18px_rgba(184,245,106,0.55)]" />
                    <span className="text-[11px] font-black uppercase tracking-[0.18em] text-white/42">Operational safeguards</span>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {["Tenant isolated", "Audit trails", "Human handoff", "Private by design"].map((item) => (
                      <span
                        key={item}
                        className="rounded-full border border-white/[0.08] bg-white/[0.045] px-4 py-2 text-xs font-semibold text-white/58"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-10 sm:grid-cols-3 lg:pt-1">
                {[
                  {
                    title: "Product",
                    links: [
                      ["Managed agents", "#workflow"],
                      ["Client portal", "#portal"],
                      ["Control", "#control"],
                      ["Capabilities", "#capabilities"],
                    ],
                  },
                  {
                    title: "Company",
                    links: [
                      ["Book a demo", demoHref],
                      ["Sign in", "/login"],
                      ["Contact", "mailto:contact@behalfy.io"],
                    ],
                  },
                  {
                    title: "Resources",
                    links: [
                      ["Gmail agents", "#workflow"],
                      ["Instagram agents", "#workflow"],
                      ["Lead qualification", "#portal"],
                      ["Calendar booking", "#control"],
                    ],
                  },
                ].map((column) => (
                  <div key={column.title}>
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/34">{column.title}</p>
                    <div className="mt-6 space-y-4">
                      {column.links.map(([label, href]) => (
                        <Link
                          key={label}
                          href={href}
                          className="block text-sm font-semibold text-white/72 transition hover:text-white"
                        >
                          {label}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-16 flex flex-col gap-6 border-t border-white/[0.07] pt-8 text-sm text-white/32 md:flex-row md:items-center md:justify-between">
              <p>(c) 2026 Behalfy by Stafless. All rights reserved.</p>
              <div className="flex items-center gap-5">
                <Link href={demoHref} className="transition hover:text-white/70">
                  Demo
                </Link>
                <span className="h-4 w-px bg-white/[0.12]" />
                <Link href="/login" className="transition hover:text-white/70">
                  App
                </Link>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}

