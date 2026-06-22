"use client";

import { motion } from "framer-motion";

export function StartOverlay({ onStart }: { onStart: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-fk-navy/70 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        initial={{ scale: 0.85, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 20 }}
        className="mx-4 max-w-sm overflow-hidden rounded-3xl bg-white text-center shadow-2xl"
      >
        {/* Flipkart-blue header band */}
        <div className="bg-[linear-gradient(to_bottom_right,#2874f0,#1b4db1)] px-7 py-5">
          <div className="flex items-center justify-center gap-2">
            <span className="rounded bg-white px-2 py-0.5 text-base font-extrabold italic text-fk-blue">
              Flipkart
            </span>
            <span className="text-base font-bold text-fk-yellow">Goat Sale</span>
          </div>
          <motion.div
            className="mt-3 text-6xl"
            animate={{ rotate: [0, -8, 8, -8, 0], y: [0, -6, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          >
            🐐
          </motion.div>
        </div>

        <div className="px-7 py-6">
          <h1 className="text-2xl font-extrabold text-slate-900">
            Out-bleat the Goat
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            He speaks fluent <span className="font-semibold">baa</span>. Have a
            3-round chat in goat language and he&apos;ll judge you into a{" "}
            <span className="font-bold text-fk-blue">50% OFF</span> coupon.
          </p>
          <button
            type="button"
            onClick={onStart}
            className="mt-5 w-full rounded-xl bg-fk-yellow px-6 py-3 text-base font-extrabold text-fk-navy shadow-lg transition hover:brightness-105 active:scale-95"
          >
            Start the chat 🎤
          </button>
          <p className="mt-3 text-[11px] text-slate-400">
            🔊 Turn your sound on · 🎙️ mic needed for your turn
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
