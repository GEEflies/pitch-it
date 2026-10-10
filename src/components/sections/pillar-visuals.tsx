"use client";

import { useRef } from "react";
import { useInView } from "motion/react";
import * as m from "motion/react-m";
import { StatusChip, type Status } from "@/components/ui/status-chip";

const ease = [0.25, 1, 0.5, 1] as const;

function useOnceInView() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.45 });
  return [ref, inView] as const;
}

function appear(inView: boolean, delay: number, y = 8) {
  return {
    initial: { opacity: 0, y },
    animate: inView ? { opacity: 1, y: 0 } : { opacity: 0, y },
    transition: { duration: 0.5, ease, delay },
  };
}

const panelClass =
  "rounded-[18px] border border-line bg-panel p-5 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.8)] sm:p-6";

/* Personalizácia: kontext stretnutia určuje, na čo sa investor zameria. */
export function ContextVisual() {
  const [ref, inView] = useOnceInView();
  const rows = [
    ["Fáza", "Seed"],
    ["Získavaš", "800 tis. €"],
    ["Kto bude oproti", "Partner VC fondu"],
  ] as const;
  const focus = ["Retencia", "Návratnosť CAC", "Prečo práve teraz", "Použitie peňazí"];

  return (
    <div ref={ref} className={panelClass} aria-hidden="true">
      <p className="text-[13px] text-faint">Kontext stretnutia</p>
      <dl className="mt-3 divide-y divide-line/70">
        {rows.map(([label, value], index) => (
          <m.div
            key={label}
            className="flex items-baseline justify-between gap-4 py-2.5"
            {...appear(inView, 0.1 + index * 0.12)}
          >
            <dt className="text-[14px] text-mute">{label}</dt>
            <dd className="text-right text-[15px] font-medium text-paper">{value}</dd>
          </m.div>
        ))}
        <m.div
          className="flex items-center justify-between gap-4 py-2.5"
          {...appear(inView, 0.46)}
        >
          <dt className="text-[14px] text-mute">Podklady</dt>
          <dd className="flex flex-wrap justify-end gap-1.5">
            {["deck.pdf", "metriky.xlsx"].map((file) => (
              <span
                key={file}
                className="rounded-md border border-line-strong bg-panel-2 px-2 py-0.5 text-[13px] text-paper/90"
              >
                {file}
              </span>
            ))}
          </dd>
        </m.div>
      </dl>

      <div className="mt-5 rounded-[12px] bg-ink/60 p-4">
        <m.p className="text-[13px] text-faint" {...appear(inView, 0.7)}>
          Na čo sa tento investor pravdepodobne zameria
        </m.p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {focus.map((item, index) => (
            <m.li
              key={item}
              className="rounded-full border border-signal-soft/40 bg-signal/10 px-3 py-1 text-[13.5px] text-paper"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={inView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.85 }}
              transition={{ type: "spring", stiffness: 380, damping: 24, delay: 0.85 + index * 0.1 }}
            >
              {item}
            </m.li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* Adaptívne otázky: každá vágna odpoveď otvorí ďalšiu úroveň. */
export function FollowUpVisual() {
  const [ref, inView] = useOnceInView();
  const chain = [
    { investor: "Aká je vaša retencia?", founder: "Veľmi dobrá, zákazníci nás majú radi." },
    { investor: "Koľko firiem z januára u vás platí aj dnes?", founder: "Zhruba šesťdesiat percent." },
    { investor: "A tých štyridsať percent? Viete, prečo odišli?", founder: null },
  ] as const;

  return (
    <div ref={ref} className={panelClass} aria-hidden="true">
      <p className="text-[13px] text-faint">Simulácia, téma retencia</p>
      <div className="mt-4">
        {chain.map((turn, depth) => (
          <div
            key={turn.investor}
            className={depth > 0 ? "mt-3 border-l border-line-strong pl-4 sm:pl-5" : ""}
            style={depth > 1 ? { marginLeft: "1rem" } : undefined}
          >
            <m.div {...appear(inView, 0.15 + depth * 0.7)}>
              <p className="flex items-center gap-2 text-[12px] text-faint">
                Investor
                {depth > 0 ? (
                  <span className="rounded-full border border-signal-soft/40 px-2 py-px text-[11px] text-signal-soft">
                    doplňujúca otázka
                  </span>
                ) : null}
              </p>
              <p className="type-investor mt-1 text-[1.05rem] leading-snug text-paper">
                {turn.investor}
              </p>
            </m.div>
            {turn.founder ? (
              <m.p
                className="mt-2 w-fit rounded-[12px] rounded-tl-[4px] bg-panel-2 px-3 py-2 text-[14px] text-paper/85"
                {...appear(inView, 0.5 + depth * 0.7)}
              >
                {turn.founder}
              </m.p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

/* Feedback a opakovaný tréning: rozbor po kolách. */
export function FeedbackVisual() {
  const [ref, inView] = useOnceInView();
  const rows: { topic: string; first: Status; second: Status }[] = [
    { topic: "Trh", first: "strong", second: "strong" },
    { topic: "Unit economics", first: "refine", second: "strong" },
    { topic: "Konkurencia", first: "missing", second: "refine" },
    { topic: "Použitie peňazí", first: "refine", second: "refine" },
  ];

  return (
    <div ref={ref} className={panelClass} aria-hidden="true">
      <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 gap-y-0 text-[13px] text-faint sm:gap-x-5">
        <span>Rozbor po simulácii</span>
        <span className="w-[6.5rem] text-left">1. kolo</span>
        <m.span className="w-[6.5rem] text-left" {...appear(inView, 0.9, 0)}>
          2. kolo
        </m.span>
      </div>
      <ul className="mt-3 divide-y divide-line/70">
        {rows.map((row, index) => (
          <li
            key={row.topic}
            className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 py-3 sm:gap-x-5"
          >
            <m.span className="text-[15px] text-paper" {...appear(inView, 0.1 + index * 0.08)}>
              {row.topic}
            </m.span>
            <m.span className="w-[6.5rem]" {...appear(inView, 0.2 + index * 0.08)}>
              <StatusChip status={row.first} />
            </m.span>
            <m.span className="w-[6.5rem]" {...appear(inView, 1 + index * 0.12)}>
              <StatusChip status={row.second} />
            </m.span>
          </li>
        ))}
      </ul>
      <m.p
        className="mt-4 rounded-[12px] bg-ink/60 px-4 py-3 text-[14px] text-mute"
        {...appear(inView, 1.6)}
      >
        Na ďalšie kolo: <span className="text-paper">konkurencia a použitie peňazí</span>
      </m.p>
    </div>
  );
}
