import type { ReactNode } from "react";
import type { Rating } from "@/lib/reports/assessment";
import { RATING_LABELS } from "@/lib/reports/assessment";

/* Stavebné prvky reportu. Každé hodnotenie nesie text aj ikonu, nikdy iba farbu. */

export type Provenance = "measured" | "indicative" | "ai";

const PROVENANCE: Record<Provenance, { label: string; className: string; title: string }> = {
  measured: {
    label: "Namerané",
    className: "border-mint/40 text-mint",
    title: "Vypočítané priamo z prepisu a časovania, bez AI.",
  },
  indicative: {
    label: "Orientačné",
    className: "border-signal-soft/45 text-signal-soft",
    title: "Signál z mikrofónu alebo kamery. Závisí od zariadenia a prostredia.",
  },
  ai: {
    label: "Hodnotenie AI",
    className: "border-marker/45 text-marker",
    title: "Úsudok jazykového modelu s vysvetlením a citáciou. Môže sa mýliť.",
  },
};

export function ProvenanceTag({ kind }: { kind: Provenance }) {
  const meta = PROVENANCE[kind];
  return (
    <span title={meta.title} className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[12px] whitespace-nowrap ${meta.className}`}>
      {meta.label}
    </span>
  );
}

export function ReportSection({
  id,
  title,
  provenance,
  intro,
  children,
}: {
  id: string;
  title: string;
  provenance?: Provenance;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="border-t border-line/70 py-10">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id={id} className="type-heading text-[1.55rem]">
          {title}
        </h2>
        {provenance ? <ProvenanceTag kind={provenance} /> : null}
      </div>
      {intro ? <div className="mt-2 max-w-[44rem] leading-relaxed text-mute">{intro}</div> : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}

const RATING_STYLE: Record<Rating, { className: string; icon: string }> = {
  strong: { className: "border-mint/40 text-mint", icon: "M3.5 8.5l3 3 6-7" },
  adequate: { className: "border-line-strong text-paper/85", icon: "M4 8h8" },
  weak: { className: "border-marker/45 text-marker", icon: "M8 4.5v4.2M8 11.3h.01" },
  not_assessable: { className: "border-line text-faint", icon: "M5.5 8h.01M8 8h.01M10.5 8h.01" },
};

export function RatingChip({ rating }: { rating: Rating }) {
  const meta = RATING_STYLE[rating];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12.5px] whitespace-nowrap ${meta.className}`}>
      <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3.5">
        <path d={meta.icon} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {RATING_LABELS[rating]}
    </span>
  );
}

/** Citácia odpovede foundera s jantárovým zvýrazňovačom investora. */
export function FounderQuote({ text, seq, href }: { text: string; seq?: number; href?: string }) {
  return (
    <blockquote className="text-[15px] leading-relaxed text-paper/90">
      <span className="marker-highlight">„{text}“</span>
      {seq !== undefined ? (
        <a href={href ?? `#tah-${seq}`} className="ml-2 text-[12.5px] text-faint hover:text-paper">
          odpoveď {seq}
        </a>
      ) : null}
    </blockquote>
  );
}

export function Stat({ label, value, note }: { label: ReactNode; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[13.5px] text-mute">{label}</dt>
      <dd className="mt-1 text-[1.6rem] font-semibold leading-none text-paper">{value}</dd>
      {note ? <dd className="mt-1.5 text-[12.5px] leading-snug text-faint">{note}</dd> : null}
    </div>
  );
}
