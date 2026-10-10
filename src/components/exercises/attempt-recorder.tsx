"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { describeMediaError, openMicrophone, rememberedDevice } from "@/components/session/media";
import { buttonClasses } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { Spinner } from "@/components/ui/submit-button";
import { useToast } from "@/components/ui/toast";
import { MicAnalyzer } from "@/lib/analytics/audio/mic-analyzer";
import { summarizeVoice } from "@/lib/analytics/audio/voice-summary";
import { formatClock } from "@/lib/format";

type Phase = "idle" | "recording" | "uploading";

function pickMimeType(): string | undefined {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return candidates.find((type) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type));
}

async function errorMessage(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
  return body?.error?.message ?? "Pokus sa nepodarilo uložiť.";
}

/** Odpoveď v cvičení: nahrávka (prepíše sa a zahodí) alebo text. */
export function AttemptRecorder({ exerciseId, timeLimitSeconds }: { exerciseId: string; timeLimitSeconds: number | null }) {
  const [mode, setMode] = useState<"voice" | "text">("voice");
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyzer = useRef<MicAnalyzer | null>(null);
  const router = useRouter();
  const toast = useToast();
  const limit = timeLimitSeconds ?? 120;

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
      stream.current?.getTracks().forEach((track) => track.stop());
      void analyzer.current?.stop();
    },
    [],
  );

  const submit = async (body: FormData | string) => {
    setPhase("uploading");
    setError(null);
    const response = await fetch(`/api/exercises/${exerciseId}/attempts`, {
      method: "POST",
      ...(typeof body === "string" ? { body, headers: { "Content-Type": "application/json" } } : { body }),
    });
    setPhase("idle");
    if (!response.ok) {
      setError(await errorMessage(response));
      router.refresh();
      return;
    }
    setText("");
    toast.show("Pokus je vyhodnotený.");
    router.refresh();
  };

  const stopRecording = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    recorder.current?.stop();
  };

  const startRecording = async () => {
    setError(null);
    try {
      const media = await openMicrophone(rememberedDevice("mic"));
      stream.current = media;
      const clockStart = performance.now();
      const mic = new MicAnalyzer(() => performance.now() - clockStart);
      analyzer.current = mic;
      await mic.start(media).catch(() => undefined);

      const mimeType = pickMimeType();
      const instance = new MediaRecorder(media, mimeType ? { mimeType, audioBitsPerSecond: 32_000 } : undefined);
      chunks.current = [];
      instance.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.current.push(event.data);
      };
      instance.onstop = () => {
        const durationMs = Math.round(performance.now() - startedAt.current);
        const frames = mic.framesBetween(0, Number.POSITIVE_INFINITY);
        const speechMs = frames.length > 0 ? summarizeVoice(frames, 0, durationMs).speechMs : null;
        void mic.stop();
        media.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunks.current, { type: instance.mimeType || "audio/webm" });
        const form = new FormData();
        form.set("audio", blob, "odpoved");
        form.set("durationMs", String(durationMs));
        if (speechMs) form.set("speechMs", String(Math.round(speechMs)));
        void submit(form);
      };
      recorder.current = instance;
      startedAt.current = performance.now();
      instance.start(1_000);
      setElapsed(0);
      setPhase("recording");
      timer.current = setInterval(() => {
        const seconds = (performance.now() - startedAt.current) / 1000;
        setElapsed(seconds);
        // Tvrdý strop: 3 minúty alebo dvojnásobok limitu cvičenia.
        if (seconds >= Math.min(180, limit * 2)) stopRecording();
      }, 250);
    } catch (cause) {
      setError(describeMediaError(cause, "mikrofón").message);
      setPhase("idle");
    }
  };

  return (
    <div className="rounded-[16px] border border-line bg-panel/60 p-5 md:p-6">
      <div role="tablist" aria-label="Spôsob odpovede" className="flex gap-2">
        {(
          [
            ["voice", "Hlasom"],
            ["text", "Textom"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={mode === key}
            disabled={phase !== "idle"}
            onClick={() => setMode(key)}
            className={`rounded-full border px-3.5 py-1.5 text-sm ${mode === key ? "border-signal-soft/60 bg-signal/10 text-paper" : "border-line-strong text-mute hover:text-paper"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "voice" ? (
        <div className="mt-6">
          {phase === "recording" ? (
            <div className="flex flex-wrap items-center gap-4">
              <span className={`tabular-nums text-[1.6rem] font-semibold ${elapsed > limit ? "text-marker" : "text-paper"}`}>
                {formatClock(elapsed)}
                <span className="text-[1rem] font-normal text-faint"> / {formatClock(limit)}</span>
              </span>
              <button type="button" onClick={stopRecording} className={buttonClasses()}>
                Hotovo, vyhodnotiť
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => void startRecording()} disabled={phase !== "idle"} className={buttonClasses({ size: "lg" })}>
              {phase === "uploading" ? (
                <>
                  <Spinner />
                  Prepisujem a vyhodnocujem…
                </>
              ) : (
                "Nahrať odpoveď"
              )}
            </button>
          )}
          <p className="mt-3 text-[13px] leading-relaxed text-faint">
            Nahrávka sa pošle na prepis (OpenAI) a hneď sa zahodí. Ukladáme iba prepis a merania.
          </p>
        </div>
      ) : (
        <form
          className="mt-6 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (text.trim()) void submit(JSON.stringify({ answer: text, inputMethod: "text", durationMs: null, speechMs: null }));
          }}
        >
          <label htmlFor="exercise-answer" className="sr-only">
            Tvoja odpoveď
          </label>
          <textarea
            id="exercise-answer"
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={5}
            maxLength={20_000}
            placeholder="Napíš odpoveď rovnako, ako ju povieš investorovi."
            className="w-full rounded-[12px] border border-line-strong bg-ink-2 px-4 py-3 text-[15px] leading-relaxed text-paper outline-none placeholder:text-faint focus:border-signal-soft"
          />
          <button type="submit" disabled={phase !== "idle" || !text.trim()} className={buttonClasses()}>
            {phase === "uploading" ? <Spinner /> : null}
            Vyhodnotiť
          </button>
        </form>
      )}
      {error ? (
        <Notice tone="error" className="mt-4">
          {error}
        </Notice>
      ) : null}
    </div>
  );
}
