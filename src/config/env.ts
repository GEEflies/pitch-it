/*
  Jediné miesto, kde sa čítajú premenné prostredia aplikácie.
  Funkcie vracajú null namiesto výnimky, aby UI vedelo ukázať stav „nenakonfigurované“.
*/

function read(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

/** Prihlasovanie potrebuje tajomstvo na podpis cookies (AUTH_SECRET; v dev náhradné). */
export function isAuthConfigured(): boolean {
  return Boolean(read("AUTH_SECRET")) || process.env.NODE_ENV !== "production";
}

/** Režim registrácie: otvorená, alebo iba zápis na čakaciu listinu. */
export type SignupMode = "open" | "waitlist";

export function getSignupMode(): SignupMode {
  return read("SIGNUP_MODE") === "waitlist" ? "waitlist" : "open";
}
