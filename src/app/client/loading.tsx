export default function ClientLoading() {
  return (
    <>
      <div className="h-24 border-b border-white/[0.09] px-5 py-5 md:px-8 md:py-6">
        <div className="h-7 w-44 animate-pulse rounded-lg bg-white/[0.07]" />
      </div>
      <div className="grid gap-4 overflow-y-auto p-6 md:grid-cols-3 md:p-8">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className="h-32 animate-pulse rounded-xl border border-white/[0.07] bg-white/[0.035]"
          />
        ))}
      </div>
    </>
  );
}
