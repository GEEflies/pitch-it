import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { buttonClasses } from "@/components/ui/button";
import { getPrimaryCta } from "@/config/site";
import { PLANS } from "@/lib/billing/plans";

export const metadata: Metadata = {
  title: "Cenník",
  description: "Free na vyskúšanie, Pro pre founderov, ktorí sa pripravujú na konkrétne stretnutia.",
  alternates: { canonical: "/cennik" },
};

export default function PricingPage() {
  const cta = getPrimaryCta();
  const plans = [PLANS.free, PLANS.pro];
  return (
    <>
      <SiteHeader cta={cta} />
      <main id="obsah" className="pt-32 pb-24 md:pt-40">
        <div className="container-page">
          <h1 className="type-display max-w-[44rem] text-[clamp(2.5rem,1.6rem+3.6vw,4rem)]">Plať za čas, ktorý reálne natrénuješ.</h1>
          <p className="mt-5 max-w-[38rem] text-lg leading-relaxed text-mute">
            Hlasový rozhovor s AI investorom stojí reálne peniaze za každú minútu. Preto sú limity v minútach a nie neobmedzené.
          </p>

          <div className="mt-14 grid gap-6 md:grid-cols-2">
            {plans.map((plan) => (
              <section
                key={plan.id}
                aria-labelledby={`plan-${plan.id}`}
                className={`flex min-w-0 flex-col rounded-[18px] border p-6 sm:p-7 md:p-9 ${plan.id === "pro" ? "border-signal/70 bg-panel" : "border-line bg-panel/50"}`}
              >
                <h2 id={`plan-${plan.id}`} className="type-heading text-[1.6rem]">
                  {plan.name}
                </h2>
                <p className="mt-2 text-mute">{plan.tagline}</p>
                {plan.id === "pro" ? <p className="mt-1 text-[13.5px] text-faint">Po registrácii prejdeš na Pro v nastaveniach účtu.</p> : null}
                <p className="mt-6 text-[2.75rem] font-semibold leading-none text-paper">
                  {plan.priceMonthlyEur === 0 ? "0 €" : `${plan.priceMonthlyEur} €`}
                  <span className="ml-2 text-base font-normal text-faint">{plan.priceMonthlyEur === 0 ? "navždy" : "mesačne"}</span>
                </p>
                <ul className="mt-8 flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-3 leading-relaxed text-paper/90">
                      <span aria-hidden="true" className="mt-[0.7em] h-px w-4 shrink-0 bg-signal-soft" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link href={plan.id === "free" ? cta.href : "/registracia"} className={buttonClasses({ size: "lg", variant: plan.id === "pro" ? "primary" : "secondary", className: "mt-10" })}>
                  {plan.id === "free" ? cta.label : "Vybrať Pro"}
                </Link>
              </section>
            ))}
          </div>

          <div className="mt-14 max-w-[44rem] space-y-3 text-[15px] leading-relaxed text-mute">
            <p>Platený plán zrušíš kedykoľvek, platí do konca zaplateného mesiaca. Nevyčerpané minúty sa neprenášajú.</p>
            <p>Textový tréning a cvičenia majú vlastné limity, ktoré bežný founder nevyčerpá. Presné čerpanie vidíš v aplikácii.</p>
            <p>PitchIt nezaručuje investíciu. Pomáha ti pripraviť sa na otázky, ktoré na stretnutí padnú.</p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
