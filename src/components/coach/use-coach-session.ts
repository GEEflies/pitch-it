"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Recording, StageApi } from "@/components/coach/CameraStage";
import { DrillTracker, type DrillProgress, type SessionMode } from "@/lib/coach/modes";
import type { FeedbackState } from "@/lib/coach/pose/feedback";
import type { Metrics } from "@/lib/coach/pose/metrics";
import { SessionRecorder, type SessionSummary } from "@/lib/coach/pose/session";

/*
  Priebeh živého tréningu bez vzhľadu: načítanie kamery, odpočet, nahrávanie, pauza,
  časomiera a záverečný súhrn. Používa ho CoachLive (cvičenia) aj PitchStudio (pitch).
*/

const UI_INTERVAL_MS = 100;
const COUNTDOWN = 2;

export type CoachResult = {
  summary: SessionSummary;
  drill: DrillProgress | null;
  /** nahrávka kamery pre klipy chýb (len v pamäti prehliadača) */
  recording: Recording | null;
};

export type CoachPhase = "loading" | "countdown" | "live" | "paused";

export const INITIAL_FB: FeedbackState = {
  status: "idle",
  title: "Načítavam…",
  tip: "Zapínam kameru a sledovanie tela.",
  ruleId: null,
  activeIds: [],
  score: 70,
  highlight: null,
};

export function useCoachSession({
  mode,
  onLive,
  onPause,
  onResume,
  onFinish,
  onError,
  onUi,
}: {
  mode: SessionMode;
  /** volá sa, keď po odpočte začne nahrávanie */
  onLive?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onFinish: (result: CoachResult) => void;
  onError: (message: string) => void;
  /** volá sa spolu s obnovou UI (najviac 10× za sekundu) */
  onUi?: (m: Metrics | null) => void;
}) {
  const [phase, setPhase] = useState<CoachPhase>("loading");
  const [fb, setFb] = useState<FeedbackState>(INITIAL_FB);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [count, setCount] = useState(COUNTDOWN);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [drillProgress, setDrillProgress] = useState<DrillProgress | null>(null);

  const stageApi = useRef<StageApi>(null);
  const recorder = useRef<SessionRecorder | null>(null);
  const drillTracker = useRef<DrillTracker | null>(null);
  const lastUi = useRef(0);
  const lastT = useRef(0);
  const liveStartedAt = useRef(0);
  const pausedAt = useRef(0);
  const finishing = useRef(false);
  const phaseRef = useRef(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const drill = mode.kind === "drill" ? mode : null;
  const durationMs = mode.durationMs;

  const callbacks = useRef({ onLive, onPause, onResume, onFinish, onError, onUi });
  useEffect(() => {
    callbacks.current = { onLive, onPause, onResume, onFinish, onError, onUi };
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
      callbacks.current.onUi?.(m);
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
    if (phaseRef.current === "paused") recorder.current.resume(performance.now());
    const summary = recorder.current.summary();
    const drillResult = drillTracker.current?.progress() ?? null;
    const recording = (await stageApi.current?.stopRecording()) ?? null;
    callbacks.current.onFinish({ summary, drill: drillResult, recording });
  }, []);

  const pause = useCallback(() => {
    if (phaseRef.current !== "live") return;
    pausedAt.current = performance.now();
    recorder.current?.pause(lastT.current || pausedAt.current);
    stageApi.current?.pauseRecording();
    phaseRef.current = "paused";
    setPhase("paused");
    callbacks.current.onPause?.();
  }, []);

  const resume = useCallback(() => {
    if (phaseRef.current !== "paused") return;
    const now = performance.now();
    liveStartedAt.current += now - pausedAt.current;
    recorder.current?.resume(lastT.current || now);
    stageApi.current?.resumeRecording();
    phaseRef.current = "live";
    setPhase("live");
    callbacks.current.onResume?.();
  }, []);

  // odpočet a potom štart nahrávania
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

  return {
    phase,
    fb,
    metrics,
    count,
    elapsedMs,
    durationMs,
    drill,
    drillProgress,
    stageApi,
    onFrame,
    onReady,
    onStageError,
    finish,
    pause,
    resume,
  };
}

export const fmtClock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};
