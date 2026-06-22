"use client";

import { useEffect, useRef, useState } from "react";
import type { GoatState } from "@/lib/conversation";
import { GoatFallback } from "./GoatFallback";

// Each goat stage maps to one looping video clip (all 720x1280, 9:16).
// There's no dedicated "voucher" clip, so it reuses the happy laughing one.
const SOURCES: Record<GoatState, string> = {
  idle: "/Goat_Idle_Waiting.mp4",
  speak: "/Goat_Speaking.mp4",
  listen: "/Goat_Listening.mp4",
  laugh: "/Goat_Laughing.mp4",
  voucher: "/Goat_Laughing.mp4",
};

// Unique clips to mount (dedupes laugh/voucher sharing a file).
const CLIPS = Array.from(new Set(Object.values(SOURCES)));

const FADE_MS = 450;

// Some clips have a lead-in before the action starts, so we start them at that
// offset (seconds) to keep the goat in sync with the audio. Tweak per clip if
// the lead-in is longer/shorter.
const START_AT: Record<string, number> = {
  [SOURCES.speak]: 1.3, // mouth starts moving ~1.3s in
  [SOURCES.laugh]: 2.5, // goat starts laughing ~2.5s in
};

export function GoatStage({ state }: { state: GoatState }) {
  const activeSrc = SOURCES[state];
  const [failed, setFailed] = useState(false);
  const refs = useRef<Record<string, HTMLVideoElement | null>>({});

  // Play the active clip from its start; pause the rest once the crossfade ends.
  // All clips are muted — the goat's voice comes from the /audio mp3 files.
  useEffect(() => {
    const el = refs.current[activeSrc];
    if (el) {
      try {
        el.currentTime = START_AT[activeSrc] ?? 0;
      } catch {
        /* not seekable yet */
      }
      el.play().catch(() => {});
    }
    const id = setTimeout(() => {
      for (const src of CLIPS) {
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
      {CLIPS.map((src) => (
        <video
          key={src}
          ref={(el) => {
            refs.current[src] = el;
          }}
          src={src}
          muted
          loop
          playsInline
          preload="auto"
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
