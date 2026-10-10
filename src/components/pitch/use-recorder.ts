"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { VisionSample } from "@/lib/analytics/vision/types";
import type { StoredCoach } from "@/lib/coach/stored";

/*
  Nahrávanie pitchu v prehliadači: mikrofón (a voliteľne kamera), úroveň hlasu pre vlnu,
  MediaRecorder na audio a odoslanie na /api/pitch. Nahrávka sa nikde neukladá.
*/

export type RecorderSetup = {
  audience: "investor" | "team";
  targetSeconds: 30 | 60 | 180;
  focus: "tempo" | "fillery" | "obsah";
};

export type MediaState = "idle" | "requesting" | "ready" | "denied" | "unsupported";

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((type) => MediaRecorder.isTypeSupported(type));
}

export function usePitchRecorder({ video = false }: { video?: boolean } = {}) {
  const [media, setMedia] = useState<MediaState>("idle");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [level, setLevel] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const open = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMedia("unsupported");
      return;
    }
    setMedia("requesting");
    try {
      const next = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: video ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" } : false,
      });
      streamRef.current = next;
      setStream(next);
      setMedia("ready");

      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(next).connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      let last = 0;
      const tick = (now: number) => {
        rafRef.current = requestAnimationFrame(tick);
        if (now - last < 60) return;
        last = now;
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const v of data) sum += ((v - 128) / 128) ** 2;
        setLevel(Math.min(1, Math.sqrt(sum / data.length) * 4));
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setMedia("denied");
    }
  }, [video]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      void audioCtxRef.current?.close();
    };
  }, []);

  const start = useCallback(() => {
    const current = streamRef.current;
    if (!current) return false;
    const audioOnly = new MediaStream(current.getAudioTracks());
    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(audioOnly, mimeType ? { mimeType } : undefined);
    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.start(1000);
    recorderRef.current = recorder;
    startedAtRef.current = performance.now();
    return true;
  }, []);

  /** Zastaví nahrávanie a vráti audio s dĺžkou. */
  const stop = useCallback(
    () =>
      new Promise<{ audio: Blob; durationMs: number } | null>((resolve) => {
        const recorder = recorderRef.current;
        if (!recorder || recorder.state === "inactive") return resolve(null);
        const durationMs = Math.round(performance.now() - startedAtRef.current);
        recorder.onstop = () => resolve({ audio: new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" }), durationMs });
        recorder.stop();
      }),
    [],
  );

  const release = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
  }, []);

  return { media, stream, level, open, start, stop, release };
}

/** Odošle nahrávku na analýzu. Vráti id pokusu alebo chybovú správu. */
export async function uploadPitch(
  recording: { audio: Blob; durationMs: number },
  setup: RecorderSetup,
  vision: VisionSample[] | null,
  coach: StoredCoach | null = null,
): Promise<{ ok: true; attemptId: string } | { ok: false; message: string }> {
  const form = new FormData();
  form.set("audio", recording.audio, "pitch");
  form.set("durationMs", String(Math.max(1000, recording.durationMs)));
  form.set("audience", setup.audience);
  form.set("targetSeconds", String(setup.targetSeconds));
  form.set("focus", setup.focus);
  if (vision?.length) form.set("vision", JSON.stringify(vision));
  if (coach) form.set("coach", JSON.stringify(coach));
  try {
    const response = await fetch("/api/pitch", { method: "POST", body: form });
    const data = (await response.json().catch(() => null)) as { attemptId?: string; error?: { message?: string } } | null;
    if (response.ok && data?.attemptId) return { ok: true, attemptId: data.attemptId };
    return { ok: false, message: data?.error?.message ?? "Analýza zlyhala. Skús to znova." };
  } catch {
    return { ok: false, message: "Nepodarilo sa spojiť so serverom. Skontroluj pripojenie a skús to znova." };
  }
}
