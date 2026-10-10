"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "motion/react";
import { usePrefersReducedMotion } from "@/components/ui/use-prefers-reduced-motion";
import * as m from "motion/react-m";
import { TypingDots } from "@/components/ui/typing-dots";

/*
  Jeden zorganizovaný moment stránky: investor si na slide zvýrazní číslo,
  opýta sa, founder odpovie vágne, prichádza doplňujúca otázka a feedback.
*/
const TIMELINE_MS = [900, 1500, 2300, 3300, 4800, 5500, 6600] as const;
const FINAL_STEP = TIMELINE_MS.length;

const founderAnswer =
  "Trh je obrovský. Aj keby sme získali jedno percento, je to 42 miliónov eur.";

const ease = [0.16, 1, 0.3, 1] as const;

export function HeroVisual() {
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { once: true, amount: 0.35 });
  const prefersReducedMotion = usePrefersReducedMotion();
  const [step, setStep] = useState(0);
  const [run, setRun] = useState(0);

  useEffect(() => {
    if (!inView || prefersReducedMotion) return;
    const timers = TIMELINE_MS.map((delay, index) =>
      window.setTimeout(() => setStep(index + 1), delay),
    );
    return () => timers.forEach(window.clearTimeout);
  }, [inView, prefersReducedMotion, run]);

  const replay = () => {
    setStep(0);
    setRun((value) => value + 1);
  };

  // Pri obmedzenom pohybe sa ukážka zobrazí rovno v cieľovom stave.
  const current = prefersReducedMotion ? FINAL_STEP : step;
  const show = (atStep: number) => current >= atStep;
  const reveal = (atStep: number, delay = 0) => ({
    initial: { opacity: 0, y: 10 },
    animate: show(atStep) ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 },
    transition: { duration: 0.55, ease, delay },
  });

  return (
    <figure ref={rootRef} className="relative md:min-h-[35rem]">
      <figcaption className="sr-only">
        Ukážka simulácie. Na slide „Trh a príležitosť“ je uvedený celkový trh
        4,2 miliardy eur. Investor sa pýta: Koľko z toho reálne oslovíte
        v najbližších troch rokoch? Founder odpovedá: {founderAnswer} Investor
        sa dopytuje: Jedno percento z čoho? Koľko konkrétnych firiem to je
        a ako sa k nim dostanete? Feedback: slabé miesto je veľkosť trhu bez
        výpočtu zdola.
      </figcaption>

      <div aria-hidden="true">
        {/* Slide z decku */}
        <m.div
          className="relative overflow-hidden rounded-[10px] bg-slide text-ink shadow-[0_50px_120px_-40px_rgba(59,130,246,0.6),0_0_0_1px_rgba(255,255,255,0.06)] md:w-[64%]"
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1, ease, delay: 0.35 }}
        >
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(110% 80% at 30% 0%, rgba(255,255,255,0.6), transparent 65%)",
            }}
          />
          <div className="relative p-5 sm:p-7">
            <div className="flex items-baseline justify-between gap-4 text-[12px] sm:text-[13px]">
              <span className="font-semibold text-ink/55">Slide 6</span>
              <span className="text-ink/45 md:hidden">Ukážkový startup</span>
            </div>
            <p className="type-heading mt-2 text-[1.5rem] text-ink sm:text-[1.75rem]">
              Trh a príležitosť
            </p>

            {/* Číslo, ktoré si investor zvýrazní */}
            <div className="mt-7 sm:mt-9">
              <p className="type-heading relative inline-block text-[2.4rem] whitespace-nowrap sm:text-[2.9rem]">
                <m.span
                  className="absolute inset-x-[-0.12em] bottom-[0.06em] h-[0.48em] origin-left rounded-[0.08em] bg-marker"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: show(1) ? 1 : 0 }}
                  transition={{ duration: 0.6, ease }}
                />
                <span className="relative">4,2 mld. €</span>
                <m.span
                  className="absolute -top-3 -right-10 flex size-7 items-center justify-center rounded-full bg-ink font-serif text-base text-marker sm:size-8 sm:text-lg"
                  initial={{ opacity: 0, scale: 0.4 }}
                  animate={show(2) ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.4 }}
                  transition={{ type: "spring", stiffness: 420, damping: 22 }}
                >
                  ?
                </m.span>
              </p>
              <p className="mt-1 text-[13px] leading-snug text-ink/60">
                Celkový trh, európsky e-commerce
              </p>
            </div>

            <div className="mt-6 flex gap-8">
              <div>
                <p className="type-heading text-[1.35rem] whitespace-nowrap">380 mil. €</p>
                <p className="mt-0.5 text-[13px] text-ink/60">Dostupný trh</p>
              </div>
              <div>
                <p className="type-heading text-[1.35rem] whitespace-nowrap">18 %</p>
                <p className="mt-0.5 text-[13px] text-ink/60">Rast za mesiac</p>
              </div>
            </div>

            <div className="mt-7 flex h-12 items-end gap-1.5">
              {[18, 24, 22, 31, 38, 44, 52, 63, 71, 86].map((height, index) => (
                <m.span
                  key={index}
                  className="flex-1 origin-bottom rounded-t-[3px] bg-signal/85"
                  style={{ height: `${height}%` }}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ duration: 0.7, ease, delay: 0.6 + index * 0.04 }}
                />
              ))}
            </div>
          </div>
        </m.div>

        {/* Okno simulácie */}
        <m.div
          className="relative z-10 mx-3 -mt-8 rounded-[18px] border border-line bg-panel p-4 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] sm:mx-8 sm:p-5 md:absolute md:top-12 md:right-0 md:mx-0 md:mt-0 md:w-[54%]"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease, delay: 0.6 }}
        >
          <div className="flex items-center justify-between gap-3 border-b border-line pb-3 text-[13px]">
            <span className="flex items-center gap-2 text-paper">
              <span className="relative flex size-2">
                <span className="absolute inset-0 rounded-full bg-mint" />
              </span>
              Simulácia stretnutia
            </span>
            <span className="text-faint">Partner fondu, seed</span>
          </div>

          <div className="mt-4 space-y-4">
            {/* Investor: prvá otázka */}
            <div className="relative">
              <m.div {...reveal(3)}>
                <p className="text-[12px] text-faint">Investor</p>
                <p className="type-investor mt-1 text-[1rem] leading-snug text-paper">
                  Tých 4,2 miliardy je celý európsky e-commerce. Koľko z toho
                  reálne oslovíte v najbližších troch rokoch?
                </p>
              </m.div>
              <TypingDots visible={current === 2} className="absolute top-5 left-0" />
            </div>

            {/* Founder: vágna odpoveď */}
            <m.div
              className="ml-6 rounded-[14px] rounded-tr-[4px] bg-panel-2 px-3.5 py-2.5"
              {...reveal(4)}
            >
              <p className="text-[12px] text-faint">Ty</p>
              <p className="mt-0.5 text-[14.5px] leading-snug text-paper/90">
                {founderAnswer.split(" ").map((word, index) => (
                  <m.span
                    key={`${word}-${index}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: show(4) ? 1 : 0 }}
                    transition={{ duration: 0.2, delay: show(4) ? index * 0.06 : 0 }}
                  >
                    {word}{" "}
                  </m.span>
                ))}
              </p>
            </m.div>

            {/* Investor: doplňujúca otázka */}
            <div className="relative">
              <m.div {...reveal(6)}>
                <p className="flex items-center gap-2 text-[12px] text-faint">
                  Investor
                  <span className="rounded-full border border-signal-soft/40 px-2 py-px text-[11px] text-signal-soft">
                    ide hlbšie
                  </span>
                </p>
                <p className="type-investor mt-1 text-[1rem] leading-snug text-paper">
                  Jedno percento z čoho? Koľko konkrétnych firiem to je a ako sa
                  k nim dostanete?
                </p>
              </m.div>
              <TypingDots visible={current === 5} className="absolute top-5 left-0" />
            </div>

            {/* Feedback */}
            <m.div
              className="rounded-[12px] border border-marker/35 bg-marker/[0.07] p-3.5"
              {...reveal(7)}
            >
              <p className="flex items-center gap-2 text-[12px] font-semibold text-marker">
                <span className="size-1.5 rounded-full bg-marker" />
                Slabé miesto
              </p>
              <p className="mt-1 text-[14.5px] font-medium text-paper">
                Veľkosť trhu bez výpočtu zdola
              </p>
              <p className="mt-1 text-[13px] leading-snug text-mute">
                Precvič: počet firiem v segmente krát ročná cena. Začni tými,
                ktorým predávaš dnes.
              </p>
            </m.div>
          </div>
        </m.div>
      </div>

      <m.button
        type="button"
        onClick={replay}
        className="mt-4 inline-flex h-11 items-center gap-2 rounded-[10px] px-3 text-sm text-mute transition-colors hover:bg-panel hover:text-paper md:absolute md:bottom-0 md:left-0 md:mt-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: current >= FINAL_STEP ? 1 : 0 }}
        transition={{ duration: 0.4 }}
        tabIndex={current >= FINAL_STEP ? 0 : -1}
        aria-hidden={current < FINAL_STEP}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4">
          <path
            d="M4 10a6 6 0 1 0 1.8-4.3M4 4v3.5h3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Prehrať ukážku znova
      </m.button>
    </figure>
  );
}
