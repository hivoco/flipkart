"use client";

import { useEffect, useRef, useState } from "react";
import type { GoatState } from "@/lib/conversation";
import { GoatFallback } from "./GoatFallback";

// All clips are 720x1280 (9:16).
// -v2 suffix = cache-bust after the clips were re-compressed; bump again if you
// replace any of these so production/CDN caches don't serve the old file.
const IDLE_SRC = "/Goat_Idle_Waiting-v2.mp4";
const LISTEN_SRC = "/Goat_Listening-v2.mp4";
const LAUGH_SRC = "/laughing-v2.mp4";
const SPEAK_SRCS = ["/speaking-v2.mp4"];

export const SPEAK_TAKES = SPEAK_SRCS.length;

// "Voiced" clips carry the goat's own audio, heard only while they're active.
const VOICED = new Set<string>([...SPEAK_SRCS, LAUGH_SRC]);
// Ambient loops keep playing forever so crossfades into them are seamless.
const AMBIENT = [IDLE_SRC, LISTEN_SRC];
const ALL_CLIPS = [IDLE_SRC, LISTEN_SRC, LAUGH_SRC, ...SPEAK_SRCS];

const FADE_MS = 550;
const UNDER_CLEAR_MS = FADE_MS + 120; // drop the underlay once the new clip is solid
const PAUSE_MS = FADE_MS + 260; // pause now-hidden voiced clips after that

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
}: {
  state: GoatState;
  speakIndex: number;
}) {
  const activeSrc = clipFor(state, speakIndex);
  const [failed, setFailed] = useState(false);
  // The previous clip, kept fully opaque UNDER the fading-in one so there's no
  // mid-crossfade dip/flash.
  const [underSrc, setUnderSrc] = useState<string | null>(null);
  const refs = useRef<Record<string, HTMLVideoElement | null>>({});
  const activeRef = useRef(activeSrc);

  // Ambient loops run continuously; unlock the voiced clips' audio on the first
  // gesture (play them unmuted-but-silent so a later unmute produces sound).
  useEffect(() => {
    for (const src of AMBIENT) {
      const el = refs.current[src];
      if (el) {
        el.muted = true;
        el.play().catch(() => {});
      }
    }
    const bless = () => {
      for (const src of VOICED) {
        const el = refs.current[src];
        if (!el) continue;
        el.muted = false;
        el.volume = 0;
        el
          .play()
          .then(() => {
            el.volume = 1;
            const stillActive = src === activeRef.current;
            el.muted = !stillActive;
            if (!stillActive) el.pause();
          })
          .catch(() => {
            el.muted = src !== activeRef.current;
          });
      }
    };
    window.addEventListener("pointerdown", bless, { once: true });
    return () => window.removeEventListener("pointerdown", bless);
  }, []);

  // On a stage change: every clip restarts from the beginning when it becomes
  // active (the underlay below hides the seek), unmute it if voiced, and keep
  // the PREVIOUS clip opaque underneath until the new one has fully faded in
  // (no flash). Hidden voiced clips pause afterwards; idle/listen never pause.
  useEffect(() => {
    const prev = activeRef.current;
    activeRef.current = activeSrc;

    for (const src of ALL_CLIPS) {
      const el = refs.current[src];
      if (el) el.muted = !(src === activeSrc && VOICED.has(src));
    }
    const activeEl = refs.current[activeSrc];
    if (activeEl) {
      try {
        activeEl.currentTime = 0; // restart this clip from the start each turn
      } catch {
        /* not seekable yet */
      }
      activeEl.play().catch(() => {});
    }

    if (prev !== activeSrc) {
      // One-time visual sync: hold the outgoing clip under the fade-in.
      setUnderSrc(prev);
    }
    const clearId = setTimeout(() => setUnderSrc(null), UNDER_CLEAR_MS);
    const pauseId = setTimeout(() => {
      for (const src of VOICED) {
        if (src !== activeRef.current) refs.current[src]?.pause();
      }
    }, PAUSE_MS);
    return () => {
      clearTimeout(clearId);
      clearTimeout(pauseId);
    };
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
      {ALL_CLIPS.map((src) => {
        const isActive = src === activeSrc;
        const isUnder = !isActive && src === underSrc;
        // Active fades in on top; the underlay stays solid beneath it; the rest
        // are hidden. (transition is always present so the fade-in animates.)
        const layer = isActive
          ? "z-20 opacity-100"
          : isUnder
            ? "z-10 opacity-100"
            : "z-0 opacity-0";
        return (
          <video
            key={src}
            ref={(el) => {
              refs.current[src] = el;
            }}
            src={src}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            onError={() => setFailed(true)}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity ease-in-out ${layer}`}
            style={{ transitionDuration: `${FADE_MS}ms` }}
          />
        );
      })}
    </div>
  );
}
