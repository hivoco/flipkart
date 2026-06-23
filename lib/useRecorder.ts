"use client";

import { useCallback, useEffect, useRef } from "react";
import type RecordRTCType from "recordrtc";

// Voice recorder built on RecordRTC's StereoAudioRecorder (Web Audio API) rather
// than the browser MediaRecorder. iOS Safari's MediaRecorder is unreliable
// (limited codecs, empty blobs, AudioContext gesture quirks); RecordRTC records
// straight off the audio graph and outputs a WAV blob that Whisper accepts.
//
// start() asks for the mic and begins recording; stop() returns the recorded
// audio Blob (or null if nothing was captured / the mic was unavailable).

export function useRecorder() {
  const recorderRef = useRef<RecordRTCType | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const cleanup = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    try {
      recorderRef.current?.destroy();
    } catch {
      /* already torn down */
    }
    recorderRef.current = null;
  }, []);

  const start = useCallback(async (): Promise<boolean> => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      // Loaded on demand so RecordRTC (which touches window) never runs on the
      // server during SSR of this client component.
      const RecordRTC = (await import("recordrtc")).default;
      const recorder = new RecordRTC(stream, {
        type: "audio",
        mimeType: "audio/wav",
        recorderType: RecordRTC.StereoAudioRecorder,
        numberOfAudioChannels: 1, // mono is plenty for speech + smaller uploads
        desiredSampRate: 16000, // Whisper runs at 16kHz; keeps the WAV small
      });
      recorder.startRecording();
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
      if (!recorder) {
        cleanup();
        resolve(null);
        return;
      }
      recorder.stopRecording(() => {
        const blob = recorder.getBlob();
        cleanup();
        resolve(blob && blob.size > 0 ? blob : null);
      });
    });
  }, [cleanup]);

  // Make sure the mic is released if the component unmounts mid-recording.
  useEffect(() => cleanup, [cleanup]);

  return { start, stop };
}
