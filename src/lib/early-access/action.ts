"use server";

import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { consumeAttempt } from "@/lib/early-access/rate-limit";
import {
  CONSENT_VERSION,
  HONEYPOT_FIELD,
  sanitizeUtm,
  validateEarlyAccess,
  type EarlyAccessResult,
} from "@/lib/early-access/schema";
import {
  countRecentSignups,
  insertSignup,
  isEarlyAccessConfigured,
} from "@/lib/early-access/store";

/** Človek formulár nevyplní rýchlejšie; boti často áno. */
const MIN_FILL_MS = 1_500;
const DB_WINDOW_MINUTES = 60;
const DB_MAX_SIGNUPS_PER_SOURCE = 5;

function clientIp(requestHeaders: Headers): string | null {
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || requestHeaders.get("x-real-ip")?.trim() || null;
}

/** IP adresu neukladáme. Iba jej HMAC so serverovým tajomstvom, ak je nastavené. */
function hashIp(ip: string | null): string | null {
  const salt = process.env.IP_HASH_SALT?.trim();
  if (!ip || !salt) return null;
  return createHmac("sha256", salt).update(ip).digest("hex");
}

function text(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  return typeof value === "string" ? value : null;
}

export async function joinEarlyAccess(formData: FormData): Promise<EarlyAccessResult> {
  try {
    if (text(formData, HONEYPOT_FIELD)?.trim()) {
      return {
        status: "error",
        message: "Formulár sa nepodarilo odoslať. Obnov stránku a skús to znova.",
      };
    }

    const startedAt = Number(text(formData, "started_at"));
    if (!Number.isFinite(startedAt) || Date.now() - startedAt < MIN_FILL_MS) {
      return {
        status: "error",
        message: "Formulár prišiel príliš rýchlo. Počkaj pár sekúnd a odošli ho znova.",
      };
    }

    const validation = validateEarlyAccess({
      email: text(formData, "email"),
      stage: text(formData, "stage"),
      nextMeeting: text(formData, "nextMeeting"),
      consent: text(formData, "consent"),
    });

    if (!validation.ok) {
      return {
        status: "error",
        message: "Skontroluj zvýraznené polia.",
        fieldErrors: validation.errors,
      };
    }

    if (!isEarlyAccessConfigured()) {
      return {
        status: "error",
        message: "Zápis na early access momentálne nefunguje. Skús to neskôr.",
      };
    }

    const ip = clientIp(await headers());
    if (ip && !consumeAttempt(ip)) {
      return {
        status: "error",
        message: "Z tejto siete prišlo veľa pokusov za krátky čas. Skús to znova o 10 minút.",
      };
    }

    const ipHash = hashIp(ip);
    if (ipHash) {
      const recent = await countRecentSignups(ipHash, DB_WINDOW_MINUTES);
      if (recent >= DB_MAX_SIGNUPS_PER_SOURCE) {
        return {
          status: "error",
          message: "Z tejto siete už prišlo veľa zápisov. Skús to znova o hodinu.",
        };
      }
    }

    await insertSignup({
      ...validation.data,
      consentVersion: CONSENT_VERSION,
      ipHash,
      utmSource: sanitizeUtm(text(formData, "utm_source")),
      utmMedium: sanitizeUtm(text(formData, "utm_medium")),
      utmCampaign: sanitizeUtm(text(formData, "utm_campaign")),
    });

    // Nový aj existujúci e-mail znamená, že záznam v databáze je.
    return { status: "success", email: validation.data.email };
  } catch (error) {
    // Bez osobných údajov v logoch.
    console.error(
      "[early-access] Zápis zlyhal:",
      error instanceof Error ? error.message : "neznáma chyba",
    );
    return {
      status: "error",
      message: "Zápis sa nepodarilo uložiť. Skús to znova o chvíľu.",
    };
  }
}
