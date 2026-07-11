"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";

const demoHref =
  "mailto:contact@behalfy.io?subject=Behalfy%2020-minute%20demo&body=Tell%20us%20which%20customer%20channels%2C%20business%20systems%2C%20and%20workflows%20you%20want%20to%20connect.";

export function AnimatedHero() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      className="mx-auto max-w-6xl text-center lg:text-left"
      initial={shouldReduceMotion ? false : { opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
    >
      <h1 className="font-serif text-[3.15rem] font-normal leading-[0.96] tracking-[-0.055em] text-black sm:text-[4.2rem] md:text-[5.7rem] lg:text-[6.55rem]">
        Stop losing customers <br className="sm:hidden" />in{" "}
        <span className="text-[#f0c995] sm:block">unanswered messages.</span>
      </h1>

      <p className="mx-auto mt-7 max-w-[44rem] text-base leading-8 text-black/58 md:text-lg lg:mx-0">
        Behalfy gives your business a fully managed AI assistant that answers customers, qualifies inquiries, and moves the work forward across your channels, CRM, calendars, and business systems.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
        <Link
          href={demoHref}
          className="inline-flex min-h-[52px] items-center gap-2 rounded-full bg-black px-6 text-sm font-extrabold text-white shadow-[0_18px_44px_rgba(0,0,0,0.18)] transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-behalfy-gold"
        >
          Book a 20-minute demo
          <ArrowRight className="size-4" />
        </Link>
        <a
          href="#how-it-works"
          className="inline-flex min-h-[52px] items-center gap-2 rounded-full border border-black/[0.12] bg-white/80 px-6 text-sm font-extrabold text-black transition hover:-translate-y-0.5 hover:border-black/25 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-behalfy-gold"
        >
          See how it works
        </a>
      </div>

      <p className="mt-5 text-xs font-semibold tracking-[0.01em] text-white/62">
        Setup, integrations, and ongoing improvements are handled for you.
      </p>
    </motion.div>
  );
}
