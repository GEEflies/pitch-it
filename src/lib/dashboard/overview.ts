import type { Recommendation } from "@/lib/dashboard/recommendation";
import type { ReportStatus } from "@/lib/db/types";
import type { TrainingMode } from "@/lib/domain/labels";
import { formatClock, formatNumber, formatNumericDate, plural } from "@/lib/format";
import { METRICS, verdictFor, type MetricDefinition } from "@/lib/history/compare";
import type { Assessment } from "@/lib/reports/assessment";
import { deliveryObservations, type DeliveryObservation } from "@/lib/reports/delivery-feedback";
import type { SessionMeasurements } from "@/lib/reports/measured";

/*
  Prehľad (dashboard): čisté funkcie nad uloženými tréningmi. Každé číslo je meranie
  alebo podiel z rozboru, ktorý sa opiera o citácie z prepisu. Nič sa nedopočítava ani
  neodhaduje a celkové skóre zámerne nie je (decision-log D4): hlavná karta ukazuje
  podiel zodpovedaných otázok (rozhovor) alebo jasne pokrytých častí pitchu (prednes).
*/

export type DashboardSession = {
  id: string;
  mode: TrainingMode;
  transport: "realtime" | "text";
  status: string;
  createdAt: string;
  endedAt: string | null;
  billedSeconds: number;
  report: {
    status: ReportStatus;
    completedAt: string | null;
    measured: SessionMeasurements | null;
    assessment: Assessment | null;
  } | null;
};

export type DashboardExercise = {
  id: string;
  title: string;
  status: "open" | "completed" | "dismissed";
  completedAt: string | null;
};

export type Family = "conversation" | "delivery";

export const familyOf = (mode: TrainingMode): Family => (mode === "delivery" ? "delivery" : "conversation");

const MODE_TITLES: Record<TrainingMode, string> = {
  coach: "Tréning s nápovedou",
  simulation: "AI investor simulácia",
  delivery: "Tréning pitchu",
};

const newestFirst = (a: DashboardSession, b: DashboardSession) => b.createdAt.localeCompare(a.createdAt);

function readyReport(session: DashboardSession) {
  return session.report?.status === "ready" ? session.report : null;
}

/** Trvanie tréningu v sekundách: účtovaný čas hlasu, inak dĺžka z meraní (textový režim). */
function durationSeconds(session: DashboardSession): number | null {
  if (session.billedSeconds > 0) return session.billedSeconds;
  return session.report?.measured?.durationSeconds ?? null;
}

function minutesLabel(session: DashboardSession): string | null {
  const seconds = durationSeconds(session);
  return seconds === null ? null : `${Math.max(1, Math.round(seconds / 60))} min`;
}

/* ───────────── Podiel z rozboru ───────────── */

export type Share = { percent: number; count: number; total: number };

/** Zodpovedané otázky (rozhovor) alebo jasne pokryté časti pitchu (prednes). Čiastočné odpovede sa nepočítajú. */
export function shareFor(session: DashboardSession): Share | null {
  const assessment = readyReport(session)?.assessment;
  if (!assessment) return null;
  if (session.mode === "delivery") {
    const coverage = assessment.pitch_coverage ?? [];
    if (coverage.length === 0) return null;
    const count = coverage.filter((item) => item.status === "clear").length;
    return { percent: (count / coverage.length) * 100, count, total: coverage.length };
  }
  if (assessment.questions.length === 0) return null;
  const count = assessment.questions.filter((question) => question.verdict === "answered").length;
  return { percent: (count / assessment.questions.length) * 100, count, total: assessment.questions.length };
}

const SHARE_DEFINITION: MetricDefinition = {
  key: "share",
  label: "Podiel",
  unit: "%",
  direction: "higher_better",
  digits: 0,
  pick: () => null,
  voiceOnly: false,
};

const SHARE_LABELS: Record<Family, { label: string; unit: (count: number) => string }> = {
  conversation: { label: "Zodpovedané otázky", unit: (count) => plural(count, "otázky", "otázok", "otázok") },
  delivery: { label: "Pokrytie pitchu", unit: (count) => plural(count, "časti", "častí", "častí") },
};

/* ───────────── Karty s metrikami ───────────── */

export type StatIcon = "star" | "gauge" | "chat" | "timer";

export type StatDelta = {
  text: string;
  sign: "up" | "down" | "flat";
  verdict: "better" | "worse" | "same";
  description: string;
};

export type StatCard = {
  key: string;
  label: string;
  icon: StatIcon;
  tone: "lime" | "violet";
  value: string | null;
  unit: string | null;
  /** Upresnenie hodnoty pre title a čítačky obrazovky (napr. „7 z 9 otázok“). */
  hint: string | null;
  delta: StatDelta | null;
  /** Text pod hodnotou, keď sa zmena nedá ukázať. */
  note: string;
};

type CardSpec = {
  key: string;
  label: string;
  icon: StatIcon;
  tone: "lime" | "violet";
  unit: string;
  digits: number;
  /** relative = percentuálna zmena hodnoty, points = rozdiel percentuálnych bodov. */
  deltaMode: "relative" | "points" | null;
  definition: MetricDefinition;
  voiceOnly: boolean;
  pick: (session: DashboardSession) => number | null;
  format?: (value: number) => string;
  hint?: (session: DashboardSession) => string | null;
};

const metric = (key: string) => {
  const definition = METRICS.find((item) => item.key === key);
  if (!definition) throw new Error(`Neznáma metrika ${key}`);
  return definition;
};

const measuredOf = (session: DashboardSession) => readyReport(session)?.measured ?? null;

function cardSpecs(family: Family): CardSpec[] {
  const share = SHARE_LABELS[family];
  const shareCard: CardSpec = {
    key: family === "delivery" ? "coverage" : "answered",
    label: share.label,
    icon: "star",
    tone: "lime",
    unit: "%",
    digits: 0,
    deltaMode: "points",
    definition: SHARE_DEFINITION,
    voiceOnly: false,
    pick: (session) => shareFor(session)?.percent ?? null,
    hint: (session) => {
      const value = shareFor(session);
      return value ? `${value.count} z ${value.total} ${share.unit(value.total)}` : null;
    },
  };
  const pace: CardSpec = {
    key: "pace",
    label: "Tempo reči",
    icon: "gauge",
    tone: "violet",
    unit: "slov/min",
    digits: 0,
    deltaMode: "relative",
    definition: metric("wpm"),
    voiceOnly: true,
    pick: (session) => measuredOf(session)?.pace.medianWpm ?? null,
    hint: () => "medián tempa odpovedí",
  };
  const fillers: CardSpec = {
    key: "fillers",
    label: "Výplňové slová",
    icon: "chat",
    tone: "violet",
    unit: "%",
    digits: 1,
    deltaMode: "relative",
    definition: metric("fillers"),
    voiceOnly: false,
    pick: (session) => measuredOf(session)?.fillers.per100Words ?? null,
    hint: () => "podiel zo všetkých slov; prepis môže zaváhania vynechať",
  };
  const length: CardSpec =
    family === "delivery"
      ? {
          key: "pitch_length",
          label: "Dĺžka pitchu",
          icon: "timer",
          tone: "lime",
          unit: "min",
          digits: 0,
          deltaMode: null,
          definition: metric("answer_seconds"),
          voiceOnly: true,
          pick: (session) => measuredOf(session)?.totals.founderSpeechSeconds ?? null,
          format: (value) => formatClock(value),
          hint: () => "čistý čas reči",
        }
      : {
          key: "answer_length",
          label: "Dĺžka odpovede",
          icon: "timer",
          tone: "lime",
          unit: "s",
          digits: 0,
          deltaMode: "relative",
          definition: metric("answer_seconds"),
          voiceOnly: true,
          pick: (session) => measuredOf(session)?.answerLength.medianSeconds ?? null,
          hint: (session) => {
            const target = measuredOf(session)?.answerLength.targetSeconds;
            return target ? `medián, cieľ do ${target} s` : "medián";
          },
        };
  return [shareCard, pace, fillers, length];
}

export function formatDelta(current: number, previous: number, mode: "relative" | "points"): { value: number; text: string } | null {
  if (mode === "relative" && previous === 0) return null;
  const change = mode === "relative" ? ((current - previous) / previous) * 100 : current - previous;
  const value = Math.round(change);
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return { value, text: `${sign}${Math.abs(value)} %` };
}

const VERDICT_WORDS = { better: "zlepšenie", worse: "zhoršenie", same: "bez výraznej zmeny" } as const;

function buildCard(spec: CardSpec, subject: DashboardSession | null, earlier: DashboardSession[]): StatCard {
  const base = { key: spec.key, label: spec.label, icon: spec.icon, tone: spec.tone };
  if (!subject) return { ...base, value: null, unit: null, hint: null, delta: null, note: "Po prvom tréningu" };

  const current = spec.pick(subject);
  if (current === null) {
    const voiceMissing = spec.voiceOnly && subject.transport !== "realtime";
    return { ...base, value: null, unit: null, hint: null, delta: null, note: voiceMissing ? "Iba v hlasovom tréningu" : "Minule sa nedalo zmerať" };
  }

  const value = spec.format ? spec.format(current) : formatNumber(current, spec.digits);
  const hint = spec.hint?.(subject) ?? null;
  // Porovnávame iba s tréningom rovnakého typu (rovnako ako história a porovnanie).
  const previousSession = earlier.find((session) => session.mode === subject.mode && spec.pick(session) !== null);
  const previous = previousSession ? spec.pick(previousSession) : null;
  if (spec.deltaMode === null || previous === null) {
    return { ...base, value, unit: spec.unit, hint, delta: null, note: spec.deltaMode === null ? hint ?? "" : "Prvé meranie" };
  }
  const change = formatDelta(current, previous, spec.deltaMode);
  if (!change) return { ...base, value, unit: spec.unit, hint, delta: null, note: "Prvé meranie" };
  const verdict = verdictFor(spec.definition, previous, current);
  return {
    ...base,
    value,
    unit: spec.unit,
    hint,
    delta: {
      text: change.text,
      sign: change.value > 0 ? "up" : change.value < 0 ? "down" : "flat",
      verdict,
      description: `${change.text} oproti minulému tréningu, ${VERDICT_WORDS[verdict]}`,
    },
    note: "vs. minulý tréning",
  };
}

/** Najnovší tréning s hotovým rozborom; podľa neho sa vyberá sada kariet. */
export function subjectSession(sessions: DashboardSession[]): DashboardSession | null {
  return [...sessions].sort(newestFirst).find((session) => readyReport(session)?.measured) ?? null;
}

export function buildStatCards(sessions: DashboardSession[]): { subject: DashboardSession | null; family: Family; cards: StatCard[] } {
  const sorted = [...sessions].sort(newestFirst);
  const subject = subjectSession(sorted);
  const family = subject ? familyOf(subject.mode) : "conversation";
  const earlier = subject ? sorted.filter((session) => session.createdAt < subject.createdAt) : [];
  return { subject, family, cards: cardSpecs(family).map((spec) => buildCard(spec, subject, earlier)) };
}

/* ───────────── Nedávne reporty ───────────── */

export type ReportTile = {
  id: string;
  title: string;
  icon: "chat" | "file";
  meta: string;
  summary: string | null;
  score: { value: number; tone: "good" | "mid" | "low"; label: string } | null;
  href: string;
};

export function scoreTone(percent: number): "good" | "mid" | "low" {
  if (percent >= 75) return "good";
  if (percent >= 50) return "mid";
  return "low";
}

export function buildRecentReports(sessions: DashboardSession[], limit = 3): ReportTile[] {
  return [...sessions]
    .sort(newestFirst)
    .filter((session) => readyReport(session)?.assessment)
    .slice(0, limit)
    .map((session) => {
      const share = shareFor(session);
      const family = familyOf(session.mode);
      const minutes = minutesLabel(session);
      return {
        id: session.id,
        title: MODE_TITLES[session.mode],
        icon: family === "delivery" ? "file" : "chat",
        meta: [formatNumericDate(session.createdAt), minutes].filter(Boolean).join(" · "),
        summary: readyReport(session)?.assessment?.summary ?? null,
        score: share
          ? {
              value: Math.round(share.percent),
              tone: scoreTone(share.percent),
              label: `${SHARE_LABELS[family].label}: ${Math.round(share.percent)} % (${share.count} z ${share.total})`,
            }
          : null,
        href: `/app/trening/${session.id}`,
      };
    });
}

/* ───────────── Posledná aktivita ───────────── */

export type ActivityItem = {
  key: string;
  kind: "training" | "report" | "exercise";
  title: string;
  meta: string;
  at: string;
  href: string;
};

export function buildActivity(sessions: DashboardSession[], exercises: DashboardExercise[], limit = 3): ActivityItem[] {
  const items: ActivityItem[] = [];
  for (const session of sessions) {
    if (session.status !== "completed") continue;
    const report = readyReport(session);
    const finishedAt = session.endedAt ?? session.createdAt;
    const href = `/app/trening/${session.id}`;
    const minutes = minutesLabel(session);
    if (session.mode !== "delivery" && report?.assessment) {
      const asked = report.assessment.questions.length;
      const at = report.completedAt ?? finishedAt;
      items.push({
        key: `report-${session.id}`,
        kind: "report",
        title: "Nový AI investor report",
        meta: [asked > 0 ? `${asked} ${plural(asked, "otázka", "otázky", "otázok")}` : null, formatNumericDate(at)].filter(Boolean).join(" · "),
        at,
        href,
      });
    } else {
      items.push({
        key: `training-${session.id}`,
        kind: "training",
        title: session.mode === "delivery" ? "Dokončený tréning pitchu" : "Dokončený rozhovor s investorom",
        meta: [minutes, formatNumericDate(finishedAt)].filter(Boolean).join(" · "),
        at: finishedAt,
        href,
      });
    }
  }
  for (const exercise of exercises) {
    if (exercise.status !== "completed" || !exercise.completedAt) continue;
    items.push({
      key: `exercise-${exercise.id}`,
      kind: "exercise",
      title: "Cielené cvičenie",
      meta: `${exercise.title} · ${formatNumericDate(exercise.completedAt)}`,
      at: exercise.completedAt,
      href: `/app/cvicenia/${exercise.id}`,
    });
  }
  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

/* ───────────── Pokrok v čase ───────────── */

export const PROGRESS_RANGES = [
  { key: "7", days: 7, label: "Posledných 7 dní" },
  { key: "30", days: 30, label: "Posledných 30 dní" },
  { key: "90", days: 90, label: "Posledných 90 dní" },
  { key: "all", days: null, label: "Celé obdobie" },
] as const;

export type ProgressRangeKey = (typeof PROGRESS_RANGES)[number]["key"];

export type ProgressPoint = { id: string; at: string; value: number; label: string; detail: string };

export type ProgressSeries = { family: Family; metricLabel: string; points: ProgressPoint[] };

/** Podiel z rozboru v čase, iba tréningy rovnakého typu (rozhovor alebo prednes). */
export function buildProgressSeries(sessions: DashboardSession[], family: Family): ProgressSeries {
  const points = [...sessions]
    .filter((session) => familyOf(session.mode) === family)
    .map((session) => ({ session, share: shareFor(session) }))
    .filter((item): item is { session: DashboardSession; share: Share } => item.share !== null)
    .sort((a, b) => a.session.createdAt.localeCompare(b.session.createdAt))
    .map(({ session, share }) => ({
      id: session.id,
      at: session.createdAt,
      value: Math.round(share.percent),
      label: formatNumericDate(session.createdAt),
      detail: `${share.count} z ${share.total} ${SHARE_LABELS[family].unit(share.total)}`,
    }));
  return { family, metricLabel: SHARE_LABELS[family].label, points };
}

export function pointsInRange(points: ProgressPoint[], range: ProgressRangeKey, now: Date): ProgressPoint[] {
  const days = PROGRESS_RANGES.find((item) => item.key === range)?.days ?? null;
  if (days === null) return points;
  const from = now.getTime() - days * 24 * 60 * 60 * 1000;
  return points.filter((point) => new Date(point.at).getTime() >= from);
}

/** Najkratšie obdobie, v ktorom sú aspoň dva body (inak by graf nič neukázal). */
export function defaultProgressRange(points: ProgressPoint[], now: Date): ProgressRangeKey {
  return PROGRESS_RANGES.find((range) => pointsInRange(points, range.key, now).length >= 2)?.key ?? "all";
}

/** Zmena od prvého po posledný bod obdobia v percentuálnych bodoch. */
export function progressChange(points: ProgressPoint[]): number | null {
  if (points.length < 2) return null;
  return points[points.length - 1].value - points[0].value;
}

/* ───────────── Tip na dnes ───────────── */

export type Tip = { title: string; detail: string; href: string; source: "measured" | "recommendation" };

/** Krátke výzvy k pozorovaniam z meraní. Text pozorovania (s číslom) ostáva ako vysvetlenie. */
const TIP_TITLES: Record<string, string> = {
  "pace-fast": "Spomaľ pri kľúčových číslach.",
  "pace-slow": "Začni rovno pointou.",
  "length-long": "Skráť odpovede.",
  "latency-slow": "Začni hlavnou myšlienkou.",
  "pauses-long": "Pracuj s pauzami vedome.",
  "fillers-high": "Nahraď výplňové slová pauzou.",
  "voice-flat-volume": "Zdôrazni dôležité vety hlasom.",
  "voice-flat-pitch": "Oživ intonáciu.",
  "camera-face-hidden": "Postav sa celou tvárou do záberu.",
  "camera-facing": "Pozeraj viac do kamery.",
  "camera-centered": "Vycentruj sa v zábere.",
};

const withFullStop = (text: string) => (/[.!?]$/.test(text) ? text : `${text}.`);

export function buildTip(subject: DashboardSession | null, recommendation: Recommendation): Tip {
  const measured = subject ? measuredOf(subject) : null;
  const observation: DeliveryObservation | undefined = measured
    ? deliveryObservations(measured).find((item) => item.tone === "attention")
    : undefined;
  if (subject && observation) {
    return {
      title: TIP_TITLES[observation.id] ?? withFullStop(observation.title),
      detail: observation.detail,
      href: `/app/trening/${subject.id}`,
      source: "measured",
    };
  }
  return { title: withFullStop(recommendation.title), detail: recommendation.reason, href: recommendation.href, source: "recommendation" };
}

/* ───────────── Hlavná výzva ───────────── */

/** Kam vedie „Začať tréning“: pripravený retest alebo prvý tréning z odporúčania, inak výber tréningu. */
export function trainingHref(recommendation: Recommendation, projectId: string | null): string {
  if (recommendation.kind === "retest" || recommendation.kind === "first_training") return recommendation.href;
  return projectId ? `/app/trening/novy?projekt=${projectId}` : "/app/trening/novy";
}
