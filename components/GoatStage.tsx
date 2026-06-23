"use client";

import { memo, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { GoatState } from "@/lib/conversation";
import { GoatFallback } from "./GoatFallback";

// All clips are 720x1280 (9:16).
// -v2 suffix = cache-bust after the clips were re-compressed; bump again if you
// replace any of these so production/CDN caches don't serve the old file.
const IDLE_SRC = "/Goat_Idle_Waiting-v2.mp4";
const LISTEN_SRC = "/Goat_Listening-v2.mp4";
const LAUGH_SRC = "/laughing-v2.mp4";
const SPEAK_SRCS = ["/speaking-v2.mp4"];

// iOS plays the goat's VOICE from these standalone audio files instead of the
// videos' embedded tracks (see the iOS notes below).
const SPEAK_VOICE_SRC = "/speaking-voice-v2.m4a";
const LAUGH_VOICE_SRC = "/laughing-voice-v2.m4a";

export const SPEAK_TAKES = SPEAK_SRCS.length;

// "Voiced" clips carry the goat's own audio (on NON-iOS, heard only while active).
const VOICED = new Set<string>([...SPEAK_SRCS, LAUGH_SRC]);
// Ambient loops keep playing forever so crossfades into them are seamless.
const AMBIENT = [IDLE_SRC, LISTEN_SRC];
const ALL_CLIPS = [IDLE_SRC, LISTEN_SRC, LAUGH_SRC, ...SPEAK_SRCS];

const FADE_MS = 550;
const UNDER_CLEAR_MS = FADE_MS + 120; // drop the underlay once the new clip is solid
const PAUSE_MS = FADE_MS + 260; // pause now-hidden voiced clips after that (non-iOS)

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

// ---------------------------------------------------------------------------
// iOS / WebKit notes (researched against the WebKit blog + Apple docs):
//  - iOS reliably plays only ONE audio stream and IGNORES HTMLMediaElement.volume.
//  - iOS PAUSES a <video> that is unmuted WITHOUT a user gesture — but our goat
//    un-mutes off a ~4s timer, so embedded-video audio is unreliable on iPhone.
//  - Multiple MUTED inline videos CAN co-play since iOS 10.3, and opacity does
//    NOT pause/stop a video.
// So on iOS we render every goat clip MUTED + looping (visual only) and play the
// VOICE from two dedicated <audio> elements, unlocked once inside the first user
// gesture. That gives one deterministic audio owner, a hard cut via pause(), and
// no per-tap/per-cut video decode. Desktop Safari + Android keep the embedded
// multi-video audio (they handle it fine).
// ---------------------------------------------------------------------------

// WebKit (iOS + desktop Safari): on NON-iOS WebKit, late muting of a playing
// <video> is ignored, so we pause the outgoing voiced clip immediately.
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

// Mobile iOS specifically gets the muted-video + separate-<audio> path.
function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return (
    /iP(hone|ad|od)/.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  );
}

// Read isIOS() the SSR-safe way: false on the server + first client render (so
// hydration matches), real value thereafter — no setState-in-effect.
const subscribeNoop = () => () => {};
const serverFalse = () => false;

// iOS 16.4+: pin the session to the loud media speaker so the goat isn't routed
// to the quiet earpiece. No-op (and harmless) elsewhere.
function pinPlaybackAudioSession() {
  try {
    const session = (
      navigator as Navigator & { audioSession?: { type: string } }
    ).audioSession;
    if (session) session.type = "playback";
  } catch {
    /* unsupported */
  }
}

// Memoized: a re-render of the page (e.g. a mic-button phase change) skips the
// goat stage unless `state`/`speakIndex` actually change — so a mic tap doesn't
// reconcile the videos, which keeps the tap instant on iOS.
function GoatStageInner({
  state,
  speakIndex,
}: {
  state: GoatState;
  speakIndex: number;
}) {
  const [failed, setFailed] = useState(false);
  // false on server + first client render (hydration-safe), real value after.
  const ios = useSyncExternalStore(subscribeNoop, isIOS, serverFalse);

  // iOS: never switch to the listen video on the mic tap (its decode hangs the
  // tap). Reuse the already-playing idle clip; the mic button's equalizer is the
  // listening indicator.
  const effectiveState: GoatState = ios && state === "listen" ? "idle" : state;
  const activeSrc = clipFor(effectiveState, speakIndex);

  // iOS doesn't mount the listen clip (unused there → one fewer decoder).
  const clips = ios ? ALL_CLIPS.filter((s) => s !== LISTEN_SRC) : ALL_CLIPS;

  // The previous clip, kept fully opaque UNDER the fading-in one (no flash).
  const [underSrc, setUnderSrc] = useState<string | null>(null);
  const refs = useRef<Record<string, HTMLVideoElement | null>>({});
  const activeRef = useRef(activeSrc);

  // iOS-only voice elements.
  const speakAudioRef = useRef<HTMLAudioElement | null>(null);
  const laughAudioRef = useRef<HTMLAudioElement | null>(null);

  // Start the muted visual loops, and unlock audio on the first user gesture.
  useEffect(() => {
    // Loops that run continuously. On iOS we keep the VOICED clips (speak + laugh)
    // warm too: if paused they'd cold-decode (~1.5-2s) when the goat speaks/laughs
    // while the separate <audio> starts instantly, so the voice would run ahead of
    // the mouth. The mic tap stays smooth regardless (GoatStage is memoized, so a
    // tap never re-renders the videos).
    const loopSrcs = ios ? [IDLE_SRC, LAUGH_SRC, ...SPEAK_SRCS] : AMBIENT;
    for (const src of loopSrcs) {
      const el = refs.current[src];
      if (el) {
        el.muted = true;
        el.play().catch(() => {});
      }
    }

    const onFirstGesture = () => {
      if (ios) {
        // FIRST, synchronously, inside the gesture: pin loud routing and unlock
        // (also pre-warm) both voice elements. play()+immediate pause() unlocks
        // without an audible blip (paused before any sound is emitted).
        pinPlaybackAudioSession();
        for (const a of [speakAudioRef.current, laughAudioRef.current]) {
          if (!a) continue;
          a.play().catch(() => {});
          a.pause();
          try {
            a.currentTime = 0;
          } catch {
            /* not seekable yet */
          }
        }
        return;
      }
      // Non-iOS: unlock the voiced VIDEOS' embedded audio (play unmuted-but-
      // silent so a later unmute produces sound).
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
    window.addEventListener("pointerdown", onFirstGesture, { once: true });
    return () => window.removeEventListener("pointerdown", onFirstGesture);
  }, [ios]);

  // iOS: drive the goat's VOICE from the dedicated <audio> elements. Play the
  // matching line on speak/laugh; pause + reset (the HARD CUT) otherwise. Keyed
  // on the REAL state (not the listen→idle remap) so audio matches the goat.
  useEffect(() => {
    if (!ios) return;
    const speak = speakAudioRef.current;
    const laugh = laughAudioRef.current;
    const cut = (a: HTMLAudioElement | null) => {
      if (!a) return;
      a.pause();
      try {
        a.currentTime = 0;
      } catch {
        /* ignore */
      }
    };
    const play = (a: HTMLAudioElement | null) => {
      if (!a) return;
      try {
        a.currentTime = 0;
      } catch {
        /* ignore */
      }
      a.play().catch(() => {});
    };
    if (state === "speak") {
      cut(laugh);
      play(speak);
    } else if (state === "laugh") {
      cut(speak);
      play(laugh);
    } else {
      cut(speak);
      cut(laugh);
    }
  }, [state, ios]);

  // On a stage change: keep the active clip visible. iOS keeps every video muted
  // (audio comes from the <audio> elements) and never SEEKS (a seek forces a
  // synchronous decode that lags the tap); the idle home clip stays playing so
  // returning to it (goat-stop → mic) is a pure opacity flip. Non-iOS restarts
  // voiced clips from 0 and drives their embedded audio.
  useEffect(() => {
    const prev = activeRef.current;
    activeRef.current = activeSrc;

    for (const src of ALL_CLIPS) {
      const el = refs.current[src];
      if (el) el.muted = ios ? true : !(src === activeSrc && VOICED.has(src));
    }
    const activeEl = refs.current[activeSrc];
    if (activeEl) {
      // Only restart VOICED clips on non-iOS (each speak/laugh begins fresh).
      // On iOS we never seek (it forces a synchronous decode that lags the tap).
      if (!ios && VOICED.has(activeSrc)) {
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

    // Pause the now-inactive voiced clips. On iOS this is the key load saver:
    // speak/laugh stop decoding when idle, so only the idle loop runs during the
    // user's turn → the goat-stop → mic tap is smooth. (On non-iOS it also stops
    // the embedded audio bleeding past the cut.) WebKit ignores late muting, so
    // pause at once there; other engines wait out the crossfade.
    const stopInactiveVoiced = () => {
      for (const src of VOICED) {
        if (src === activeRef.current) continue;
        // iOS: never pause the voiced clips — keep them warm so their video
        // doesn't cold-decode (which desyncs the voice by ~2s). Non-iOS pauses
        // them so their embedded audio can't bleed past the cut.
        if (ios) continue;
        const el = refs.current[src];
        if (el) {
          el.muted = true;
          el.pause();
        }
      }
    };
    let pauseId: ReturnType<typeof setTimeout> | undefined;
    if (isWebKit()) stopInactiveVoiced();
    else pauseId = setTimeout(stopInactiveVoiced, PAUSE_MS);
    return () => {
      clearTimeout(clearId);
      if (pauseId !== undefined) clearTimeout(pauseId);
    };
  }, [activeSrc, ios]);

  if (failed) {
    return (
      <div className="relative h-full w-full overflow-hidden rounded-3xl ring-1 ring-white/10">
        <GoatFallback state={state} />
      </div>
    );
  }

  return (
    // contain-content + isolate scope the videos' compositing to this subtree so
    // a media repaint can never invalidate the mic button's layer.
    <div className="relative h-full w-full overflow-hidden rounded-3xl shadow-2xl ring-1 ring-white/10 contain-content isolate">
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

      {/* iOS only: the goat's voice, decoupled from the muted videos. */}
      {ios && (
        <>
          <audio ref={speakAudioRef} src={SPEAK_VOICE_SRC} preload="auto" />
          <audio ref={laughAudioRef} src={LAUGH_VOICE_SRC} preload="auto" />
        </>
      )}
    </div>
  );
}

export const GoatStage = memo(GoatStageInner);
