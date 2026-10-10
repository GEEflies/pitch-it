"use client";

import type { Phase } from "@/lib/session/live-state";
import type { Stage } from "@/lib/session/controller";

const PHASE_LABEL: Record<Phase, string> = {
  idle: "Pripravuje sa",
  investor_thinking: "Rozmýšľa",
  investor_speaking: "Hovorí",
  listening: "Počúva",
  founder_speaking: "Počúva ťa",
  processing: "Premýšľa nad odpoveďou",
};

function SpeakingBars({ active }: { active: boolean }) {
  return (
    <span aria-hidden="true" className="flex h-4 items-end gap-[3px]">
      {[0, 1, 2, 3].map((index) => (
        <span
          key={index}
          className={`w-[3px] rounded-full bg-signal-soft ${active ? "voice-bar" : ""}`}
          style={{ height: active ? undefined : "30%", animationDelay: `${index * 120}ms` }}
        />
      ))}
    </span>
  );
}

export function StatusPill({ stage, phase, delivery }: { stage: Stage; phase: Phase; delivery: boolean }) {
  let label = PHASE_LABEL[phase];
  let tone = "border-line-strong text-mute";
  if (stage === "connecting") label = "Pripája sa";
  else if (stage === "reconnecting") {
    label = "Obnovuje spojenie";
    tone = "border-marker/50 text-marker";
  } else if (stage === "failed") {
    label = "Spojenie prerušené";
    tone = "border-coral/50 text-coral";
  } else if (stage === "ending") label = "Ukladá sa";
  else if (delivery && stage === "live") label = phase === "founder_speaking" ? "Počúva prednes" : "Čaká na teba";
  else if (phase === "investor_speaking") tone = "border-signal-soft/60 text-paper";

  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[13px] ${tone}`} role="status" aria-live="polite">
      <SpeakingBars active={phase === "investor_speaking" && stage === "live"} />
      {label}
    </span>
  );
}

/** Hlavná plocha: posledná replika investora veľkým pätkovým písmom. */
export function InvestorStage({
  investorName,
  line,
  phase,
  stage,
  founderPartial,
  delivery,
}: {
  investorName: string;
  line: string | null;
  phase: Phase;
  stage: Stage;
  founderPartial: string | null;
  delivery: boolean;
}) {
  const thinking = phase === "investor_thinking" || phase === "processing";
  return (
    <div className="flex min-h-[18rem] flex-col justify-between gap-8 md:min-h-[24rem]">
      <div>
        <p className="text-[14px] text-faint">{delivery ? "Prednes pitchu" : investorName}</p>
        {delivery ? (
          <p className="type-investor mt-4 max-w-[34rem] text-[clamp(1.6rem,1.2rem+1.4vw,2.4rem)] leading-[1.25] text-paper/90">
            {stage === "live" ? "Odprezentuj celý pitch. Investor počúva a nevstupuje do toho." : "Keď začneš, spustí sa čas."}
          </p>
        ) : line ? (
          <p
            aria-live="polite"
            className={`type-investor mt-4 max-w-[38rem] text-[clamp(1.55rem,1.15rem+1.5vw,2.45rem)] leading-[1.28] transition-opacity duration-300 ${
              thinking ? "opacity-55" : "opacity-100"
            }`}
          >
            {line}
          </p>
        ) : (
          <p className="type-investor mt-4 text-[clamp(1.4rem,1.1rem+1vw,2rem)] text-mute">
            {stage === "live" || stage === "connecting" ? "Investor si prechádza tvoje podklady…" : "Rozhovor ešte nezačal."}
          </p>
        )}
      </div>

      {phase === "founder_speaking" || founderPartial ? (
        <div className="border-l-2 border-signal/70 pl-4">
          <p className="text-[13px] text-faint">Ty</p>
          <p className="mt-1 max-w-[38rem] text-[1.05rem] leading-relaxed text-paper/80">
            {founderPartial?.trim() || "Hovoríš…"}
          </p>
        </div>
      ) : null}
    </div>
  );
}
