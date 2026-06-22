"use client";

function FlipkartMark() {
  return (
    <span className="flex items-center gap-1.5">
      <span className="rounded bg-white px-1.5 py-0.5 text-[12px] font-extrabold italic leading-none text-fk-blue">
        Flipkart
      </span>
      <span className="text-[12px] font-bold text-fk-yellow">🐐 Goat Sale</span>
    </span>
  );
}

export function ProgressBar({
  progress,
  round,
  total,
  visible,
}: {
  progress: number; // 0..1
  round: number; // 1..total (0 before start)
  total: number;
  visible: boolean;
}) {
  if (!visible) return null;
  const pct = Math.round(progress * 100);

  return (
    <div className="fixed inset-x-0 top-0 z-40 px-3 pt-3">
      <div className="mx-auto max-w-xl rounded-xl border border-white/15 bg-fk-navy/55 px-3 py-2 shadow-lg backdrop-blur-md">
        <div className="mb-1.5 flex items-center justify-between">
          <FlipkartMark />
          <span className="text-[11px] font-semibold text-fk-yellow">
            {round > 0 ? `Round ${Math.min(round, total)}/${total}` : "Ready"} · {pct}%
          </span>
        </div>
        <div className="relative h-3 w-full overflow-hidden rounded-full bg-white/15">
          <div
            className="h-full rounded-full transition-[width] duration-500 ease-out"
            style={{
              width: `${pct}%`,
              backgroundImage: "linear-gradient(to right, #ffe11b, #fcd200)",
            }}
          />
        </div>
        <div className="mt-2 flex justify-between">
          {Array.from({ length: total }).map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-1.5 rounded-full transition-colors ${
                progress >= (i + 1) / total ? "bg-fk-yellow" : "bg-white/25"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
