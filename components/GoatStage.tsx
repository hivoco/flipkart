"use client";

import { useEffect, useRef, useState } from "react";
import type { GoatState } from "@/lib/conversation";
import { GoatFallback } from "./GoatFallback";

// All clips are 720x1280 (9:16).
const IDLE_SRC = "/Goat_Idle_Waiting.mp4";
const LISTEN_SRC = "/Goat_Listening.mp4";
const LAUGH_SRC = "/Goat_Laughing_1.mp4";
const SPEAK_SRCS = [
  "/Goat_Speaking_1.mp4",
  "/Goat_Speaking_2.mp4",
  "/Goat_Speaking_3.mp4",
];

export const SPEAK_TAKES = SPEAK_SRCS.length;

// "Voiced" clips play ONCE with their own (already-synced) audio and report
// when they finish via onClipEnd. Everything else is a muted ambient loop.
const VOICED = new Set<string>([...SPEAK_SRCS, LAUGH_SRC]);

// Every clip we mount (idle / listen / laugh + the three speaking takes).
const ALL_CLIPS = [IDLE_SRC, LISTEN_SRC, LAUGH_SRC, ...SPEAK_SRCS];

const FADE_MS = 450;

function clipFor(state: GoatState, speakIndex: number): string {
  switch (state) {
    case "speak":
      return SPEAK_SRCS[speakIndex % SPEAK_SRCS.length];
    case "laugh":
      return LAUGH_SRC;
    case "listen":
      return LISTEN_SRC;
    // voucher → keep the goat idle behind the popup.
    default:
      return IDLE_SRC;
  }
}

export function GoatStage({
  state,
  speakIndex,
  onClipEnd,
}: {
  state: GoatState;
  speakIndex: number;
  onClipEnd?: (state: GoatState) => void;
}) {
  const activeSrc = clipFor(state, speakIndex);
  const [failed, setFailed] = useState(false);
  const refs = useRef<Record<string, HTMLVideoElement | null>>({});
  const activeSrcRef = useRef(activeSrc);

  // Enforce mute state directly (React's `muted` prop is unreliable).
  useEffect(() => {
    for (const src of ALL_CLIPS) {
      const el = refs.current[src];
      if (el) el.muted = !VOICED.has(src);
    }
  }, []);

  // Unlock playback (incl. the voiced clips' audio) on the first user gesture.
  useEffect(() => {
    const prime = () => {
      for (const src of ALL_CLIPS) {
        const el = refs.current[src];
        if (!el) continue;
        const voiced = VOICED.has(src);
        if (voiced) el.volume = 0;
        el.play()
          .then(() => {
            // Don't stop a clip that has meanwhile become the active one.
            if (src !== activeSrcRef.current) {
              el.pause();
              el.currentTime = 0;
            }
            if (voiced) el.volume = 1;
          })
          .catch(() => {});
      }
    };
    window.addEventListener("pointerdown", prime, { once: true });
    return () => window.removeEventListener("pointerdown", prime);
  }, []);

  // Play the active clip from its start; pause the rest after the crossfade.
  useEffect(() => {
    activeSrcRef.current = activeSrc;
    const el = refs.current[activeSrc];
    if (el) {
      try {
        el.currentTime = 0;
      } catch {
        /* not seekable yet */
      }
      if (VOICED.has(activeSrc)) el.volume = 1;
      el.play().catch(() => {
        // Unmuted playback blocked → mute so it still plays/animates.
        if (VOICED.has(activeSrc)) {
          el.muted = true;
          el.play().catch(() => {});
        }
      });
    }
    const id = setTimeout(() => {
      for (const src of ALL_CLIPS) {
        if (src !== activeSrc) refs.current[src]?.pause();
      }
    }, FADE_MS + 80);
    return () => clearTimeout(id);
  }, [activeSrc]);

  if (failed) {
    return (
      <div className="relative h-full w-full overflow-hidden rounded-3xl ring-1 ring-white/10">
        <GoatFallback state={state} />
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden rounded-3xl shadow-2xl ring-1 ring-white/10">
      {ALL_CLIPS.map((src) => (
        <video
          key={src}
          ref={(el) => {
            refs.current[src] = el;
          }}
          src={src}
          muted={!VOICED.has(src)}
          loop={!VOICED.has(src)}
          playsInline
          preload="auto"
          onEnded={VOICED.has(src) ? () => onClipEnd?.(state) : undefined}
          onError={() => setFailed(true)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity ease-out ${
            src === activeSrc ? "opacity-100" : "opacity-0"
          }`}
          style={{ transitionDuration: `${FADE_MS}ms` }}
        />
      ))}
    </div>
  );
}
