import Link from "next/link";
import { ProvenanceTag, RatingChip } from "@/components/report/parts";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { formatNumber } from "@/lib/format";
import type { compareSessions } from "@/lib/history/compare";

const VERDICT = {
  better: { label: "Zlepšenie", className: "text-mint", icon: "M8 12V4M4.5 7.5 8 4l3.5 3.5" },
  worse: { label: "Zhoršenie", className: "text-marker", icon: "M8 4v8M4.5 8.5 8 12l3.5-3.5" },
  same: { label: "Bez zmeny", className: "text-mute", icon: "M4 8h8" },
} as const;

function VerdictText({ verdict }: { verdict: keyof typeof VERDICT }) {
  const meta = VERDICT[verdict];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[14px] ${meta.className}`}>
      <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4">
        <path d={meta.icon} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {meta.label}
    </span>
  );
}

export function CompareView({
  comparison,
  description,
  backHref,
}: {
  comparison: ReturnType<typeof compareSessions>;
  description: string;
  backHref: string;
}) {
  return (
    <>
      <PageHeader
        back={
          <Link href={backHref} className="link-underline text-sm text-mute hover:text-paper">
            História
          </Link>
        }
        title="Porovnanie tréningov"
        description={description}
      />

      {!comparison.comparable ? (
        <Notice tone="attention">{comparison.reason}</Notice>
      ) : (
        <div className="space-y-12">
          <section aria-labelledby="metrics">
            <div className="flex flex-wrap items-center gap-3">
              <h2 id="metrics" className="type-heading text-[1.4rem]">
                Merania
              </h2>
              <ProvenanceTag kind="measured" />
            </div>
            {comparison.metrics.length === 0 ? (
              <p className="mt-3 text-mute">Tréningy nemajú spoločné merania (napríklad jeden bol textový).</p>
            ) : (
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[34rem] text-left">
                  <thead className="text-[13px] text-faint">
                    <tr className="border-b border-line/70">
                      <th className="py-2 pr-4 font-normal">Meranie</th>
                      <th className="py-2 pr-4 text-right font-normal">Predtým</th>
                      <th className="py-2 pr-4 text-right font-normal">Teraz</th>
                      <th className="py-2 font-normal">Zmena</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60">
                    {comparison.metrics.map((metric) => (
                      <tr key={metric.key}>
                        <td className="py-3 pr-4 text-paper">{metric.label}</td>
                        <td className="py-3 pr-4 text-right tabular-nums text-mute">
                          {formatNumber(metric.before, metric.digits)} {metric.unit}
                        </td>
                        <td className="py-3 pr-4 text-right tabular-nums text-paper">
                          {formatNumber(metric.after, metric.digits)} {metric.unit}
                        </td>
                        <td className="py-3">
                          <VerdictText verdict={metric.verdict} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {comparison.skipped.length > 0 ? (
              <p className="mt-3 text-[13px] text-faint">Neporovnávame (chýbajú v jednom z tréningov): {comparison.skipped.join(", ").toLowerCase()}.</p>
            ) : null}
          </section>

          <section aria-labelledby="dimensions">
            <div className="flex flex-wrap items-center gap-3">
              <h2 id="dimensions" className="type-heading text-[1.4rem]">
                Obsah odpovedí
              </h2>
              <ProvenanceTag kind="ai" />
            </div>
            {comparison.dimensions.length === 0 ? (
              <p className="mt-3 text-mute">Oba tréningy potrebujú hotový rozbor obsahu.</p>
            ) : (
              <ul className="mt-5 divide-y divide-line/60">
                {comparison.dimensions.map((dimension) => (
                  <li key={dimension.key} className="grid gap-2 py-3 sm:grid-cols-12 sm:items-center">
                    <span className="text-paper sm:col-span-5">{dimension.label}</span>
                    <span className="flex items-center gap-2 sm:col-span-4">
                      <RatingChip rating={dimension.before} />
                      <span aria-hidden="true" className="text-faint">
                        →
                      </span>
                      <span className="sr-only">potom</span>
                      <RatingChip rating={dimension.after} />
                    </span>
                    <span className="sm:col-span-3">
                      <VerdictText verdict={dimension.verdict} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 max-w-[44rem] text-[13.5px] leading-relaxed text-faint">
              Hodnotenie AI závisí aj od otázok, ktoré v danom rozhovore padli. Zmenu ber ako signál, nie ako presné meranie.
            </p>
          </section>
        </div>
      )}
    </>
  );
}
