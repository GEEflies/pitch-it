import type { PitchAttemptRow } from "@/lib/db/types";

/*
  Výsledok analýzy, ktorý vrátil server pri odoslaní nahrávky. Feedback ho ukáže, aj keď
  server pokus nenájde (napr. bez trvalého úložiska ho iná inštancia nevidí).
  Pamäť karty + sessionStorage, aby prežil aj obnovenie stránky.
*/

const KEY = "pitchit-last-attempt";
let last: PitchAttemptRow | null = null;

export function keepLocalAttempt(attempt: PitchAttemptRow) {
  last = attempt;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(attempt));
  } catch {
    // bez sessionStorage vydrží len do obnovenia stránky
  }
}

export function getLocalAttempt(id: string): PitchAttemptRow | null {
  if (last?.id === id) return last;
  try {
    const raw = sessionStorage.getItem(KEY);
    const stored = raw ? (JSON.parse(raw) as PitchAttemptRow) : null;
    return stored?.id === id ? stored : null;
  } catch {
    return null;
  }
}
