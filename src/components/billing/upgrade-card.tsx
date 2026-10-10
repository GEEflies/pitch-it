import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { PLANS } from "@/lib/billing/plans";

/** Ponuka Pro po prvom rozbore: v momente, keď používateľ vidí, čo produkt vie. */
export function UpgradeCard({ upgradeHref = "/app/nastavenia#plan" }: { upgradeHref?: string }) {
  const pro = PLANS.pro;
  return (
    <section aria-labelledby="upgrade-title" className="mt-12 rounded-xl border border-signal/40 bg-signal/[0.06] px-6 py-6 md:px-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl">
          <p className="text-sm font-medium text-signal-soft">Prvý rozbor máš za sebou</p>
          <h2 id="upgrade-title" className="type-heading mt-1 text-xl">
            Zlepšenie príde s ďalšími tréningmi
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-mute">
            S plánom {pro.name} máš {pro.limits.realtimeMinutes} minút hlasového tréningu a {pro.limits.reports} rozborov mesačne. Dosť na
            celý plán pred stretnutím aj na porovnanie pokroku.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-2 md:items-end">
          <Link href={upgradeHref} className={buttonClasses({ size: "lg" })}>
            Prejsť na {pro.name} za {pro.priceMonthlyEur} €/mes.
          </Link>
          <Link href="/cennik" className="text-sm text-mute hover:text-paper">
            Porovnať plány
          </Link>
        </div>
      </div>
    </section>
  );
}
