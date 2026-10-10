"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { LogoMark } from "@/components/wordmark";
import { buttonClasses } from "@/components/ui/button";
import { Spinner } from "@/components/ui/submit-button";
import { siteConfig } from "@/config/site";
import { STAGES, STAGE_LABELS, TRAINING_MODE_LABELS, type Stage } from "@/lib/domain/labels";
import { INVESTOR_STYLES, SCENARIOS } from "@/lib/investor/catalog";
import { skipOnboarding, submitOnboarding } from "@/lib/onboarding/actions";
import { previewHref } from "@/lib/preview/links";
import {
  EXPERIENCE_LABELS,
  EXPERIENCE_LEVELS,
  MEETING_LABELS,
  MEETING_TIMINGS,
  RAISE_LABELS,
  RAISE_RANGES,
  WORRIES,
  WORRY_LABELS,
  buildTrainingPlan,
  firstSessionHref,
  type ExperienceLevel,
  type MeetingTiming,
  type OnboardingAnswers,
  type RaiseRange,
  type TrainingPlan,
  type Worry,
} from "@/lib/onboarding/plan";

type Draft = {
  stage?: Stage;
  raise?: RaiseRange;
  meeting?: MeetingTiming;
  worries: Worry[];
  experience?: ExperienceLevel;
  startupName: string;
};

type Option<T extends string> = { value: T; label: string; hint?: string };

const STAGE_HINTS: Partial<Record<Stage, string>> = {
  idea: "Overujem nápad, ešte nemám produkt",
  pre_seed: "Prvá verzia produktu, prví používatelia",
  seed: "Produkt na trhu, prví platiaci zákazníci",
  series_a: "Rastieme a škálujeme",
};

const options = <T extends string>(values: readonly T[], labels: Record<T, string>, hints: Partial<Record<T, string>> = {}): Option<T>[] =>
  values.map((value) => ({ value, label: labels[value], hint: hints[value] }));

const STEP_COUNT = 6;

const BUILD_LINES = [
  "Fáza startupu a cieľ kola",
  "Termín najbližšieho stretnutia",
  "Tvoje slabé miesta",
  "Výber investora pre prvý tréning",
];

function OptionButton({
  selected,
  onClick,
  label,
  hint,
  multi = false,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  hint?: string;
  multi?: boolean;
}) {
  return (
    <button
      type="button"
      role={multi ? "checkbox" : "radio"}
      aria-checked={selected}
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3.5 text-left transition-colors ${
        selected ? "border-signal bg-signal/10" : "border-line bg-panel hover:border-line-strong hover:bg-panel-2"
      }`}
    >
      <span
        aria-hidden="true"
        className={`inline-flex size-[18px] shrink-0 items-center justify-center border ${multi ? "rounded" : "rounded-full"} ${
          selected ? "border-signal bg-signal text-white" : "border-line-strong"
        }`}
      >
        {selected ? (
          <svg viewBox="0 0 16 16" className="size-3">
            <path d="m3.5 8.5 3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-medium text-paper">{label}</span>
        {hint ? <span className="mt-0.5 block text-sm text-mute">{hint}</span> : null}
      </span>
    </button>
  );
}

function Question({ step, title, hint, children }: { step: number; title: string; hint?: string; children: React.ReactNode }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), [step]);
  return (
    <div key={step} className="fade-up">
      <p className="text-sm text-mute">
        Otázka {step + 1} z {STEP_COUNT}
      </p>
      <h1 ref={headingRef} tabIndex={-1} className="type-display mt-2 text-[1.75rem] outline-none md:text-[2rem]">
        {title}
      </h1>
      {hint ? <p className="mt-2 text-[15px] text-mute">{hint}</p> : null}
      <div className="mt-7">{children}</div>
    </div>
  );
}

function BuildingPlan({ done }: { done: number }) {
  return (
    <div className="fade-up" role="status" aria-live="polite">
      <Spinner className="size-6 text-signal-soft" />
      <h1 className="type-display mt-5 text-[1.75rem] md:text-[2rem]">Skladám tvoj plán tréningu…</h1>
      <ul className="mt-7 space-y-3">
        {BUILD_LINES.map((line, index) => (
          <li key={line} className={`flex items-center gap-3 text-[15px] transition-colors ${index < done ? "text-paper" : "text-faint"}`}>
            <span
              aria-hidden="true"
              className={`inline-flex size-5 items-center justify-center rounded-full border ${
                index < done ? "border-mint bg-mint/15 text-mint" : "border-line-strong"
              }`}
            >
              {index < done ? (
                <svg viewBox="0 0 16 16" className="size-3">
                  <path d="m3.5 8.5 3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : null}
            </span>
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PlanView({
  plan,
  projectId,
  startupName,
  freeMinutes,
  href,
}: {
  plan: TrainingPlan;
  projectId: string;
  startupName: string;
  freeMinutes: number;
  href: (path: string) => string;
}) {
  const investor = INVESTOR_STYLES[plan.firstSession.investorKey];
  const scenario = SCENARIOS[plan.firstSession.scenarioKey];
  return (
    <div className="fade-up">
      <p className="text-sm font-medium text-mint">Plán je pripravený</p>
      <h1 className="type-display mt-2 text-[1.75rem] md:text-[2.25rem]">Tvoj plán pre {startupName} {plan.horizon}</h1>

      <dl className="mt-7 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-line bg-panel px-4 py-3.5">
          <dt className="text-sm text-mute">Tréningy s investorom</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">{plan.sessions}</dd>
        </div>
        <div className="rounded-lg border border-line bg-panel px-4 py-3.5">
          <dt className="text-sm text-mute">Cielené cvičenia</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">{plan.exercises}</dd>
        </div>
      </dl>

      <div className="mt-6">
        <h2 className="text-sm font-medium text-mute">Zameriame sa na</h2>
        <ul className="mt-2 flex flex-wrap gap-2">
          {plan.focus.map((worry) => (
            <li key={worry} className="rounded-full border border-line-strong px-3 py-1 text-sm text-paper">
              {WORRY_LABELS[worry]}
            </li>
          ))}
        </ul>
      </div>

      <ol className="mt-7 space-y-4 border-l border-line pl-5">
        {plan.steps.map((step, index) => (
          <li key={step.title} className="relative">
            <span
              aria-hidden="true"
              className="absolute top-0.5 -left-[31px] inline-flex size-5 items-center justify-center rounded-full border border-line-strong bg-ink text-[11px] text-mute"
            >
              {index + 1}
            </span>
            <p className="font-medium text-paper">{step.title}</p>
            <p className="mt-0.5 text-sm leading-relaxed text-mute">{step.detail}</p>
          </li>
        ))}
      </ol>

      <div className="mt-8 rounded-lg border border-line bg-panel px-5 py-4">
        <p className="text-sm text-mute">Prvý tréning</p>
        <p className="mt-1 font-medium text-paper">{investor.name}</p>
        <p className="mt-0.5 text-sm text-mute">
          {scenario.name} · {TRAINING_MODE_LABELS[plan.firstSession.mode]} · {scenario.defaultMinutes} min
        </p>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link href={href(firstSessionHref(plan, projectId))} className={buttonClasses({ size: "lg", className: "sm:flex-1" })}>
          Začať bezplatný tréning
        </Link>
        <Link href={href(`/app/projekty/${projectId}/podklady?novy=1`)} className={buttonClasses({ variant: "secondary", size: "lg" })}>
          Najprv nahrať pitch deck
        </Link>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-faint">
        Free plán má {freeMinutes} minút hlasového tréningu mesačne. Na celý plán pred stretnutím s rezervou stačí plán{" "}
        <Link href={href("/app/nastavenia#plan")} className="text-mute underline underline-offset-2 hover:text-paper">
          Pro
        </Link>
        .
      </p>
    </div>
  );
}

/** `preview`: vývojová ukážka bez účtu; nič neukladá, odkazy vedú do /ukazka. */
export function OnboardingQuiz({ freeMinutes, preview = false }: { freeMinutes: number; preview?: boolean }) {
  const href = preview ? previewHref : (path: string) => path;
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>({ worries: [], startupName: "" });
  const [phase, setPhase] = useState<"quiz" | "building" | "plan">("quiz");
  const [buildDone, setBuildDone] = useState(0);
  const [result, setResult] = useState<{ projectId: string; plan: TrainingPlan } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [skipping, startSkip] = useTransition();
  const advanceTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
  }, []);

  // Animácia skladania plánu: riadky sa odškrtávajú postupne; plán sa ukáže, až keď je uložený.
  useEffect(() => {
    if (phase !== "building") return;
    if (buildDone < BUILD_LINES.length) {
      const id = window.setTimeout(() => setBuildDone((value) => value + 1), 550);
      return () => window.clearTimeout(id);
    }
    if (result) {
      const id = window.setTimeout(() => setPhase("plan"), 350);
      return () => window.clearTimeout(id);
    }
  }, [phase, buildDone, result]);

  const pick = <K extends "stage" | "raise" | "meeting" | "experience">(key: K, value: NonNullable<Draft[K]>) => {
    setDraft((current) => ({ ...current, [key]: value }));
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    advanceTimer.current = window.setTimeout(() => setStep((current) => Math.min(current + 1, STEP_COUNT - 1)), 220);
  };

  const toggleWorry = (worry: Worry) =>
    setDraft((current) => ({
      ...current,
      worries: current.worries.includes(worry) ? current.worries.filter((item) => item !== worry) : [...current.worries, worry],
    }));

  const submit = () => {
    const { stage, raise, meeting, experience, worries, startupName } = draft;
    if (!stage || !raise || !meeting || !experience || worries.length === 0) {
      setError("Niektorá odpoveď chýba. Vráť sa a doplň ju.");
      return;
    }
    if (!startupName.trim()) {
      setError("Zadaj názov startupu.");
      return;
    }
    const answers: OnboardingAnswers = { stage, raise, meeting, experience, worries };
    setError(null);
    setBuildDone(0);
    setPhase("building");
    if (preview) {
      setResult({ projectId: "ukazka", plan: buildTrainingPlan(answers) });
      return;
    }
    startTransition(async () => {
      const response = await submitOnboarding({ ...answers, startupName });
      if (response.status === "ok") {
        setResult({ projectId: response.projectId, plan: buildTrainingPlan(answers) });
      } else {
        setError(response.message);
        setPhase("quiz");
      }
    });
  };

  const progress = phase === "quiz" ? (step / STEP_COUNT) * 100 : 100;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 sm:px-6">
          <span className="inline-flex items-center gap-2 text-[15px] font-semibold">
            <LogoMark className="size-7" />
            {siteConfig.name}
          </span>
          {phase === "quiz" && preview ? (
            <Link href={href("/app")} className="rounded-md px-2 py-1 text-sm text-mute hover:text-paper">
              Preskočiť
            </Link>
          ) : phase === "quiz" ? (
            <button
              type="button"
              disabled={skipping}
              onClick={() => startSkip(() => skipOnboarding())}
              className="rounded-md px-2 py-1 text-sm text-mute hover:text-paper"
            >
              {skipping ? "Preskakujem…" : "Preskočiť"}
            </button>
          ) : null}
        </div>
        <div className="h-0.5 bg-line" aria-hidden="true">
          <div className="h-full bg-signal transition-[width] duration-300 ease-out" style={{ width: `${progress}%` }} />
        </div>
      </header>

      <main id="obsah" className="mx-auto w-full max-w-xl flex-1 px-4 py-10 sm:px-6 md:py-16">
        {phase === "building" ? <BuildingPlan done={buildDone} /> : null}
        {phase === "plan" && result ? (
          <PlanView plan={result.plan} projectId={result.projectId} startupName={draft.startupName.trim()} freeMinutes={freeMinutes} href={href} />
        ) : null}

        {phase === "quiz" ? (
          <>
            {step === 0 ? (
              <Question step={0} title="V akej fáze je tvoj startup?" hint="Podľa toho prispôsobíme otázky investora.">
                <div role="radiogroup" className="space-y-2.5">
                  {options(STAGES, STAGE_LABELS, STAGE_HINTS).map((option) => (
                    <OptionButton key={option.value} {...option} selected={draft.stage === option.value} onClick={() => pick("stage", option.value)} />
                  ))}
                </div>
              </Question>
            ) : null}
            {step === 1 ? (
              <Question step={1} title="Koľko plánuješ získať?" hint="Stačí približne. Investor sa na to určite opýta.">
                <div role="radiogroup" className="space-y-2.5">
                  {options(RAISE_RANGES, RAISE_LABELS).map((option) => (
                    <OptionButton key={option.value} {...option} selected={draft.raise === option.value} onClick={() => pick("raise", option.value)} />
                  ))}
                </div>
              </Question>
            ) : null}
            {step === 2 ? (
              <Question step={2} title="Kedy máš najbližšie stretnutie s investorom?" hint="Plán rozložíme tak, aby si bol pripravený včas.">
                <div role="radiogroup" className="space-y-2.5">
                  {options(MEETING_TIMINGS, MEETING_LABELS).map((option) => (
                    <OptionButton key={option.value} {...option} selected={draft.meeting === option.value} onClick={() => pick("meeting", option.value)} />
                  ))}
                </div>
              </Question>
            ) : null}
            {step === 3 ? (
              <Question step={3} title="Čoho sa na stretnutí obávaš najviac?" hint="Vyber všetko, čo platí.">
                <div className="space-y-2.5">
                  {options(WORRIES, WORRY_LABELS).map((option) => (
                    <OptionButton
                      key={option.value}
                      multi
                      {...option}
                      selected={draft.worries.includes(option.value)}
                      onClick={() => toggleWorry(option.value)}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  disabled={draft.worries.length === 0}
                  onClick={() => setStep(4)}
                  className={buttonClasses({ size: "lg", className: "mt-6 w-full" })}
                >
                  Pokračovať
                </button>
              </Question>
            ) : null}
            {step === 4 ? (
              <Question step={4} title="Pitchoval si už investorom?">
                <div role="radiogroup" className="space-y-2.5">
                  {options(EXPERIENCE_LEVELS, EXPERIENCE_LABELS).map((option) => (
                    <OptionButton
                      key={option.value}
                      {...option}
                      selected={draft.experience === option.value}
                      onClick={() => pick("experience", option.value)}
                    />
                  ))}
                </div>
              </Question>
            ) : null}
            {step === 5 ? (
              <Question step={5} title="Ako sa volá tvoj startup?" hint="Vytvoríme z neho tvoj prvý projekt. Podklady doplníš kedykoľvek.">
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    submit();
                  }}
                >
                  <label htmlFor="startup-name" className="sr-only">
                    Názov startupu
                  </label>
                  <input
                    id="startup-name"
                    autoFocus
                    maxLength={120}
                    value={draft.startupName}
                    onChange={(event) => setDraft((current) => ({ ...current, startupName: event.target.value }))}
                    placeholder="Napr. Faktúrka"
                    className="h-12 w-full rounded-lg border border-line-strong bg-panel px-4 text-[15px] text-paper outline-none placeholder:text-faint focus:border-signal-soft"
                  />
                  <button type="submit" disabled={pending || !draft.startupName.trim()} className={buttonClasses({ size: "lg", className: "mt-6 w-full" })}>
                    Vytvoriť môj plán
                  </button>
                </form>
              </Question>
            ) : null}

            {error ? (
              <p role="alert" className="mt-5 text-sm text-coral">
                {error}
              </p>
            ) : null}

            {step > 0 ? (
              <button type="button" onClick={() => setStep((current) => current - 1)} className="mt-8 text-sm text-mute hover:text-paper">
                ← Späť
              </button>
            ) : null}
          </>
        ) : null}
      </main>
    </div>
  );
}
