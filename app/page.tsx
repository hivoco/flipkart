"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChatBox } from "@/components/ChatBox";
import { ProgressBar } from "@/components/ProgressBar";
import { MicButton } from "@/components/MicButton";
import { StartOverlay } from "@/components/StartOverlay";
import { DiscountPopup } from "@/components/DiscountPopup";
import { useGoatAudio } from "@/lib/useGoatAudio";
import { useRecorder } from "@/lib/useRecorder";
import {
  ROUNDS,
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

const RECORD_MAX_MS = 7000; // auto-stop safety net
// Fallback in case the speaking video's "ended" event never fires (e.g. the
// file is missing and the CSS goat is shown instead). A little above the clip
// length so the real video end normally wins.
const SPEAK_SAFETY_MS = 13000;

export default function Home() {
  const audio = useGoatAudio();
  const recorder = useRecorder();

  const [started, setStarted] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [round, setRound] = useState(0);
  const [rejectCount, setRejectCount] = useState(0);
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

  // Always-current round, so timers/callbacks never read a stale value.
  const roundRef = useRef(0);
  useEffect(() => {
    roundRef.current = round;
  }, [round]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const addMessage = useCallback(
    (sender: Sender, gibberish: string, text: string) =>
      setMessages((prev) => [...prev, { id: nextId(), sender, gibberish, text }]),
    [],
  );

  // Called when the goat finishes speaking — either the speaking video ended
  // (its audio is the goat's voice) or the safety timer fired. Then it's the
  // user's turn. Guarded so video-end + safety can't both fire it.
  const finishSpeak = () => {
    if (!speakingRef.current) return;
    speakingRef.current = false;
    if (timer.current) clearTimeout(timer.current);
    setGoatState("idle");
    setPhase("awaitMic");
    setProgress((roundRef.current + 0.5) / ROUNDS.length);
  };

  // Goat speaks round i. The speaking video plays (muted) while the mp3 from
  // /audio plays; the turn ends when that audio finishes (finishSpeak).
  const startGoatTurn = (i: number) => {
    const r = ROUNDS[i];
    setPhase("goatSpeaking");
    setGoatState("speak");
    addMessage("goat", r.goatGibberish, r.goatText);
    speakingRef.current = true;
    audio.playGoatSpeak(i, r.goatGibberish).then(finishSpeak);
    schedule(finishSpeak, SPEAK_SAFETY_MS); // backup if the audio promise hangs
  };

  // Accepted (the user bleated like a goat): show their line, laugh, advance.
  const acceptUserTurn = () => {
    const r = ROUNDS[round];
    addMessage("user", r.userGibberish, r.userText);
    setPhase("goatLaughing");
    setGoatState("laugh");
    audio.playGoatLaugh();
    schedule(() => {
      const next = round + 1;
      setProgress(next / ROUNDS.length);
      if (next < ROUNDS.length) {
        setRound(next);
        startGoatTurn(next);
      } else {
        setGoatState("voucher");
        setPhase("finished");
        schedule(() => setShowPopup(true), 1100);
      }
    }, 1800);
  };

  // Rejected (they spoke a real language): goat complains, same round again.
  // Same video-driven speaking as a normal turn.
  const rejectUserTurn = () => {
    const reply = NOT_GOAT_REPLIES[rejectCount % NOT_GOAT_REPLIES.length];
    setRejectCount((c) => c + 1);
    addMessage("goat", reply.gibberish, reply.text);
    setPhase("goatSpeaking");
    setGoatState("speak");
    speakingRef.current = true;
    audio.playGoatSpeak(rejectCount % ROUNDS.length, reply.gibberish).then(finishSpeak);
    schedule(finishSpeak, SPEAK_SAFETY_MS);
  };

  // Stop recording, transcribe with Whisper, classify goat vs. human.
  const finishRecording = async () => {
    if (!recordingRef.current) return;
    recordingRef.current = false;
    setPhase("transcribing");
    setGoatState("idle");

    const blob = await recorder.stop();

    let isGoat = true; // default: accept (keeps the flow alive on any failure)
    if (blob) {
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
    }

    if (isGoat) acceptUserTurn();
    else rejectUserTurn();
  };

  // Start recording the user's "goat speech".
  const beginRecording = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    const ok = await recorder.start();
    busyRef.current = false;
    if (!ok) {
      // No mic / permission denied → fall back to just accepting.
      acceptUserTurn();
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
    audio.unlock();
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
          <GoatStage state={goatState} />
        </div>
      </div>

      <ChatBox messages={messages} visible={started} />
      <MicButton phase={phase} onTap={onMicTap} visible={started} />

      {!started && <StartOverlay onStart={startExperience} />}

      <DiscountPopup
        open={showPopup}
        onClose={() => setShowPopup(false)}
        coupon={COUPON}
      />
    </main>
  );
}
