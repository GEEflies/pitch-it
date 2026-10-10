import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal-page";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Ochrana osobných údajov",
  description: "Ako Pitch It spracúva osobné údaje: účet, podklady, hlasový tréning, kamera a early access.",
  alternates: { canonical: "/ochrana-osobnych-udajov" },
};

export default function PrivacyPage() {
  const { legal, contactEmail } = siteConfig;
  return (
    <LegalPage title="Ochrana osobných údajov" updated="10. 10. 2026">
      <LegalSection title="Kto údaje spracúva">
        <p>
          Prevádzkovateľom je {legal.entityName ? <strong>{legal.entityName}</strong> : "prevádzkovateľ služby Pitch It"}
          {legal.entityId ? <>, IČO {legal.entityId}</> : null}
          {legal.entityAddress ? <>, {legal.entityAddress}</> : null}.
          {contactEmail ? (
            <>
              {" "}
              V otázkach osobných údajov píš na{" "}
              <a href={`mailto:${contactEmail}`} className="link-underline text-paper">
                {contactEmail}
              </a>
              .
            </>
          ) : null}
        </p>
      </LegalSection>

      <LegalSection title="Aké údaje spracúvame a prečo">
        <ul>
          <li>
            <strong>Účet:</strong> e-mail, heslo (iba hash u poskytovateľa autentifikácie), meno, ak ho uvedieš, a záznam o súhlasoch. Účel: poskytovanie služby. Základ: zmluva (čl. 6 ods. 1 písm. b) GDPR).
          </li>
          <li>
            <strong>Profil startupu a podklady:</strong> texty, ktoré zadáš, nahraté PDF a PPTX, z nich vytiahnuté slidy a návrhy faktov. Účel: príprava otázok investora a rozboru. Základ: zmluva.
          </li>
          <li>
            <strong>Hlasový tréning:</strong> hlas sa počas rozhovoru posiela poskytovateľovi AI na prepis a odpovede investora. Ukladáme prepis, časovanie a merania (tempo, pauzy, dĺžka odpovedí, orientačná hlasitosť a výška hlasu). Zvukovú nahrávku neukladáme. Základ: súhlas (čl. 6 ods. 1 písm. a) GDPR), ktorý dávaš pred prvým hlasovým tréningom.
          </li>
          <li>
            <strong>Kamera (voliteľná):</strong> obraz spracúva model priamo v tvojom prehliadači a nikam sa neposiela. Ukladáme iba súhrnné pomery za tréning (napríklad tvár v zábere, natočenie hlavy ku kamere). Nerozpoznávame identitu ani emócie. Základ: súhlas.
          </li>
          <li>
            <strong>Cvičenia:</strong> odpovede (text alebo prepis nahrávky) a ich vyhodnotenie. Nahrávka sa po prepise zahodí.
          </li>
          <li>
            <strong>Spotreba a platby:</strong> počet minút a reportov kvôli limitom plánu; pri platenom pláne identifikátory zákazníka u platobnej brány (údaje o karte nespracúvame).
          </li>
          <li>
            <strong>Prevádzkové udalosti:</strong> anonymné počty (napríklad dokončený tréning) bez obsahu rozhovorov, na zlepšovanie produktu. Základ: oprávnený záujem.
          </li>
          <li>
            <strong>Early access:</strong> e-mail, fáza startupu, termín stretnutia, UTM označenie kampane a dočasný hash IP adresy (maže sa po 24 hodinách). Základ: súhlas.
          </li>
        </ul>
        <p>Údaje nepredávame, nepoužívame ich na reklamné profilovanie ani na trénovanie vlastných modelov.</p>
      </LegalSection>

      <LegalSection title="Sprostredkovatelia">
        <ul>
          <li>Supabase: databáza, autentifikácia a úložisko súborov (región EÚ).</li>
          <li>Anthropic: analýza podkladov, rozbor tréningu, nápoveda, textový režim a vyhodnotenie cvičení.</li>
          <li>OpenAI: hlasový rozhovor a prepis reči.</li>
          <li>Prevádzkovateľ hostingu: doručovanie webu.</li>
          <li>Stripe: platby, iba pri platenom pláne.</li>
        </ul>
        <p>
          Anthropic a OpenAI môžu údaje spracúvať aj mimo EÚ. Prenos sa opiera o zmluvné záruky (štandardné zmluvné doložky) uzavreté v ich podmienkach pre spracovanie údajov.
        </p>
      </LegalSection>

      <LegalSection title="Ako dlho údaje uchovávame">
        <p>
          Projekty, podklady a tréningy uchovávame, kým ich nezmažeš alebo kým nezrušíš účet. V nastaveniach si môžeš zapnúť automatické mazanie tréningov po 30, 90 alebo 365 dňoch. Záznamy o spotrebe uchovávame počas trvania účtu. Zápis na early access uchovávame do odvolania súhlasu, najdlhšie 24 mesiacov.
        </p>
      </LegalSection>

      <LegalSection title="Tvoje práva">
        <p>
          Máš právo na prístup, opravu, vymazanie, obmedzenie spracúvania, prenosnosť a právo namietať. V nastaveniach účtu si stiahneš všetky údaje (JSON), zmažeš tréningy alebo celý účet a odvoláš súhlasy. Odvolanie súhlasu nemá vplyv na zákonnosť spracúvania pred ním.
        </p>
        <p>Sťažnosť môžeš podať Úradu na ochranu osobných údajov Slovenskej republiky (dataprotection.gov.sk).</p>
      </LegalSection>

      <LegalSection title="Cookies">
        <p>Používame iba nevyhnutné cookies na prihlásenie. Nepoužívame analytické, reklamné ani sledovacie cookies.</p>
      </LegalSection>
    </LegalPage>
  );
}
