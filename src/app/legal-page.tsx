import Link from "next/link";

import type { LegalPageContent } from "./legal-content";

export function LegalPage({ page }: { page: LegalPageContent }) {
  return (
    <main className="min-h-screen bg-[#f8f8f6] text-[#111111]">
      <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-5 py-8 md:px-8 md:py-12">
        <header className="flex items-center justify-between border-b border-black/10 pb-6">
          <Link href="/" className="font-serif text-2xl font-semibold tracking-[-0.055em]">
            Behalfy
          </Link>
          <Link href="mailto:contact@behalfy.io" className="text-sm font-semibold text-black/60 transition hover:text-black">
            contact@behalfy.io
          </Link>
        </header>

        <article className="py-14 md:py-20">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8a6438]">{page.eyebrow}</p>
          <h1 className="mt-5 font-serif text-5xl font-semibold tracking-[-0.055em] md:text-7xl">{page.title}</h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-black/64">{page.summary}</p>
          <p className="mt-5 text-sm font-semibold text-black/44">Last updated: {page.lastUpdated}</p>

          <div className="mt-12 space-y-10 border-t border-black/10 pt-10">
            {page.sections.map((section) => (
              <section key={section.title} className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
                <h2 className="text-sm font-black uppercase tracking-[0.14em] text-black/72">{section.title}</h2>
                <div className="space-y-4 text-base leading-7 text-black/68">
                  {section.body.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </article>

        <footer className="mt-auto flex flex-col gap-4 border-t border-black/10 py-6 text-sm text-black/46 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Behalfy.</p>
          <nav className="flex gap-5">
            <Link href="/privacy" className="transition hover:text-black">
              Privacy
            </Link>
            <Link href="/terms" className="transition hover:text-black">
              Terms
            </Link>
            <Link href="/data-deletion" className="transition hover:text-black">
              Data deletion
            </Link>
          </nav>
        </footer>
      </div>
    </main>
  );
}
