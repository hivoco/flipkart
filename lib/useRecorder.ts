"use client";

import { useCallback, useEffect, useRef } from "react";

// Thin wrapper around getUserMedia + MediaRecorder.
// start() asks for the mic and begins recording; stop() returns the recorded
// audio Blob (or null if nothing was captured / the mic was unavailable).
//
// Note: this is only used on non-iOS. iOS fakes the mic at the page level
// (Safari's mic/audio-session handling is too unreliable), so the recorder
// stays a single simple implementation shared by Android + desktop.

export function useRecorder() {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const cleanup = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
  }, []);

  const start = useCallback(async (): Promise<boolean> => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start();
      recorderRef.current = recorder;
      return true;
    } catch {
      cleanup();
      return false;
    }
  }, [cleanup]);

  const stop = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        cleanup();
        resolve(null);
        return;
      }
      recorder.onstop = () => {
        const type = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        cleanup();
        resolve(blob.size > 0 ? blob : null);
      };
      recorder.stop();
    });
  }, [cleanup]);

  // Make sure the mic is released if the component unmounts mid-recording.
  useEffect(() => cleanup, [cleanup]);

  return { start, stop };
}
