"use client";

/* Prístup k zariadeniam a zrozumiteľné chybové hlášky. */

export type MediaError = { kind: "denied" | "not_found" | "busy" | "insecure" | "unknown"; message: string };

export function describeMediaError(error: unknown, device: "mikrofón" | "kamera"): MediaError {
  const name = error instanceof DOMException ? error.name : "";
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return { kind: "insecure", message: `${device === "mikrofón" ? "Mikrofón" : "Kamera"} funguje iba cez zabezpečené pripojenie (HTTPS).` };
  }
  if (name === "NotAllowedError" || name === "SecurityError") {
    return {
      kind: "denied",
      message: `Prístup k zariadeniu ${device} je zablokovaný. Povoľ ho v nastaveniach prehliadača (ikona zámku vedľa adresy) a skús znova.`,
    };
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return { kind: "not_found", message: `Nenašli sme žiadne zariadenie: ${device}. Pripoj ho a skús znova.` };
  }
  if (name === "NotReadableError" || name === "AbortError") {
    return { kind: "busy", message: `Zariadenie ${device} práve používa iná aplikácia. Zavri ju a skús znova.` };
  }
  return { kind: "unknown", message: `Zariadenie ${device} sa nepodarilo zapnúť.` };
}

export async function openMicrophone(deviceId: string | null): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: {
      deviceId: deviceId ? { exact: deviceId } : undefined,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
    },
    video: false,
  });
}

export async function openCamera(deviceId: string | null): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: {
      deviceId: deviceId ? { exact: deviceId } : undefined,
      width: { ideal: 640 },
      height: { ideal: 480 },
      frameRate: { ideal: 24, max: 30 },
      facingMode: "user",
    },
    audio: false,
  });
}

export async function listDevices(kind: "audioinput" | "videoinput"): Promise<MediaDeviceInfo[]> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((device) => device.kind === kind && device.deviceId);
  } catch {
    return [];
  }
}

/** Krátky tón na test reproduktorov. */
export async function playTestTone(volume: number): Promise<void> {
  const context = new AudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.frequency.value = 523.25;
  gain.gain.setValueAtTime(0, context.currentTime);
  gain.gain.linearRampToValueAtTime(0.18 * volume, context.currentTime + 0.03);
  gain.gain.linearRampToValueAtTime(0, context.currentTime + 0.45);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.5);
  await new Promise((resolve) => setTimeout(resolve, 600));
  await context.close();
}

const STORAGE_KEY = "pitch-it:devices";

export function rememberDevice(kind: "mic" | "camera", deviceId: string): void {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, string>;
    stored[kind] = deviceId;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Úložisko nie je dostupné (súkromné okno): výber sa iba nezapamätá.
  }
}

export function rememberedDevice(kind: "mic" | "camera"): string | null {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, string>;
    return stored[kind] ?? null;
  } catch {
    return null;
  }
}
