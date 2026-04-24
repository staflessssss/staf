export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-[28px] bg-[linear-gradient(135deg,#ffffff_0%,#f4f2ff_52%,#e9edff_100%)] p-8 shadow-[0_18px_40px_rgba(24,24,54,0.06)] ring-1 ring-[#d8d6fe]/80 md:p-10">
        <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#5c5c7e]">
          Settings
        </p>
        <h1 className="mt-2 font-heading text-4xl font-bold tracking-tight text-[#181836]">
          Admin settings
        </h1>
        <p className="mt-3 max-w-2xl text-[#464554]">
          Operational configuration remains intentionally small for now. This page is a reserved
          surface for later policy, runtime, and security controls.
        </p>
      </section>

      <section className="rounded-[24px] bg-white p-8 shadow-[0_12px_28px_rgba(24,24,54,0.05)] ring-1 ring-[#d8d6fe]/70">
        <div className="rounded-[24px] bg-[#f5f2ff] px-4 py-4 text-sm leading-6 text-[#464554] ring-1 ring-[#d8d6fe]/70">
          Runtime, deploy, and security controls will land here once the builder and shared runtime
          phases are wired end to end.
        </div>
      </section>
    </div>
  );
}
