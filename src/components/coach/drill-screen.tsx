"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CoachLive, useCoachPrefs, type CoachResult } from "@/components/coach/coach-live";
import { preloadCoachModels } from "@/components/coach/CameraStage";
import SessionSetup from "@/components/coach/SessionSetup";
import SessionSummaryView from "@/components/coach/SessionSummaryView";
import { PI_BACKGROUND, PiTopbar } from "@/components/pitch/pi-topbar";
import { DRILLS, ruleFilterFor, type Drill } from "@/lib/coach/modes";

/*
  Cvičenia reči tela: jedna zručnosť, jeden cieľ (power zóna, otvorené dlane, pohľad…).
  Všetko beží v prehliadači, výsledok sa nikam neukladá.
*/

type Phase = "setup" | "live" | "summary";

export function DrillScreen({ backHref }: { backHref: string }) {
  const prefs = useCoachPrefs();
  const [phase, setPhase] = useState<Phase>("setup");
  const [drill, setDrill] = useState<Drill>(DRILLS[0]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CoachResult | null>(null);
  const ruleFilter = useMemo(() => ruleFilterFor(drill, !!prefs.prompterText), [drill, prefs.prompterText]);

  // modely sťahujeme už počas nastavenia, aby štart nahrávania nečakal
  useEffect(() => preloadCoachModels(prefs.quality), [prefs.quality]);

  // nahrávka žije len v pamäti prehliadača; pri odchode zo stránky ju uvoľníme
  const videoUrl = useRef<string | null>(null);
  useEffect(() => {
    videoUrl.current = result?.recording?.url ?? null;
  }, [result]);
  useEffect(
    () => () => {
      if (videoUrl.current) URL.revokeObjectURL(videoUrl.current);
    },
    [],
  );

  const clearResult = () => {
    if (result?.recording) URL.revokeObjectURL(result.recording.url);
    setResult(null);
  };

  if (phase === "live") {
    return (
      <CoachLive
        mode={drill}
        label={`Cvičenie · ${drill.title}`}
        prefs={prefs}
        ruleFilter={ruleFilter}
        finishLabel="Skončiť a vyhodnotiť"
        onFinish={(r) => {
          setResult(r);
          setPhase("summary");
        }}
        onError={(message) => {
          setError(message);
          setPhase("setup");
        }}
      />
    );
  }

  return (
    <div style={{ background: PI_BACKGROUND, color: "var(--color-paper)", minHeight: "100dvh" }}>
      <PiTopbar />
      <main id="obsah">
        {phase === "summary" && result ? (
          <SessionSummaryView
            summary={result.summary}
            mode={drill}
            drill={result.drill}
            ruleFilter={ruleFilter}
            recording={result.recording}
            backHref={backHref}
            onRetry={() => {
              clearResult();
              setPhase("live");
            }}
            onSetup={() => {
              clearResult();
              setPhase("setup");
            }}
          />
        ) : (
          <SessionSetup
            heading="Cvičenia reči tela"
            lead="Krátke cvičenia pred kamerou, každé trénuje jednu zručnosť. Tréner ti počas neho radí v reálnom čase."
            backHref={backHref}
            backLabel="Tréning pitchu"
            modes={DRILLS}
            mode={drill}
            onMode={(m) => {
              if (m.kind === "drill") setDrill(m);
            }}
            {...prefs}
            error={error}
            onStart={() => {
              setError(null);
              setPhase("live");
            }}
          />
        )}
      </main>
    </div>
  );
}
