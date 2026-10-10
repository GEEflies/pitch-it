"use client";

import { useSyncExternalStore } from "react";
import { CoachReport } from "@/components/coach/SessionSummaryView";
import { getLocalSession } from "@/lib/coach/local-session";
import { finalScoreFor, fromStoredCoach, type StoredCoach } from "@/lib/coach/stored";

const noop = () => () => {};

/** Karta „Reč tela“ na Feedbacku: výsledok živého trénera, s klipmi chýb, ak sú ešte v pamäti. */
export function CoachFeedbackCard({ attemptId, coach }: { attemptId: string; coach: StoredCoach }) {
  // video a fotky sú len v pamäti karty, na serveri ich nemáme
  const local = useSyncExternalStore(noop, () => getLocalSession(attemptId), () => null);
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
