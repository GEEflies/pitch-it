"use client";

import "@/styles/screens/coach.css";
import { useCallback, useEffect, useRef, useState } from "react";
import CameraStage, { type Recording, type StageApi, type TrackingQuality } from "@/components/coach/CameraStage";
import DrillProgressCard from "@/components/coach/DrillProgressCard";
import FeedbackBubble from "@/components/coach/FeedbackBubble";
import LivePanel from "@/components/coach/LivePanel";
import type { PrompterSetting } from "@/components/coach/SessionSetup";
import StageMap from "@/components/coach/StageMap";
import Teleprompter from "@/components/coach/Teleprompter";
import { DrillTracker, SCRIPTS, type DrillProgress, type SessionMode } from "@/lib/coach/modes";
import type { FeedbackState } from "@/lib/coach/pose/feedback";
import type { Metrics, MicHand } from "@/lib/coach/pose/metrics";
import { STATUS_COLOR } from "@/lib/coach/pose/renderer";
import { SessionRecorder, type SessionSummary } from "@/lib/coach/pose/session";

/*
  Živý tréner reči tela (port zo Stage Coach): kamera so siluetou, bublina s radou nad hlavou,
  power zóna, teleprompter a záznam chýb. Pripojenie komponentu = spustenie kamery a modelu.
*/

const UI_INTERVAL_MS = 100;
const MIC_KEY = "pitchit-coach-mic";
const QUALITY_KEY = "pitchit-coach-quality";
const MIC_HAND_KEY = "pitchit-coach-mic-hand";
/** odhad šírky bubliny, aby sme ju vedeli udržať v zábere */
const BUBBLE_MAX_W = 900;
const COUNTDOWN = 2;

type Anchor = { x: number; y: number };

/** bublina nad hlavou, ale vždy celá v zábere (a pod telepromptrom) */
function bubbleAnchor(head: Anchor | null, stage: HTMLElement | null, bubble: HTMLElement | null, topInset: number): Anchor | null {
  if (!head || !stage) return null;
  const w = stage.clientWidth;
  const half = Math.min(w * 0.92, BUBBLE_MAX_W) / 2;
  const h = bubble?.offsetHeight ?? 200;
  return {
    x: Math.min(Math.max(head.x, half + 8), w - half - 8),
    y: Math.max(head.y, topInset + h + 12),
  };
}

function readPref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writePref(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // bez localStorage si voľbu len nezapamätáme
  }
}

/** Nastavenia trénera, zapamätané v prehliadači (len pohodlie, appka funguje aj bez nich). */
export function useCoachPrefs() {
  const [micMode, setMicMode] = useState(false);
  const [quality, setQuality] = useState<TrackingQuality>("balanced");
  const [micHand, setMicHand] = useState<MicHand>("auto");
  const [prompter, setPrompter] = useState<PrompterSetting>({ scriptId: null, customText: "", wpm: 150 });

  useEffect(() => {
    const q = readPref(QUALITY_KEY);
    const h = readPref(MIC_HAND_KEY);
    /* eslint-disable react-hooks/set-state-in-effect -- localStorage je dostupný až na klientovi */
    setMicMode(readPref(MIC_KEY) === "1");
    setQuality(q === "fast" || q === "precise" ? q : "balanced");
    setMicHand(h === "left" || h === "right" ? h : "auto");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const prompterText =
    prompter.scriptId === "custom"
      ? prompter.customText.trim() || null
      : (SCRIPTS.find((s) => s.id === prompter.scriptId)?.text ?? null);

  return {
    micMode,
    onMic: (on: boolean) => {
      setMicMode(on);
      writePref(MIC_KEY, on ? "1" : "0");
    },
    quality,
    onQuality: (q: TrackingQuality) => {
      setQuality(q);
      writePref(QUALITY_KEY, q);
    },
    micHand,
    onMicHand: (h: MicHand) => {
      setMicHand(h);
      writePref(MIC_HAND_KEY, h);
    },
    prompter,
    onPrompter: setPrompter,
    prompterText,
  };
}

export type CoachPrefs = ReturnType<typeof useCoachPrefs>;

export type CoachResult = {
  summary: SessionSummary;
  drill: DrillProgress | null;
  /** nahrávka kamery pre klipy chýb (len v pamäti prehliadača) */
  recording: Recording | null;
};

const fmtClock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

const INITIAL_FB: FeedbackState = {
  status: "idle",
  title: "Načítavam…",
  tip: "Zapínam kameru a sledovanie tela.",
  ruleId: null,
  activeIds: [],
  score: 70,
  highlight: null,
};

type Phase = "loading" | "countdown" | "live";

export function CoachLive({
  mode,
  label,
  prefs,
  ruleFilter,
  finishLabel = "Skončiť",
  onLive,
  onFinish,
  onError,
}: {
  mode: SessionMode;
  /** štítok v hlavičke (napr. „Pitch · 60 s“) */
  label: string;
  prefs: CoachPrefs;
  ruleFilter: (id: string) => boolean;
  finishLabel?: string;
  /** volá sa, keď po odpočte začne nahrávanie */
  onLive?: () => void;
  onFinish: (result: CoachResult) => void;
  onError: (message: string) => void;
}) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [fb, setFb] = useState<FeedbackState>(INITIAL_FB);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [count, setCount] = useState(COUNTDOWN);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [drillProgress, setDrillProgress] = useState<DrillProgress | null>(null);
  const { prompter, onPrompter, prompterText, micMode, micHand, quality } = prefs;

  const stageApi = useRef<StageApi>(null);
  const stageRef = useRef<HTMLElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const prompterRef = useRef<HTMLDivElement>(null);
  const recorder = useRef<SessionRecorder | null>(null);
  const drillTracker = useRef<DrillTracker | null>(null);
  const lastUi = useRef(0);
  const lastT = useRef(0);
  const liveStartedAt = useRef(0);
  const finishing = useRef(false);
  const phaseRef = useRef(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const drill = mode.kind === "drill" ? mode : null;
  const durationMs = mode.durationMs;

  const callbacks = useRef({ onLive, onFinish, onError });
  useEffect(() => {
    callbacks.current = { onLive, onFinish, onError };
  });

  const onFrame = useCallback((f: FeedbackState, m: Metrics | null, t: number) => {
    const dt = lastT.current ? Math.min(t - lastT.current, 250) : 0;
    lastT.current = t;
    if (phaseRef.current === "live") {
      recorder.current?.record(t, f, m, () => stageApi.current?.snapshot() ?? null);
      drillTracker.current?.update(m, f, dt);
    }
    if (t - lastUi.current > UI_INTERVAL_MS) {
      lastUi.current = t;
      setFb(f);
      setMetrics(m);
      if (drillTracker.current) setDrillProgress(drillTracker.current.progress());
      const head = m ? (stageApi.current?.headAnchor(m) ?? null) : null;
      const p = prompterRef.current;
      const inset = p ? p.offsetTop + p.offsetHeight : 0;
      setAnchor(bubbleAnchor(head, stageRef.current, bubbleRef.current, inset));
    }
  }, []);

  const onReady = useCallback(() => {
    setCount(COUNTDOWN);
    setPhase("countdown");
  }, []);

  const onStageError = useCallback((msg: string) => callbacks.current.onError(msg), []);

  const finish = useCallback(async () => {
    if (!recorder.current || finishing.current) return;
    finishing.current = true;
    const summary = recorder.current.summary();
    const drillResult = drillTracker.current?.progress() ?? null;
    const recording = (await stageApi.current?.stopRecording()) ?? null;
    callbacks.current.onFinish({ summary, drill: drillResult, recording });
  }, []);

  // odpočet 3-2-1 a potom štart nahrávania
  useEffect(() => {
    if (phase !== "countdown") return;
    const id = setTimeout(
      () => {
        if (count > 0) return setCount(count - 1);
        recorder.current = new SessionRecorder();
        recorder.current.begin(lastT.current || performance.now());
        drillTracker.current = drill ? new DrillTracker(drill) : null;
        setDrillProgress(drillTracker.current?.progress() ?? null);
        liveStartedAt.current = performance.now();
        stageApi.current?.startRecording();
        setElapsedMs(0);
        setPhase("live");
        callbacks.current.onLive?.();
      },
      count > 0 ? 800 : 300,
    );
    return () => clearTimeout(id);
  }, [phase, count, drill]);

  // časomiera; pri režime s limitom sa nahrávanie na konci samo ukončí
  useEffect(() => {
    if (phase !== "live") return;
    const id = setInterval(() => {
      const el = performance.now() - liveStartedAt.current;
      setElapsedMs(el);
      if (durationMs !== null && el >= durationMs) void finish();
    }, 250);
    return () => clearInterval(id);
  }, [phase, durationMs, finish]);

  const color = STATUS_COLOR[fb.status];
  const remaining = durationMs !== null ? durationMs - elapsedMs : null;
  const clockColor =
    remaining === null
      ? "text-paper"
      : remaining <= 10_000
        ? "animate-pulse text-danger"
        : remaining <= Math.max(30_000, durationMs! * 0.1)
          ? "text-marker"
          : "text-paper";

  return (
    <main id="obsah" className="flex h-dvh flex-col bg-ink text-paper">
      <header className="relative flex items-center justify-between gap-4 border-b border-line px-6 py-3">
        <div className="flex min-w-0 items-center gap-4">
          <span className="h text-lg">
            Pitch<span className="text-signal">It</span>
          </span>
          <span className="hidden truncate rounded-full bg-panel px-3 py-1 text-xs font-bold uppercase tracking-widest text-mute sm:inline">
            {label}
          </span>
        </div>
        <div className="flex items-center gap-5">
          {phase === "live" && (
            <span className={`flex items-center gap-2 font-mono text-2xl font-bold ${clockColor}`} aria-live="off">
              <span className="h-3 w-3 animate-pulse rounded-full bg-danger" />
              {remaining !== null ? fmtClock(remaining) : fmtClock(elapsedMs)}
            </span>
          )}
          <button
            type="button"
            onClick={() => void finish()}
            disabled={phase !== "live"}
            className="rounded-full bg-signal px-5 py-2 font-bold text-on-signal transition hover:bg-signal-hover disabled:opacity-30"
          >
            {finishLabel}
          </button>
        </div>
        {phase === "live" && durationMs !== null && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-panel">
            <div
              className="h-full bg-gradient-to-r from-violet to-signal transition-[width] duration-300 ease-linear"
              style={{ width: `${Math.min(100, (elapsedMs / durationMs) * 100)}%` }}
            />
          </div>
        )}
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <section ref={stageRef} className="relative min-h-0 flex-1 overflow-hidden">
          {/* „reflektor“: okraj záberu svieti farbou stavu */}
          <div
            className="pointer-events-none absolute inset-0 z-10 transition-[box-shadow] duration-500"
            style={{ boxShadow: `inset 0 0 120px 10px ${color}55` }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <CameraStage
              ref={stageApi}
              micMode={micMode}
              micHand={micHand}
              quality={quality}
              ruleFilter={ruleFilter}
              onFrame={onFrame}
              onReady={onReady}
              onError={onStageError}
            />
          </div>

          {prompterText && (
            <div ref={prompterRef} className="absolute left-1/2 top-3 z-20 h-[30%] max-h-64 min-h-40 w-[min(92%,1000px)] -translate-x-1/2">
              <Teleprompter
                text={prompterText}
                wpm={prompter.wpm}
                onWpmChange={(wpm) => onPrompter({ ...prompter, wpm })}
                running={phase === "live"}
              />
            </div>
          )}

          {phase === "loading" && (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-ink/80">
              <p className="animate-pulse text-xl text-mute">Načítavam kameru a model…</p>
            </div>
          )}
          {phase === "countdown" && (
            <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-ink/50 px-6 text-center">
              <p className="text-sm uppercase tracking-[0.4em] text-mute">Začíname o</p>
              <p className="mt-2 text-mute">Pozeraj sa rovno do kamery, nastavujeme polohu hlavy</p>
              <p
                key={count}
                className="animate-pop h text-[10rem] leading-none"
                style={{
                  background: "linear-gradient(135deg,#D2FF6B,var(--color-violet))",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                {count || "Štart"}
              </p>
              {drill && <p className="max-w-xl text-xl font-semibold">{drill.goal}</p>}
            </div>
          )}

          {phase === "live" && (
            <div className={`absolute inset-x-4 bottom-4 z-20 flex md:bottom-6 ${drill ? "justify-end" : "justify-center"}`}>
              <StageMap m={metrics} />
            </div>
          )}
          {phase === "live" && drill && drillProgress && (
            <div className="absolute bottom-4 left-4 z-20 md:bottom-6">
              <DrillProgressCard drill={drill} progress={drillProgress} />
            </div>
          )}

          {/* veľká rada nad hlavou rečníka, čitateľná z diaľky */}
          <div
            ref={bubbleRef}
            className="absolute z-30 w-[92%] max-w-[900px] -translate-x-1/2 -translate-y-full transition-[left,top] duration-100 ease-out"
            style={anchor ? { left: anchor.x, top: anchor.y } : { left: "50%", top: "65%" }}
          >
            <FeedbackBubble fb={fb} />
          </div>
        </section>

        <aside className="w-full shrink-0 overflow-y-auto border-t border-line p-6 lg:w-80 lg:border-l lg:border-t-0">
          <LivePanel fb={fb} m={metrics} />
        </aside>
      </div>
    </main>
  );
}
