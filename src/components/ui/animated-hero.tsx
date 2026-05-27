"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

const demoHref = "mailto:contact@behalfy.io?subject=Book%20a%20Behalfy%20demo";

export function AnimatedHero() {
  const [titleNumber, setTitleNumber] = useState(0);
  const titles = useMemo(
    () => ["a qualified lead", "a booked call", "a clear next step"],
    [],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setTitleNumber((current) => (current === titles.length - 1 ? 0 : current + 1));
    }, 2200);

    return () => window.clearTimeout(timeoutId);
  }, [titleNumber, titles]);

  return (
    <div className="mx-auto max-w-5xl text-center lg:text-left">
      <h1 className="font-serif text-[3.25rem] font-normal leading-[0.98] tracking-[-0.055em] text-black md:text-[5.7rem] lg:text-[6.7rem]">
        <span className="block">Turn every inquiry into</span>
        <span className="relative mx-auto mt-1 flex h-[1.1em] w-full justify-center overflow-hidden px-4 pb-3 text-black md:px-8 lg:mx-0 lg:justify-start lg:px-0">
          {titles.map((title, index) => (
            <motion.span
              key={title}
              className="absolute whitespace-nowrap px-3 font-normal"
              initial={{ opacity: 0, y: 80 }}
              transition={{ type: "spring", stiffness: 58, damping: 18 }}
              animate={
                titleNumber === index
                  ? {
                      y: 0,
                      opacity: 1,
                    }
                  : {
                      y: titleNumber > index ? -110 : 110,
                      opacity: 0,
                    }
              }
            >
              {title}
            </motion.span>
          ))}
        </span>
      </h1>

      <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-black/58 md:text-lg lg:mx-0">
        Behalfy gives your business an AI assistant that replies to customers, collects the details, and helps book the next step across your connected channels.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
        <Link
          href={demoHref}
          className="inline-flex items-center gap-2 rounded-full bg-black px-6 py-3.5 text-sm font-black text-white shadow-[0_18px_44px_rgba(0,0,0,0.18)] transition hover:-translate-y-0.5"
        >
          Book a demo
          <ArrowRight className="size-4" />
        </Link>
        <a
          href="#workflow"
          className="inline-flex items-center gap-2 rounded-full border border-black/[0.1] bg-white/80 px-6 py-3.5 text-sm font-black text-black transition hover:-translate-y-0.5"
        >
          See how it works
        </a>
      </div>
    </div>
  );
}
