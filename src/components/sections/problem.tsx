import { Reveal } from "@/components/ui/reveal";

const questions = [
  {
    slide: "Trh",
    question: "Koľko z toho trhu reálne oslovíte v najbližších troch rokoch?",
  },
  {
    slide: "Trakcia",
    question: "Koľko z tých zákazníkov s vami zostane aj po šiestich mesiacoch?",
  },
  {
    slide: "Konkurencia",
    question:
      "Čo vám zostane, keď to isté spustí niekto s desaťnásobným rozpočtom?",
  },
  {
    slide: "Tím",
    question: "Prečo ste práve vy tí, ktorí to dotiahnu?",
  },
  {
    slide: "Financovanie",
    question: "Aký konkrétny míľnik si za tieto peniaze kúpite?",
  },
] as const;

export function Problem() {
  return (
    <section
      aria-labelledby="problem-title"
      className="relative border-t border-line/70 py-24 md:py-32"
    >
      <div className="container-page grid gap-14 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-28">
            <h2
              id="problem-title"
              className="type-heading text-[clamp(2.1rem,1.4rem+2.8vw,3.5rem)]"
            >
              Prezentáciu máš nacvičenú. Otázky nie.
            </h2>
            <p className="mt-6 max-w-[30rem] text-lg leading-relaxed text-mute">
              Na pitch sa pripravuješ týždne: slidy, čísla, príbeh. Investor však
              nepočúva preto, aby zatlieskal. Hľadá miesto, kde sa tvoj príbeh
              láme, a nájde ho otázkou, na ktorú v príprave nepomyslíš.
            </p>
            <p className="mt-4 max-w-[30rem] text-lg leading-relaxed text-mute">
              Odpovede na takéto otázky sa nedajú naučiť naspamäť. Dajú sa
              natrénovať.
            </p>
          </div>
        </div>

        <ul className="lg:col-span-7" aria-label="Otázky, ktoré prichádzajú po slidoch">
          {questions.map((item, index) => (
            <Reveal
              as="li"
              key={item.slide}
              delay={index * 0.06}
              className="grid gap-2 border-b border-line/70 py-6 first:pt-0 sm:grid-cols-[8.5rem_1fr] sm:gap-6"
            >
              <span className="pt-1.5 text-sm text-faint">
                Slide: {item.slide}
              </span>
              <p className="type-investor text-[1.35rem] leading-snug text-paper md:text-[1.6rem]">
                {item.question}
              </p>
            </Reveal>
          ))}

          <Reveal
            as="li"
            delay={0.1}
            className="grid gap-2 py-6 sm:grid-cols-[8.5rem_1fr] sm:gap-6"
          >
            <span className="pt-1.5 text-sm text-marker">Nie je na žiadnom slide</span>
            <p className="type-investor text-[1.35rem] leading-snug text-paper md:text-[1.6rem]">
              <span className="underline decoration-marker decoration-2 underline-offset-[0.22em]">
                Čo by sa muselo stať, aby táto firma neprežila?
              </span>
            </p>
          </Reveal>
        </ul>
      </div>
    </section>
  );
}
