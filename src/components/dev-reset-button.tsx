"use client";

import { useState } from "react";

/* Dočasné vývojové tlačidlo: vráti prehliadač do stavu „prvá návšteva“ (ako anonymné okno). */
export function DevResetButton() {
  const [busy, setBusy] = useState(false);

  const reset = async () => {
    setBusy(true);
    // Každý krok má strop, aby tlačidlo nikdy neostalo visieť.
    const capped = (work: Promise<unknown>, ms = 1500) => Promise.race([work.catch(() => null), new Promise((done) => setTimeout(done, ms))]);
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
    await Promise.all([
      capped(fetch("/api/dev/reset", { method: "POST" }), 6000),
      capped(caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))))),
      capped(navigator.serviceWorker.getRegistrations().then((all) => Promise.all(all.map((worker) => worker.unregister())))),
      capped(indexedDB.databases().then((all) => all.forEach((db) => db.name && indexedDB.deleteDatabase(db.name)))),
    ]);
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
