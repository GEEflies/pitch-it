/** Vývojová ukážka: dostupná lokálne, v produkcii iba s ENABLE_PREVIEW=true. */
export function isPreviewEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.ENABLE_PREVIEW === "true";
}

/** Odkazy aplikácie (/app/…) presmeruje na zodpovedajúce ukážkové obrazovky. */
export function previewHref(path: string): string {
  if (path === "/app") return "/ukazka/prehlad";
  if (path.startsWith("/app/vitaj")) return "/ukazka/vitaj";
  if (path.startsWith("/app/historia/porovnanie")) return path.replace("/app/historia/porovnanie", "/ukazka/porovnanie");
  if (path.startsWith("/app/historia")) return path.replace("/app/historia", "/ukazka/historia");
  if (path.startsWith("/app/trening/novy")) return "/ukazka/novy-trening";
  if (path.startsWith("/app/trening/")) return "/ukazka/report";
  if (path.startsWith("/app/miestnost/")) return "/ukazka/miestnost";
  if (path.startsWith("/app/projekty")) return "/ukazka/podklady";
  if (path.startsWith("/app/cvicenia")) return "/ukazka/report#plan";
  return "/ukazka/prehlad";
}

