export type DemoAnswer = {
  id: "a" | "b";
  label: string;
  text: string;
  followUp: string;
  feedback: {
    worked: string;
    missing: string;
    practice: string;
  };
};

export type DemoScenario = {
  id: string;
  topic: string;
  question: string;
  answers: [DemoAnswer, DemoAnswer];
};

/*
  Pripravené ukážky z vymysleného startupu (B2B softvér pre e-shopy).
  Nejde o výstup živej AI, iba o ilustráciu, ako simulácia reaguje.
*/
export const demoScenarios: DemoScenario[] = [
  {
    id: "trh",
    topic: "Trh",
    question:
      "Na slide uvádzate trh 4,2 miliardy eur. Koľko z toho dokážete reálne osloviť v najbližších troch rokoch?",
    answers: [
      {
        id: "a",
        label: "Všeobecná odpoveď",
        text: "Trh je obrovský a stále rastie. Aj keby sme získali iba jedno percento, je to 42 miliónov eur.",
        followUp:
          "Jedno percento z čoho presne? Koľko zákazníkov to je a ako sa k nim dostanete?",
        feedback: {
          worked: "Odpoveď je krátka a znie sebaisto.",
          missing:
            "Argument „stačí nám jedno percento“ nehovorí, kto sú zákazníci ani ako ich získate. Investor sa preto opýta znova.",
          practice:
            "Výpočet trhu zdola: počet firiem v segmente krát ročná cena. Začni segmentom, ktorému predávaš dnes.",
        },
      },
      {
        id: "b",
        label: "Konkrétna odpoveď",
        text: "Tých 4,2 miliardy je celá Európa. Cielime na e-shopy na Slovensku, v Česku a v Poľsku s obratom nad milión eur. Je ich zhruba 6 000. Pri cene 3 000 eur ročne je to 18 miliónov eur, a to je náš reálny trh na tri roky.",
        followUp:
          "Dobre. Koľko z tých 6 000 firiem ste už oslovili a koľko z nich platí?",
        feedback: {
          worked:
            "Ukazuješ výpočet zdola a je jasné, z čoho číslo vzniklo.",
          missing:
            "Chýba zdroj čísla 6 000. Investor sa naň opýta skôr či neskôr.",
          practice:
            "Maj pripravený zdroj odhadu a čísla z doterajšieho predaja: oslovení, ukážky produktu, platiaci.",
        },
      },
    ],
  },
  {
    id: "unit-economics",
    topic: "Unit economics",
    question:
      "Váš CAC je dnes 40 eur. Čo sa s ním stane, keď vyčerpáte organické kanály?",
    answers: [
      {
        id: "a",
        label: "Všeobecná odpoveď",
        text: "Myslíme si, že zostane podobný. Máme silnú značku a veľa ľudí nás odporúča ďalej.",
        followUp:
          "Koľko nových zákazníkov dnes prichádza z odporúčaní? A skúšali ste už platené kanály?",
        feedback: {
          worked: "Spomínaš odporúčania, ktoré môžu byť reálnou výhodou.",
          missing:
            "„Myslíme si“ bez dát. Investor potrebuje vedieť, či rast nezastane, keď sa organické kanály vyčerpajú.",
          practice:
            "Rozdeľ CAC podľa kanálov a priprav výsledok aspoň jedného testu platenej akvizície.",
        },
      },
      {
        id: "b",
        label: "Konkrétna odpoveď",
        text: "Dnes máme 70 % zákazníkov z organiky. Do platených kanálov sme v teste dali 2 000 eur a CAC tam vyšiel 95 eur. Pri LTV 400 eur to stále dáva zmysel, len sa návratnosť predĺži z troch na sedem mesiacov.",
        followUp:
          "Sedem mesiacov je v poriadku. Ako sa zmení LTV, ak budú zákazníci z platených kanálov odchádzať rýchlejšie?",
        feedback: {
          worked:
            "Pracuješ s reálnym testom a priznávaš, že sa čísla zhoršia.",
          missing:
            "Test za 2 000 eur je malá vzorka. Povedz to skôr, než to povie investor.",
          practice:
            "Retenciu podľa kanála, z ktorého zákazník prišiel. Presne tam smeruje ďalšia otázka.",
        },
      },
    ],
  },
  {
    id: "konkurencia",
    topic: "Konkurencia",
    question:
      "Čo urobíte, keď rovnakú funkciu spustí platforma, na ktorej vaši zákazníci predávajú?",
    answers: [
      {
        id: "a",
        label: "Všeobecná odpoveď",
        text: "Nemyslím si, že to urobia. Sú príliš veľkí a pomalí, my sme rýchlejší.",
        followUp:
          "Rýchlosť vám pomáha iba dovtedy, kým to nespustia. Čo vám zostane potom?",
        feedback: {
          worked: "Rýchlosť malého tímu je v začiatkoch reálna výhoda.",
          missing:
            "Odpoveď riziko spochybňuje, namiesto toho, aby ho riešila. Investor chce počuť, čo sa dá ťažko skopírovať.",
          practice:
            "Pomenuj, čo budete mať o 18 mesiacov a platforma nie: dáta, integrácie, segment, o ktorý nemá záujem.",
        },
      },
      {
        id: "b",
        label: "Konkrétna odpoveď",
        text: "Je to reálne riziko. Preto nestaviame iba funkciu, ale napojenie na účtovníctvo a sklad, ktoré platforma robiť nebude. Používa ho 40 % zákazníkov a tí od nás odchádzajú trikrát menej.",
        followUp:
          "Zaujímavé. Je tých 40 % výsledok vášho onboardingu, alebo sa to deje samo?",
        feedback: {
          worked:
            "Priznávaš riziko a hneď ukazuješ, čo sa dá ťažko skopírovať, aj s dátami.",
          missing:
            "„Trikrát menej“ potrebuje časové obdobie a veľkosť vzorky.",
          practice:
            "Kohortnú analýzu zákazníkov s napojením a bez neho.",
        },
      },
    ],
  },
];
