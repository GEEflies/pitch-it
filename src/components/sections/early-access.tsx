import { EarlyAccessForm } from "@/components/sections/early-access-form";
import { isEarlyAccessConfigured } from "@/lib/early-access/store";

const afterSignup = [
  "Uložíme tvoj e-mail a odpovede z formulára. Nič iné.",
  "Keď budú prvé simulácie pripravené, ozveme sa e-mailom.",
  "Súhlas môžeš kedykoľvek odvolať a záznam dáme zmazať.",
];

export function EarlyAccess() {
  const available = isEarlyAccessConfigured();
  const setupHint =
    !available && process.env.NODE_ENV !== "production"
      ? "Vývojárska poznámka: nastav KV_REST_API_URL a KV_REST_API_TOKEN v .env.local a reštartuj server. Postup je v README."
      : null;

  return (
    <section
      id="early-access"
      aria-labelledby="early-access-title"
      className="relative overflow-hidden border-t border-line/70 py-24 md:py-32"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-64 left-1/2 h-[760px] w-[1200px] -translate-x-1/2"
        style={{
          background:
            "radial-gradient(closest-side, rgba(125,81,254,0.22), rgba(125,81,254,0.06) 55%, transparent 78%)",
        }}
      />

      <div className="container-page relative grid gap-12 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-5 lg:pt-2">
          <h2
            id="early-access-title"
            className="type-display text-[clamp(2.5rem,1.4rem+3.6vw,4rem)]"
          >
            Ďalšie stretnutie si natrénuj vopred.
          </h2>
          <p className="mt-6 max-w-[28rem] text-lg leading-relaxed text-mute">
            PitchIt pripravujeme. Zapíš sa na early access a medzi prvými si
            vyskúšaš simuláciu na vlastných podkladoch.
          </p>

          <ul className="mt-10 space-y-4 border-t border-line/70 pt-8">
            {afterSignup.map((item) => (
              <li key={item} className="flex gap-3 leading-relaxed text-paper/85">
                <span
                  aria-hidden="true"
                  className="mt-[0.7em] h-px w-4 shrink-0 bg-signal-soft"
                />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:col-span-6 lg:col-start-7">
          <EarlyAccessForm available={available} setupHint={setupHint} />
        </div>
      </div>
    </section>
  );
}
