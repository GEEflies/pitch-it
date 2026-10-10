/*
  Jediné miesto, kde sa čítajú premenné prostredia aplikácie.
  Funkcie vracajú null namiesto výnimky, aby UI vedelo ukázať stav „nenakonfigurované“.
*/

function read(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export type SupabasePublicConfig = { url: string; publishableKey: string };

/** URL a verejný kľúč Supabase (bezpečné aj pre prehliadač; chráni ich RLS). */
export function getSupabasePublicConfig(): SupabasePublicConfig | null {
  const url = read("NEXT_PUBLIC_SUPABASE_URL") ?? read("SUPABASE_URL");
  const publishableKey =
    read("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ?? read("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return url && publishableKey ? { url, publishableKey } : null;
}

export function isAuthConfigured(): boolean {
  return getSupabasePublicConfig() !== null;
}

/** Režim registrácie: otvorená, alebo iba zápis na čakaciu listinu. */
export type SignupMode = "open" | "waitlist";

export function getSignupMode(): SignupMode {
  return read("SIGNUP_MODE") === "waitlist" ? "waitlist" : "open";
}
