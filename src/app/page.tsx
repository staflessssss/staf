import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck2,
  CheckCircle2,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  Workflow,
  Zap,
} from "lucide-react";

const capabilityCards = [
  {
    icon: Zap,
    title: "Answers fast",
    text: "Behalfy responds quickly so leads do not sit around waiting for a reply.",
  },
  {
    icon: MessageSquareText,
    title: "Keeps the chat moving",
    text: "It asks for the right details in a simple order and keeps the conversation easy to follow.",
  },
  {
    icon: CalendarCheck2,
    title: "Checks availability",
    text: "If timing matters, it can check the calendar before promising a slot.",
  },
  {
    icon: ShieldCheck,
    title: "Feels controlled",
    text: "The setup stays clear and managed so your team can trust what it does.",
  },
];

const steps = [
  {
    number: "01",
    title: "Connect the channel",
    text: "Pick where customers already write to you: Gmail, Instagram, Telegram, or website chat.",
  },
  {
    number: "02",
    title: "Set the conversation",
    text: "Choose what the agent asks first, what it needs to collect, and when it should check availability or pricing.",
  },
  {
    number: "03",
    title: "Test and launch",
    text: "Use the test chat, review the replies, and turn it on when the flow feels right.",
  },
];

const useCases = [
  "Salons and spas",
  "Photographers and studios",
  "Clinics and service businesses",
  "Teams that get leads by message",
];

const metrics = [
  {
    value: "24/7",
    label: "always ready to reply",
  },
  {
    value: "4 channels",
    label: "Gmail, Instagram, Telegram, website chat",
  },
  {
    value: "1 flow",
    label: "from first message to next step",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#fcf8ff] text-[#181836]">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[#d8d6fe]/60 bg-[#fcf8ff]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 md:px-12">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-[#181836] text-white shadow-[0_12px_32px_rgba(24,24,54,0.16)]">
              <Sparkles className="size-5" />
            </div>
            <div>
              <p className="text-lg font-extrabold tracking-tight text-[#181836]">Behalfy</p>
              <p className="text-xs font-medium text-[#5c5c7e]">AI agents for customer conversations</p>
            </div>
          </div>

          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#4648d4] to-[#6063ee] px-6 py-2.5 text-sm font-semibold text-white shadow-[0_10px_28px_rgba(70,72,212,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(70,72,212,0.28)]"
          >
            Login
          </Link>
        </div>
      </header>

      <div className="relative overflow-hidden pt-24">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-[-8rem] top-[-6rem] h-[28rem] w-[28rem] rounded-full bg-[#c0c1ff]/40 blur-3xl" />
          <div className="absolute right-[-10rem] top-[10rem] h-[24rem] w-[24rem] rounded-full bg-[#bff365]/20 blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.9),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.2),transparent_20%)]" />
        </div>

        <section className="mx-auto max-w-7xl px-6 py-20 md:px-12 lg:py-28">
          <div className="grid items-center gap-14 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <div className="mb-6 inline-flex items-center gap-2 rounded-lg border border-[#c7c4d7] bg-white/75 px-4 py-2 text-sm font-semibold text-[#444464] shadow-[0_8px_24px_rgba(24,24,54,0.05)]">
                <Workflow className="size-4 text-[#4648d4]" />
                Simple AI for businesses that talk to customers every day
              </div>

              <h1 className="max-w-3xl text-5xl font-extrabold tracking-tight text-[#181836] md:text-6xl lg:text-7xl lg:leading-[0.98]">
                Turn new messages into leads, bookings, and clear next steps.
              </h1>

              <p className="mt-6 max-w-2xl text-xl leading-8 text-[#464554]">
                Behalfy helps you reply faster, ask the right follow-up questions, and keep the conversation moving without making your team live in the inbox.
              </p>

              <div className="mt-10 flex flex-wrap items-center gap-4">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#4648d4] to-[#6063ee] px-8 py-4 text-lg font-semibold text-white shadow-[0_16px_36px_rgba(70,72,212,0.22)] transition hover:-translate-y-0.5"
                >
                  Login
                  <ArrowRight className="size-5" />
                </Link>
                <p className="max-w-sm text-sm leading-6 text-[#5c5c7e]">
                  Works with Gmail, Instagram, Telegram, and website chat.
                </p>
              </div>

              <div className="mt-12 grid gap-4 sm:grid-cols-3">
                {metrics.map((metric) => (
                  <div
                    key={metric.label}
                    className="rounded-2xl border border-[#e2dfff] bg-white/80 p-5 shadow-[0_10px_32px_rgba(24,24,54,0.05)]"
                  >
                    <p className="text-3xl font-extrabold tracking-tight text-[#181836]">{metric.value}</p>
                    <p className="mt-2 text-sm leading-6 text-[#5c5c7e]">{metric.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="relative">
                <div className="absolute inset-0 -z-10 rounded-[2rem] bg-[#c0c1ff]/40 blur-[110px]" />
                <div className="overflow-hidden rounded-[2rem] border border-[#d8d6fe] bg-[#ffffff]/90 shadow-[0_24px_60px_rgba(24,24,54,0.10)]">
                  <div className="border-b border-[#e2dfff] bg-[#efecff] px-6 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#5c5c7e]">
                      Live conversation preview
                    </p>
                  </div>

                  <div className="space-y-4 p-6">
                    <div className="rounded-[1.25rem] bg-[#f5f2ff] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5c5c7e]">
                        Customer
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[#181836]">
                        Hi, do you have anything available next month?
                      </p>
                    </div>
                    <div className="rounded-[1.25rem] bg-[#4648d4] p-4 text-white shadow-[0_12px_30px_rgba(70,72,212,0.18)]">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/75">
                        Behalfy
                      </p>
                      <p className="mt-2 text-sm leading-6">
                        Absolutely. What is your name, and what date are you thinking about?
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[1.25rem] border border-[#e2dfff] bg-[#fcf8ff] p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5c5c7e]">
                          Availability
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[#181836]">
                          Checks the calendar before offering a slot.
                        </p>
                      </div>
                      <div className="rounded-[1.25rem] border border-[#e2dfff] bg-[#fcf8ff] p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5c5c7e]">
                          Pricing
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[#181836]">
                          Shares pricing or the next step when the lead is ready.
                        </p>
                      </div>
                    </div>

                    <div className="rounded-[1.25rem] border border-[#c7c4d7] bg-[#e8e5ff] px-4 py-3 text-sm font-semibold text-[#444464]">
                      Fast, human-sounding replies across your main channels
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#efecff] py-24">
          <div className="mx-auto max-w-7xl px-6 md:px-12">
            <div className="mx-auto mb-16 max-w-3xl text-center">
              <p className="mb-4 text-sm font-semibold uppercase tracking-[0.24em] text-[#5c5c7e]">
                Why use Behalfy?
              </p>
              <h2 className="text-4xl font-extrabold tracking-tight text-[#181836] md:text-5xl">
                Everything you need for the first reply
              </h2>
              <p className="mt-4 text-lg text-[#464554]">
                Focus on the business. Behalfy handles the opening part of the conversation.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              {capabilityCards.map(({ icon: Icon, title, text }) => (
                <div
                  key={title}
                  className="rounded-2xl border border-[#d8d6fe] bg-white p-7 shadow-[0_12px_32px_rgba(24,24,54,0.05)]"
                >
                  <div className="mb-6 flex size-12 items-center justify-center rounded-2xl bg-[#efecff] text-[#4648d4]">
                    <Icon className="size-6" />
                  </div>
                  <h3 className="text-xl font-bold tracking-tight text-[#181836]">{title}</h3>
                  <p className="mt-3 text-sm leading-7 text-[#464554]">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-24 md:px-12">
          <div className="mb-16 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <p className="mb-4 text-sm font-semibold uppercase tracking-[0.24em] text-[#5c5c7e]">
                How it works
              </p>
              <h2 className="text-4xl font-extrabold tracking-tight text-[#181836] md:text-5xl">
                Simple setup. Clear flow. Real replies.
              </h2>
            </div>
          </div>

          <div className="grid gap-8 lg:grid-cols-3">
            {steps.map((step) => (
              <div
                key={step.number}
                className="relative rounded-2xl border border-[#d8d6fe] bg-white p-8 shadow-[0_12px_32px_rgba(24,24,54,0.05)]"
              >
                <div className="mb-6 flex size-16 items-center justify-center rounded-2xl bg-[#efecff] text-lg font-extrabold text-[#4648d4]">
                  {step.number}
                </div>
                <h3 className="text-2xl font-bold tracking-tight text-[#181836]">{step.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[#464554]">{step.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-[#181836] py-24 text-white">
          <div className="mx-auto grid max-w-7xl gap-12 px-6 md:px-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <p className="mb-4 text-sm font-semibold uppercase tracking-[0.24em] text-[#c0c1ff]">
                Who it fits
              </p>
              <h2 className="text-4xl font-extrabold tracking-tight md:text-5xl">
                Built for teams that get leads by message.
              </h2>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-[#d8d6fe]">
                Use it when you want fast replies, less back-and-forth, and a cleaner path from inquiry to booking.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                {useCases.map((item) => (
                  <span
                    key={item}
                    className="rounded-lg border border-white/15 bg-white/6 px-4 py-2 text-sm font-medium text-[#f5f2ff]"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/6 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.20)]">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/8 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c0c1ff]">
                    Before
                  </p>
                  <p className="mt-3 text-sm leading-7 text-[#f5f2ff]">
                    Messages come in, the team is busy, and the lead waits too long for a first response.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/8 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#bff365]">
                    After
                  </p>
                  <p className="mt-3 text-sm leading-7 text-[#f5f2ff]">
                    Behalfy replies, asks for the right details, and moves the conversation toward the next step.
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-[#2d2d4d] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#bff365]">
                  What people usually want
                </p>
                <div className="mt-4 space-y-3">
                  {[
                    "Faster first replies",
                    "Fewer missed opportunities",
                    "A simple setup that is easy to trust",
                    "A cleaner handoff to booking or pricing",
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-3 rounded-2xl bg-white/6 px-4 py-3">
                      <CheckCircle2 className="size-4 text-[#bff365]" />
                      <span className="text-sm text-[#f5f2ff]">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-24 md:px-12">
          <div className="rounded-[2rem] border border-[#d8d6fe] bg-white p-8 shadow-[0_16px_40px_rgba(24,24,54,0.06)] md:p-10">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#5c5c7e]">
                  Ready to log in?
                </p>
                <h2 className="mt-3 text-4xl font-extrabold tracking-tight text-[#181836] md:text-5xl">
                  Open the app and start from there.
                </h2>
                <p className="mt-4 text-lg leading-8 text-[#464554]">
                  The public page stays simple. The real work happens after login.
                </p>
              </div>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#4648d4] to-[#6063ee] px-8 py-4 text-lg font-semibold text-white shadow-[0_16px_36px_rgba(70,72,212,0.22)] transition hover:-translate-y-0.5"
              >
                Login
                <ArrowRight className="size-5" />
              </Link>
            </div>
          </div>
        </section>

        <footer className="border-t border-[#d8d6fe] bg-white/70">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-8 text-sm text-[#5c5c7e] md:flex-row md:items-center md:justify-between md:px-12">
            <p>Behalfy</p>
            <p>AI agents for businesses that want a faster first reply.</p>
          </div>
        </footer>
      </div>
    </main>
  );
}
