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

// WebKit (iOS + desktop Safari) ignores late muting of a playing <video>, so the
// goat's audio bleeds past the SPEAK_MS/LAUGH_MS cut. On WebKit we pause the
// outgoing voiced clip IMMEDIATELY (rather than after the crossfade) so its audio
// stops exactly at the cut and never overlaps the next clip.
function isWebKit(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const ios =
    /iP(hone|ad|od)/.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const safari =
    /Safari/.test(ua) &&
    !/Chrome|Chromium|CriOS|FxiOS|Edg|EdgiOS|OPR|OPiOS|Android/.test(ua);
  return ios || safari;
}

// Mobile iOS specifically can't afford to switch the goat to the listen video on
// the mic tap — that decode hangs the main thread and lags the animation. There
// we just keep the already-playing idle clip (the mic button's equalizer is the
// listening indicator). Desktop Safari is fast enough to use the real listen
// video, so this branch is iOS-only.
function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return (
    /iP(hone|ad|od)/.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  );
}

export function GoatStage({
  state,
  speakIndex,
}: {
  state: GoatState;
  speakIndex: number;
}) {
  const [failed, setFailed] = useState(false);
  // Resolved after mount (reads navigator) so SSR + first client render match.
  const [ios, setIos] = useState(false);
  useEffect(() => setIos(isIOS()), []);

  // iOS: never switch to the listen video (its decode hangs the tap). Reuse the
  // already-playing idle clip and overlay the listening indicator instead, so the
  // mic tap changes NO video state — just the overlay.
  const effectiveState: GoatState = ios && state === "listen" ? "idle" : state;
  const activeSrc = clipFor(effectiveState, speakIndex);

  // iOS doesn't even mount the listen clip (unused there → one fewer video to
  // decode); every other platform renders all four for the crossfade.
  const clips = ios ? ALL_CLIPS.filter((s) => s !== LISTEN_SRC) : ALL_CLIPS;

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
    let blessed = false;
    // First gesture unlocks the voiced clips' audio. Every gesture also nudges the
    // active clip back to playing if iOS paused it (cheap; skips already-playing).
    const onGesture = () => {
      if (!blessed) {
        blessed = true;
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
      }
      const active = refs.current[activeRef.current];
      if (active?.paused) active.play().catch(() => {});
    };
    window.addEventListener("pointerdown", onGesture);
    return () => window.removeEventListener("pointerdown", onGesture);
  }, []);

  // On a stage change: VOICED clips restart from the beginning when they become
  // active (the underlay hides the seek), unmute the active voiced clip, and keep
  // the PREVIOUS clip opaque underneath until the new one has fully faded in.
  // (idle↔listen on iOS maps to the SAME src, so the mic tap never runs this.)
  useEffect(() => {
    const prev = activeRef.current;
    activeRef.current = activeSrc;

    for (const src of ALL_CLIPS) {
      const el = refs.current[src];
      if (el) el.muted = !(src === activeSrc && VOICED.has(src));
    }
    const activeEl = refs.current[activeSrc];
    if (activeEl) {
      // Only restart VOICED clips (each speak/laugh begins fresh). Seeking an
      // ambient loop to 0 forces a synchronous decode on iOS that lags the tap.
      if (VOICED.has(activeSrc)) {
        try {
          activeEl.currentTime = 0;
        } catch {
          /* not seekable yet */
        }
      }
      activeEl.play().catch(() => {});
    }

    if (prev !== activeSrc) {
      // One-time visual sync: hold the outgoing clip under the fade-in.
      setUnderSrc(prev);
    }
    const clearId = setTimeout(() => setUnderSrc(null), UNDER_CLEAR_MS);

    // Stop the now-inactive voiced clips so their audio can't bleed past the
    // SPEAK_MS/LAUGH_MS cut. WebKit ignores late muting, so there we pause them
    // at once; elsewhere we wait out the crossfade for a smoother visual fade.
    const stopInactiveVoiced = () => {
      for (const src of VOICED) {
        if (src !== activeRef.current) {
          const el = refs.current[src];
          if (el) {
            el.muted = true;
            el.pause();
          }
        }
      }
    };
    let pauseId: ReturnType<typeof setTimeout> | undefined;
    if (isWebKit()) {
      stopInactiveVoiced();
    } else {
      pauseId = setTimeout(stopInactiveVoiced, PAUSE_MS);
    }
    return () => {
      clearTimeout(clearId);
      if (pauseId !== undefined) clearTimeout(pauseId);
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
      {clips.map((src) => {
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
