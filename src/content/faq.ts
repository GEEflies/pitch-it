export type FaqItem = { id: string; question: string; answer: string[] };

export const faqItems: FaqItem[] = [
  {
    id: "ako-funguje",
    question: "Ako simulácia funguje?",
    answer: [
      "Z tvojich podkladov a kontextu stretnutia pripraví simulácia témy, na ktoré sa investor pravdepodobne zameria. Počas rozhovoru kladie otázky a podľa tvojich odpovedí sa dopytuje ďalej.",
      "Na konci dostaneš rozbor: ktoré odpovede obstáli, kde chýbali dôkazy a čo si pripraviť pred ďalším kolom.",
    ],
  },
  {
    id: "pre-koho",
    question: "Pre koho je PitchIt určený?",
    answer: [
      "Pre founderov, ktorí sa chystajú na stretnutie s angel investorom alebo fondom. Najviac pomôže startupom v pre-seed a seed fáze.",
      "Oplatí sa aj vtedy, keď stretnutie ešte nemáš dohodnuté a chceš zistiť, kde máš medzery.",
    ],
  },
  {
    id: "podklady",
    question: "Čo sa stane s mojimi podkladmi?",
    answer: [
      "Podklady slúžia iba na prípravu tvojich simulácií a rozboru. Nezdieľame ich s investormi ani s nikým ďalším a kedykoľvek ich zmažeš.",
      "Na analýzu používame AI od Anthropic, hlasový rozhovor zabezpečuje OpenAI. Zvukovú nahrávku neukladáme a video z kamery sa spracúva iba v tvojom prehliadači. Podrobnosti sú v zásadách ochrany osobných údajov.",
    ],
  },
  {
    id: "skutocny-investor",
    question: "Je simulácia rovnaká ako skutočný investor?",
    answer: [
      "Nie. Simulácia vychádza z typov otázok, ktoré na investorských stretnutiach bežne zaznievajú, a prispôsobuje ich tvojim podkladom. Každý investor je však iný.",
      "PitchIt ti pomôže odhaliť slabé miesta. Skutočný rozhovor nenahradí.",
    ],
  },
  {
    id: "garancia",
    question: "Čo PitchIt nedokáže zaručiť?",
    answer: [
      "Nezaručí ti investíciu, konkrétne ohodnotenie ani to, že na stretnutí padnú presne tie otázky, ktoré si natrénuješ. Nie je to investičné, právne ani finančné poradenstvo.",
      "Jeho cieľom sú lepšie premyslené odpovede, s ktorými na stretnutie pôjdeš.",
    ],
  },
  {
    id: "mentor",
    question: "Nahradí PitchIt mentora alebo akcelerátor?",
    answer: [
      "Nie. Mentor ti dá skúsenosť, kontakty a pohľad zvonku. PitchIt ti dá možnosť trénovať odpovede vtedy, keď to potrebuješ, aj večer pred stretnutím.",
    ],
  },
  {
    id: "cena",
    question: "Koľko to stojí?",
    answer: [
      "Plán Free obsahuje 20 minút hlasového tréningu a 3 rozbory mesačne. Plán Pro stojí 29 € mesačne a obsahuje 180 minút a 40 rozborov.",
      "Limity sú v minútach, lebo každá minúta rozhovoru s AI investorom stojí reálne peniaze. Platený plán zrušíš kedykoľvek.",
    ],
  },
];
