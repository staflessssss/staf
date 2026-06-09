export default function ClientLoading() {
  return (
    <main className="min-h-dvh bg-[#070705] p-2 text-[#f7f0e7] md:h-dvh md:p-5">
      <section className="flex h-[calc(100dvh-16px)] overflow-hidden rounded-[1.25rem] border border-[#d7a96d]/45 bg-[#0d0d0b] md:h-[calc(100dvh-40px)] md:rounded-[1.6rem]">
        <aside className="hidden w-[248px] shrink-0 border-r border-white/[0.09] bg-[#10100e] p-5 md:block">
          <div className="h-10 w-32 animate-pulse rounded-lg bg-white/[0.07]" />
          <div className="mt-10 space-y-3">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="h-11 animate-pulse rounded-xl bg-white/[0.045]" />
            ))}
          </div>
        </aside>
        <div className="min-w-0 flex-1">
          <div className="h-24 border-b border-white/[0.09] px-8 py-7">
            <div className="h-7 w-44 animate-pulse rounded-lg bg-white/[0.07]" />
          </div>
          <div className="grid gap-4 p-6 md:grid-cols-3 md:p-8">
            {Array.from({ length: 6 }, (_, index) => (
              <div
                key={index}
                className="h-32 animate-pulse rounded-xl border border-white/[0.07] bg-white/[0.035]"
              />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
