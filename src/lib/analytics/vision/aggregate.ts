import type { VisionSample } from "@/lib/analytics/vision/types";
import type { VisualAggregate } from "@/lib/validation/schemas";

/*
  Agregácia signálov z kamery za reláciu. Ukladajú sa iba tieto súhrny.
  Indexy pohybu sú relatívne (×100), slúžia na porovnanie pokusov toho istého človeka
  s rovnakou kamerou, nie na porovnanie ľudí.
*/

function ratio(samples: VisionSample[], pick: (sample: VisionSample) => boolean | null): number | null {
  const known = samples.map(pick).filter((value): value is boolean => value !== null);
  if (known.length === 0) return null;
  return Math.round((known.filter(Boolean).length / known.length) * 1000) / 1000;
}

function meanStep(values: Array<number | null>): number | null {
  const steps: number[] = [];
  for (let i = 1; i < values.length; i += 1) {
    const a = values[i - 1];
    const b = values[i];
    if (a !== null && b !== null) steps.push(Math.abs(b - a));
  }
  if (steps.length === 0) return null;
  return Math.round((steps.reduce((sum, value) => sum + value, 0) / steps.length) * 100 * 1000) / 1000;
}

function sd(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1));
}

export function framingIssues(samples: VisionSample[]): string[] {
  const issues: string[] = [];
  const visible = ratio(samples, (sample) => sample.faceVisible);
  if (visible !== null && visible < 0.8) issues.push("face_often_missing");
  const centered = ratio(samples, (sample) => sample.faceCentered);
  if (centered !== null && centered < 0.7) issues.push("off_center");
  const distances = samples.map((sample) => sample.faceDistance).filter((value) => value !== null);
  if (distances.length > 0) {
    const far = distances.filter((value) => value === "far").length / distances.length;
    const close = distances.filter((value) => value === "close").length / distances.length;
    if (far > 0.5) issues.push("too_far");
    if (close > 0.5) issues.push("too_close");
  }
  return issues;
}

export function aggregateVision(
  samples: VisionSample[],
  founderWindows: Array<{ turnSeq: number; startMs: number; endMs: number }>,
): VisualAggregate {
  const sorted = [...samples].sort((a, b) => a.t - b.t);
  const durationSeconds = sorted.length > 1 ? (sorted[sorted.length - 1].t - sorted[0].t) / 1000 : 0;
  const motion = sorted.map((sample) => sample.handMotion).filter((value): value is number => value !== null);
  const shoulders = sorted.map((sample) => sample.shoulderY).filter((value): value is number => value !== null);
  const posture = sd(shoulders);

  return {
    framesAnalyzed: sorted.length,
    sampleRateHz: durationSeconds > 0 ? Math.round((sorted.length / durationSeconds) * 10) / 10 : null,
    faceVisibleRatio: ratio(sorted, (sample) => sample.faceVisible),
    faceCenteredRatio: ratio(sorted, (sample) => sample.faceCentered),
    facingCameraRatio: ratio(sorted, (sample) => sample.facingCamera),
    gazeTowardCameraRatio: ratio(sorted, (sample) => sample.gazeTowardCamera),
    headMovementIndex: meanStep(sorted.map((sample) => sample.headX)),
    upperBodyVisibleRatio: ratio(sorted, (sample) => sample.upperBodyVisible),
    postureStabilityIndex: posture === null ? null : Math.round(posture * 100 * 1000) / 1000,
    handsVisibleRatio: ratio(sorted, (sample) => sample.handsVisible),
    gestureActivityIndex:
      motion.length > 0 ? Math.round((motion.reduce((sum, value) => sum + value, 0) / motion.length) * 100 * 1000) / 1000 : null,
    framingIssues: framingIssues(sorted),
    perTurn: founderWindows
      .map((window) => {
        const inWindow = sorted.filter((sample) => sample.t >= window.startMs && sample.t <= window.endMs);
        if (inWindow.length < 5) return null;
        const windowMotion = inWindow.map((sample) => sample.handMotion).filter((value): value is number => value !== null);
        return {
          turnSeq: window.turnSeq,
          facingCameraRatio: ratio(inWindow, (sample) => sample.facingCamera),
          faceVisibleRatio: ratio(inWindow, (sample) => sample.faceVisible),
          gestureActivityIndex:
            windowMotion.length > 0
              ? Math.round((windowMotion.reduce((sum, value) => sum + value, 0) / windowMotion.length) * 100 * 1000) / 1000
              : null,
        };
      })
      .filter((value): value is NonNullable<typeof value> => value !== null)
      .slice(0, 500),
  };
}

/** Súhrn za posledné okno (pre živé upozornenia). */
export function recentVision(samples: VisionSample[], now: number, windowMs = 8_000) {
  const recent = samples.filter((sample) => now - sample.t <= windowMs);
  return {
    samples: recent.length,
    faceVisibleRatio: ratio(recent, (sample) => sample.faceVisible),
    facingCameraRatio: ratio(recent, (sample) => sample.facingCamera),
  };
}
