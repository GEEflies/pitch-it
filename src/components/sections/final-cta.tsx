import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import type { Cta } from "@/config/site";

const steps = [
  "Vytvor profil startupu alebo nahraj pitch deck.",
  "Vyber investora a typ stretnutia, potom sa s ním rozprávaj nahlas.",
  "Dostaneš rozbor s citáciami tvojich odpovedí a cvičenia na slabé miesta.",
];

export function FinalCta({ cta }: { cta: Cta }) {
  return (
    <section aria-labelledby="final-cta-title" className="relative overflow-hidden border-t border-line/70 py-24 md:py-32">
      <div className="container-page relative grid gap-12 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-6">
          <h2 id="final-cta-title" className="type-display text-[clamp(2.5rem,1.4rem+3.6vw,4rem)]">
            Ďalšie stretnutie si natrénuj vopred.
          </h2>
          <p className="mt-6 max-w-[28rem] text-lg leading-relaxed text-mute">{cta.note}</p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href={cta.href} className={buttonClasses({ size: "lg" })}>
              {cta.label}
            </Link>
            <Link href="/cennik" className={buttonClasses({ variant: "secondary", size: "lg" })}>
              Pozrieť cenník
            </Link>
          </div>
        </div>
        <ol className="space-y-5 border-t border-line/70 pt-8 lg:col-span-5 lg:col-start-8 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-10">
          {steps.map((step, index) => (
            <li key={step} className="flex gap-4 leading-relaxed text-paper/90">
              <span className="type-heading text-signal-soft">{index + 1}</span>
              {step}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
