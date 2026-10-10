import { DrawnLine } from "@/components/ui/drawn-line";
import { Reveal } from "@/components/ui/reveal";

const steps = [
  {
    title: "Nahraj podklady",
    text: "Pitch deck, kľúčové metriky a kontext stretnutia: s kým sa stretneš, v akej fáze je tvoj startup a koľko získavaš.",
  },
  {
    title: "Absolvuj simuláciu",
    text: "Investor sa pýta na tvoj startup, nie na všeobecný pitch. Keď odpovieš vágne, dopytuje sa ďalej.",
  },
  {
    title: "Dostaň plán zlepšenia",
    text: "Uvidíš, ktoré odpovede neobstáli, prečo, a čo si pripraviť pred ďalším kolom.",
  },
] as const;

export function HowItWorks() {
  return (
    <section
      id="ako-to-funguje"
      aria-labelledby="how-title"
      className="relative bg-ink-2 py-24 md:py-32"
    >
      <div className="container-page">
        <div className="max-w-[42rem]">
          <h2
            id="how-title"
            className="type-heading text-[clamp(2.1rem,1.4rem+2.8vw,3.5rem)]"
          >
            Ako to funguje
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-mute">
            Tri kroky od podkladov k zoznamu vecí, ktoré treba pred stretnutím
            dotiahnuť.
          </p>
        </div>

        <div className="relative mt-16">
          {/* Spojnica krokov */}
          <div
            aria-hidden="true"
            className="absolute top-[1.375rem] right-0 left-0 hidden h-px bg-line md:block"
          >
            <DrawnLine className="h-px w-full bg-signal-soft/70" />
          </div>
          <div
            aria-hidden="true"
            className="absolute top-0 bottom-0 left-[1.375rem] w-px bg-line md:hidden"
          >
            <DrawnLine orientation="vertical" className="h-full w-px bg-signal-soft/70" />
          </div>

          <ol className="relative grid gap-12 md:grid-cols-3 md:gap-10">
            {steps.map((step, index) => (
              <Reveal
                as="li"
                key={step.title}
                delay={0.15 + index * 0.18}
                className="grid grid-cols-[2.75rem_1fr] gap-5 md:block"
              >
                <span className="relative z-10 flex size-11 items-center justify-center rounded-full border border-signal-soft/60 bg-ink-2 text-[15px] font-semibold text-paper">
                  {index + 1}
                </span>
                <div className="md:mt-8">
                  <h3 className="type-heading text-[1.6rem]">{step.title}</h3>
                  <p className="mt-3 max-w-[22rem] leading-relaxed text-mute">
                    {step.text}
                  </p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
