"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Braces,
  ChevronRight,
  MessagesSquare,
  Workflow,
} from "lucide-react";

import { AnimatedHero } from "@/components/ui/animated-hero";
import { ConnectionEcosystem } from "@/components/ui/connection-ecosystem";
import { ConversationScenarios } from "@/components/ui/conversation-scenarios";
import { Entropy } from "@/components/ui/entropy";

const connectionHighlights = [
  { name: "Any customer channel", icon: MessagesSquare },
  { name: "CRM, booking & operations", icon: Workflow },
  { name: "Direct APIs & webhooks", icon: Braces },
];

const demoHref =
  "mailto:contact@behalfy.io?subject=Behalfy%2020-minute%20demo&body=Tell%20us%20which%20customer%20channels%2C%20business%20systems%2C%20and%20workflows%20you%20want%20to%20connect.";

export default function HomePage() {
  const [controlInteractiveActive, setControlInteractiveActive] = useState(0);
  const shouldReduceMotion = useReducedMotion();

  return (
    <main className="behalfy-landing min-h-screen overflow-x-clip bg-[#f8f8f6] text-behalfy-panel">
      <section className="relative overflow-hidden bg-black text-white md:min-h-screen">
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
              <a href="#how-it-works" className="transition hover:text-white">
                How it works
              </a>
              <a href="#connections" className="transition hover:text-white">
                Connections
              </a>
              <a href="#control" className="transition hover:text-white">
                Control
              </a>
            </nav>

            <div className="flex items-center gap-4">
              <Link href="/login" className="hidden text-sm font-semibold text-white/78 transition hover:text-white sm:inline">
                Client login
              </Link>
              <Link
                href={demoHref}
                aria-label="Book a 20-minute demo"
                className="inline-flex min-h-11 items-center rounded-full bg-white px-5 text-sm font-extrabold text-black shadow-[0_18px_48px_rgba(0,0,0,0.18)] transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-behalfy-gold"
              >
                <span className="md:hidden">Book a demo</span>
                <span className="hidden md:inline">Book a 20-minute demo</span>
              </Link>
            </div>
          </div>
        </header>

        <div className="relative z-10 mx-auto flex max-w-7xl flex-col items-center px-5 pb-10 pt-10 text-center sm:pt-14 md:min-h-[calc(100vh-6.5rem)] md:justify-center md:px-8 md:pb-28 md:pt-0">
          <div className="rounded-full border border-white/12 bg-white/10 px-4 py-2 text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/78 backdrop-blur-md">
            Managed AI for busy service businesses
          </div>
          <div className="mt-8 [&_h1]:text-white [&_p]:text-white/82 [&_a:first-of-type]:bg-white [&_a:first-of-type]:text-black [&_a:last-of-type]:border-white/18 [&_a:last-of-type]:bg-white/10 [&_a:last-of-type]:text-white [&_a]:backdrop-blur-md">
            <AnimatedHero />
          </div>

        </div>

        <div id="channels" className="relative z-10 mx-auto w-full max-w-5xl px-5 pb-10 text-center md:absolute md:bottom-10 md:left-1/2 md:-translate-x-1/2 md:px-8 md:pb-0">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/68">
            Connected around the way your business already works
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-3 text-white/78 sm:gap-x-8">
            {connectionHighlights.map(({ name, icon: Icon }) => (
              <span key={name} className="inline-flex items-center gap-2 text-xs font-bold">
                <span className="grid size-7 place-items-center rounded-full border border-white/12 bg-white/10 text-behalfy-gold-light backdrop-blur-md">
                  <Icon className="size-3.5" />
                </span>
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* The Response Gap */}
      <section className="bg-behalfy-ink px-5 pt-12 pb-24 text-white md:px-8 md:pt-16 md:pb-28">
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

          {/* Where the lead gets lost */}
          <div className="mx-auto mt-14 grid max-w-5xl gap-4 md:grid-cols-3">
            {[
              { step: "01", title: "A message arrives", label: "Your team is serving customers, on calls, or finishing the work that pays the bills." },
              { step: "02", title: "The reply waits", label: "Details sit across inboxes and nobody has time to own the next step." },
              { step: "03", title: "The customer moves on", label: "A warm inquiry quietly becomes someone else’s booked customer." },
            ].map((item, index) => (
              <div
                key={index}
                className="group rounded-2xl border border-white/[0.07] bg-[#121212] px-8 py-8 transition-colors hover:border-behalfy-gold/30"
              >
                <div className="font-mono text-xs font-semibold tracking-[0.18em] text-behalfy-gold">
                  {item.step}
                </div>
                <h3 className="mt-8 font-serif text-2xl font-normal tracking-[-0.04em] text-white">{item.title}</h3>
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
              <div className="max-w-[260px] text-center lg:text-right">
                <div className="mb-2 text-sm font-medium uppercase tracking-[0.1em] text-behalfy-gold">With Behalfy</div>
                <div className="text-lg font-medium tracking-tight">Organized. Clear. Handled.</div>
                <p className="mt-3 text-sm text-white/60">
                  Connected inquiries receive a fast first response, consistent qualification, and a clear next step.
                </p>
              </div>

              {/* Entropy Component */}
              <div>
                <Entropy size={420} className="rounded-2xl" />
              </div>

              {/* Right: Without Behalfy */}
              <div className="max-w-[260px] text-center lg:text-left">
                <div className="text-sm font-medium text-white/50 mb-2 tracking-[0.1em] uppercase">Without Behalfy</div>
                <div className="text-lg font-medium tracking-tight">Scattered. Unanswered. Forgotten.</div>
                <p className="mt-3 text-sm text-white/60">
                  Messages wait across channels until someone finds enough time to answer.
                </p>
              </div>
            </div>

            <p className="mt-10 text-center text-sm text-white/50 max-w-md mx-auto">
              The expensive leads are often not the ones you never received. They are the ones already waiting in your inbox.
            </p>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="bg-behalfy-warm px-5 py-24 text-[#15130f] md:px-8 md:py-32">
        <div className="mx-auto grid max-w-[1320px] gap-16 lg:grid-cols-[0.78fr_1.22fr] lg:gap-24">
          <div className="lg:sticky lg:top-12 lg:self-start">
            <p className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#80603c]">
              <span className="size-2 rounded-full bg-[#b87531]" />
              Fully managed
            </p>
            <h2 className="mt-7 max-w-[12ch] font-serif text-5xl font-normal leading-[0.98] tracking-[-0.055em] md:text-6xl">
              You get the assistant. We handle the setup.
            </h2>
            <p className="mt-7 max-w-lg text-base leading-8 text-black/62">
              Behalfy is not another bot builder for your team to learn. We study how your business sells, connect the right channels and tools, launch the assistant, and keep improving it after go-live.
            </p>
            <Link
              href={demoHref}
              className="mt-9 inline-flex min-h-[52px] items-center gap-2 rounded-full bg-[#15130f] px-6 text-sm font-extrabold text-white transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-behalfy-gold"
            >
              Book a 20-minute demo
              <span aria-hidden="true">→</span>
            </Link>
          </div>

          <ol className="border-t border-black/15">
            {[
              {
                number: "01",
                title: "We learn the conversations that matter",
                body: "Your offers, frequent questions, qualification criteria, tone, handoff rules, and the moments where customers usually get stuck.",
              },
              {
                number: "02",
                title: "We connect Behalfy to the work",
                body: "Customer channels, CRM, calendars, booking tools, documents, and internal systems—connected through native integrations, direct APIs, or webhooks.",
              },
              {
                number: "03",
                title: "We launch, watch, and improve",
                body: "You see the conversations and can take over at any time. We refine the assistant as your business, offers, and customer questions change.",
              },
            ].map((step) => (
              <li key={step.number} className="grid gap-5 border-b border-black/15 py-9 sm:grid-cols-[72px_1fr] sm:py-11">
                <span className="font-mono text-sm font-semibold text-[#9a6b36]">{step.number}</span>
                <div>
                  <h3 className="font-serif text-3xl font-normal tracking-[-0.045em]">{step.title}</h3>
                  <p className="mt-4 max-w-2xl text-[15px] leading-7 text-black/58">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="workflow" className="bg-behalfy-ink px-5 pb-24 pt-12 text-white md:px-8 md:pb-32 md:pt-16">
        <div className="mx-auto max-w-[1440px]">
          <ConnectionEcosystem />
          <div className="mt-24 grid gap-10 border-b border-white/[0.08] pb-20 md:mt-32 lg:grid-cols-[minmax(0,1fr)_560px] lg:items-start">
            <p className="max-w-[38ch] font-serif text-2xl font-normal tracking-[-0.03em] leading-relaxed text-white">
              Give every connected inquiry a fast, useful first response—without adding another inbox, tool, or technical project to your team.
            </p>
            <div className="grid grid-cols-2 border-l border-white/[0.08]">
              {[
                ["Typical first reply", "Seconds"],
                ["Setup and upkeep", "Managed"],
              ].map(([label, value]) => (
                <div key={label} className="border-r border-white/[0.08] px-5 sm:px-8 lg:px-10">
                  <p className="text-sm font-medium tracking-[0.08em] text-white/60">{label}</p>
                  <p className="mt-3 font-serif text-4xl font-normal leading-[1.02] tracking-[-0.055em] text-white sm:text-5xl md:text-6xl">{value}</p>
                  <p className="mt-4 text-sm leading-relaxed text-white/55">
                    {label === "Typical first reply"
                      ? "Across the customer channels connected to Behalfy"
                      : "From initial setup through ongoing improvements"}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <ConversationScenarios demoHref={demoHref} />
        </div>
      </section>

      <section id="control" className="bg-behalfy-ink px-5 pb-12 pt-24 text-white md:px-8 md:pt-32">
        <div className="mx-auto max-w-[1320px]">
          <div className="max-w-3xl">
            <p className="mb-4 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/68">
              <span className="size-2 rounded-full bg-behalfy-gold" />
              Control
            </p>
            <h2 className="font-serif text-5xl font-normal leading-[1.02] tracking-[-0.055em] md:text-6xl">
              Behalfy handles the routine. Your team steps in when it matters.
            </h2>
          </div>

          <div className="relative mt-12 overflow-hidden rounded-3xl border border-white/10 bg-[#0a0a0a]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_18%,rgba(212,166,111,0.16),transparent_36%),linear-gradient(125deg,#080808,#15110d)]" />
            <div className="relative z-10 grid min-h-[410px] lg:grid-cols-12">
              <div className="flex flex-col justify-center p-6 sm:p-8 lg:col-span-5 lg:p-10 lg:pr-12">
                <div className="space-y-2 text-[15.5px]">
                  {[
                    { num: "01", label: "See every conversation" },
                    { num: "02", label: "Works within your rules" },
                    { num: "03", label: "Take over anytime" },
                  ].map((item, index) => {
                    const isActive = controlInteractiveActive === index;
                    return (
                      <button
                        key={item.num}
                        type="button"
                        onClick={() => setControlInteractiveActive(index)}
                        aria-pressed={isActive}
                        aria-controls="control-detail"
                        className={`group flex min-h-14 w-full items-center gap-4 rounded-xl border px-4 py-3 text-left font-bold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-behalfy-gold ${
                          isActive
                            ? "border-behalfy-gold/35 bg-behalfy-gold/[0.09] text-white"
                            : "border-transparent text-white/68 hover:border-white/10 hover:bg-white/[0.04] hover:text-white"
                        }`}
                      >
                        <span className={`font-mono text-xs tabular-nums ${isActive ? "text-behalfy-gold-light" : "text-white/48"}`}>
                          {item.num}
                        </span>
                        <span className="flex-1">{item.label}</span>
                        <ChevronRight className={`size-4 transition ${isActive ? "translate-x-0 text-behalfy-gold" : "-translate-x-1 text-white/35 group-hover:translate-x-0"}`} />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center p-6 pt-0 sm:p-8 sm:pt-0 lg:col-span-7 lg:p-12">
                <div id="control-detail" className="w-full rounded-2xl border border-white/10 bg-behalfy-panel p-7 sm:p-9">
                  <div className="mb-7 flex items-center gap-2">
                    <div className="size-1.5 rounded-full bg-behalfy-gold" />
                    <span className="text-xs font-bold uppercase tracking-[2px] text-white/58">Your oversight</span>
                  </div>
                  <motion.div
                    key={controlInteractiveActive}
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: shouldReduceMotion ? 0 : 0.35, ease: [0.25, 0.1, 0.25, 1] }}
                    className="min-h-[130px]"
                  >
                    <h3 className="mb-5 font-serif text-4xl font-normal tracking-[-0.04em]">
                      {[
                        "See every conversation",
                        "Works within your rules",
                        "Take over anytime",
                      ][controlInteractiveActive]}
                    </h3>
                    <p className="max-w-[52ch] text-[15.5px] leading-7 text-white/72">
                      {[
                        "Follow every customer conversation and next step from one clear view.",
                        "Your approved knowledge, tone, qualification, and handoff rules define what Behalfy can do.",
                        "Pause the assistant and continue the conversation yourself whenever human judgment is needed.",
                      ][controlInteractiveActive]}
                    </p>
                  </motion.div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="faq" className="bg-behalfy-ivory px-5 py-24 text-[#15130f] md:px-8 md:py-32">
        <div className="mx-auto grid max-w-[1240px] gap-14 lg:grid-cols-[0.68fr_1.32fr] lg:gap-24">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#80603c]">Questions before you trust an AI assistant</p>
            <h2 className="mt-6 max-w-[9ch] font-serif text-5xl font-normal leading-[0.98] tracking-[-0.055em] md:text-6xl">
              Clear answers. No black box.
            </h2>
            <p className="mt-7 max-w-md text-base leading-8 text-black/58">
              Behalfy is designed to reduce routine without hiding what is happening from the people responsible for the customer.
            </p>
          </div>

          <div className="border-t border-black/15">
            {[
              {
                question: "Will it sound like our business?",
                answer: "Yes. We configure the assistant around your offers, knowledge, tone, qualification questions, timing, and channel-specific behavior—not a generic chatbot script.",
              },
              {
                question: "What happens when Behalfy does not know the answer?",
                answer: "The assistant follows the boundaries we agree with you. It can ask a clarifying question or hand the conversation to a person instead of inventing a business fact.",
              },
              {
                question: "Can our team take over a conversation?",
                answer: "At any time. Your team can see the conversation, pause the assistant, and continue with the customer when judgment or a personal touch matters.",
              },
              {
                question: "Can Behalfy connect to our existing systems?",
                answer: "Yes. Behalfy is designed to work across customer channels, CRM, calendars, booking tools, files, databases, and internal systems. We use a native connection where it fits, or connect directly through an available API or webhook.",
              },
              {
                question: "Do we need technical staff to run it?",
                answer: "No. We handle configuration, connections, testing, launch, and ongoing improvements. Your team provides the business knowledge and stays in control of customer decisions.",
              },
            ].map((item) => (
              <details key={item.question} className="group border-b border-black/15 py-1">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-7 text-left text-lg font-bold marker:content-none">
                  {item.question}
                  <span className="grid size-8 shrink-0 place-items-center rounded-full border border-black/15 font-mono text-lg font-normal transition-transform group-open:rotate-45" aria-hidden="true">
                    +
                  </span>
                </summary>
                <p className="max-w-2xl pb-8 pr-12 text-[15px] leading-7 text-black/58">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
      <section id="demo" className="bg-behalfy-ivory px-5 py-24 text-[#15130f] md:px-8 md:py-32">
        <div className="mx-auto grid max-w-[1240px] gap-12 border-y border-black/15 py-14 md:py-20 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:gap-20">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#8b6337]">Start with your real inbox</p>
            <h2 className="mt-7 max-w-[12ch] font-serif text-5xl font-normal leading-[0.98] tracking-[-0.055em] md:text-7xl">
              See how Behalfy would handle your next ten inquiries.
            </h2>
          </div>
          <div className="max-w-xl">
            <p className="text-base leading-8 text-black/62 md:text-lg">
              Bring three customer questions your team answers every week. We will show you how Behalfy can reply, clarify what matters, and move each conversation toward the right next step.
            </p>
            <Link
              href={demoHref}
              className="mt-9 inline-flex min-h-[52px] items-center gap-3 rounded-full bg-[#15130f] px-7 text-sm font-extrabold text-white transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-behalfy-gold"
            >
              Book a 20-minute demo
              <span aria-hidden="true">→</span>
            </Link>
            <p className="mt-5 text-xs font-semibold text-black/58">No technical preparation. No commitment.</p>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/[0.07] bg-[#070908] text-white">
        <div className="mx-auto max-w-[1440px] px-5 py-14 md:px-8 md:py-18">
          <div className="grid gap-14 md:grid-cols-[1.35fr_0.7fr_0.7fr] md:gap-10">
            <div>
              <Link href="/" className="inline-flex items-center gap-3">
                <Image
                  src="/assets/landing/behalfy-gold-mark.png"
                  alt=""
                  width={36}
                  height={36}
                  className="size-9 object-contain"
                />
                <span className="font-serif text-3xl font-normal tracking-[-0.055em]">Behalfy</span>
              </Link>
              <p className="mt-6 max-w-sm text-sm leading-7 text-white/58">
                Fully managed AI agents across customer channels and business systems.
              </p>
              <Link href="mailto:contact@behalfy.io" className="mt-6 inline-block text-sm font-bold text-behalfy-gold transition hover:text-behalfy-gold-light focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-behalfy-gold">
                contact@behalfy.io
              </Link>
            </div>

            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-behalfy-gold">Product</p>
              <div className="mt-6 space-y-4">
                {[
                  ["How it works", "#how-it-works"],
                  ["Connections", "#connections"],
                  ["Example conversations", "#workflow"],
                  ["Control", "#control"],
                  ["FAQ", "#faq"],
                ].map(([label, href]) => (
                  <Link key={label} href={href} className="block text-sm font-semibold text-white/66 transition hover:text-white">
                    {label}
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-behalfy-gold">Legal</p>
              <div className="mt-6 space-y-4">
                {[
                  ["Privacy", "/privacy"],
                  ["Terms", "/terms"],
                  ["Data deletion", "/data-deletion"],
                ].map(([label, href]) => (
                  <Link key={label} href={href} className="block text-sm font-semibold text-white/66 transition hover:text-white">
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-14 flex flex-col gap-5 border-t border-white/[0.08] pt-7 text-sm text-white/58 sm:flex-row sm:items-center sm:justify-between">
            <p>© 2026 Behalfy. All rights reserved.</p>
            <Link href="/login" className="font-semibold transition hover:text-white/72">
              Client login
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

