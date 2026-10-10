import Link from "next/link";
import { navLinks, siteConfig } from "@/config/site";
import { Wordmark } from "@/components/wordmark";

export function SiteFooter() {
  return (
    <footer className="border-t border-line/70 bg-ink-2">
      <div className="container-page grid gap-12 py-14 md:grid-cols-12 md:gap-8">
        <div className="md:col-span-5">
          <Wordmark />
          <p className="mt-4 max-w-[22rem] leading-relaxed text-mute">
            Tréning investorských stretnutí pre founderov. Simulácia otázok,
            ktoré v pitch decku nie sú.
          </p>
        </div>

        <nav aria-label="Navigácia v pätičke" className="md:col-span-3">
          <p className="text-sm text-faint">Stránka</p>
          <ul className="mt-4 space-y-2.5">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="link-underline text-paper/85 hover:text-paper">
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/prihlasenie" className="link-underline text-paper/85 hover:text-paper">
                Prihlásenie
              </Link>
            </li>
          </ul>
        </nav>

        <div className="md:col-span-4">
          <p className="text-sm text-faint">Kontakt a právne</p>
          <ul className="mt-4 space-y-2.5">
            {siteConfig.contactEmail ? (
              <li>
                <a
                  href={`mailto:${siteConfig.contactEmail}`}
                  className="link-underline text-paper/85 hover:text-paper"
                >
                  {siteConfig.contactEmail}
                </a>
              </li>
            ) : null}
            <li>
              <Link href="/podmienky" className="link-underline text-paper/85 hover:text-paper">
                Podmienky používania
              </Link>
            </li>
            <li>
              <Link
                href="/ochrana-osobnych-udajov"
                className="link-underline text-paper/85 hover:text-paper"
              >
                Ochrana osobných údajov
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-line/70">
        <div className="container-page flex flex-col gap-2 py-6 text-sm text-faint sm:flex-row sm:justify-between">
          <p>© {siteConfig.legal.entityName ?? siteConfig.name}</p>
          <p>Pitch It nie je investičné ani finančné poradenstvo.</p>
        </div>
      </div>
    </footer>
  );
}
