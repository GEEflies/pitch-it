import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getPrimaryCta } from "@/config/site";

export default function NotFound() {
  return (
    <>
      <SiteHeader cta={getPrimaryCta()} />
      <main id="obsah" className="container-page flex min-h-[70dvh] flex-col justify-center pt-32 pb-24">
        <p className="type-investor text-[1.4rem] text-mute">Na túto otázku odpoveď nemáme.</p>
        <h1 className="type-display mt-4 text-[clamp(2.5rem,1.6rem+3.6vw,4.5rem)]">
          Stránka neexistuje
        </h1>
        <p className="mt-5 max-w-[30rem] text-lg leading-relaxed text-mute">
          Odkaz je zrejme neplatný alebo stránku sme presunuli.
        </p>
        <div className="mt-9">
          <Link href="/" className={buttonClasses({ size: "lg" })}>
            Prejsť na hlavnú stránku
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
