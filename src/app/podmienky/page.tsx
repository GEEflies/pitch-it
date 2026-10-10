import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Podmienky používania",
  description: "Podmienky používania služby PitchIt.",
  alternates: { canonical: "/podmienky" },
};

export default function TermsPage() {
  return (
    <LegalPage title="Podmienky používania" updated="10. 10. 2026">
      <LegalSection title="Čo PitchIt je">
        <p>
          PitchIt je tréningový nástroj. Simulovaný investor kladie otázky podľa tvojich podkladov a po tréningu dostaneš rozbor. Simulácia nie je skutočný investor a rozbor nie je predpoveďou rozhodnutia žiadneho investora.
        </p>
        <p>PitchIt neposkytuje investičné, právne, daňové ani finančné poradenstvo.</p>
      </LegalSection>

      <LegalSection title="Účet">
        <ul>
          <li>Službu môžu používať iba osoby staršie ako 18 rokov.</li>
          <li>Za bezpečnosť hesla a aktivitu na účte zodpovedáš ty.</li>
          <li>Do služby nahrávaj iba podklady, na ktoré máš právo. Dôverné informácie tretích strán nahrávaj iba s ich súhlasom.</li>
        </ul>
      </LegalSection>

      <LegalSection title="AI a jej obmedzenia">
        <p>
          Otázky, hodnotenia a ukážky odpovedí vytvára umelá inteligencia. Môžu byť nepresné alebo neúplné. Merania (tempo, pauzy, signály z kamery) sú technické odhady a závisia od zariadenia a prostredia. Rozhodnutia, ktoré na ich základe urobíš, sú tvoje.
        </p>
      </LegalSection>

      <LegalSection title="Plány, limity a platby">
        <p>
          Plán Free má mesačné limity uvedené v cenníku. Plán Pro sa platí mesačne vopred cez platobnú bránu a obnovuje sa automaticky, kým ho nezrušíš. Zrušenie platí ku koncu zaplateného obdobia. Nevyčerpané minúty sa do ďalšieho mesiaca neprenášajú.
        </p>
      </LegalSection>

      <LegalSection title="Zakázané použitie">
        <ul>
          <li>obchádzanie limitov, automatizované používanie bez dohody alebo zaťažovanie služby,</li>
          <li>používanie simulácie na iné účely ako príprava na stretnutia (napríklad generovanie obsahu pre tretie strany),</li>
          <li>nahrávanie nezákonného obsahu.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Ukončenie">
        <p>Účet môžeš kedykoľvek zmazať v nastaveniach. Pri porušení podmienok môžeme účet obmedziť alebo zrušiť.</p>
      </LegalSection>
    </LegalPage>
  );
}
