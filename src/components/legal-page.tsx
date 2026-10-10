import type { ReactNode } from "react";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getPrimaryCta, siteConfig } from "@/config/site";

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line/70 pt-8">
      <h2 className="type-heading text-[1.6rem]">{title}</h2>
      <div className="mt-4 space-y-4 leading-relaxed text-mute [&_strong]:font-medium [&_strong]:text-paper [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}

/** Kostra právnych stránok s upozornením, kým nie sú doplnené údaje prevádzkovateľa. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  const controllerKnown = Boolean(siteConfig.legal.entityName && siteConfig.contactEmail);
  return (
    <>
      <SiteHeader cta={getPrimaryCta()} />
      <main id="obsah" className="pt-32 pb-24 md:pt-40">
        <article className="container-page max-w-[46rem]">
          <h1 className="type-display text-[clamp(2.5rem,1.6rem+3.6vw,4rem)]">{title}</h1>
          <p className="mt-5 text-faint">Posledná aktualizácia: {updated}</p>
          {!controllerKnown ? (
            <p role="note" className="mt-8 rounded-[12px] border border-marker/40 bg-marker/[0.08] p-4 leading-relaxed text-paper">
              Údaje o prevádzkovateľovi a kontakt doplníme pred spustením. Text je pracovný návrh a pred spustením prejde právnou kontrolou.
            </p>
          ) : null}
          <div className="mt-12 space-y-12">{children}</div>
          <p className="mt-16">
            <Link href="/" className="link-underline text-paper">
              Späť na hlavnú stránku
            </Link>
          </p>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
