/*
  Riadiace poznámky, ktoré klient posiela investorovi počas relácie.
  Investor ich pozná z inštrukcií (sekcia „Začiatok a koniec“).
*/

export const CONTROL_NOTES = {
  kickoff: "Stretnutie začína. Pozdrav foundera jednou vetou a polož prvú otázku.",
  resume: "Spojenie je obnovené. Nadviaž podľa pokynov a pokračuj.",
  timeAlmostUp: "[Systémová poznámka] Zostáva približne minúta. Polož poslednú otázku.",
  timeUp: "[Systémová poznámka] Čas vypršal. Krátko sa rozlúč jednou vetou a zavolaj nástroj na ukončenie stretnutia.",
  interrupt:
    "[Systémová poznámka] Founder hovorí príliš dlho. Zdvorilo ho preruš jednou vetou a vráť ho k podstate otázky.",
} as const;

/** Kedy poslať upozornenie, že čas končí (sekundy pred koncom). */
export const TIME_WARNING_BEFORE_END_SECONDS = 60;

/** Rezerva, ktorú klient po vypršaní času dá investorovi na rozlúčku. */
export const WRAP_UP_GRACE_SECONDS = 25;
