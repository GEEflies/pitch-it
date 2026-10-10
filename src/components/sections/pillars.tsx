import type { ReactNode } from "react";
import {
  ContextVisual,
  FeedbackVisual,
  FollowUpVisual,
} from "@/components/sections/pillar-visuals";

type Pillar = {
  id: string;
  title: string;
  text: string;
  points: string[];
  visual: ReactNode;
};

const pillars: Pillar[] = [
  {
    id: "personalizacia",
    title: "Príprava na tvoje stretnutie, nie na všeobecný pitch",
    text: "Simulácia vychádza z tvojich podkladov a z toho, kto bude sedieť oproti. Angel investor sa pýta inak ako partner fondu, ktorý ťa bude obhajovať pred investičným výborom.",
    points: [
      "Otázky postavené na tvojich číslach a tvrdeniach",
      "Zohľadňuje fázu, výšku kola a typ investora",
    ],
    visual: <ContextVisual />,
  },
  {
    id: "adaptivne-otazky",
    title: "Otázky, ktoré nepustia",
    text: "Simulácia nečíta otázky zo zoznamu. Reaguje na to, čo povieš. Keď odpoveď obíde podstatu, príde doplňujúca otázka, ako na skutočnom stretnutí.",
    points: [
      "Dopytuje sa, kým nepríde konkrétna odpoveď",
      "Všíma si vágne formulácie a chýbajúce čísla",
    ],
    visual: <FollowUpVisual />,
  },
  {
    id: "feedback",
    title: "Feedback, s ktorým sa dá pracovať",
    text: "Po simulácii dostaneš rozbor odpovedí: čo zaznelo presvedčivo, kde chýbali dôkazy a čo si pripraviť. Slabé témy si potom zopakuješ v ďalšom kole.",
    points: [
      "Konkrétne slabé miesta namiesto všeobecných rád",
      "Opakované kolá, v ktorých vidíš, čo sa zlepšilo",
    ],
    visual: <FeedbackVisual />,
  },
];

export function Pillars() {
  return (
    <section
      id="funkcie"
      aria-labelledby="pillars-title"
      className="relative py-24 md:py-32"
    >
      <div className="container-page">
        <div className="max-w-[46rem]">
          <h2
            id="pillars-title"
            className="type-heading text-[clamp(2.1rem,1.4rem+2.8vw,3.5rem)]"
          >
            Tréning na otázky, nie generátor slidov
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-mute">
            PitchIt ti neurobí deck a nebude ti chváliť každú odpoveď. Je to
            sparingpartner na chvíľu po prezentácii, keď sa začnú otázky.
          </p>
        </div>

        <div className="mt-16 space-y-20 md:mt-20 md:space-y-28">
          {pillars.map((pillar, index) => (
            <article
              key={pillar.id}
              aria-labelledby={`${pillar.id}-title`}
              className="grid items-center gap-10 lg:grid-cols-12 lg:gap-16"
            >
              <div
                className={`lg:col-span-5 ${index % 2 === 1 ? "lg:order-2 lg:col-start-8" : ""}`}
              >
                <h3
                  id={`${pillar.id}-title`}
                  className="type-heading text-[clamp(1.6rem,1.3rem+1.2vw,2.25rem)]"
                >
                  {pillar.title}
                </h3>
                <p className="mt-4 text-lg leading-relaxed text-mute">{pillar.text}</p>
                <ul className="mt-6 space-y-2.5">
                  {pillar.points.map((point) => (
                    <li key={point} className="flex gap-3 text-paper/90">
                      <span
                        aria-hidden="true"
                        className="mt-[0.6em] h-px w-4 shrink-0 bg-signal-soft"
                      />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
              <div
                className={`lg:col-span-6 ${index % 2 === 1 ? "lg:order-1 lg:col-start-1" : "lg:col-start-7"}`}
              >
                {pillar.visual}
              </div>
            </article>
          ))}
        </div>

        <p className="mt-16 text-sm text-faint">
          Ukážky na tejto stránke sú ilustračné. Vychádzajú z vymysleného startupu
          a vymyslených čísel.
        </p>
      </div>
    </section>
  );
}
