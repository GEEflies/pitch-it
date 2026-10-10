"use client";

import "@/styles/screens/record.css";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CoachLive, useCoachPrefs, type CoachResult } from "@/components/coach/coach-live";
import { preloadCoachModels } from "@/components/coach/CameraStage";
import SessionSetup from "@/components/coach/SessionSetup";
import { PI_BACKGROUND, PiTopbar } from "@/components/pitch/pi-topbar";
import { uploadPitch, usePitchRecorder, type RecorderSetup } from "@/components/pitch/use-recorder";
import { keepLocalSession } from "@/lib/coach/local-session";
import { ruleFilterFor, type TalkMode } from "@/lib/coach/modes";
import { toStoredCoach } from "@/lib/coach/stored";
import { AUDIENCE_LABELS } from "@/lib/onboarding/plan";

/*
  Nahrávanie pitchu s kamerou: živý tréner reči tela (silueta, rady nad hlavou, teleprompter)
  beží počas nahrávania zvuku. Na server ide zvuk a súhrn reči tela, video zostáva v prehliadači.
*/

type Phase = "setup" | "live" | "analyze";

const STEPS = [
  ["Reč tela", "Gestá, pohľad, postoj a záznam chýb"],
  ["Prepis reči", "Whisper, vrátane časových značiek"],
  ["Tempo a vypĺňacie slová", "Slabiky za sekundu, pauzy, akože a ehm"],
  ["Obsahové skóre", "Problém, Riešenie, Trh, Traction a Ask"],
] as const;

export function CameraRecordScreen({
  setup,
  audioHref,
  feedbackHref,
  preview = false,
}: {
  setup: RecorderSetup;
  /** nahrávanie len so zvukom */
  audioHref: string;
  /** Kam viesť po analýze; `{id}` sa nahradí id pokusu. */
  feedbackHref: string;
  preview?: boolean;
}) {
  const prefs = useCoachPrefs();
  const recorder = usePitchRecorder();
  const { open, release } = recorder;
  const [phase, setPhase] = useState<Phase>("setup");
  const [error, setError] = useState<string | null>(null);
  const [k, setK] = useState(0);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const audioStarted = useRef(false);

  const mode: TalkMode = useMemo(
    () => ({ kind: "talk", id: "pitch", title: `Pitch · ${setup.targetSeconds} s`, subtitle: AUDIENCE_LABELS[setup.audience], durationMs: setup.targetSeconds * 1000 }),
    [setup.targetSeconds, setup.audience],
  );
  const ruleFilter = useMemo(() => ruleFilterFor(mode, !!prefs.prompterText), [mode, prefs.prompterText]);

  useEffect(() => {
    if (!preview) void open();
  }, [open, preview]);

  // modely sťahujeme už počas nastavenia, aby štart nahrávania nečakal
  useEffect(() => preloadCoachModels(prefs.quality), [prefs.quality]);

  // kroky analýzy postupujú, posledný sa uzavrie až po odpovedi servera
  useEffect(() => {
    if (phase !== "analyze" || error) return;
    const timer = setInterval(() => setK((v) => (preview ? Math.min(4, v + 1) : attemptId ? 4 : Math.min(3, v + 1))), 1000);
    return () => clearInterval(timer);
  }, [phase, error, attemptId, preview]);

  const micReady = preview || recorder.media === "ready";
  const micText =
    preview || recorder.media === "ready"
      ? null
      : recorder.media === "denied"
        ? "Prístup k mikrofónu je zamietnutý. Povoľ ho v nastaveniach prehliadača a obnov stránku."
        : recorder.media === "unsupported"
          ? "Tento prehliadač nevie nahrávať. Skús Chrome, Edge alebo Safari."
          : "Zapínam mikrofón…";

  const start = () => {
    if (!micReady) return;
    setError(null);
    audioStarted.current = false;
    setPhase("live");
  };

  const onLive = () => {
    if (!preview) audioStarted.current = recorder.start();
  };

  const onFinish = async (result: CoachResult) => {
    setPhase("analyze");
    setK(1);
    const coach = toStoredCoach(result.summary, { teleprompter: !!prefs.prompterText, micMode: prefs.micMode });
    if (preview) {
      keepLocalSession("ukazka", { summary: result.summary, videoUrl: result.recording?.url ?? null });
      return;
    }
    const recording = audioStarted.current ? await recorder.stop() : null;
    release();
    if (!recording) {
      if (result.recording) URL.revokeObjectURL(result.recording.url);
      setError("Nahrávka sa nezachytila. Skús to znova.");
      return;
    }
    const uploaded = await uploadPitch(recording, setup, null, coach);
    if (uploaded.ok) {
      keepLocalSession(uploaded.attemptId, { summary: result.summary, videoUrl: result.recording?.url ?? null });
      setAttemptId(uploaded.attemptId);
      setK(4);
    } else {
      if (result.recording) URL.revokeObjectURL(result.recording.url);
      setError(uploaded.message);
    }
  };

  const onError = (message: string) => {
    if (audioStarted.current) void recorder.stop();
    audioStarted.current = false;
    setError(message);
    setPhase("setup");
  };

  const retry = () => {
    setError(null);
    setAttemptId(null);
    setK(0);
    setPhase("setup");
    if (!preview) void open();
  };

  if (phase === "live") {
    return (
      <CoachLive
        mode={mode}
        label={`${mode.title} · ${AUDIENCE_LABELS[setup.audience]}`}
        prefs={prefs}
        ruleFilter={ruleFilter}
        finishLabel="Skončiť pitch"
        onLive={onLive}
        onFinish={(r) => void onFinish(r)}
        onError={onError}
      />
    );
  }

  const done = k >= 4 && (preview || attemptId);

  return (
    <div className="pi-rec" style={{ background: PI_BACKGROUND, color: "var(--color-paper)", minHeight: "100dvh" }}>
      <PiTopbar />
      {phase === "setup" ? (
        <main id="obsah">
          <SessionSetup
            heading="Pitch pred kamerou"
            lead={`${setup.targetSeconds >= 60 ? `${setup.targetSeconds / 60} min` : `${setup.targetSeconds} s`} pitch ${AUDIENCE_LABELS[setup.audience].toLowerCase()}. Tréner ti počas pitchu radí, na konci dostaneš spätnú väzbu.`}
            backHref={audioHref}
            backLabel="Nahrávať len zvuk"
            modes={null}
            mode={mode}
            onMode={() => {}}
            {...prefs}
            error={error}
            startLabel="Spustiť nahrávanie"
            canStart={micReady}
            finePrint="Spustením súhlasíš, že pitch analyzuje AI a výsledky uvidia mentori akcie."
            onStart={start}
          >
            {micText ? (
              <p className="text-sm text-marker" role="status">
                {micText}
              </p>
            ) : null}
          </SessionSetup>
        </main>
      ) : (
        <main id="obsah" style={{ display: "flex", justifyContent: "center", padding: "40px 32px" }}>
          <div className="card" style={{ flex: "1 1 640px", maxWidth: "860px", minWidth: "0", padding: "32px" }}>
            <h1 className="h" style={{ fontSize: "36px", margin: "8px 0 8px" }}>
              Analyzujem tvoj pitch.
            </h1>
            <p className="muted" style={{ margin: "0 0 24px", fontSize: "16px" }}>
              Výsledok bude hotový približne za 15 sekúnd.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }} aria-live="polite">
              {STEPS.map(([title, detail], i) => (
                <div
                  key={title}
                  className="stp"
                  style={k > i ? { borderColor: "var(--color-mint)", background: "var(--pi-sel)" } : k === i ? { borderColor: "var(--color-violet)" } : undefined}
                >
                  <span style={{ display: "inline-flex", width: "24px", height: "24px" }}>
                    {k > i ? (
                      <svg width="24" height="24" viewBox="0 0 22 22" aria-label="Hotovo">
                        <circle cx="11" cy="11" r="11" fill="var(--color-signal)" />
                        <path d="M6 11.5L9.5 15L16 8" fill="none" stroke="#141414" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <svg width="24" height="24" viewBox="0 0 22 22" aria-hidden="true">
                        <circle cx="11" cy="11" r="10" fill="none" stroke="var(--color-line-strong)" strokeWidth="2" />
                      </svg>
                    )}
                  </span>
                  <span style={{ flex: "1" }}>
                    <b style={{ display: "block", fontSize: "15px" }}>{title}</b>
                    <span className="muted" style={{ fontSize: "13px" }}>
                      {detail}
                    </span>
                  </span>
                </div>
              ))}
            </div>
            {error ? (
              <div style={{ marginTop: "24px" }}>
                <p role="alert" style={{ margin: "0 0 14px", fontSize: "15px", color: "var(--color-coral)" }}>
                  {error}
                </p>
                <button type="button" className="btn" onClick={retry} style={{ width: "100%", minHeight: "54px" }}>
                  Skús znova
                </button>
              </div>
            ) : null}
            {done ? (
              <div style={{ marginTop: "24px" }}>
                <Link
                  className="btn btn-p"
                  href={feedbackHref.replace("{id}", attemptId ?? "")}
                  style={{ width: "100%", boxSizing: "border-box", minHeight: "54px" }}
                >
                  Zobraziť feedback
                </Link>
              </div>
            ) : null}
          </div>
        </main>
      )}
    </div>
  );
}
