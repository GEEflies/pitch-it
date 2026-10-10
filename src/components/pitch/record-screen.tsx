"use client";

import "@/styles/screens/record.css";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PI_BACKGROUND, PiTopbar } from "@/components/pitch/pi-topbar";
import { uploadPitch, usePitchRecorder, type RecorderSetup } from "@/components/pitch/use-recorder";
import { AUDIENCE_LABELS } from "@/lib/onboarding/plan";

/*
  „2 · Nahrávanie a analýza“ 1:1 podľa dizajnu: pripravenosť a súhlas → odpočet →
  nahrávanie s časovačom → analýza v štyroch krokoch → feedback.
*/

type Phase = "ready" | "count" | "rec" | "analyze";

const STEPS = [
  ["Prepis reči", "Whisper, vrátane časových značiek"],
  ["Tempo a pauzy", "Slabiky za sekundu a pauzy nad 1 s"],
  ["Vypĺňacie slová", "Hľadáme akože, vlastne, ehm a podobne"],
  ["Obsahové skóre", "Problém, Riešenie, Trh, Traction a Ask"],
] as const;

function bars(n: number, live: boolean) {
  return Array.from({ length: n }, (_, i) => ({
    h: live ? 30 + Math.round(90 * Math.abs(Math.sin(i * 0.7) * Math.cos(i * 0.23))) : 8 + (i % 5) * 3,
    d: ((i * 0.13) % 1).toFixed(2),
  }));
}
const IDLE = bars(30, false);
const LIVE = bars(40, true);

const mmss = (x: number) => `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`;

export function RecordScreen({
  setup,
  cameraHref,
  drillsHref,
  feedbackHref,
  preview = false,
}: {
  setup: RecorderSetup;
  cameraHref: string;
  /** Cvičenia reči tela pred kamerou. */
  drillsHref?: string;
  /** Kam viesť po analýze; `{id}` sa nahradí id pokusu. */
  feedbackHref: string;
  preview?: boolean;
}) {
  const recorder = usePitchRecorder();
  const { open } = recorder;
  const [phase, setPhase] = useState<Phase>("ready");
  const [consent, setConsent] = useState(false);
  const [hint, setHint] = useState(false);
  const [cnt, setCnt] = useState(3);
  const [left, setLeft] = useState<number>(setup.targetSeconds);
  const [k, setK] = useState(0);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const finishing = useRef(false);

  useEffect(() => {
    if (!preview) void open();
  }, [open, preview]);

  const finish = async () => {
    if (finishing.current) return;
    finishing.current = true;
    setPhase("analyze");
    setK(0);
    if (preview) return;
    const recording = await recorder.stop();
    recorder.release();
    if (!recording) {
      setError("Nahrávka sa nezachytila. Skús to znova.");
      return;
    }
    const result = await uploadPitch(recording, setup, null);
    if (result.ok) {
      setAttemptId(result.attemptId);
      setK(4);
    } else setError(result.message);
  };

  // Jeden tik za sekundu, ako v dizajne. Interval beží stabilne počas fázy,
  // časté prekreslenia (napr. meradlo mikrofónu) ho nesmú resetovať;
  // logika tiku sa číta cez ref, aby videla aktuálny stav.
  const tickRef = useRef<() => void>(() => {});
  useEffect(() => {
    tickRef.current = () => {
      if (phase === "count") {
        if (cnt <= 1) {
          if (!preview) recorder.start();
          setPhase("rec");
          setLeft(setup.targetSeconds);
        } else setCnt(cnt - 1);
      } else if (phase === "rec") {
        if (left <= 1) void finish();
        else setLeft(left - 1);
      } else if (phase === "analyze" && !error) {
        // Kroky analýzy postupujú, posledný sa uzavrie až po odpovedi servera.
        setK((value) => (preview ? Math.min(4, value + 1) : attemptId ? 4 : Math.min(3, value + 1)));
      }
    };
  });
  useEffect(() => {
    if (phase === "ready") return;
    const timer = setInterval(() => tickRef.current(), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  const start = () => {
    if (!consent) {
      setHint(true);
      return;
    }
    if (!preview && recorder.media !== "ready") {
      setHint(true);
      return;
    }
    finishing.current = false;
    setCnt(3);
    setPhase("count");
  };

  const retry = () => {
    setError(null);
    setAttemptId(null);
    setPhase("ready");
    setLeft(setup.targetSeconds);
    finishing.current = false;
    void open();
  };

  const done = k >= 4 && (preview || attemptId);
  const pct = Math.round((100 * (setup.targetSeconds - left)) / setup.targetSeconds);
  const micText =
    preview || recorder.media === "ready"
      ? "Mikrofón je zapnutý. Povedz niečo, mala by sa pohnúť vlna."
      : recorder.media === "denied"
        ? "Prístup k mikrofónu je zamietnutý. Povoľ ho v nastaveniach prehliadača a obnov stránku."
        : recorder.media === "unsupported"
          ? "Tento prehliadač nevie nahrávať. Skús Chrome, Edge alebo Safari."
          : "Zapínam mikrofón…";
  const hintText = hint ? (consent ? "Najprv povoľ prístup k mikrofónu." : "Pred nahrávaním prosím potvrď súhlas.") : "";

  return (
    <div className="pi-rec" style={{ background: PI_BACKGROUND, color: "var(--color-paper)", minHeight: "100dvh" }}>
      <PiTopbar />
      <main id="obsah" style={{ display: "flex", flexWrap: "wrap", gap: "32px", justifyContent: "center", padding: "40px 32px" }}>
        <div className="card" style={{ flex: "1 1 640px", maxWidth: "860px", minWidth: "0", padding: "32px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: "20px" }}>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <span className="chip">{AUDIENCE_LABELS[setup.audience]}</span>
              <span className="chip">{setup.targetSeconds} s</span>
              <span className="chip">Slovenčina</span>
            </div>
            <span className="chip">Cieľ: 3,5 až 5 slabík za sekundu</span>
          </div>

          {phase === "ready" ? (
            <>
              <h1 className="h" style={{ fontSize: "40px", margin: "8px 0 12px" }}>
                Si pripravený?
              </h1>
              <p className="muted" style={{ fontSize: "17px", lineHeight: "1.55", margin: "0 0 24px" }}>
                Odstúp od notebooku a over, že ťa appka počuje. Hovor tak, ako budeš pitchovať naživo.
              </p>
              <div className="bars" aria-hidden="true">
                {IDLE.map((b, i) => (
                  <i key={i} style={{ height: `${Math.round(b.h * (1 + recorder.level * 5 * (0.6 + 0.4 * Math.abs(Math.sin(i * 1.3)))))}px`, transition: "height .08s linear" }} />
                ))}
              </div>
              <div style={{ textAlign: "center", fontSize: "14px", margin: "6px 0 24px" }} className="muted" role="status">
                {micText}
              </div>
              <label style={{ display: "flex", gap: "12px", alignItems: "flex-start", fontSize: "15px", lineHeight: "1.5", marginBottom: "24px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={() => {
                    setConsent(!consent);
                    setHint(false);
                  }}
                  style={{ marginTop: "3px", width: "20px", height: "20px", accentColor: "var(--color-signal)" }}
                />
                Súhlasím, že môj pitch bude analyzovaný AI a výsledky budú viditeľné mentorom tejto akcie.
              </label>
              <button className="btn btn-p" type="button" onClick={start} style={{ width: "100%", minHeight: "54px", opacity: consent ? 1 : 0.45 }}>
                Spustiť nahrávanie
              </button>
              <div role="alert" style={{ textAlign: "center", marginTop: "12px", fontSize: "13px", height: "18px", color: "var(--color-marker)" }}>
                {hintText}
              </div>
              <div style={{ textAlign: "center", marginTop: "8px" }}>
                <Link href={cameraHref} style={{ fontSize: "14px", color: "var(--color-accent)", fontWeight: 700 }}>
                  Nahrávať s kamerou a rečou tela
                </Link>
                {drillsHref ? (
                  <>
                    <span className="muted" style={{ margin: "0 10px" }} aria-hidden="true">
                      ·
                    </span>
                    <Link href={drillsHref} style={{ fontSize: "14px", color: "var(--color-violet-soft)", fontWeight: 700 }}>
                      Cvičenia reči tela
                    </Link>
                  </>
                ) : null}
              </div>
            </>
          ) : null}

          {phase === "count" ? (
            <div style={{ textAlign: "center", padding: "60px 0" }} aria-live="assertive">
              <div className="muted" style={{ fontSize: "17px" }}>
                Nahrávanie sa spustí o
              </div>
              <div
                key={cnt}
                className="h cnt"
                style={{
                  fontSize: "180px",
                  lineHeight: "1.1",
                  background: "linear-gradient(135deg,#D2FF6B,var(--color-violet))",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                {cnt}
              </div>
            </div>
          ) : null}

          {phase === "rec" ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "8px 0 24px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", fontWeight: 700 }}>
                  <span className="rd" style={{ width: "12px", height: "12px", borderRadius: "50%", background: "var(--color-danger)" }} />
                  Nahrávam
                </div>
                <div className="h" style={{ fontSize: "48px" }} aria-label={`Zostáva ${left} sekúnd`}>
                  {mmss(left)}
                </div>
              </div>
              <div className="bars live" aria-hidden="true">
                {LIVE.map((b, i) => (
                  <i key={i} style={{ height: `${b.h}px`, animationDelay: `${b.d}s` }} />
                ))}
              </div>
              <div style={{ height: "8px", borderRadius: "4px", background: "var(--color-line)", margin: "24px 0", overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    borderRadius: "4px",
                    background: "linear-gradient(90deg,var(--color-violet),var(--color-signal))",
                    width: `${pct}%`,
                    transition: "width 1s linear",
                  }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <button className="btn btn-p" type="button" onClick={() => void finish()} style={{ minWidth: "240px" }}>
                  Skončiť pitch
                </button>
              </div>
              <div className="muted" style={{ textAlign: "center", marginTop: "14px", fontSize: "13px" }}>
                Po skončení sa nahrávka odošle na analýzu automaticky.
              </div>
            </>
          ) : null}

          {phase === "analyze" ? (
            <>
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
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
}
