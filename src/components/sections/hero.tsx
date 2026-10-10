import type { CSSProperties } from "react";
import Link from "next/link";
import type { Cta } from "@/config/site";
import { buttonClasses } from "@/components/ui/button";
import { HeroVisual } from "@/components/sections/hero-visual";

const headlineLines = ["Priprav sa na otázky,", "ktoré v pitch decku nie sú."];

export function Hero({ cta }: { cta: Cta }) {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative overflow-hidden pt-28 pb-20 md:pt-36 md:pb-28"
    >
      {/* Svetlo projektora dopadajúce na slide */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 right-[-20%] h-[900px] w-[1100px] opacity-90 md:right-[-8%]"
        style={{
          background:
            "radial-gradient(closest-side, rgba(61,91,255,0.28), rgba(61,91,255,0.08) 55%, transparent 75%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-ink"
      />

      <div className="container-page relative">
        <h1
          id="hero-title"
          className="type-display max-w-[16ch] text-[clamp(2.75rem,1.2rem+6.2vw,5.6rem)] text-paper lg:max-w-none"
        >
          {headlineLines.map((line, index) => (
            <span
              key={line}
              className="reveal-line"
              style={{ "--i": index } as CSSProperties}
            >
              <span>{line} </span>
            </span>
          ))}
        </h1>

        <div className="mt-10 grid items-start gap-14 lg:mt-14 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-5 lg:pt-4">
            <p
              className="fade-up max-w-[34rem] text-lg leading-relaxed text-mute md:text-xl"
              style={{ "--d": "320ms" } as CSSProperties}
            >
              Natrénuj si investorské stretnutie skôr, než príde naostro. Odhaľ
              slabé miesta svojich odpovedí, zvládni nepríjemné otázky a zisti,
              čo potrebuješ zlepšiť.
            </p>

            <div
              className="fade-up mt-9 flex flex-col gap-3 sm:flex-row"
              style={{ "--d": "440ms" } as CSSProperties}
            >
              <Link
                href={cta.href}
                className={buttonClasses({ size: "lg" })}
              >
                {cta.label}
              </Link>
              <Link
                href="/#ako-to-funguje"
                className={buttonClasses({ variant: "secondary", size: "lg" })}
              >
                Pozrieť, ako to funguje
              </Link>
            </div>

            <p
              className="fade-up mt-5 text-sm text-faint"
              style={{ "--d": "540ms" } as CSSProperties}
            >
              {cta.note}
            </p>
          </div>

          <div className="lg:col-span-7">
            <HeroVisual />
          </div>
        </div>
      </div>
    </section>
  );
}
