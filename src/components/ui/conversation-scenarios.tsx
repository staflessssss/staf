"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  CalendarCheck2,
  Check,
  ChevronRight,
  FileCheck2,
  MessageSquareText,
} from "lucide-react";

const scenarios = [
  {
    id: "new-inquiry",
    label: "New inquiry",
    short: "Reply and qualify",
    icon: MessageSquareText,
    brand: "Northline Home",
    brandMark: "N",
    channel: "Instagram",
    channelIcon: "/brands/instagram.svg",
    context: "A new lead arrives while the team is busy on-site.",
    messages: [
      { side: "customer", text: "Hi — do you handle full-home window replacement?" },
      { side: "business", text: "We do. Is this for your current home, and roughly how many windows are you considering?" },
      { side: "customer", text: "Our home, probably 8 to 10." },
      { side: "business", text: "Thanks — that helps. What postcode is the property in so we can prepare the right next step?" },
    ],
    outcome: "Qualified before your team steps in",
    outcomes: [
      "Need and project size clarified",
      "The next useful detail requested",
      "The conversation stays under the business brand",
    ],
    result: "Ready for a quote follow-up",
  },
  {
    id: "availability",
    label: "Availability & booking",
    short: "Check and move forward",
    icon: CalendarCheck2,
    brand: "Still & Form",
    brandMark: "S",
    channel: "Telegram",
    channelIcon: "/brands/telegram.svg",
    context: "A customer wants a time without waiting for a manual reply.",
    messages: [
      { side: "customer", text: "Do you have any consultation times next week?" },
      { side: "business", text: "I can check. Do mornings or afternoons work better for you?" },
      { side: "customer", text: "Afternoons would be best." },
      { side: "business", text: "There are two approved times available. Would Tuesday at 3:00 PM work?" },
    ],
    outcome: "An approved next step, without the wait",
    outcomes: [
      "Customer preference understood",
      "Approved availability checked",
      "The conversation moves toward a confirmed consultation",
    ],
    result: "One reply away from booking",
  },
  {
    id: "follow-through",
    label: "Questions & follow-through",
    short: "Answer, send, or hand off",
    icon: FileCheck2,
    brand: "Harbor & Field",
    brandMark: "H",
    channel: "Gmail",
    channelIcon: "/brands/gmail.svg",
    context: "A customer needs the right information before deciding.",
    messages: [
      { side: "customer", text: "Could you send more information about what’s included?" },
      { side: "business", text: "Absolutely. Are you looking for the standard service or something tailored?" },
      { side: "customer", text: "Something tailored for a small team." },
      { side: "business", text: "Got it. I’ll share the most relevant overview and flag this for a person to review." },
    ],
    outcome: "Answered, routed, and ready for follow-through",
    outcomes: [
      "Approved knowledge used",
      "The relevant material selected",
      "Human judgment requested at the right moment",
    ],
    result: "Context preserved for the team",
  },
] as const;

type ConversationScenariosProps = {
  demoHref: string;
};

export function ConversationScenarios({ demoHref }: ConversationScenariosProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const shouldReduceMotion = useReducedMotion();
  const active = scenarios[activeIndex];

  return (
    <div className="mt-20 md:mt-28">
      <div className="grid gap-10 border-t border-white/[0.08] pt-16 lg:grid-cols-[0.78fr_1.22fr] lg:items-end">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-behalfy-gold">
            <span className="size-2 rounded-full bg-behalfy-gold" />
            Example conversations
          </p>
          <h2 className="mt-7 max-w-[15ch] font-serif text-5xl font-normal leading-[0.98] tracking-[-0.055em] text-white md:text-6xl">
            See the moments where Behalfy keeps the customer moving.
          </h2>
        </div>
        <div className="max-w-2xl lg:justify-self-end">
          <p className="text-lg leading-8 text-white/62">
            Different businesses need different conversations. Choose a common situation to see how the assistant can respond, clarify, and move the customer toward the right next step.
          </p>
          <p className="mt-4 text-sm leading-7 text-white/58">
            Illustrative examples. Customer-facing messages appear under each business&apos;s own identity; Behalfy is the managed layer behind them.
          </p>
        </div>
      </div>

      <div className="mt-12 grid gap-5 lg:grid-cols-[330px_minmax(0,1fr)]">
        <div role="tablist" aria-label="Example customer conversations" className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          {scenarios.map((scenario, index) => {
            const Icon = scenario.icon;
            const isActive = index === activeIndex;

            return (
              <button
                key={scenario.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls="conversation-scenario-panel"
                onClick={() => setActiveIndex(index)}
                className={`group rounded-2xl border px-5 py-5 text-left transition focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-behalfy-gold ${
                  isActive
                    ? "border-behalfy-gold/55 bg-[#191510] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                    : "border-white/[0.08] bg-white/[0.025] text-white/62 hover:border-white/20 hover:text-white"
                }`}
              >
                <span className="flex items-start gap-4">
                  <span className={`grid size-10 shrink-0 place-items-center rounded-full border ${isActive ? "border-behalfy-gold/35 bg-behalfy-gold/10 text-behalfy-gold-light" : "border-white/10 bg-white/[0.035] text-white/58"}`}>
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold">{scenario.label}</span>
                    <span className="mt-2 block text-xs leading-5 opacity-62">{scenario.short}</span>
                  </span>
                  <ChevronRight className={`mt-2 size-4 transition ${isActive ? "translate-x-0 text-behalfy-gold" : "-translate-x-1 text-white/42 group-hover:translate-x-0"}`} />
                </span>
              </button>
            );
          })}
        </div>

        <motion.div
          key={active.id}
          id="conversation-scenario-panel"
          role="tabpanel"
          initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden rounded-[1.6rem] border border-white/[0.09] bg-[#0c0d0d] shadow-[0_36px_100px_rgba(0,0,0,0.42)]"
        >
          <div className="grid xl:grid-cols-[1.12fr_0.88fr]">
            <div data-nosnippet className="border-b border-white/[0.08] xl:border-b-0 xl:border-r">
              <div className="flex items-center gap-4 border-b border-white/[0.08] px-5 py-5 sm:px-7">
                <span className="grid size-11 place-items-center rounded-full border border-behalfy-gold/28 bg-[#171717] font-serif text-xl text-behalfy-gold-light">
                  {active.brandMark}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-white">{active.brand}</p>
                  <p className="mt-1 text-xs text-white/58">Business chat · illustrative example</p>
                </div>
                <div className="ml-auto flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-2">
                  <Image src={active.channelIcon} alt="" width={16} height={16} className="size-4 object-contain" />
                  <span className="hidden text-xs font-bold text-white/58 sm:inline">{active.channel}</span>
                </div>
              </div>

              <div className="min-h-[470px] bg-[radial-gradient(circle_at_48%_12%,rgba(212,166,111,0.075),transparent_32%)] px-4 py-7 sm:px-8">
                <p className="mx-auto mb-8 max-w-md text-center text-[11px] font-bold uppercase tracking-[0.14em] text-white/52">
                  {active.context}
                </p>
                <div className="mx-auto max-w-xl space-y-5">
                  {active.messages.map((message, index) => {
                    const isBusiness = message.side === "business";
                    return (
                      <div key={`${message.text}-${index}`} className={`flex items-end gap-3 ${isBusiness ? "justify-end" : "justify-start"}`}>
                        {!isBusiness ? (
                          <span className="grid size-8 shrink-0 place-items-center rounded-full border border-white/10 bg-[#1b1d1d] text-[10px] font-bold text-white/58">
                            C
                          </span>
                        ) : null}
                        <div
                          className={`max-w-[82%] rounded-2xl px-4 py-3.5 text-sm leading-6 sm:max-w-[72%] ${
                            isBusiness
                              ? "rounded-br-sm bg-[#5a4028] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                              : "rounded-bl-sm bg-[#202222] text-white/84"
                          }`}
                        >
                          {message.text}
                        </div>
                        {isBusiness ? (
                          <span className="grid size-8 shrink-0 place-items-center rounded-full border border-behalfy-gold/28 bg-[#171717] font-serif text-sm text-behalfy-gold-light">
                            {active.brandMark}
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex flex-col bg-[#111313] p-6 sm:p-8 lg:p-10">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-behalfy-gold">What happened</p>
              <h3 className="mt-5 max-w-[18ch] font-serif text-3xl font-normal leading-[1.05] tracking-[-0.045em] text-white sm:text-4xl">
                {active.outcome}
              </h3>
              <div className="mt-8 space-y-5">
                {active.outcomes.map((outcome) => (
                  <div key={outcome} className="flex items-start gap-3 border-b border-white/[0.07] pb-5 text-sm leading-6 text-white/68 last:border-b-0">
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border border-behalfy-gold/34 bg-behalfy-gold/8 text-behalfy-gold-light">
                      <Check className="size-3" />
                    </span>
                    {outcome}
                  </div>
                ))}
              </div>
              <div className="mt-auto pt-9">
                <div className="rounded-2xl border border-behalfy-gold/22 bg-behalfy-gold/[0.055] px-5 py-5">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/54">Next-step state</p>
                  <p className="mt-2 text-sm font-bold text-white">{active.result}</p>
                </div>
                <p className="mt-5 text-xs leading-5 text-white/54">Managed behind the scenes by Behalfy. The customer only sees {active.brand}.</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="mt-8 flex flex-col gap-5 rounded-2xl border border-white/[0.08] bg-white/[0.025] px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div>
          <p className="text-sm font-bold text-white">Bring three customer questions your team answers every week.</p>
          <p className="mt-2 text-sm leading-6 text-white/60">We will show you how Behalfy would handle them inside your actual channels and business rules.</p>
        </div>
        <Link href={demoHref} className="inline-flex min-h-[52px] shrink-0 items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-extrabold text-black transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-behalfy-gold">
          Book a 20-minute demo
          <ChevronRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}
