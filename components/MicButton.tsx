"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { Phase } from "@/lib/conversation";

export function MicButton({
  phase,
  onTap,
  visible,
}: {
  phase: Phase;
  onTap: () => void;
  visible: boolean;
}) {
  if (!visible) return null;

  const ready = phase === "awaitMic";
  const recording = phase === "userRecording";
  const thinking = phase === "transcribing";
  const clickable = ready || recording;

  const label = recording
    ? "Tap to send 🐐"
    : thinking
      ? "Translating your goat…"
      : ready
        ? "Tap & speak goat"
        : phase === "goatLaughing"
          ? "The goat is losing it"
          : "Goat is talking…";

  return (
    <div className="fixed bottom-6 left-1/2 z-30 flex -translate-x-1/2 flex-col items-center gap-2">
      <motion.button
        type="button"
        onClick={clickable ? onTap : undefined}
        disabled={!clickable}
        whileTap={clickable ? { scale: 0.9 } : undefined}
        className={`relative flex h-16 w-16 items-center justify-center rounded-full text-2xl shadow-xl transition-colors ${
          recording
            ? "bg-rose-500 text-white"
            : thinking
              ? "cursor-wait bg-fk-blue text-white"
              : ready
                ? "cursor-pointer bg-fk-yellow text-fk-navy hover:brightness-105"
                : "cursor-not-allowed bg-white/25 text-white/60"
        }`}
        aria-label={label}
      >
        {/* Pulsing ring when it's your turn */}
        {ready && (
          <motion.span
            className="absolute inset-0 rounded-full border-2 border-fk-yellow"
            animate={{ scale: [1, 1.4], opacity: [0.7, 0] }}
            transition={{ duration: 1.3, repeat: Infinity }}
          />
        )}

        <AnimatePresence mode="wait">
          {recording ? (
            <motion.span
              key="bars"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-end gap-[3px]"
            >
              {[0, 1, 2, 3].map((i) => (
                <motion.span
                  // scaleY (GPU transform) instead of height (layout reflow), so
                  // the equalizer stays smooth on iOS while videos decode.
                  key={i}
                  className="block h-6 w-[3px] origin-bottom rounded-full bg-white"
                  animate={{ scaleY: [0.25, 0.85, 0.4, 1, 0.25] }}
                  transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.12 }}
                />
              ))}
            </motion.span>
          ) : thinking ? (
            <motion.span
              key="spin"
              className="block h-6 w-6 rounded-full border-[3px] border-white/40 border-t-white"
              animate={{ rotate: 360 }}
              transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
            />
          ) : (
            <motion.span
              key="mic"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              🎤
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      <span className="rounded-full bg-black/30 px-3 py-1 text-xs font-medium text-white shadow backdrop-blur-sm">
        {label}
      </span>
    </div>
  );
}
