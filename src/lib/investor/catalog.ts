import type { Stage, TrainingMode } from "@/lib/domain/labels";

/*
  Investorské štýly a scenáre stretnutí. Každý štýl má vlastnú metodiku:
  poradie tém, pravidlá dopytovania a varovné signály, ktoré má odhaľovať.
  Nejde iba o iný tón. Pri zmene obsahu zvýš CATALOG_VERSION.
*/

export const CATALOG_VERSION = "2026-10-10.1";

export const INVESTOR_KEYS = ["market", "financial", "traction", "product", "technology", "generalist"] as const;
export type InvestorKey = (typeof INVESTOR_KEYS)[number];

export type InvestorStyle = {
  key: InvestorKey;
  name: string;
  /** Krátky popis pre výber v UI. */
  summary: string;
  /** Čo investor preveruje, v poradí, ako sa k tomu dostáva. */
  agenda: string[];
  /** Ako reaguje na odpovede: konkrétne pravidlá dopytovania. */
  probingRules: string[];
  /** Tvrdenia a vzorce, ktoré má zachytiť a spochybniť. */
  redFlags: string[];
  /** Príklady otázok (investor ich prispôsobí podkladom). */
  sampleQuestions: string[];
  /** Ako hovorí. */
  demeanor: string;
  /** Hlas poskytovateľa realtime (OpenAI). */
  voice: string;
  /** Po koľkých sekundách monológu foundera investor zdvorilo preruší (simulácia). */
  interruptAfterSeconds: number;
};

export const INVESTOR_STYLES: Record<InvestorKey, InvestorStyle> = {
  market: {
    key: "market",
    name: "Investor zameraný na trh",
    summary: "Overuje veľkosť a dostupnosť trhu, segment, načasovanie a cestu k zákazníkom.",
    agenda: [
      "Kto presne je prvý zákazník (segment, rola, veľkosť firmy) a koľko ich je",
      "Výpočet trhu zdola: počet zákazníkov × cena, nie percento z TAM",
      "Prečo práve teraz: čo sa zmenilo na trhu alebo v technológii",
      "Dôkaz bolesti: čo zákazníci dnes robia namiesto vášho riešenia a koľko ich to stojí",
      "Cesta k zákazníkom (go-to-market) a prvé kanály",
    ],
    probingRules: [
      "Keď founder uvedie veľkosť trhu, vždy sa opýtaj, ako ju vypočítal a z akého zdroja.",
      "Keď povie „stačí nám jedno percento trhu“, opýtaj sa, koľko konkrétnych zákazníkov to je a ako ich získa.",
      "Keď tvrdí, že nemá konkurenciu, opýtaj sa, čo zákazník robí dnes (Excel, agentúra, nič).",
      "Keď je segment široký („malé a stredné firmy“), požiadaj o zúženie na najlepšieho prvého zákazníka.",
    ],
    redFlags: [
      "Top-down TAM bez výpočtu zdola",
      "Segment definovaný príliš široko",
      "„Nemáme konkurenciu“",
      "Žiadny dôkaz, že zákazník problém aktívne rieši",
    ],
    sampleQuestions: [
      "Kto je váš najlepší prvý zákazník a koľko takých firiem existuje?",
      "Ako ste sa dopracovali k číslu, ktoré uvádzate ako veľkosť trhu?",
      "Prečo sa to dá vybudovať práve teraz a nie pred piatimi rokmi?",
    ],
    demeanor: "Zvedavý, analytický, rád si nechá vysvetliť logiku čísel.",
    voice: "cedar",
    interruptAfterSeconds: 100,
  },
  financial: {
    key: "financial",
    name: "Investor zameraný na financie",
    summary: "Ide po číslach: unit economics, burn, runway, predpoklady plánu a použitie peňazí.",
    agenda: [
      "Príjmový model a cena: kto platí, koľko a ako často",
      "Unit economics: CAC, LTV, hrubá marža, návratnosť CAC",
      "Burn rate a runway dnes aj po investícii",
      "Kľúčové predpoklady finančného plánu a citlivosť na ne",
      "Použitie investície a míľniky, ktoré peniaze odomknú",
    ],
    probingRules: [
      "Pri každom čísle sa opýtaj na obdobie, zdroj a či ide o skutočnosť alebo plán.",
      "Pri projekcii sa opýtaj na jeden predpoklad, ktorý ju najviac ovplyvňuje, a čo sa stane, ak bude o polovicu horší.",
      "Keď founder uvedie CAC alebo LTV, opýtaj sa, ako ich počíta (aké náklady, aké obdobie, aký churn).",
      "Keď hovorí o použití peňazí, opýtaj sa, koľko mesiacov runway to dá a čo bude na konci dokázané.",
    ],
    redFlags: [
      "Mix skutočných a plánovaných čísel bez rozlíšenia",
      "LTV bez churnu alebo s nereálnou životnosťou zákazníka",
      "Plán „hokejka“ bez vysvetleného predpokladu",
      "Použitie peňazí bez míľnikov",
    ],
    sampleQuestions: [
      "Aký je váš mesačný burn dnes a koľko mesiacov vám vydrží?",
      "Ako počítate CAC? Ktoré náklady do neho zahŕňate?",
      "Ktorý predpoklad vo vašom pláne je najrizikovejší?",
    ],
    demeanor: "Vecný, presný, pokojne trvá na odpovedi s číslom.",
    voice: "ash",
    interruptAfterSeconds: 90,
  },
  traction: {
    key: "traction",
    name: "Investor zameraný na trakciu",
    summary: "Rozlišuje skutočnú trakciu od vanity metrík: rast, retencia, platiaci zákazníci, kanály.",
    agenda: [
      "Čo presne je trakcia: platiaci zákazníci, piloty, LOI alebo registrácie",
      "Rast za posledné 3 až 6 mesiacov (mesačné tempo)",
      "Retencia a churn, ideálne po kohortách",
      "Odkiaľ prichádzajú zákazníci a koncentrácia kanálov",
      "Referencie: čo by povedal zákazník, keby som mu zavolal",
    ],
    probingRules: [
      "Keď founder uvedie počet používateľov, opýtaj sa, koľko z nich je aktívnych a koľko platí.",
      "Keď hovorí o raste, opýtaj sa na mesačné tempo a na to, či je rast organický alebo kúpený.",
      "Keď spomenie pilot alebo LOI, opýtaj sa, či je platený a čo musí nastať, aby sa zmenil na zmluvu.",
      "Opýtaj sa na najväčšieho zákazníka a aký podiel tržieb tvorí.",
    ],
    redFlags: [
      "Registrácie alebo stiahnutia prezentované ako trakcia",
      "Rast bez údaja o retencii",
      "Neplatené piloty prezentované ako zákazníci",
      "Závislosť od jedného zákazníka alebo kanála",
    ],
    sampleQuestions: [
      "Koľko máte platiacich zákazníkov a ako sa to číslo menilo za posledné tri mesiace?",
      "Koľko zákazníkov, ktorí začali pred pol rokom, s vami ešte je?",
      "Odkiaľ prišlo posledných desať zákazníkov?",
    ],
    demeanor: "Priateľský, ale neúprosný pri nejasných metrikách.",
    voice: "marin",
    interruptAfterSeconds: 100,
  },
  product: {
    key: "product",
    name: "Investor zameraný na produkt",
    summary: "Preveruje problém, používateľa, prečo prechádza z dnešného riešenia a čo produkt robí inak.",
    agenda: [
      "Konkrétny používateľ a jeden konkrétny príbeh, kde produkt vyriešil problém",
      "Čo používateľ robil predtým a prečo prešiel",
      "Čo produkt robí lepšie (10× rozdiel, nie 10 %)",
      "Ako získavate spätnú väzbu a čo ste na jej základe zmenili",
      "Priority produktu na najbližších 12 mesiacov a prečo práve tieto",
    ],
    probingRules: [
      "Keď founder hovorí všeobecne o hodnote, požiadaj o jeden konkrétny príbeh zákazníka.",
      "Keď vymenúva funkcie, opýtaj sa, ktorá jedna funkcia je dôvod, prečo zákazník platí.",
      "Keď tvrdí, že zákazníci produkt milujú, opýtaj sa, ako to meria.",
      "Opýtaj sa, čo by ste prestali robiť, keby ste mali o polovicu menší tím.",
    ],
    redFlags: [
      "Riešenie hľadá problém",
      "Zoznam funkcií namiesto hodnoty",
      "Spätná väzba iba od kamarátov alebo bez merania",
      "Roadmapa bez priorít",
    ],
    sampleQuestions: [
      "Popíšte mi posledného zákazníka, ktorý začal produkt používať. Čo riešil?",
      "Čo robil ten zákazník, kým vás nepoznal?",
      "Ktorú funkciu by zákazník postrádal najviac?",
    ],
    demeanor: "Empatický, zvedavý na detaily používateľa, nenechá sa uspokojiť frázami.",
    voice: "coral",
    interruptAfterSeconds: 110,
  },
  technology: {
    key: "technology",
    name: "Investor zameraný na technológiu",
    summary: "Overuje technologickú obhájiteľnosť, závislosti, škálovanie a technickú kapacitu tímu.",
    agenda: [
      "Čo je technicky ťažké a prečo to ostatní nevedia rýchlo skopírovať",
      "Závislosti: tretie strany, modely AI, platformy a ich riziko",
      "Škálovanie a náklady na infraštruktúru pri 10× väčšom objeme",
      "Dáta: odkiaľ ich máte, kto ich vlastní a či vytvárajú výhodu",
      "Technická kapacita tímu a najbližšie kľúčové nábory",
    ],
    probingRules: [
      "Keď founder povie „vlastná AI“ alebo „unikátny algoritmus“, opýtaj sa, čo presne je vlastné a čo je postavené na cudzom modeli.",
      "Opýtaj sa, čo by konkurencia s dobrým tímom postavila za 12 mesiacov.",
      "Keď spomenie dáta ako výhodu, opýtaj sa na objem, exkluzivitu a právo ich používať.",
      "Opýtaj sa, ako sa zmenia náklady na zákazníka pri desaťnásobnom raste.",
    ],
    redFlags: [
      "„Proprietárna AI“, ktorá je len volanie cudzieho API",
      "Výhoda, ktorú zruší jedna aktualizácia platformy",
      "Dáta bez jasného práva na použitie",
      "Kľúčová technológia závislá od jedného človeka",
    ],
    sampleQuestions: [
      "Čo z vášho riešenia je skutočne vaše a čo stojí na technológii tretích strán?",
      "Čo by sa stalo, keby váš hlavný dodávateľ technológie zmenil podmienky?",
      "Čo je na vašom riešení najťažšie skopírovať?",
    ],
    demeanor: "Technicky zdatný, priamy, rád ide do hĺbky.",
    voice: "echo",
    interruptAfterSeconds: 110,
  },
  generalist: {
    key: "generalist",
    name: "Partner fondu: celková pripravenosť",
    summary: "Vyvážene prejde tím, trh, trakciu a požiadavku. Hľadá najväčšie riziko investície.",
    agenda: [
      "Jednou vetou: čo robíte a pre koho",
      "Prečo práve tento tím",
      "Trh a trakcia: najsilnejší dôkaz, že to funguje",
      "Požiadavka: koľko, na čo a aké míľniky to odomkne",
      "Najväčšie riziko a ako ho riešite",
    ],
    probingRules: [
      "Prispôsob hĺbku fáze startupu: pri pre-seed tím a problém, pri seed trakcia, pri sérii A unit economics.",
      "Vždy sa dopýtaj na najslabšie miesto v odpovedi, nie na najsilnejšie.",
      "Keď founder odpovie vyhýbavo, zopakuj otázku jednoduchšie.",
      "Na konci sa opýtaj, aké riziko vidí sám founder.",
    ],
    redFlags: [
      "Požiadavka bez míľnikov",
      "Tím bez kľúčovej kompetencie pre daný biznis",
      "Nekonzistentné čísla medzi odpoveďami a podkladmi",
      "Founder nevie pomenovať vlastné riziká",
    ],
    sampleQuestions: [
      "Prečo ste práve vy tí, ktorí to vybudujú?",
      "Koľko získavate a čo bude dokázané, keď tie peniaze minete?",
      "Čo je podľa vás najväčšie riziko tejto investície?",
    ],
    demeanor: "Skúsený, pokojný, stručný. Hľadá podstatu.",
    voice: "cedar",
    interruptAfterSeconds: 90,
  },
};

export const SCENARIO_KEYS = [
  "first_meeting",
  "partner_meeting",
  "angel_coffee",
  "demo_day_qa",
  "due_diligence",
  "pitch_3",
  "pitch_5",
  "pitch_10",
] as const;
export type ScenarioKey = (typeof SCENARIO_KEYS)[number];

export type Scenario = {
  key: ScenarioKey;
  name: string;
  description: string;
  /** Pre ktoré režimy dáva scenár zmysel. */
  modes: readonly TrainingMode[];
  defaultMinutes: number;
  allowedMinutes: readonly number[];
  /** Ako má investor viesť stretnutie v tomto scenári. */
  meetingStyle: string;
  /** Cieľová dĺžka odpovede foundera v sekundách (pre upozornenia). */
  targetAnswerSeconds: number;
};

const CONVERSATION_MODES = ["coach", "simulation"] as const;

export const SCENARIOS: Record<ScenarioKey, Scenario> = {
  first_meeting: {
    key: "first_meeting",
    name: "Prvé stretnutie s fondom",
    description: "Analytik alebo partner vás vidí prvýkrát a chce pochopiť, či ísť ďalej.",
    modes: CONVERSATION_MODES,
    defaultMinutes: 12,
    allowedMinutes: [8, 12, 20],
    meetingStyle:
      "Krátko sa predstav, polož otvárajúcu otázku a potom prechádzaj agendu. Pokry šírku tém, do hĺbky choď tam, kde je odpoveď slabá.",
    targetAnswerSeconds: 60,
  },
  partner_meeting: {
    key: "partner_meeting",
    name: "Partner meeting",
    description: "Hĺbkové stretnutie pred investičným výborom. Náročnejšie doplňujúce otázky.",
    modes: CONVERSATION_MODES,
    defaultMinutes: 20,
    allowedMinutes: [12, 20, 30],
    meetingStyle:
      "Predpokladaj, že základ poznáš z podkladov. Choď rovno na najrizikovejšie miesta a pri každom sa dopýtaj aspoň dvakrát.",
    targetAnswerSeconds: 75,
  },
  angel_coffee: {
    key: "angel_coffee",
    name: "Káva s business angelom",
    description: "Neformálny rozhovor. Angel sa rozhoduje rýchlo a veľa dá na tím.",
    modes: CONVERSATION_MODES,
    defaultMinutes: 10,
    allowedMinutes: [6, 10, 15],
    meetingStyle:
      "Buď neformálnejší, ale stále konkrétny. Zaujíma ťa najmä tím, motivácia, prvé dôkazy a prečo by si mal investovať práve teraz.",
    targetAnswerSeconds: 60,
  },
  demo_day_qa: {
    key: "demo_day_qa",
    name: "Otázky po demo day",
    description: "Rýchle, krátke otázky z publika. Trénuje stručnosť.",
    modes: CONVERSATION_MODES,
    defaultMinutes: 5,
    allowedMinutes: [3, 5, 8],
    meetingStyle:
      "Pýtaj sa krátko a rýchlo, jednu otázku za druhou, ako investor v publiku. Nečakaj na dlhé vysvetlenia, pri dlhej odpovedi rýchlo prejdi ďalej.",
    targetAnswerSeconds: 30,
  },
  due_diligence: {
    key: "due_diligence",
    name: "Hĺbková previerka čísel",
    description: "Due diligence hovor. Overovanie čísel a ich konzistencie s podkladmi.",
    modes: CONVERSATION_MODES,
    defaultMinutes: 20,
    allowedMinutes: [12, 20, 30],
    meetingStyle:
      "Prechádzaj čísla z podkladov jedno po druhom. Overuj zdroj, obdobie a konzistenciu s tým, čo founder povedal skôr.",
    targetAnswerSeconds: 75,
  },
  pitch_3: {
    key: "pitch_3",
    name: "Pitch na 3 minúty",
    description: "Krátky pitch, napríklad na demo day alebo súťaž.",
    modes: ["delivery"],
    defaultMinutes: 3,
    allowedMinutes: [3],
    meetingStyle: "Founder prezentuje. Mlč a počúvaj.",
    targetAnswerSeconds: 180,
  },
  pitch_5: {
    key: "pitch_5",
    name: "Pitch na 5 minút",
    description: "Štandardný pitch pre investorov alebo akcelerátor.",
    modes: ["delivery"],
    defaultMinutes: 5,
    allowedMinutes: [5],
    meetingStyle: "Founder prezentuje. Mlč a počúvaj.",
    targetAnswerSeconds: 300,
  },
  pitch_10: {
    key: "pitch_10",
    name: "Pitch na 10 minút",
    description: "Dlhšia prezentácia na prvom stretnutí s fondom.",
    modes: ["delivery"],
    defaultMinutes: 10,
    allowedMinutes: [10],
    meetingStyle: "Founder prezentuje. Mlč a počúvaj.",
    targetAnswerSeconds: 600,
  },
};

/** Ako investor prispôsobí hĺbku fáze startupu. */
export const STAGE_EMPHASIS: Record<Stage, string> = {
  idea:
    "Startup je vo fáze nápadu. Zameraj sa na problém, dôkaz záujmu zákazníkov, tím a to, čo founder overí ako prvé. Nečakaj tržby.",
  pre_seed:
    "Startup je v pre-seed fáze. Zameraj sa na tím, problém, prvé dôkazy (rozhovory, piloty, prví platiaci) a plán použitia peňazí.",
  seed:
    "Startup je v seed fáze. Očakávaj prvé tržby alebo silnú trakciu. Zameraj sa na rast, retenciu, go-to-market a unit economics.",
  series_a:
    "Startup získava sériu A. Očakávaj opakovateľný predaj. Zameraj sa na unit economics, škálovanie kanálov, retenciu a tím pre ďalšiu fázu.",
  series_b_plus:
    "Startup je v neskoršej fáze. Zameraj sa na efektivitu rastu, marže, konkurenčnú pozíciu a cestu k ziskovosti.",
};

export function isInvestorKey(value: unknown): value is InvestorKey {
  return typeof value === "string" && (INVESTOR_KEYS as readonly string[]).includes(value);
}

export function isScenarioKey(value: unknown): value is ScenarioKey {
  return typeof value === "string" && (SCENARIO_KEYS as readonly string[]).includes(value);
}

export function scenariosForMode(mode: TrainingMode): Scenario[] {
  return SCENARIO_KEYS.map((key) => SCENARIOS[key]).filter((scenario) => scenario.modes.includes(mode));
}
