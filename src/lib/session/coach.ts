import type { CoachFocus } from "@/lib/domain/labels";
import { DELIVERY_THRESHOLDS } from "@/lib/reports/delivery-feedback";

/*
  Jemné upozornenia v režime tréningu. Iba pre oblasti, ktoré si používateľ vybral,
  najviac jedno naraz a s odstupom, aby nerušili rozhovor.
*/

export type Nudge = { id: string; focus: CoachFocus; text: string };

export const NUDGE_MIN_GAP_MS = 20_000;

export function nudgeForLongAnswer(focus: readonly CoachFocus[], speakingSeconds: number, targetSeconds: number): Nudge | null {
  if (!focus.includes("answer_length") || speakingSeconds < targetSeconds) return null;
  return {
    id: "answer-long",
    focus: "answer_length",
    text: `Odpoveď trvá ${Math.round(speakingSeconds)} s. Zhrň pointu jednou vetou.`,
  };
}

export function nudgeForFinishedAnswer(
  focus: readonly CoachFocus[],
  metrics: { wordsPerMinute: number | null; fillers: number; words: number },
): Nudge | null {
  if (focus.includes("pace") && metrics.wordsPerMinute !== null) {
    if (metrics.wordsPerMinute > DELIVERY_THRESHOLDS.fastWpm) {
      return {
        id: "pace-fast",
        focus: "pace",
        text: `Posledná odpoveď mala ${Math.round(metrics.wordsPerMinute)} slov za minútu. Pri číslach spomaľ.`,
      };
    }
    if (metrics.wordsPerMinute < DELIVERY_THRESHOLDS.slowWpm) {
      return {
        id: "pace-slow",
        focus: "pace",
        text: `Posledná odpoveď mala ${Math.round(metrics.wordsPerMinute)} slov za minútu. Skús začať rovno pointou.`,
      };
    }
  }
  if (focus.includes("fillers") && metrics.fillers >= 3 && metrics.words >= 20) {
    return {
      id: "fillers",
      focus: "fillers",
      text: `V poslednej odpovedi bolo aspoň ${metrics.fillers} výplňových slov. Namiesto nich si daj krátku pauzu.`,
    };
  }
  return null;
}

export function nudgeForCamera(
  focus: readonly CoachFocus[],
  recent: { faceVisibleRatio: number | null; facingCameraRatio: number | null; samples: number },
): Nudge | null {
  if (recent.samples < 20) return null;
  if (focus.includes("framing") && recent.faceVisibleRatio !== null && recent.faceVisibleRatio < 0.5) {
    return { id: "framing", focus: "framing", text: "Kamera ťa nevidí celého. Posuň sa do stredu záberu." };
  }
  if (focus.includes("camera_gaze") && recent.facingCameraRatio !== null && recent.facingCameraRatio < 0.4) {
    return { id: "gaze", focus: "camera_gaze", text: "Často sa pozeráš mimo kamery. Skús sa vrátiť pohľadom k investorovi." };
  }
  return null;
}

/** Rozhodne, či novú pripomienku ukázať (odstup a neopakovať tú istú hneď znova). */
export function shouldShowNudge(
  nudge: Nudge,
  last: { id: string; at: number } | null,
  now: number,
): boolean {
  if (!last) return true;
  if (now - last.at < NUDGE_MIN_GAP_MS) return false;
  if (last.id === nudge.id && now - last.at < NUDGE_MIN_GAP_MS * 3) return false;
  return true;
}
