/* Formátovanie pre slovenské UI. Časová zóna je pevná, aby server a klient zobrazili to isté. */

const TIME_ZONE = "Europe/Bratislava";

const dateTime = new Intl.DateTimeFormat("sk-SK", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});

const dateOnly = new Intl.DateTimeFormat("sk-SK", { day: "numeric", month: "long", year: "numeric", timeZone: TIME_ZONE });

const shortDate = new Intl.DateTimeFormat("sk-SK", { day: "numeric", month: "numeric", timeZone: TIME_ZONE });

const numericDate = new Intl.DateTimeFormat("sk-SK", { day: "numeric", month: "numeric", year: "numeric", timeZone: TIME_ZONE });

export function formatDateTime(value: string | Date): string {
  return dateTime.format(typeof value === "string" ? new Date(value) : value);
}

export function formatDate(value: string | Date): string {
  return dateOnly.format(typeof value === "string" ? new Date(value) : value);
}

export function formatShortDate(value: string | Date): string {
  return shortDate.format(typeof value === "string" ? new Date(value) : value);
}

/** „24. 4. 2026“ */
export function formatNumericDate(value: string | Date): string {
  return numericDate.format(typeof value === "string" ? new Date(value) : value);
}

/** 754 → „12:34“, 65 → „1:05“. */
export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

/** 754 → „12 min 34 s“. */
export function formatDuration(totalSeconds: number | null | undefined): string {
  if (totalSeconds === null || totalSeconds === undefined) return "–";
  const seconds = Math.max(0, Math.round(totalSeconds));
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes} min ${rest} s` : `${minutes} min`;
}

export function formatNumber(value: number, fractionDigits = 0): string {
  return new Intl.NumberFormat("sk-SK", { maximumFractionDigits: fractionDigits }).format(value);
}

/** Slovenské skloňovanie počtu: 1 tréning, 2 tréningy, 5 tréningov. */
export function plural(count: number, one: string, few: string, many: string): string {
  if (count === 1) return one;
  if (count >= 2 && count <= 4) return few;
  return many;
}
