"use client";

import { useEffect, useState } from "react";
import { CoachReport } from "@/components/coach/SessionSummaryView";
import { loadLocalSession } from "@/lib/coach/local-session";
import { finalScoreFor, fromStoredCoach, type StoredCoach } from "@/lib/coach/stored";

/** Karta „Reč tela“ na Feedbacku: výsledok živého trénera, s klipmi chýb, ak sú ešte v pamäti. */
export function CoachFeedbackCard({ attemptId, coach }: { attemptId: string; coach: StoredCoach }) {
  // video a fotky sú len v tomto prehliadači (pamäť karty / IndexedDB), na serveri ich nemáme
  const [local, setLocal] = useState<Awaited<ReturnType<typeof loadLocalSession>>>(null);
  useEffect(() => {
    let live = true;
    void loadLocalSession(attemptId).then((s) => live && setLocal(s));
    return () => {
      live = false;
    };
  }, [attemptId]);
  const summary = local?.summary ?? fromStoredCoach(coach);
  const final = finalScoreFor(coach);

  return (
    <section className="card rv" style={{ animationDelay: "550ms", order: 3 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "12px" }}>
        <h2 className="h" style={{ fontSize: "26px" }}>
          Reč tela
        </h2>
        <span className="muted">{local?.videoUrl ? "Z videa pitchu" : "Video sa neukladá, zostali časy chýb"}</span>
      </div>
      <div className="mt-6 flex flex-col gap-10">
        <CoachReport summary={summary} final={final} videoUrl={local?.videoUrl ?? null} />
      </div>
    </section>
  );
}
