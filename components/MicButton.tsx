"use client";

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
      <button
        type="button"
        // pointerdown (tap-DOWN) not click (tap-UP): fires immediately and isn't
        // cancelled by the :active scale on iOS. No `disabled` attr either — iOS
        // drops the first tap on a button that just re-enabled (every goat turn),
        // so we gate on `clickable` in the handler instead.
        onPointerDown={clickable ? onTap : undefined}
        aria-disabled={!clickable}
        // No `transition-colors`: the recording color must SNAP in one paint, not
        // animate (the ~150ms bg fade gets starved behind video decode on iOS).
        // touch-manipulation kills the 350ms double-tap wait; will-change promotes
        // the button to its own GPU layer so its repaint doesn't queue behind the
        // looping video's main-thread decode.
        className={`relative flex h-16 w-16 touch-manipulation select-none items-center justify-center rounded-full text-2xl shadow-xl will-change-transform ${
          clickable ? "active:scale-90" : ""
        } ${
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
        {/* Pulsing ring when it's your turn (CSS/GPU). */}
        {ready && (
          <span className="absolute inset-0 animate-ping rounded-full border-2 border-fk-yellow" />
        )}

        {/* Icon is derived straight from the phase — no animation queue — so it
            never lags behind the label (which mattered on iOS). */}
        {recording ? (
          <span className="flex items-end gap-[3px]">
            {[0, 1, 2, 3].map((i) => (
              <span
                // Pure-CSS transform animation (compositor/GPU) — smooth on iOS.
                key={i}
                className="block h-6 w-[3px] origin-bottom rounded-full bg-white"
                style={{ animation: `eq-bar 0.9s ease-in-out ${i * 0.12}s infinite` }}
              />
            ))}
          </span>
        ) : thinking ? (
          <span className="block h-6 w-6 animate-spin rounded-full border-[3px] border-white/40 border-t-white" />
        ) : (
          <span>🎤</span>
        )}
      </button>

      <span className="rounded-full bg-black/30 px-3 py-1 text-xs font-medium text-white shadow backdrop-blur-sm">
        {label}
      </span>
    </div>
  );
}
