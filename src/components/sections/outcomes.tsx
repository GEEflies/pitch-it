import type { ReactNode } from "react";
import { Reveal } from "@/components/ui/reveal";

type Outcome = { title: string; text: string; icon: ReactNode };

const iconProps = {
  viewBox: "0 0 32 32",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  className: "size-8",
};

const outcomes: Outcome[] = [
  {
    title: "Odpovede, ktoré obstoja aj pri druhej otázke",
    text: "Cieľom je mať na kľúčové témy odpoveď postavenú na tvrdení, dôkaze a tom, čo z neho vyplýva. Nie na dojme.",
    icon: (
      <svg {...iconProps} className="size-8 text-signal-soft">
        <path d="M6 8h20M6 16h14M6 24h8" />
      </svg>
    ),
  },
  {
    title: "Slabé miesta skôr, než ich nájde investor",
    text: "Uvidíš, kde odpovedáš vágne, kde ti chýbajú čísla a kde si protirečíš.",
    icon: (
      <svg {...iconProps} className="size-8 text-marker">
        <path d="M5 23h12" strokeWidth={5} strokeOpacity={0.45} />
        <path d="M19.5 6.5l6 6L15 23l-6.5.5L9 17 19.5 6.5Z" />
      </svg>
    ),
  },
  {
    title: "Jasno v tom, čo precvičiť",
    text: "Žiadne všeobecné rady. Konkrétne témy a otázky, ku ktorým sa vrátiš v ďalšom kole.",
    icon: (
      <svg {...iconProps} className="size-8 text-mint">
        <path d="M25 11a10 10 0 1 0 1 7" />
        <path d="M26 5v6h-6" />
      </svg>
    ),
  },
];

export function Outcomes() {
  return (
    <section
      id="co-ziskas"
      aria-labelledby="outcomes-title"
      className="relative py-24 md:py-32"
    >
      <div className="container-page grid gap-14 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-5">
          <h2
            id="outcomes-title"
            className="type-heading text-[clamp(2.1rem,1.4rem+2.8vw,3.5rem)]"
          >
            Čo získaš
          </h2>
          <p className="mt-5 max-w-[28rem] text-lg leading-relaxed text-mute">
            Pitch It ti nezaručí investíciu. Jeho cieľom je, aby ťa na
            stretnutí nič podstatné nezaskočilo.
          </p>
        </div>

        <ul className="lg:col-span-7">
          {outcomes.map((item, index) => (
            <Reveal
              as="li"
              key={item.title}
              delay={index * 0.08}
              className="grid grid-cols-[2.5rem_1fr] gap-5 border-t border-line/70 py-8 last:border-b sm:grid-cols-[3rem_1fr] sm:gap-6"
            >
              {item.icon}
              <div>
                <h3 className="type-heading text-[1.5rem] md:text-[1.75rem]">{item.title}</h3>
                <p className="mt-2 max-w-[34rem] leading-relaxed text-mute">{item.text}</p>
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
