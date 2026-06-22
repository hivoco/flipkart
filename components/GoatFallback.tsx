"use client";

import { AnimatePresence, motion, type Transition, type Variants } from "framer-motion";
import type { GoatState } from "@/lib/conversation";

// A fully animated CSS/emoji goat used whenever the goat videos fail to load.
// It reacts to the same states as the video stage.

const bodyVariants: Variants = {
  idle: { rotate: [0, -1.5, 0, 1.5, 0], y: [0, -4, 0], scale: 1 },
  speak: { rotate: [0, -3, 3, -3, 0], y: [0, -6, 0], scale: 1.04 },
  listen: { rotate: 0, y: 2, scale: 1.02 },
  laugh: { rotate: [0, -8, 8, -8, 8, 0], y: [0, -10, 0], scale: 1.06 },
  voucher: { rotate: [0, -12, 12, 0], y: [0, -18, 0], scale: 1.12 },
};

const transitionFor: Record<GoatState, Transition> = {
  idle: { duration: 4, repeat: Infinity, ease: "easeInOut" },
  speak: { duration: 0.5, repeat: Infinity, ease: "easeInOut" },
  listen: { duration: 0.6, ease: "easeOut" },
  laugh: { duration: 0.45, repeat: Infinity, ease: "easeInOut" },
  voucher: { duration: 0.8, repeat: Infinity, ease: "easeInOut" },
};

const faceFor: Record<GoatState, string> = {
  idle: "🐐",
  speak: "🐐",
  listen: "🐐",
  laugh: "😂",
  voucher: "🤩",
};

export function GoatFallback({ state }: { state: GoatState }) {
  return (
    <div className="relative flex h-full w-full items-center justify-center select-none">
      {/* Soft halo that changes colour per state */}
      <motion.div
        aria-hidden
        className="absolute h-[68%] w-[68%] rounded-full blur-2xl"
        animate={{
          backgroundColor:
            state === "listen"
              ? "rgba(255,255,255,0.32)"
              : state === "laugh"
                ? "rgba(255,225,27,0.4)"
                : state === "voucher"
                  ? "rgba(252,210,0,0.5)"
                  : "rgba(40,116,240,0.45)",
          scale: state === "speak" ? [1, 1.1, 1] : 1,
        }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Listening pulse rings */}
      <AnimatePresence>
        {state === "listen" && (
          <>
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="absolute rounded-full border-2 border-white/70"
                initial={{ width: 120, height: 120, opacity: 0.6 }}
                animate={{ width: 320, height: 320, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.5 }}
              />
            ))}
          </>
        )}
      </AnimatePresence>

      {/* The goat */}
      <motion.div
        className="relative z-10 text-[clamp(6rem,18vw,11rem)] drop-shadow-xl"
        variants={bodyVariants}
        animate={state}
        transition={transitionFor[state]}
      >
        <AnimatePresence mode="popLayout">
          <motion.span
            key={faceFor[state]}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            className="inline-block"
          >
            {faceFor[state]}
          </motion.span>
        </AnimatePresence>
      </motion.div>

      {/* Speech wiggle lines while speaking */}
      <AnimatePresence>
        {state === "speak" && (
          <motion.div
            className="absolute right-[22%] top-[28%] z-20 flex gap-1"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
          >
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="block w-1.5 rounded-full bg-fk-yellow"
                animate={{ height: [8, 22, 8] }}
                transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.12 }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Laugh tears + sparkles */}
      <AnimatePresence>
        {state === "laugh" && (
          <motion.div
            className="absolute z-20 text-3xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.span
              className="absolute -left-24 -top-6"
              animate={{ y: [0, 12, 0], rotate: [-10, 10, -10] }}
              transition={{ duration: 0.5, repeat: Infinity }}
            >
              💧
            </motion.span>
            <motion.span
              className="absolute left-20 -top-6"
              animate={{ y: [0, 12, 0], rotate: [10, -10, 10] }}
              transition={{ duration: 0.5, repeat: Infinity }}
            >
              💧
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Voucher sparkles */}
      <AnimatePresence>
        {state === "voucher" && (
          <motion.div
            className="absolute inset-0 z-20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {["✨", "🎉", "⭐", "💛", "✨", "🎊"].map((s, i) => (
              <motion.span
                key={i}
                className="absolute text-2xl"
                style={{ left: `${15 + i * 13}%`, top: `${20 + (i % 3) * 22}%` }}
                animate={{ y: [0, -16, 0], scale: [0.8, 1.3, 0.8], rotate: [0, 25, 0] }}
                transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.15 }}
              >
                {s}
              </motion.span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
