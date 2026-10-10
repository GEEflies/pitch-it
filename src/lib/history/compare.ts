import type { TrainingMode } from "@/lib/domain/labels";
import { CONTENT_DIMENSIONS, CONTENT_DIMENSION_LABELS, type Assessment, type Rating } from "@/lib/reports/assessment";
import { DELIVERY_THRESHOLDS } from "@/lib/reports/delivery-feedback";
import type { SessionMeasurements } from "@/lib/reports/measured";

/*
  Porovnanie dvoch tréningov a priebeh v čase. Porovnávame iba rovnaký režim
  (rozhovor s rozhovorom, prednes s prednesom) a iba namerané hodnoty, ktoré oba
  tréningy majú. Žiadne dopočítané ani odhadnuté zlepšenie.
*/

export type ComparableSession = {
  id: string;
  mode: TrainingMode;
  transport: "realtime" | "text";
  createdAt: string;
  measured: SessionMeasurements | null;
  assessment: Assessment | null;
};

export type Direction = "lower_better" | "higher_better" | "in_range";

export type MetricDefinition = {
  key: string;
  label: string;
  unit: string;
  direction: Direction;
  range?: { low: number; high: number };
  digits: number;
  pick: (measured: SessionMeasurements) => number | null;
  voiceOnly: boolean;
};

export const METRICS: MetricDefinition[] = [
  {
    key: "wpm",
    label: "Tempo reči (medián)",
    unit: "slov/min",
    direction: "in_range",
    range: { low: DELIVERY_THRESHOLDS.slowWpm, high: DELIVERY_THRESHOLDS.fastWpm },
    digits: 0,
    pick: (m) => m.pace.medianWpm,
    voiceOnly: true,
  },
  {
    key: "answer_seconds",
    label: "Dĺžka odpovede (medián)",
    unit: "s",
    direction: "lower_better",
    digits: 0,
    pick: (m) => m.answerLength.medianSeconds,
    voiceOnly: true,
  },
  {
    key: "over_target",
    label: "Odpovede nad cieľovú dĺžku",
    unit: "",
    direction: "lower_better",
    digits: 0,
    pick: (m) => (m.founderTurns > 0 ? m.answerLength.overTargetCount : null),
    voiceOnly: true,
  },
  {
    key: "latency",
    label: "Nábeh na odpoveď (medián)",
    unit: "s",
    direction: "lower_better",
    digits: 1,
    pick: (m) => (m.latency.medianMs === null ? null : m.latency.medianMs / 1000),
    voiceOnly: true,
  },
  {
    key: "fillers",
    label: "Výplňové slová na 100 slov",
    unit: "",
    direction: "lower_better",
    digits: 1,
    pick: (m) => m.fillers.per100Words,
    voiceOnly: false,
  },
  {
    key: "long_pauses",
    label: "Odpovede s dlhou pauzou",
    unit: "",
    direction: "lower_better",
    digits: 0,
    pick: (m) => (m.transport === "realtime" ? m.pauses.longPauses : null),
    voiceOnly: true,
  },
  {
    key: "facing_camera",
    label: "Hlava natočená ku kamere",
    unit: "%",
    direction: "higher_better",
    digits: 0,
    pick: (m) => (m.visual?.reliable && m.visual.facingCameraRatio !== null ? m.visual.facingCameraRatio * 100 : null),
    voiceOnly: true,
  },
];

export type ComparisonBlocked = { comparable: false; reason: string };

export type MetricComparison = {
  key: string;
  label: string;
  unit: string;
  digits: number;
  before: number;
  after: number;
  delta: number;
  verdict: "better" | "worse" | "same";
};

export type DimensionComparison = { key: string; label: string; before: Rating; after: Rating; verdict: "better" | "worse" | "same" };

export type Comparison = {
  comparable: true;
  metrics: MetricComparison[];
  dimensions: DimensionComparison[];
  skipped: string[];
};

const RATING_ORDER: Record<Rating, number> = { weak: 0, adequate: 1, strong: 2, not_assessable: -1 };

function distanceFromRange(value: number, range: { low: number; high: number }): number {
  if (value < range.low) return range.low - value;
  if (value > range.high) return value - range.high;
  return 0;
}

export function verdictFor(definition: MetricDefinition, before: number, after: number): "better" | "worse" | "same" {
  // Malé rozdiely (pod 5 % alebo pod 1 jednotku) neprezentujeme ako zmenu.
  const tolerance = Math.max(Math.abs(before) * 0.05, definition.digits === 0 ? 1 : 0.2);
  if (definition.direction === "in_range" && definition.range) {
    const a = distanceFromRange(before, definition.range);
    const b = distanceFromRange(after, definition.range);
    if (Math.abs(a - b) < tolerance) return "same";
    return b < a ? "better" : "worse";
  }
  if (Math.abs(after - before) < tolerance) return "same";
  const lower = after < before;
  return definition.direction === "lower_better" ? (lower ? "better" : "worse") : lower ? "worse" : "better";
}

export function compareSessions(before: ComparableSession, after: ComparableSession): ComparisonBlocked | Comparison {
  if (before.mode !== after.mode) {
    return {
      comparable: false,
      reason: "Tréningy majú rôzny režim (napríklad rozhovor a prednes pitchu). Porovnaj dva tréningy rovnakého typu.",
    };
  }
  if (!before.measured || !after.measured) {
    return { comparable: false, reason: "Jeden z tréningov ešte nemá merania." };
  }

  const metrics: MetricComparison[] = [];
  const skipped: string[] = [];
  for (const definition of METRICS) {
    if (definition.voiceOnly && (before.transport !== "realtime" || after.transport !== "realtime")) {
      skipped.push(definition.label);
      continue;
    }
    const a = definition.pick(before.measured);
    const b = definition.pick(after.measured);
    if (a === null || b === null) {
      skipped.push(definition.label);
      continue;
    }
    metrics.push({
      key: definition.key,
      label: definition.label,
      unit: definition.unit,
      digits: definition.digits,
      before: a,
      after: b,
      delta: b - a,
      verdict: verdictFor(definition, a, b),
    });
  }

  const dimensions: DimensionComparison[] = [];
  if (before.assessment && after.assessment) {
    for (const key of CONTENT_DIMENSIONS) {
      const a = before.assessment.content_dimensions.find((item) => item.key === key)?.rating;
      const b = after.assessment.content_dimensions.find((item) => item.key === key)?.rating;
      if (!a || !b || a === "not_assessable" || b === "not_assessable") continue;
      const diff = RATING_ORDER[b] - RATING_ORDER[a];
      dimensions.push({
        key,
        label: CONTENT_DIMENSION_LABELS[key],
        before: a,
        after: b,
        verdict: diff > 0 ? "better" : diff < 0 ? "worse" : "same",
      });
    }
  }

  return { comparable: true, metrics, dimensions, skipped };
}

/** Body pre graf vývoja jednej metriky (iba tréningy daného režimu s hodnotou). */
export function metricSeries(sessions: ComparableSession[], definition: MetricDefinition, mode: TrainingMode) {
  return sessions
    .filter((session) => session.mode === mode && session.measured)
    .filter((session) => !definition.voiceOnly || session.transport === "realtime")
    .map((session) => ({ session, value: definition.pick(session.measured as SessionMeasurements) }))
    .filter((point): point is { session: ComparableSession; value: number } => point.value !== null)
    .sort((a, b) => a.session.createdAt.localeCompare(b.session.createdAt));
}
