import type { ReactNode } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/wordmark";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="container-page flex h-16 items-center justify-between">
        <Wordmark />
        <Link href="/" className="rounded-md px-2 py-1 text-sm text-mute hover:text-paper">
          Späť na úvod
        </Link>
      </header>
      <main id="obsah" className="container-page grid flex-1 items-start gap-12 py-10 md:py-16 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-5">{children}</div>
        <aside aria-hidden="true" className="hidden lg:col-span-6 lg:col-start-7 lg:block">
          <figure className="mt-10 border-l-2 border-marker/70 pl-8">
            <blockquote className="type-investor text-[1.9rem] leading-[1.25] text-paper/90">
              Na slide uvádzate trh štyri celé dva miliardy. Koľko z toho dokážete reálne osloviť za tri roky?
            </blockquote>
            <figcaption className="mt-6 text-[15px] text-faint">
              Takéto otázky si natrénuješ skôr, než zaznejú naostro.
            </figcaption>
          </figure>
        </aside>
      </main>
    </div>
  );
}
