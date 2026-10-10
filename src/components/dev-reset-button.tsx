"use client";

import { useState } from "react";

/* Dočasné vývojové tlačidlo: vráti prehliadač do stavu „prvá návšteva“ (ako anonymné okno). */
export function DevResetButton() {
  const [busy, setBusy] = useState(false);

  const reset = async () => {
    setBusy(true);
    await fetch("/api/dev/reset", { method: "POST" }).catch(() => null);
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
    if ("caches" in window) await Promise.all((await caches.keys()).map((key) => caches.delete(key))).catch(() => null);
    const workers = await navigator.serviceWorker?.getRegistrations().catch(() => []);
    await Promise.all((workers ?? []).map((worker) => worker.unregister()));
    window.location.replace("/");
  };

  return (
    <button
      type="button"
      onClick={reset}
      disabled={busy}
      title="Zmaže cookies, úložisko a cache (len vo vývoji)"
      style={{
        position: "fixed",
        right: "14px",
        bottom: "14px",
        zIndex: 2147483000,
        padding: "8px 14px",
        borderRadius: "999px",
        border: "1px solid #ff5c5c",
        background: "rgba(20,20,20,.9)",
        color: "#ff8a8a",
        font: "600 12px/1 system-ui, sans-serif",
        cursor: busy ? "wait" : "pointer",
        boxShadow: "0 4px 16px rgba(0,0,0,.4)",
      }}
    >
      {busy ? "Resetujem…" : "⟲ Dev reset"}
    </button>
  );
}
