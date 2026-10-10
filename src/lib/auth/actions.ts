"use server";

import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSignupMode, isAuthConfigured } from "@/config/env";
import { getHashSalt } from "@/config/server-env";
import { siteConfig } from "@/config/site";
import {
  LEGAL_VERSION,
  newPasswordSchema,
  OAUTH_PROVIDERS,
  type OAuthProvider,
  resetRequestSchema,
  signInSchema,
  signUpSchema,
  type AuthFormState,
} from "@/lib/auth/schemas";
import { safeNextPath } from "@/lib/auth/session";
import { trackEvent } from "@/lib/events/track";
import { consumeRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fieldErrors } from "@/lib/validation/schemas";

const NOT_CONFIGURED: AuthFormState = {
  status: "error",
  message: "Prihlasovanie momentálne nefunguje. Skús to neskôr.",
};

const TOO_MANY: AuthFormState = {
  status: "error",
  message: "Z tejto siete prišlo veľa pokusov. Skús to znova o 10 minút.",
};

async function rateKey(scope: string): Promise<string> {
  const requestHeaders = await headers();
  const ip =
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || requestHeaders.get("x-real-ip")?.trim() || "unknown";
  const salt = getHashSalt() ?? "pitch-it";
  return `${scope}:${createHmac("sha256", salt).update(ip).digest("hex").slice(0, 32)}`;
}

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function confirmUrl(next: string): string {
  return `${siteConfig.url}/auth/confirm?next=${encodeURIComponent(next)}`;
}

export async function signUp(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!isAuthConfigured()) return NOT_CONFIGURED;
  if (getSignupMode() === "waitlist") {
    return { status: "error", message: "Registrácia je zatiaľ iba na pozvánku. Zapíš sa na early access na úvodnej stránke." };
  }
  if (!consumeRateLimit(await rateKey("signup"), RATE_LIMITS.auth)) return TOO_MANY;

  const values = {
    display_name: text(formData, "display_name"),
    email: text(formData, "email"),
  };
  const parsed = signUpSchema.safeParse({
    display_name: values.display_name,
    email: values.email,
    password: text(formData, "password"),
    accept_terms: formData.get("accept_terms") ?? undefined,
    account_type: text(formData, "account_type"),
    product_emails: formData.get("product_emails") ?? undefined,
  });
  if (!parsed.success) {
    return { status: "error", message: "Skontroluj zvýraznené polia.", fieldErrors: fieldErrors(parsed.error), values };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: confirmUrl("/app"),
      data: {
        display_name: parsed.data.display_name,
        accepted_terms: "true",
        age_confirmed: "true",
        product_emails: parsed.data.product_emails ? "true" : "false",
        account_type: parsed.data.account_type,
        consent_version: LEGAL_VERSION,
      },
    },
  });

  if (error) {
    if (error.code === "weak_password") {
      return {
        status: "error",
        message: "Heslo je príliš slabé alebo sa objavilo v známych únikoch. Zvoľ iné.",
        fieldErrors: { password: "Zvoľ silnejšie heslo." },
        values,
      };
    }
    if (error.code === "over_email_send_rate_limit" || error.status === 429) return TOO_MANY;
    console.error("[auth] signUp:", error.code ?? error.status);
    return { status: "error", message: "Účet sa nepodarilo vytvoriť. Skús to znova o chvíľu.", values };
  }

  if (data.user) await trackEvent(data.user.id, "signup_completed", { email_confirmation: !data.session });

  // Bez potvrdenia e-mailu (vypnuté v Supabase) je používateľ rovno prihlásený.
  if (data.session) redirect("/app");

  // Rovnaká odpoveď aj pre existujúci e-mail, aby sa nedalo zisťovať, kto má účet.
  return {
    status: "success",
    message: `Poslali sme ti e-mail na ${parsed.data.email}. Klikni na odkaz v ňom a účet sa aktivuje.`,
  };
}

export async function signIn(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!isAuthConfigured()) return NOT_CONFIGURED;
  if (!consumeRateLimit(await rateKey("signin"), RATE_LIMITS.auth)) return TOO_MANY;

  const values = { email: text(formData, "email") };
  const parsed = signInSchema.safeParse({ email: values.email, password: text(formData, "password") });
  if (!parsed.success) {
    return { status: "error", message: "Skontroluj zvýraznené polia.", fieldErrors: fieldErrors(parsed.error), values };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === "email_not_confirmed") {
      return {
        status: "error",
        message: "E-mail ešte nie je potvrdený. Klikni na odkaz, ktorý sme ti poslali po registrácii.",
        values,
      };
    }
    if (error.status === 429) return TOO_MANY;
    return { status: "error", message: "Nesprávny e-mail alebo heslo.", values };
  }

  redirect(safeNextPath(text(formData, "next")));
}

export async function requestPasswordReset(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!isAuthConfigured()) return NOT_CONFIGURED;
  if (!consumeRateLimit(await rateKey("reset"), RATE_LIMITS.auth)) return TOO_MANY;

  const values = { email: text(formData, "email") };
  const parsed = resetRequestSchema.safeParse(values);
  if (!parsed.success) {
    return { status: "error", message: "Skontroluj e-mail.", fieldErrors: fieldErrors(parsed.error), values };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: confirmUrl("/nove-heslo"),
  });
  if (error && error.status === 429) return TOO_MANY;
  if (error) console.error("[auth] reset:", error.code ?? error.status);

  // Vždy rovnaká odpoveď: nezverejňujeme, či účet existuje.
  return {
    status: "success",
    message: "Ak k tomuto e-mailu existuje účet, poslali sme naň odkaz na nastavenie nového hesla.",
  };
}

export async function updatePassword(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!isAuthConfigured()) return NOT_CONFIGURED;
  const parsed = newPasswordSchema.safeParse({
    password: text(formData, "password"),
    password_confirm: text(formData, "password_confirm"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Skontroluj zvýraznené polia.", fieldErrors: fieldErrors(parsed.error) };
  }

  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) {
    return {
      status: "error",
      message: "Odkaz na zmenu hesla vypršal. Vypýtaj si nový.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "weak_password") {
      return { status: "error", message: "Heslo je príliš slabé.", fieldErrors: { password: "Zvoľ silnejšie heslo." } };
    }
    if (error.code === "same_password") {
      return { status: "error", fieldErrors: { password: "Nové heslo musí byť iné ako staré." }, message: "Zvoľ iné heslo." };
    }
    return { status: "error", message: "Heslo sa nepodarilo zmeniť. Skús to znova." };
  }
  redirect("/app?heslo=zmenene");
}

export async function signOut(): Promise<void> {
  if (isAuthConfigured()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  redirect("/");
}

/**
 * Prihlásenie cez Google alebo LinkedIn (Supabase OAuth, PKCE).
 * Poskytovateľa treba zapnúť v Supabase → Authentication → Providers.
 */
export async function signInWithProvider(formData: FormData): Promise<void> {
  const provider = text(formData, "provider") as OAuthProvider;
  if (!isAuthConfigured() || !OAUTH_PROVIDERS.includes(provider)) redirect("/prihlasenie?chyba=poskytovatel");
  const next = safeNextPath(text(formData, "next") || "/app");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: confirmUrl(next) },
  });
  if (error || !data.url) {
    console.error("[auth] oauth:", provider, error?.code ?? error?.status);
    redirect("/prihlasenie?chyba=poskytovatel");
  }
  redirect(data.url);
}
