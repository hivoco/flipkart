"use client";

import { useCallback, useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// Goat audio.
//
// For each speaking round it tries to play  public/audio/goat-speak-{n}.mp3
// (n = 1..5) and  public/audio/goat-laugh.mp3  for the laugh. If a file is
// missing it synthesises a goat "bleat" with the Web Audio API so there is
// always sound. Drop your real files in and they take over automatically.
// ---------------------------------------------------------------------------

type WindowWithWebkitAudio = Window &
  typeof globalThis & { webkitAudioContext?: typeof AudioContext };

export function useGoatAudio() {
  const ctxRef = useRef<AudioContext | null>(null);

  const getCtx = useCallback((): AudioContext | null => {
    if (typeof window === "undefined") return null;
    if (!ctxRef.current) {
      const w = window as WindowWithWebkitAudio;
      const Ctor = w.AudioContext ?? w.webkitAudioContext;
      if (!Ctor) return null;
      ctxRef.current = new Ctor();
    }
    return ctxRef.current;
  }, []);

  /** Must be called from a user gesture to satisfy autoplay policies. */
  const unlock = useCallback(() => {
    const ctx = getCtx();
    if (ctx && ctx.state === "suspended") void ctx.resume();
  }, [getCtx]);

  /** One synthetic goat bleat with a pitch wobble (tremolo) so it sounds caprine. */
  const bleat = useCallback(
    (variant: number, when = 0, gain = 0.32, length = 0.5) => {
      const ctx = getCtx();
      if (!ctx) return;
      const t0 = ctx.currentTime + when;
      const dur = length + variant * 0.04;
      const base = 215 + variant * 22;

      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(base, t0);
      osc.frequency.linearRampToValueAtTime(base * 0.9, t0 + dur);

      // Vibrato -> the classic goat "maaa-aa-aa" wobble.
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 9 + variant;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = base * 0.07;
      lfo.connect(lfoGain).connect(osc.frequency);

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = base * 3;
      filter.Q.value = 1.4;

      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, t0);
      env.gain.exponentialRampToValueAtTime(gain, t0 + 0.03);
      env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

      osc.connect(filter).connect(env).connect(ctx.destination);
      osc.start(t0);
      lfo.start(t0);
      osc.stop(t0 + dur + 0.05);
      lfo.stop(t0 + dur + 0.05);
    },
    [getCtx],
  );

  /** Play several bleats in a row to "speak" a line. */
  const synthSpeak = useCallback(
    (variant: number, gibberish: string) => {
      const words = Math.max(2, Math.min(5, gibberish.split(/\s+/).length));
      for (let i = 0; i < words; i++) {
        bleat((variant + i) % 5, i * 0.42);
      }
    },
    [bleat],
  );

  /** A stuttery "heh-heh-heh" built from tiny rising bleats. */
  const synthLaugh = useCallback(() => {
    for (let i = 0; i < 6; i++) {
      bleat(i, i * 0.13, 0.22, 0.16);
    }
  }, [bleat]);

  const tryFile = useCallback((src: string, fallback: () => void) => {
    if (typeof Audio === "undefined") {
      fallback();
      return;
    }
    let usedFallback = false;
    const runFallback = () => {
      if (!usedFallback) {
        usedFallback = true;
        fallback();
      }
    };
    const el = new Audio(src);
    el.volume = 0.85;
    el.addEventListener("error", runFallback, { once: true });
    el.play().catch(runFallback);
  }, []);

  // Plays /audio/goat-speak-{n}.mp3 and resolves when it finishes, so the goat
  // "speaks" for exactly the length of the audio file. Falls back to a
  // synthesised bleat (and its estimated duration) if the file is missing.
  const playGoatSpeak = useCallback(
    (roundIndex: number, gibberish: string): Promise<void> => {
      const words = Math.max(2, Math.min(5, gibberish.split(/\s+/).length));
      const synthMs = (words - 1) * 420 + 600;

      return new Promise<void>((resolve) => {
        let settled = false;
        const finish = () => {
          if (!settled) {
            settled = true;
            resolve();
          }
        };

        if (typeof Audio === "undefined") {
          synthSpeak(roundIndex, gibberish);
          setTimeout(finish, synthMs);
          return;
        }

        const el = new Audio(`/audio/goat-speak-${roundIndex + 1}.mp3`);
        el.volume = 0.85;
        let usedSynth = false;
        const fallback = () => {
          if (!usedSynth) {
            usedSynth = true;
            synthSpeak(roundIndex, gibberish);
            setTimeout(finish, synthMs);
          }
        };
        el.addEventListener("ended", finish, { once: true });
        el.addEventListener("error", fallback, { once: true });
        el.play().catch(fallback);
        setTimeout(finish, 15000); // hard safety cap
      });
    },
    [synthSpeak],
  );

  const playGoatLaugh = useCallback(() => {
    tryFile(`/audio/goat-laugh.mp3`, synthLaugh);
  }, [tryFile, synthLaugh]);

  // Tidy up the AudioContext on unmount.
  useEffect(() => {
    return () => {
      void ctxRef.current?.close();
      ctxRef.current = null;
    };
  }, []);

  return { unlock, playGoatSpeak, playGoatLaugh };
}
