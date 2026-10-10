import type { StoredCoach } from "@/lib/coach/stored";

/* Ukážkový výsledok živého trénera reči tela pre /ukazka (60 s pitch pred kamerou). */

const DURATION = 62_000;

function timeline(): StoredCoach["summary"]["timeline"] {
  const bad: Array<[number, number]> = [[18_000, 21_500]];
  const warn: Array<[number, number]> = [[6_000, 9_000], [33_000, 37_500], [49_000, 51_000]];
  const inside = (t: number, ranges: Array<[number, number]>) => ranges.some(([a, b]) => t >= a && t < b);
  return Array.from({ length: Math.floor(DURATION / 250) }, (_, i) => {
    const t = i * 250;
    const status = t < 1_500 ? "idle" : inside(t, bad) ? "bad" : inside(t, warn) ? "warn" : "good";
    return { t, status, score: status === "bad" ? 48 : status === "warn" ? 66 : 84 } as const;
  });
}

export const PREVIEW_COACH: StoredCoach = {
  version: 2,
  teleprompter: false,
  micMode: false,
  summary: {
    durationMs: DURATION,
    personMs: 60_500,
    avgScore: 78,
    statusShare: { good: 0.79, warn: 0.15, bad: 0.06 },
    cleanShare: 0.79,
    zoneShare: 0.68,
    gesturesPerMin: 17,
    stageShare: { left: 0.08, center: 0.84, right: 0.08 },
    gazeShare: { left: 0.21, center: 0.58, right: 0.21 },
    highlights: { palms: 4, hold: 3, wide: 2, count: 1 },
    issues: [
      { id: "crossed", ms: 3_500, count: 1 },
      { id: "hands-low", ms: 4_500, count: 1 },
      { id: "head-down", ms: 3_000, count: 1 },
      { id: "pointing", ms: 2_000, count: 1 },
    ],
    mistakes: [
      { id: "head-down", start: 6_000, end: 9_000 },
      { id: "crossed", start: 18_000, end: 21_500 },
      { id: "hands-low", start: 33_000, end: 37_500 },
      { id: "pointing", start: 49_000, end: 51_000 },
    ],
    timeline: timeline(),
  },
};
