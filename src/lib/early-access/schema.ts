/*
  Zdieľaná validácia pre klienta aj server. Bez závislostí, aby sa dala
  spustiť aj v Node teste a nepridávala nič navyše do klientskeho bundlu.
*/

export const STAGE_OPTIONS = [
  { value: "idea", label: "Nápad" },
  { value: "pre_seed", label: "Pre-seed" },
  { value: "seed", label: "Seed" },
  { value: "series_a_plus", label: "Séria A a ďalej" },
] as const;

export const MEETING_OPTIONS = [
  { value: "within_2_weeks", label: "Do 2 týždňov" },
  { value: "within_3_months", label: "Do 3 mesiacov" },
  { value: "not_planned", label: "Zatiaľ nemám dohodnuté" },
] as const;

export type Stage = (typeof STAGE_OPTIONS)[number]["value"];
export type NextMeeting = (typeof MEETING_OPTIONS)[number]["value"];

/** Verzia textu súhlasu. Pri zmene textu ju zvýš. */
export const CONSENT_VERSION = "2026-10-10";

/** Skryté pole proti botom. Človek ho nevidí ani nevyplní. */
export const HONEYPOT_FIELD = "company_website";

export const EMAIL_MAX_LENGTH = 254;
const UTM_MAX_LENGTH = 100;

export type EarlyAccessField = "email" | "stage" | "nextMeeting" | "consent";
export type FieldErrors = Partial<Record<EarlyAccessField, string>>;

export type EarlyAccessRawInput = {
  email: unknown;
  stage: unknown;
  nextMeeting: unknown;
  consent: unknown;
};

export type EarlyAccessData = {
  email: string;
  stage: Stage;
  nextMeeting: NextMeeting | null;
};

export type ValidationResult =
  | { ok: true; data: EarlyAccessData }
  | { ok: false; errors: FieldErrors };

// Pragmatická kontrola: jeden @, bez medzier, doména s bodkou a TLD aspoň 2 znaky.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)*\.[^\s@.]{2,}$/;

const stageValues = new Set<string>(STAGE_OPTIONS.map((option) => option.value));
const meetingValues = new Set<string>(MEETING_OPTIONS.map((option) => option.value));

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function validateEarlyAccess(raw: EarlyAccessRawInput): ValidationResult {
  const errors: FieldErrors = {};

  const email = normalizeEmail(asTrimmedString(raw.email));
  if (!email) {
    errors.email = "Zadaj e-mail, na ktorý ti dáme vedieť o spustení.";
  } else if (email.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(email)) {
    errors.email = "Tento e-mail nevyzerá správne. Skontroluj zavináč a doménu.";
  }

  const stage = asTrimmedString(raw.stage);
  if (!stage) {
    errors.stage = "Vyber fázu, v ktorej je tvoj startup.";
  } else if (!stageValues.has(stage)) {
    errors.stage = "Vyber jednu z ponúkaných fáz.";
  }

  const nextMeeting = asTrimmedString(raw.nextMeeting);
  if (nextMeeting && !meetingValues.has(nextMeeting)) {
    errors.nextMeeting = "Vyber jednu z ponúkaných možností.";
  }

  const consent = raw.consent === true || raw.consent === "on" || raw.consent === "true";
  if (!consent) {
    errors.consent = "Na zápis potrebujeme tvoj súhlas so spracovaním e-mailu.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      email,
      stage: stage as Stage,
      nextMeeting: nextMeeting ? (nextMeeting as NextMeeting) : null,
    },
  };
}

/** UTM parametre: iba bezpečné znaky a obmedzená dĺžka, inak null. */
export function sanitizeUtm(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().slice(0, UTM_MAX_LENGTH);
  return /^[\w.\-+ ]+$/u.test(cleaned) ? cleaned : null;
}

export type EarlyAccessResult =
  | { status: "success"; email: string }
  | { status: "error"; message: string; fieldErrors?: FieldErrors };
