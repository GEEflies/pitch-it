"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { demoScenarios, type DemoAnswer } from "@/content/demo";
import { TypingDots } from "@/components/ui/typing-dots";

const ease = [0.25, 1, 0.5, 1] as const;
const THINKING_MS = 950;

type Phase = "idle" | "thinking" | "answered";

export function Demo() {
  const baseId = useId();
  const prefersReducedMotion = useReducedMotion();
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [answerId, setAnswerId] = useState<DemoAnswer["id"] | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const responseRef = useRef<HTMLDivElement>(null);

  const scenario = demoScenarios[scenarioIndex];
  const answer = scenario.answers.find((item) => item.id === answerId) ?? null;

  useEffect(() => {
    if (phase !== "thinking") return;
    const timer = window.setTimeout(
      () => setPhase("answered"),
      prefersReducedMotion ? 0 : THINKING_MS,
    );
    return () => window.clearTimeout(timer);
  }, [phase, prefersReducedMotion]);

  const selectScenario = (index: number) => {
    setScenarioIndex(index);
    setAnswerId(null);
    setPhase("idle");
  };

  const chooseAnswer = (id: DemoAnswer["id"]) => {
    setAnswerId(id);
    setPhase("thinking");

    // Na mobile je odpoveď simulácie pod tlačidlami; posuň ju do zorného poľa.
    const response = responseRef.current;
    if (response && window.matchMedia("(max-width: 1023px)").matches) {
      const rect = response.getBoundingClientRect();
      if (rect.top > window.innerHeight * 0.6) {
        response.scrollIntoView({
          behavior: prefersReducedMotion ? "auto" : "smooth",
          block: "center",
        });
      }
    }
  };

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = demoScenarios.length - 1;
    const keyMap: Record<string, number> = {
      ArrowRight: index === last ? 0 : index + 1,
      ArrowLeft: index === 0 ? last : index - 1,
      Home: 0,
      End: last,
    };
    const next = keyMap[event.key];
    if (next === undefined) return;
    event.preventDefault();
    selectScenario(next);
    tabRefs.current[next]?.focus();
  };

  const otherAnswer = scenario.answers.find((item) => item.id !== answerId);

  return (
    <section
      id="ukazka"
      aria-labelledby="demo-title"
      className="relative overflow-hidden border-y border-line/70 bg-ink-2 py-24 md:py-32"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-1/2 h-[520px] w-[900px] -translate-x-1/2"
        style={{
          background:
            "radial-gradient(closest-side, rgba(59,130,246,0.16), transparent 75%)",
        }}
      />

      <div className="container-page relative">
        <div className="max-w-[44rem]">
          <h2
            id="demo-title"
            className="type-heading text-[clamp(2.1rem,1.4rem+2.8vw,3.5rem)]"
          >
            Vyskúšaj si jednu otázku
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-mute">
            Vyber tému a jednu z dvoch odpovedí. Uvidíš, ako by sa investor
            dopytoval a čo by ti simulácia vytkla.
          </p>
        </div>

        <div className="mt-12 rounded-[24px] border border-line bg-panel/80 p-2 shadow-[0_40px_120px_-50px_rgba(0,0,0,0.9)] sm:p-3">
          <div
            role="tablist"
            aria-label="Téma otázky"
            className="flex gap-1 overflow-x-auto rounded-[16px] bg-ink/70 p-1"
          >
            {demoScenarios.map((item, index) => {
              const selected = index === scenarioIndex;
              return (
                <button
                  key={item.id}
                  ref={(node) => {
                    tabRefs.current[index] = node;
                  }}
                  id={`${baseId}-tab-${item.id}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={`${baseId}-panel`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => selectScenario(index)}
                  onKeyDown={(event) => onTabKeyDown(event, index)}
                  className={`relative h-11 flex-1 rounded-[12px] px-4 text-[15px] whitespace-nowrap transition-colors duration-200 ${
                    selected ? "text-paper" : "text-mute hover:text-paper"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`absolute inset-0 rounded-[12px] border border-line-strong bg-panel-2 transition-[opacity,transform] duration-300 ease-out ${
                      selected ? "scale-100 opacity-100" : "scale-95 opacity-0"
                    }`}
                  />
                  <span className="relative">{item.topic}</span>
                </button>
              );
            })}
          </div>

          <div
            id={`${baseId}-panel`}
            role="tabpanel"
            aria-labelledby={`${baseId}-tab-${scenario.id}`}
            className="grid gap-3 pt-3 lg:grid-cols-2"
          >
            {/* Otázka a výber odpovede */}
            <div className="rounded-[16px] p-4 sm:p-6">
              <AnimatePresence mode="wait" initial={false}>
                <m.div
                  key={scenario.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.3, ease }}
                >
                  <p className="text-[13px] text-faint">Investor</p>
                  <p className="type-investor mt-2 text-[1.4rem] leading-snug text-paper md:text-[1.65rem]">
                    {scenario.question}
                  </p>

                  <p id={`${baseId}-choose`} className="mt-8 text-[14px] text-mute">
                    Ako odpovieš?
                  </p>
                  <div
                    role="group"
                    aria-labelledby={`${baseId}-choose`}
                    className="mt-3 space-y-3"
                  >
                    {scenario.answers.map((item) => {
                      const pressed = item.id === answerId;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          aria-pressed={pressed}
                          onClick={() => chooseAnswer(item.id)}
                          className={`group block w-full rounded-[14px] border p-4 text-left transition-[border-color,background-color] duration-200 ${
                            pressed
                              ? "border-signal-soft/80 bg-signal/12"
                              : "border-line-strong bg-ink/40 hover:border-signal-soft/50 hover:bg-panel-2"
                          }`}
                        >
                          <span className="flex items-center justify-between gap-3">
                            <span className="text-[13px] font-medium text-signal-soft">
                              {item.label}
                            </span>
                            <span
                              aria-hidden="true"
                              className={`flex size-5 items-center justify-center rounded-full border transition-colors ${
                                pressed
                                  ? "border-signal-soft bg-signal-soft"
                                  : "border-line-strong group-hover:border-signal-soft/60"
                              }`}
                            >
                              {pressed ? (
                                <span className="size-2 rounded-full bg-ink" />
                              ) : null}
                            </span>
                          </span>
                          <span className="mt-2 block text-[15px] leading-relaxed text-paper/90">
                            {item.text}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </m.div>
              </AnimatePresence>
            </div>

            {/* Reakcia simulácie */}
            <div
              ref={responseRef}
              aria-live="polite"
              className="flex min-h-[22rem] flex-col rounded-[16px] border border-line bg-ink/60 p-4 sm:p-6"
            >
              {phase === "idle" || !answer ? (
                <div className="m-auto max-w-[19rem] py-10 text-center">
                  <svg
                    viewBox="0 0 40 40"
                    aria-hidden="true"
                    className="mx-auto size-10 text-line-strong"
                  >
                    <path
                      d="M8 10h24a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H17l-6 5v-5H8a3 3 0 0 1-3-3V13a3 3 0 0 1 3-3Z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    />
                  </svg>
                  <p className="mt-4 text-[15px] leading-relaxed text-mute">
                    Vyber odpoveď a uvidíš, ako bude simulácia pokračovať.
                  </p>
                </div>
              ) : (
                <div className="flex flex-1 flex-col">
                  <p className="text-[13px] text-faint">Investor pokračuje</p>
                  <div className="relative mt-2 min-h-[3.5rem]">
                    <TypingDots visible={phase === "thinking"} className="absolute top-1 left-0" />
                    <AnimatePresence mode="wait">
                      {phase === "answered" ? (
                        <m.p
                          key={`${scenario.id}-${answer.id}`}
                          className="type-investor text-[1.2rem] leading-snug text-paper md:text-[1.3rem]"
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.45, ease }}
                        >
                          {answer.followUp}
                        </m.p>
                      ) : null}
                    </AnimatePresence>
                  </div>

                  {phase === "answered" ? (
                    <m.div
                      key={`${scenario.id}-${answer.id}-feedback`}
                      className="mt-6 border-t border-line pt-5"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3, delay: 0.25 }}
                    >
                      <p className="text-[13px] text-faint">Feedback k tvojej odpovedi</p>
                      <dl className="mt-3 space-y-3">
                        <FeedbackRow
                          tone="mint"
                          label="Čo fungovalo"
                          text={answer.feedback.worked}
                          delay={0.35}
                        />
                        <FeedbackRow
                          tone="marker"
                          label="Čo chýba"
                          text={answer.feedback.missing}
                          delay={0.5}
                        />
                        <FeedbackRow
                          tone="signal"
                          label="Čo precvičiť"
                          text={answer.feedback.practice}
                          delay={0.65}
                        />
                      </dl>

                      <div className="mt-6 flex flex-wrap gap-2">
                        {otherAnswer ? (
                          <button
                            type="button"
                            onClick={() => chooseAnswer(otherAnswer.id)}
                            className="inline-flex h-10 items-center rounded-[10px] border border-line-strong px-3.5 text-[14px] text-paper transition-colors hover:border-signal-soft/60 hover:bg-panel"
                          >
                            Skúsiť druhú odpoveď
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => {
                            const next = (scenarioIndex + 1) % demoScenarios.length;
                            selectScenario(next);
                            tabRefs.current[next]?.focus();
                          }}
                          className="inline-flex h-10 items-center rounded-[10px] px-3.5 text-[14px] text-mute transition-colors hover:bg-panel hover:text-paper"
                        >
                          Ďalšia téma
                        </button>
                      </div>
                    </m.div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>

        <p className="mt-5 text-sm text-faint">
          Toto je pripravená ukážka s vopred napísanými odpoveďami. V produkte
          simulácia reaguje na to, čo naozaj povieš.
        </p>
      </div>
    </section>
  );
}

const toneClasses = {
  mint: "bg-mint",
  marker: "bg-marker",
  signal: "bg-signal-soft",
} as const;

function FeedbackRow({
  tone,
  label,
  text,
  delay,
}: {
  tone: keyof typeof toneClasses;
  label: string;
  text: string;
  delay: number;
}) {
  return (
    <m.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease, delay }}
    >
      <dt className="flex items-center gap-2.5 text-[13px] font-semibold text-paper">
        <span aria-hidden="true" className={`size-2 rounded-full ${toneClasses[tone]}`} />
        {label}
      </dt>
      <dd className="mt-0.5 pl-[1.125rem] text-[15px] leading-relaxed text-mute">{text}</dd>
    </m.div>
  );
}
