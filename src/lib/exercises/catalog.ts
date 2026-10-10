import type { ExerciseCategory, ExerciseKind } from "@/lib/domain/labels";
import type { InvestorKey, ScenarioKey } from "@/lib/investor/catalog";

/*
  Knižnica cvičení. Každé cvičenie trénuje jednu zručnosť; kritériá úspechu
  sú konkrétne a kontrolovateľné v prepise odpovede.
*/

export type ExerciseTemplate = {
  key: string;
  category: ExerciseCategory;
  kind: ExerciseKind;
  title: string;
  /** Otázka investora. {startup} sa nahradí názvom projektu. */
  prompt: string;
  rationale: string;
  successCriteria: string[];
  timeLimitSeconds: number;
  /** Pre mini simuláciu a prednes: s akým investorom a scenárom sa spustí. */
  simulation?: { investorKey: InvestorKey; scenarioKey: ScenarioKey; minutes: number };
};

export const EXERCISE_LIBRARY: ExerciseTemplate[] = [
  {
    key: "market-bottom-up",
    category: "market",
    kind: "answer_drill",
    title: "Veľkosť trhu výpočtom zdola",
    prompt: "Ako veľký je trh pre {startup}? Ukážte mi, ako ste sa k tomu číslu dopracovali.",
    rationale: "Investori neveria top-down TAM. Chcú vidieť počet zákazníkov × cenu.",
    successCriteria: [
      "Pomenuje konkrétny cieľový segment",
      "Uvedie počet potenciálnych zákazníkov a zdroj",
      "Vynásobí cenou a povie výsledok",
      "Odlíši celý trh od trhu, ktorý reálne osloví v 3 rokoch",
    ],
    timeLimitSeconds: 75,
  },
  {
    key: "market-why-now",
    category: "market",
    kind: "answer_drill",
    title: "Prečo práve teraz",
    prompt: "Prečo sa {startup} dá vybudovať práve teraz a nie pred piatimi rokmi?",
    rationale: "Načasovanie je častá otázka. Odpoveď má ukázať konkrétnu zmenu na trhu alebo v technológii.",
    successCriteria: [
      "Pomenuje konkrétnu zmenu (regulácia, technológia, správanie zákazníkov)",
      "Vysvetlí, prečo táto zmena otvára príležitosť",
      "Podloží zmenu dátami alebo príkladom",
    ],
    timeLimitSeconds: 60,
  },
  {
    key: "financials-burn-runway",
    category: "financials",
    kind: "answer_drill",
    title: "Burn, runway a použitie peňazí",
    prompt: "Aký je váš mesačný burn, koľko mesiacov runway vám dá táto investícia a čo bude na konci dokázané?",
    rationale: "Investor overuje, či founder pozná svoje čísla a či investícia vedie k merateľným míľnikom.",
    successCriteria: [
      "Uvedie mesačný burn s obdobím",
      "Uvedie runway po investícii v mesiacoch",
      "Pomenuje 2 až 3 merateľné míľniky",
    ],
    timeLimitSeconds: 75,
  },
  {
    key: "financials-assumption",
    category: "financials",
    kind: "answer_drill",
    title: "Najrizikovejší predpoklad plánu",
    prompt: "Ktorý predpoklad vo vašom finančnom pláne je najrizikovejší a čo sa stane, ak bude o polovicu horší?",
    rationale: "Founder, ktorý pozná citlivosť plánu, pôsobí dôveryhodne.",
    successCriteria: [
      "Pomenuje jeden konkrétny predpoklad",
      "Vysvetlí dopad, ak bude horší",
      "Povie, ako riziko znižuje alebo overuje",
    ],
    timeLimitSeconds: 75,
  },
  {
    key: "competition-moat",
    category: "competition",
    kind: "answer_drill",
    title: "Čo sa nedá ľahko skopírovať",
    prompt: "Čo urobíte, keď rovnakú funkciu spustí veľký hráč na vašom trhu?",
    rationale: "Odpoveď nemá riziko popierať, ale ukázať obhájiteľnú výhodu.",
    successCriteria: [
      "Prizná riziko namiesto popierania",
      "Pomenuje konkrétnu výhodu (dáta, integrácie, segment, distribúcia)",
      "Podloží výhodu dátami alebo príkladom",
    ],
    timeLimitSeconds: 60,
  },
  {
    key: "traction-quality",
    category: "traction_unit_economics",
    kind: "answer_drill",
    title: "Kvalita trakcie",
    prompt: "Koľko máte platiacich zákazníkov, ako rýchlo rastiete a koľko zákazníkov s vami ostáva?",
    rationale: "Investor odlišuje platiacich zákazníkov od registrácií a pilotov.",
    successCriteria: [
      "Odlíši platiacich od neplatiacich",
      "Uvedie tempo rastu s obdobím",
      "Uvedie retenciu alebo churn",
    ],
    timeLimitSeconds: 60,
  },
  {
    key: "unit-economics",
    category: "traction_unit_economics",
    kind: "answer_drill",
    title: "CAC, LTV a návratnosť",
    prompt: "Koľko vás stojí získať zákazníka, koľko na ňom zarobíte a za ako dlho sa vám náklad vráti?",
    rationale: "Unit economics ukazujú, či rast dáva ekonomický zmysel.",
    successCriteria: [
      "Uvedie CAC a z čoho sa počíta",
      "Uvedie LTV alebo hrubú maržu na zákazníka",
      "Uvedie dobu návratnosti CAC",
    ],
    timeLimitSeconds: 75,
  },
  {
    key: "team-why-us",
    category: "team",
    kind: "answer_drill",
    title: "Prečo práve vy",
    prompt: "Prečo ste práve vy tí, ktorí {startup} vybudujú?",
    rationale: "Pri skorých fázach investor investuje najmä do tímu.",
    successCriteria: [
      "Pomenuje relevantnú skúsenosť alebo nespravodlivú výhodu tímu",
      "Prepojí ju s tým, čo je na biznise najťažšie",
      "Prizná medzeru v tíme a plán, ako ju doplniť",
    ],
    timeLimitSeconds: 60,
  },
  {
    key: "ask-clear",
    category: "fundraising_ask",
    kind: "answer_drill",
    title: "Jasná požiadavka",
    prompt: "Koľko získavate, za akých podmienok a na čo presne tie peniaze použijete?",
    rationale: "Nejasná požiadavka je jeden z najčastejších dôvodov, prečo stretnutie nikam nevedie.",
    successCriteria: [
      "Uvedie sumu a typ kola alebo nástroja",
      "Rozdelí použitie peňazí do 2 až 4 položiek",
      "Pomenuje míľniky, ktoré peniaze odomknú",
    ],
    timeLimitSeconds: 60,
  },
  {
    key: "concise-30s",
    category: "concise_answers",
    kind: "answer_drill",
    title: "Odpoveď do 30 sekúnd",
    prompt: "Jednou-dvoma vetami: čo robíte, pre koho a prečo to zákazníci potrebujú?",
    rationale: "Krátka a jasná odpoveď ukazuje, že founder pozná podstatu biznisu.",
    successCriteria: [
      "Zmestí sa do 30 sekúnd",
      "Pomenuje zákazníka a jeho problém",
      "Neobsahuje žargón ani zoznam funkcií",
    ],
    timeLimitSeconds: 30,
  },
  {
    key: "concise-demo-day",
    category: "concise_answers",
    kind: "mini_simulation",
    title: "Rýchle otázky ako po demo day",
    prompt: "Päť minút krátkych otázok. Odpovedaj stručne, investor rýchlo strieda témy.",
    rationale: "Trénuje stručnosť pod tlakom.",
    successCriteria: ["Väčšina odpovedí do 30 sekúnd", "Každá odpoveď začína pointou"],
    timeLimitSeconds: 300,
    simulation: { investorKey: "generalist", scenarioKey: "demo_day_qa", minutes: 5 },
  },
  {
    key: "tough-follow-ups",
    category: "tough_follow_ups",
    kind: "mini_simulation",
    title: "Náročné doplňujúce otázky",
    prompt: "Partner fondu ide rovno na najslabšie miesta a dopytuje sa aspoň dvakrát.",
    rationale: "Trénuje pokoj a konkrétnosť pri opakovanom dopytovaní.",
    successCriteria: ["Na doplňujúcu otázku odpovie konkrétnejšie než prvýkrát", "Prizná, čo nevie, a povie, ako to zistí"],
    timeLimitSeconds: 600,
    simulation: { investorKey: "generalist", scenarioKey: "partner_meeting", minutes: 12 },
  },
  {
    key: "full-pitch-3",
    category: "full_pitch",
    kind: "pitch_timed",
    title: "Celý pitch za 3 minúty",
    prompt: "Odprezentuj celý pitch v časovom limite 3 minúty.",
    rationale: "Trénuje štruktúru a tempo pri krátkom pitchi.",
    successCriteria: ["Pokryje problém, riešenie, trh, trakciu, tím a požiadavku", "Zmestí sa do limitu"],
    timeLimitSeconds: 180,
    simulation: { investorKey: "generalist", scenarioKey: "pitch_3", minutes: 3 },
  },
  {
    key: "full-pitch-5",
    category: "full_pitch",
    kind: "pitch_timed",
    title: "Celý pitch za 5 minút",
    prompt: "Odprezentuj celý pitch v časovom limite 5 minút.",
    rationale: "Štandardná dĺžka pitchu pre investorov a akcelerátory.",
    successCriteria: ["Pokryje všetky prvky pitchu", "Zmestí sa do limitu", "Tempo bez zrýchľovania na konci"],
    timeLimitSeconds: 300,
    simulation: { investorKey: "generalist", scenarioKey: "pitch_5", minutes: 5 },
  },
];

export function findTemplate(key: string): ExerciseTemplate | null {
  return EXERCISE_LIBRARY.find((template) => template.key === key) ?? null;
}

export function personalizePrompt(prompt: string, startupName: string | null): string {
  return prompt.replaceAll("{startup}", startupName?.trim() || "váš startup");
}

/** Investor pre mini simuláciu z cvičenia vytvoreného z reportu (podľa kategórie). */
export const CATEGORY_INVESTOR: Record<ExerciseCategory, InvestorKey> = {
  market: "market",
  financials: "financial",
  competition: "product",
  traction_unit_economics: "traction",
  team: "generalist",
  fundraising_ask: "financial",
  concise_answers: "generalist",
  tough_follow_ups: "generalist",
  full_pitch: "generalist",
};
