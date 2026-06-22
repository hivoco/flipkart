"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

const CONFETTI_COLORS = [
  "#2874F0", // flipkart blue
  "#FFE11B", // flipkart yellow
  "#FCD200", // flipkart gold
  "#ffffff",
  "#1B4DB1",
  "#9ec3ff",
];

// Deterministic, index-seeded pseudo-random so the confetti layout is pure
// (no Math.random in render → no hydration mismatch, no lint headaches).
const seeded = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const CONFETTI_PIECES = Array.from({ length: 60 }).map((_, i) => ({
  id: i,
  left: seeded(i + 1) * 100,
  delay: seeded(i + 2) * 0.6,
  duration: 2.4 + seeded(i + 3) * 1.8,
  rotate: seeded(i + 4) * 360,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  size: 6 + seeded(i + 5) * 8,
}));

function Confetti() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {CONFETTI_PIECES.map((p) => (
        <motion.span
          key={p.id}
          className="absolute top-[-10%] block rounded-sm"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.5,
            backgroundColor: p.color,
          }}
          initial={{ y: "-10%", rotate: 0, opacity: 1 }}
          animate={{ y: "110vh", rotate: p.rotate, opacity: [1, 1, 0.4] }}
          transition={{ duration: p.duration, delay: p.delay, repeat: Infinity }}
        />
      ))}
    </div>
  );
}

export function DiscountPopup({
  open,
  onClose,
  coupon,
}: {
  open: boolean;
  onClose: () => void;
  coupon: { code: string; percent: number };
}) {
  const [gifFailed, setGifFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(coupon.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <Confetti />

          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.7, y: 40, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.7, y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 18 }}
            className="relative z-10 w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl"
          >
            {/* Celebration media: real gif if present, animated emoji otherwise. */}
            <div className="relative flex items-center justify-center bg-[linear-gradient(to_bottom_right,#2874f0,#1b4db1)] p-6">
              <span className="absolute left-4 top-3 flex items-center gap-1.5">
                <span className="rounded bg-white px-1.5 py-0.5 text-[11px] font-extrabold italic text-fk-blue">
                  Flipkart
                </span>
                <span className="text-[11px] font-bold text-fk-yellow">Goat Sale</span>
              </span>
              {!gifFailed ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src="/voucher.gif"
                  alt="Celebration"
                  className="h-36 w-auto object-contain"
                  onError={() => setGifFailed(true)}
                />
              ) : (
                <motion.div
                  className="text-7xl"
                  animate={{ rotate: [0, -12, 12, 0], scale: [1, 1.15, 1] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                >
                  🐐🎉
                </motion.div>
              )}
            </div>

            <div className="px-7 py-6 text-center">
              <p className="text-sm font-semibold uppercase tracking-wide text-fk-blue">
                The goat has spoken
              </p>
              <h2 className="mt-1 text-5xl font-extrabold text-fk-blue">
                {coupon.percent}% OFF
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                You out-bleated the goat. Here&apos;s your reward.
              </p>

              <button
                type="button"
                onClick={copy}
                className="group mt-5 flex w-full items-center justify-between gap-3 rounded-xl border-2 border-dashed border-fk-blue bg-fk-blue/5 px-4 py-3 transition hover:bg-fk-blue/10"
              >
                <span className="font-mono text-lg font-bold tracking-widest text-fk-blue">
                  {coupon.code}
                </span>
                <span className="rounded-lg bg-fk-yellow px-3 py-1 text-sm font-bold text-fk-navy">
                  {copied ? "Copied!" : "Copy"}
                </span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="mt-3 text-xs font-medium text-slate-400 hover:text-slate-600"
              >
                Maybe later
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
