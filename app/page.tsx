"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChatBox } from "@/components/ChatBox";
import { ProgressBar } from "@/components/ProgressBar";
import { MicButton } from "@/components/MicButton";
import { StartOverlay } from "@/components/StartOverlay";
import { DiscountPopup } from "@/components/DiscountPopup";
import { useRecorder } from "@/lib/useRecorder";
import {
  ROUNDS,
  FINALE,
  COUPON,
  NOT_GOAT_REPLIES,
  type ChatMessage,
  type GoatState,
  type Phase,
  type Sender,
} from "@/lib/conversation";

// Rive touches the canvas/window, so load it client-only.
const GoatStage = dynamic(
  () => import("@/components/GoatStage").then((m) => m.GoatStage),
  { ssr: false },
);

let messageId = 0;
const nextId = () => `m${++messageId}`;

// WebKit's mic + audio-session handling is too unreliable, so on iOS AND on
// Safari (desktop included) we fake the mic: play the recording animation but
// never open getUserMedia or call Groq — the reply is always accepted as goat
// speech. Chrome/Firefox/Edge keep the real mic + speech check.
const shouldFakeMic = () => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // iOS (iPadOS 13+ reports as "Macintosh" with touch).
  const isIOS =
    /iP(hone|ad|od)/.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  // Safari = has "Safari" but isn't another engine wearing Safari's UA string.
  const isSafari =
    /Safari/.test(ua) &&
    !/Chrome|Chromium|CriOS|FxiOS|Edg|EdgiOS|OPR|OPiOS|Android/.test(ua);
  return isIOS || isSafari;
};

// On iOS the fake "send" shows the processing animation this long before the
// goat reacts (mimics the real transcribe round-trip).
const FAKE_PROCESS_MS = 700;

const RECORD_MAX_MS = 7000; // auto-stop safety net
// How long the goat speaks / laughs (clip + audio cut here, then crossfades).
const SPEAK_MS = 4000;
// Laugh runs this long before the closing roast reveals; the goat keeps laughing
// after, so the roast lands within ~2s (LAUGH_MS + DIALOG_DELAY_MS).
const LAUGH_MS = 1000;
const FINALE_MS = 2500; // goat's closing roast holds long enough to read, then voucher
const DIALOG_DELAY_MS = 1000; // goat's subtitle appears ~1s after it starts speaking
const SPEAK_TAKE_COUNT = 1; // single speaking clip for now (raise if more are added)

export default function Home() {
  const recorder = useRecorder();

  const [started, setStarted] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [round, setRound] = useState(0);
  const [rejectCount, setRejectCount] = useState(0);
  const [speakIndex, setSpeakIndex] = useState(0);
  const [goatState, setGoatState] = useState<GoatState>("idle");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [progress, setProgress] = useState(0);
  const [showPopup, setShowPopup] = useState(false);

  // Single timer for the sequential flow; each step cancels the previous.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const schedule = useCallback((fn: () => void, ms: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(fn, ms);
  }, []);

  const recordingRef = useRef(false); // true while the mic is live
  const busyRef = useRef(false); // guards getUserMedia re-entrancy
  const speakingRef = useRef(false); // true while the goat is speaking a line
  const laughingRef = useRef(false); // true while the goat is laughing
  // The goat's line is held here while it bleats, then dropped into the chat a
  // beat (DIALOG_DELAY_MS) after it STARTS speaking, via its own timer below.
  const pendingGoatRef = useRef<{ gibberish: string; text: string } | null>(null);
  const dialogTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Always-current round, so timers/callbacks never read a stale value.
  const roundRef = useRef(0);
  useEffect(() => {
    roundRef.current = round;
  }, [round]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (dialogTimer.current) clearTimeout(dialogTimer.current);
    },
    [],
  );

  const addMessage = useCallback(
    (sender: Sender, gibberish: string, text: string) =>
      setMessages((prev) => [...prev, { id: nextId(), sender, gibberish, text }]),
    [],
  );

  // Drop the goat's held-back line into the chat. Idempotent: cancels the reveal
  // timer and no-ops if the line was already shown.
  const flushGoatLine = () => {
    if (dialogTimer.current) {
      clearTimeout(dialogTimer.current);
      dialogTimer.current = null;
    }
    const pending = pendingGoatRef.current;
    if (!pending) return;
    pendingGoatRef.current = null;
    addMessage("goat", pending.gibberish, pending.text);
  };

  // Reveal the goat's line a beat AFTER it starts bleating (not immediately, and
  // not only when it finishes) — so the subtitle lands while the goat is talking.
  const revealGoatLineSoon = () => {
    if (dialogTimer.current) clearTimeout(dialogTimer.current);
    dialogTimer.current = setTimeout(flushGoatLine, DIALOG_DELAY_MS);
  };

  // Goat finished speaking (a speaking video ended, or the safety timer fired).
  // Hand the turn to the mic. Guarded so the two can't both fire it.
  const finishSpeak = () => {
    if (!speakingRef.current) return;
    speakingRef.current = false;
    if (timer.current) clearTimeout(timer.current);
    flushGoatLine(); // safety: line is usually already revealed mid-speech
    setGoatState("idle");
    setPhase("awaitMic");
    setProgress((roundRef.current + 0.5) / ROUNDS.length);
  };

  // Goat speaks round i: a RANDOM speaking take plays with its own (already
  // synced) audio; the turn ends when that video finishes (finishSpeak).
  const startGoatTurn = (i: number) => {
    const r = ROUNDS[i];
    setSpeakIndex(Math.floor(Math.random() * SPEAK_TAKE_COUNT));
    setPhase("goatSpeaking");
    setGoatState("speak");
    pendingGoatRef.current = { gibberish: r.goatGibberish, text: r.goatText };
    speakingRef.current = true;
    revealGoatLineSoon(); // subtitle drops in ~1s into the goat's speech
    schedule(finishSpeak, SPEAK_MS); // goat speaks ~4s, then it's your turn
  };

  // The goat finished its big laugh at the FINAL user turn (laugh video ended,
  // or the safety timer). Deliver the closing roast, then open the voucher.
  const finishLaugh = () => {
    if (!laughingRef.current) return;
    laughingRef.current = false;
    if (timer.current) clearTimeout(timer.current);
    setProgress(1);
    // The goat keeps LAUGHING through its closing line — no speaking clip. The
    // laugh video stays on screen and the roast just appears over it; the goat
    // only settles (voucher pose) once the popup actually opens.
    pendingGoatRef.current = {
      gibberish: FINALE.goatGibberish,
      text: FINALE.goatText,
    };
    revealGoatLineSoon(); // roast drops in ~1s while the goat is still laughing
    schedule(() => {
      flushGoatLine(); // safety: ensure the roast is shown
      schedule(() => {
        setGoatState("voucher");
        setPhase("finished");
        setShowPopup(true);
      }, 2600); // hold the roast (goat still laughing) before the voucher pops
    }, FINALE_MS);
  };

  // Accepted (the user bleated like a goat): show their line. Only the FINAL
  // user turn makes the goat laugh (laugh video + its synced audio) before the
  // closing roast; earlier turns skip the laugh and go straight to the goat's
  // next line.
  const acceptUserTurn = () => {
    const r = ROUNDS[round];
    addMessage("user", r.userGibberish, r.userText);

    if (round >= ROUNDS.length - 1) {
      setPhase("goatLaughing");
      setGoatState("laugh");
      laughingRef.current = true;
      schedule(finishLaugh, LAUGH_MS); // big laugh, then the final roast
    } else {
      const next = round + 1;
      setRound(next);
      setProgress(next / ROUNDS.length);
      startGoatTurn(next); // no laugh — straight to the goat's next reply
    }
  };

  // Rejected (they spoke a real language): goat complains, same round again.
  const rejectUserTurn = () => {
    const reply = NOT_GOAT_REPLIES[rejectCount % NOT_GOAT_REPLIES.length];
    setRejectCount((c) => c + 1);
    setSpeakIndex(Math.floor(Math.random() * SPEAK_TAKE_COUNT));
    pendingGoatRef.current = { gibberish: reply.gibberish, text: reply.text };
    setPhase("goatSpeaking");
    setGoatState("speak");
    speakingRef.current = true;
    revealGoatLineSoon(); // complaint drops in ~1s into the goat's speech
    schedule(finishSpeak, SPEAK_MS);
  };

  // Stop recording, transcribe with Whisper, classify goat vs. human.
  const finishRecording = async () => {
    if (!recordingRef.current) return;
    recordingRef.current = false;
    setPhase("transcribing");

    // iOS/Safari: no real audio was captured — show the processing animation
    // briefly, then accept the reply as goat speech (skip Whisper/Groq entirely).
    // Leave goatState idle (no GoatStage re-render → instant); audio's already cut.
    if (shouldFakeMic()) {
      schedule(acceptUserTurn, FAKE_PROCESS_MS);
      return;
    }

    setGoatState("listen");
    const blob = await recorder.stop();

    // Mic captured no voice → nothing to evaluate → back to idle, your turn.
    if (!blob) {
      setGoatState("idle");
      setPhase("awaitMic");
      return;
    }

    // We have a voice → stay "listening" while we transcribe + evaluate it.
    let isGoat = true; // default: accept on any failure, to keep the flow alive
    try {
      const fd = new FormData();
      fd.append("audio", blob, "speech.webm");
      const controller = new AbortController();
      const to = setTimeout(() => controller.abort(), 15000);
      const res = await fetch("/api/transcribe", {
        method: "POST",
        body: fd,
        signal: controller.signal,
      });
      clearTimeout(to);
      const data = await res.json();
      if (data?.ok && typeof data.isGoat === "boolean") isGoat = data.isGoat;
    } catch {
      isGoat = true;
    }

    if (isGoat) acceptUserTurn();
    else rejectUserTurn();
  };

  // Start recording the user's "goat speech".
  const beginRecording = async () => {
    if (busyRef.current) return;
    busyRef.current = true;

    // iOS/Safari: don't actually open the mic — just play the recording
    // animation. The reply is accepted as goat speech when they "send".
    // We do NOT touch goatState here: on iOS "listen" maps to the idle clip
    // anyway, so leaving the goat idle means GoatStage doesn't re-render on the
    // tap — only the lightweight button does → the state flips instantly.
    if (shouldFakeMic()) {
      busyRef.current = false;
      recordingRef.current = true;
      setPhase("userRecording");
      schedule(() => void finishRecording(), RECORD_MAX_MS);
      return;
    }

    const ok = await recorder.start();
    busyRef.current = false;
    if (!ok) {
      // Mic is off / permission denied → no voice to evaluate. Stay idle and
      // let the user try again.
      setGoatState("idle");
      setPhase("awaitMic");
      return;
    }
    recordingRef.current = true;
    setPhase("userRecording");
    setGoatState("listen");
    schedule(() => void finishRecording(), RECORD_MAX_MS);
  };

  const onMicTap = () => {
    if (phase === "awaitMic") void beginRecording();
    else if (phase === "userRecording") void finishRecording();
  };

  const startExperience = () => {
    setStarted(true);
    startGoatTurn(0);
  };

  // Reset every bit of round state and replay from the goat's opening line.
  const restartExperience = () => {
    if (timer.current) clearTimeout(timer.current);
    if (dialogTimer.current) clearTimeout(dialogTimer.current);
    speakingRef.current = false;
    laughingRef.current = false;
    recordingRef.current = false;
    pendingGoatRef.current = null;
    roundRef.current = 0;
    setShowPopup(false);
    setMessages([]);
    setRejectCount(0);
    setSpeakIndex(0);
    setProgress(0);
    setRound(0);
    startGoatTurn(0);
  };

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[linear-gradient(160deg,#0d1830_0%,#15347e_48%,#2874f0_100%)]">
      {/* Floating Flipkart glow blobs for depth */}
      <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-fk-yellow/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-10 h-80 w-80 rounded-full bg-fk-blue/50 blur-3xl" />
      <div className="pointer-events-none absolute left-1/3 top-1/4 h-64 w-64 rounded-full bg-fk-gold/15 blur-3xl" />

      <ProgressBar
        progress={progress}
        round={started ? round + 1 : 0}
        total={ROUNDS.length}
        visible={started}
      />

      {/* The goat stage — 9:16 to match the portrait video clips exactly */}
      <div className="absolute inset-0 flex items-center justify-center pt-14">
        <div className="aspect-9/16 h-[min(80svh,720px)] max-w-[94vw]">
          <GoatStage state={goatState} speakIndex={speakIndex} />
        </div>
      </div>

      <ChatBox messages={messages} visible={started} />
      <MicButton phase={phase} onTap={onMicTap} visible={started} />

      {!started && <StartOverlay onStart={startExperience} />}

      <DiscountPopup
        open={showPopup}
        onClose={() => setShowPopup(false)}
        onRestart={restartExperience}
        coupon={COUPON}
      />
    </main>
  );
}
