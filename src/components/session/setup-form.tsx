"use client";

import Link from "next/link";
import { useActionState, useId, useMemo, useState } from "react";
import { buttonClasses } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  COACH_FOCUS_LABELS,
  COACH_FOCUS_OPTIONS,
  TRAINING_MODES,
  TRAINING_MODE_DESCRIPTIONS,
  TRAINING_MODE_LABELS,
  type CoachFocus,
  type TrainingMode,
} from "@/lib/domain/labels";
import { INVESTOR_KEYS, INVESTOR_STYLES, SCENARIOS, scenariosForMode, type InvestorKey, type ScenarioKey } from "@/lib/investor/catalog";
import type { FormState } from "@/lib/projects/actions";
import { createTrainingSessionAction } from "@/lib/session/actions";

export type SetupDefaults = {
  projectId: string | null;
  mode: TrainingMode;
  investorKey: InvestorKey;
  scenarioKey: ScenarioKey | null;
  coachFocus: CoachFocus[];
  previousSessionId: string | null;
  exerciseId: string | null;
};

function Choice({
  name,
  value,
  checked,
  onChange,
  title,
  description,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  title: string;
  description: string;
}) {
  return (
    <label
      className={`relative flex cursor-pointer flex-col gap-1.5 rounded-[12px] border p-4 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-signal-soft ${
        checked ? "border-signal bg-signal/[0.08]" : "border-line-strong hover:border-signal-soft/60"
      }`}
    >
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="sr-only" />
      <span className="flex items-center justify-between gap-3">
        <span className="font-semibold text-paper">{title}</span>
        <span
          aria-hidden="true"
          className={`size-4 shrink-0 rounded-full border-2 ${checked ? "border-signal bg-signal shadow-[inset_0_0_0_2px_var(--color-ink)]" : "border-line-strong"}`}
        />
      </span>
      <span className="text-[14px] leading-snug text-mute">{description}</span>
    </label>
  );
}

function Step({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line/70 py-8">
      <h2 className="type-heading text-[1.3rem]">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function SetupForm({
  projects,
  defaults,
  realtimeAvailable,
  textAvailable,
  remainingMinutes,
  maxSessionMinutes,
  exerciseTitle,
  previewRoomHref,
}: {
  projects: Array<{ id: string; name: string }>;
  defaults: SetupDefaults;
  realtimeAvailable: boolean;
  textAvailable: boolean;
  remainingMinutes: number;
  maxSessionMinutes: number;
  exerciseTitle: string | null;
  /** Vývojová ukážka: tlačidlo vedie do ukážkovej miestnosti, nič sa neukladá. */
  previewRoomHref?: string;
}) {
  const [state, action] = useActionState(createTrainingSessionAction, { status: "idle" } as FormState);
  const [mode, setMode] = useState<TrainingMode>(defaults.mode);
  const [investor, setInvestor] = useState<InvestorKey>(defaults.investorKey);
  const scenarios = useMemo(() => scenariosForMode(mode), [mode]);
  const [scenarioKey, setScenarioKey] = useState<ScenarioKey>(
    defaults.scenarioKey && SCENARIOS[defaults.scenarioKey].modes.includes(defaults.mode)
      ? defaults.scenarioKey
      : scenariosForMode(defaults.mode)[0].key,
  );
  const scenario = SCENARIOS[scenarioKey].modes.includes(mode) ? SCENARIOS[scenarioKey] : scenarios[0];
  const [minutes, setMinutes] = useState<number>(scenario.defaultMinutes);
  const [transport, setTransport] = useState<"realtime" | "text">(realtimeAvailable && remainingMinutes > 0 ? "realtime" : "text");
  const [camera, setCamera] = useState(false);
  const id = useId();

  const chooseMode = (next: TrainingMode) => {
    setMode(next);
    const first = scenariosForMode(next)[0];
    setScenarioKey(first.key);
    setMinutes(first.defaultMinutes);
    if (next === "delivery") setTransport("realtime");
  };

  const chooseScenario = (key: ScenarioKey) => {
    setScenarioKey(key);
    setMinutes(SCENARIOS[key].defaultMinutes);
  };

  const voiceBlocked = !realtimeAvailable || remainingMinutes <= 0;
  const effectiveMinutes = Math.min(minutes, maxSessionMinutes);

  return (
    <form action={action} noValidate>
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="scenarioKey" value={scenario.key} />
      <input type="hidden" name="investorKey" value={investor} />
      <input type="hidden" name="transport" value={transport} />
      {defaults.previousSessionId ? <input type="hidden" name="previousSessionId" value={defaults.previousSessionId} /> : null}
      {defaults.exerciseId ? <input type="hidden" name="exerciseId" value={defaults.exerciseId} /> : null}

      {state.status === "error" && state.message ? (
        <Notice tone="error" className="mb-6">
          {state.message}
        </Notice>
      ) : null}
      {exerciseTitle ? (
        <Notice tone="info" className="mb-6">
          Tréning patrí k cvičeniu „{exerciseTitle}“.
        </Notice>
      ) : null}
      {defaults.previousSessionId ? (
        <Notice tone="info" className="mb-6">
          Nadväzuje na predchádzajúci tréning, aby sa dali pokusy porovnať.
        </Notice>
      ) : null}

      <section className="py-2">
        <Field id={`${id}-project`} label="Za ktorý startup hovoríš">
          <Select id={`${id}-project`} name="projectId" defaultValue={defaults.projectId ?? projects[0]?.id}>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </Select>
        </Field>
      </section>

      <Step title="Režim">
        <div className="grid gap-3 md:grid-cols-3">
          {TRAINING_MODES.map((option) => (
            <Choice
              key={option}
              name="mode-choice"
              value={option}
              checked={mode === option}
              onChange={() => chooseMode(option)}
              title={TRAINING_MODE_LABELS[option]}
              description={TRAINING_MODE_DESCRIPTIONS[option]}
            />
          ))}
        </div>
      </Step>

      {mode !== "delivery" ? (
        <Step title="Investor">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {INVESTOR_KEYS.map((key) => (
              <Choice
                key={key}
                name="investor-choice"
                value={key}
                checked={investor === key}
                onChange={() => setInvestor(key)}
                title={INVESTOR_STYLES[key].name}
                description={INVESTOR_STYLES[key].summary}
              />
            ))}
          </div>
        </Step>
      ) : null}

      <Step title={mode === "delivery" ? "Dĺžka pitchu" : "Stretnutie"}>
        <div className="grid gap-3 md:grid-cols-2">
          {scenarios.map((option) => (
            <Choice
              key={option.key}
              name="scenario-choice"
              value={option.key}
              checked={scenario.key === option.key}
              onChange={() => chooseScenario(option.key)}
              title={option.name}
              description={option.description}
            />
          ))}
        </div>
        {scenario.allowedMinutes.length > 1 ? (
          <fieldset className="mt-6">
            <legend className="text-sm font-medium text-paper">Dĺžka tréningu</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {scenario.allowedMinutes.map((value) => {
                const overPlan = value > maxSessionMinutes;
                return (
                  <label
                    key={value}
                    className={`cursor-pointer rounded-full border px-4 py-2 text-sm transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-signal-soft ${
                      minutes === value ? "border-signal bg-signal/10 text-paper" : "border-line-strong text-mute hover:text-paper"
                    } ${overPlan ? "opacity-50" : ""}`}
                  >
                    <input
                      type="radio"
                      name="durationMinutes"
                      value={value}
                      checked={minutes === value}
                      onChange={() => setMinutes(value)}
                      disabled={overPlan}
                      className="sr-only"
                    />
                    {value} min
                  </label>
                );
              })}
            </div>
            {scenario.allowedMinutes.some((value) => value > maxSessionMinutes) ? (
              <p className="mt-2 text-[13px] text-faint">Dlhšie tréningy sú dostupné v pláne Pro.</p>
            ) : null}
          </fieldset>
        ) : (
          <input type="hidden" name="durationMinutes" value={minutes} />
        )}
      </Step>

      {mode === "coach" ? (
        <Step title="Na čo sa chceš sústrediť">
          <p className="-mt-2 mb-4 max-w-[40rem] text-[14.5px] leading-relaxed text-mute">
            Počas tréningu dostaneš jemné upozornenia iba na to, čo vyberieš. Odporúčame jednu až dve veci naraz.
          </p>
          <div className="flex flex-wrap gap-2">
            {COACH_FOCUS_OPTIONS.map((focus) => (
              <label
                key={focus}
                className="cursor-pointer rounded-full border border-line-strong px-4 py-2 text-sm text-mute transition-colors has-[:checked]:border-signal has-[:checked]:bg-signal/10 has-[:checked]:text-paper has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-signal-soft"
              >
                <input
                  type="checkbox"
                  name="coachFocus"
                  value={focus}
                  defaultChecked={defaults.coachFocus.includes(focus)}
                  className="sr-only"
                />
                {COACH_FOCUS_LABELS[focus]}
              </label>
            ))}
          </div>
        </Step>
      ) : null}

      <Step title="Ako budeš hovoriť">
        <div className="grid gap-3 md:grid-cols-2">
          <Choice
            name="transport-choice"
            value="realtime"
            checked={transport === "realtime"}
            onChange={() => !voiceBlocked && setTransport("realtime")}
            title="Hlasom"
            description={
              !realtimeAvailable
                ? "Hlasový režim teraz nie je dostupný."
                : remainingMinutes <= 0
                  ? "Minúty hlasového tréningu sú na tento mesiac vyčerpané."
                  : `Investor hovorí a počúva cez mikrofón. Zostáva ti ${remainingMinutes} min tento mesiac.`
            }
          />
          {mode !== "delivery" ? (
            <Choice
              name="transport-choice"
              value="text"
              checked={transport === "text"}
              onChange={() => textAvailable && setTransport("text")}
              title="Textom"
              description={
                textAvailable
                  ? "Píšeš odpovede, investor odpovedá textom. Bez merania hlasu a tempa."
                  : "Textový režim teraz nie je dostupný."
              }
            />
          ) : null}
        </div>

        {transport === "realtime" ? (
          <label className="mt-6 flex items-start gap-3 rounded-[12px] border border-line-strong p-4">
            <input
              type="checkbox"
              name="cameraEnabled"
              checked={camera}
              onChange={(event) => setCamera(event.target.checked)}
              className="mt-0.5 size-[18px] shrink-0 accent-signal"
            />
            <span>
              <span className="font-medium text-paper">Zapnúť aj kameru (voliteľné)</span>
              <span className="mt-1 block text-[14px] leading-relaxed text-mute">
                Kamera sleduje iba polohu v zábere, natočenie hlavy a viditeľnú gestikuláciu. Spracovanie beží v tvojom prehliadači, video sa nikam neposiela ani neukladá. Pred spustením ešte potvrdíš súhlas.
              </span>
            </span>
          </label>
        ) : null}
      </Step>

      <div className="flex flex-col gap-3 border-t border-line/70 pt-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-faint">
          {transport === "realtime" ? `Tréning potrvá najviac ${effectiveMinutes} min.` : "Textový tréning môžeš ukončiť kedykoľvek."}
        </p>
        {previewRoomHref ? (
          <Link href={previewRoomHref} className={buttonClasses({ size: "lg" })}>
            Pripraviť tréning
          </Link>
        ) : (
        <SubmitButton
          pendingLabel="Pripravujem miestnosť…"
          size="lg"
          disabled={projects.length === 0 || (transport === "realtime" ? voiceBlocked : !textAvailable)}
        >
          Pripraviť tréning
        </SubmitButton>
        )}
      </div>
    </form>
  );
}
