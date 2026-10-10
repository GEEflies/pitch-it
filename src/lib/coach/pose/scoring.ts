import { CONFIG } from "./config";
import { RULES, type GroupId } from "./rules";
import type { SessionSummary } from "./session";

/**
 * Prísne finálne skóre. Na rozdiel od živého skóre (motivačné, vyhladené) sa
 * počíta z celého tréningu: každá chyba stojí body podľa toho, koľko percent
 * času trvala a koľkokrát sa opakovala, a závažné problémy skóre zastropujú.
 */

export type Deduction = { reason: string; points: number };

export type CategoryScore = {
  id: GroupId;
  title: string;
  weight: number;
  /** null = kategória sa v tomto režime nehodnotila (napr. pri cvičení) */
  score: number | null;
  deductions: Deduction[];
};

export type FinalScore = {
  /** null = málo dát na hodnotenie */
  total: number | null;
  /** skóre pred stropmi */
  raw: number | null;
  grade: string;
  label: string;
  verdict: string;
  categories: CategoryScore[];
  caps: { limit: number; reason: string }[];
};

const CATEGORIES: { id: GroupId; title: string; weight: number }[] = [
  { id: "gestures", title: "Gestá a ruky", weight: 0.5 },
  { id: "head", title: "Hlava a pohľad", weight: 0.25 },
  { id: "stage", title: "Pohyb v priestore", weight: 0.15 },
  { id: "posture", title: "Postoj", weight: 0.1 },
];

// koľko bodov stojí chyba, ktorá trvá celý tréning, a koľko každé jej opakovanie
const TIME_PENALTY = { bad: 200, warn: 100 };
const REPEAT_PENALTY = { bad: 5, warn: 3 };
const REPEAT_CAP = { bad: 25, warn: 15 };

// ciele pre merané hodnoty
const ZONE_TARGET = 0.75;
const GESTURE_RATE_TARGET = 20;
const GESTURE_RATE_MAX = 45;
const GAZE_SIDE_MIN = 0.15;

/**
 * Dobrý rečník chyby nielen nerobí, ale dobré veci aj predvádza.
 * Minimálny počet za minútu; chýbajúce strhávajú body (len ak je dané pravidlo zapnuté).
 */
const SKILL_REQUIREMENTS: {
  category: GroupId;
  highlight: keyof SessionSummary["highlights"];
  rule: string;
  perMin: number;
  maxPoints: number;
  minPersonMs: number;
  label: string;
}[] = [
  { category: "gestures", highlight: "hold", rule: "no-hold", perMin: 3, maxPoints: 15, minPersonMs: 30_000, label: "podržaných gest" },
  { category: "gestures", highlight: "wide", rule: "closed", perMin: 1, maxPoints: 10, minPersonMs: 30_000, label: "širokých, otvorených gest" },
  { category: "head", highlight: "sweep", rule: "gaze-stuck", perMin: 2, maxPoints: 20, minPersonMs: 30_000, label: "prechodov pohľadu cez miestnosť" },
  { category: "stage", highlight: "planted", rule: "rooted", perMin: 1, maxPoints: 25, minPersonMs: 60_000, label: "zámerných presunov so zastavením" },
];

/** celková prísnosť: všetky strhnuté body sa násobia týmto číslom (1 = najprísnejšie) */
const STRICTNESS = 0.8;

const MIN_PERSON_MS = 10_000;
const SHORT_SESSION_MS = 55_000;

const pct = (v: number) => `${Math.round(v * 100)} %`;
const round1 = (v: number) => Math.round(v * 10) / 10;

export function gradeFor(total: number): { grade: string; label: string; verdict: string } {
  if (total >= 97) return { grade: "A+", label: "Pripravený na pódium", verdict: "Výnimočné. Reč tela máš na úrovni najlepších TED rečníkov." };
  if (total >= 93) return { grade: "A", label: "Pripravený na pódium", verdict: "Výborne. Od bezchybného výstupu ťa delia len drobnosti." };
  if (total >= 85) return { grade: "B", label: "Takmer pripravený", verdict: "Silný výstup, no profesionálne publikum by si ešte všimlo pár zlozvykov." };
  if (total >= 75) return { grade: "C", label: "Sebaistý", verdict: "Slušné, ale viaceré zlozvyky odvádzajú pozornosť od posolstva. Na pódium to ešte nie je." };
  if (total >= 65) return { grade: "D", label: "Rozvíjaš sa", verdict: "Reč tela miestami pracuje proti tebe. Oprav najväčšie zrážky nižšie." };
  if (total >= 50) return { grade: "E", label: "Začiatočník", verdict: "Telo zatiaľ nepodporuje tvoje posolstvo. Trénuj hlavné problémy po jednom cvičení." };
  return { grade: "F", label: "Treba zapracovať", verdict: "Výrazné zlozvyky oslabujú tvoj prejav. Pred ďalším celým pitchom si prejdi cvičenia." };
}

export function computeFinalScore(
  s: SessionSummary,
  isEnabled: (ruleId: string) => boolean = () => true,
): FinalScore {
  const person = s.personMs;
  const issueById = new Map(s.issues.map((i) => [i.id, i]));
  const share = (id: string) => (person ? (issueById.get(id)?.ms ?? 0) / person : 0);

  const categories: CategoryScore[] = CATEGORIES.map((c) => {
    const rules = RULES.filter((r) => r.group === c.id && isEnabled(r.id));
    if (!rules.length) return { ...c, score: null, deductions: [] };
    const deductions: Deduction[] = [];

    // chyby podľa času a opakovaní
    for (const r of rules) {
      const issue = issueById.get(r.id);
      if (!issue || !person) continue;
      const f = Math.min(1, issue.ms / person);
      const points =
        (r.scoreWeight ?? 1) *
        (TIME_PENALTY[r.severity] * f + Math.min(issue.count * REPEAT_PENALTY[r.severity], REPEAT_CAP[r.severity]));
      if (points >= 0.5) {
        deductions.push({
          reason: `${r.title}: ${pct(f)} času, ${issue.count}×`,
          points: round1(points),
        });
      }
    }

    // merané hodnoty, ktoré pravidlá nezachytia naplno
    if (c.id === "gestures") {
      if (isEnabled("hands-low") && s.zoneShare < ZONE_TARGET) {
        deductions.push({
          reason: `Ruky v power zóne len ${pct(s.zoneShare)} času (cieľ ${pct(ZONE_TARGET)}+)`,
          points: round1((ZONE_TARGET - s.zoneShare) * 80),
        });
      }
      const g = s.gesturesPerMin;
      if (isEnabled("few-gestures") && g !== null) {
        if (g < GESTURE_RATE_TARGET) {
          deductions.push({
            reason: `${g} gest za minútu (najlepší TED rečníci ~25)`,
            points: round1(Math.min(40, (GESTURE_RATE_TARGET - g) * 2)),
          });
        } else if (g > GESTURE_RATE_MAX) {
          deductions.push({
            reason: `${g} gest za minútu je nepokojných (drž sa pod ${GESTURE_RATE_MAX})`,
            points: round1(Math.min(15, g - GESTURE_RATE_MAX)),
          });
        }
      }
    }
    if (c.id === "head" && isEnabled("gaze-stuck") && person >= 30_000) {
      for (const side of ["left", "right"] as const) {
        const v = s.gazeShare[side];
        if (v < GAZE_SIDE_MIN) {
          deductions.push({
            reason: `Pohľad ${side === "left" ? "doľava" : "doprava"} len ${pct(v)} času`,
            points: round1(Math.min(15, (GAZE_SIDE_MIN - v) * 120)),
          });
        }
      }
    }

    // chýbajúce dobré návyky
    const minutes = person / 60_000;
    for (const req of SKILL_REQUIREMENTS) {
      if (req.category !== c.id || !isEnabled(req.rule) || person < req.minPersonMs) continue;
      const rate = (s.highlights[req.highlight] ?? 0) / minutes;
      if (rate < req.perMin) {
        deductions.push({
          reason: `Len ${rate.toFixed(1).replace(".", ",")} ${req.label} za minútu (cieľ ${req.perMin}+)`,
          points: round1(req.maxPoints * (1 - rate / req.perMin)),
        });
      }
    }

    for (const d of deductions) d.points = round1(d.points * STRICTNESS);
    deductions.sort((a, b) => b.points - a.points);
    const score = Math.max(0, Math.round(100 - deductions.reduce((a, d) => a + d.points, 0)));
    return { ...c, score, deductions };
  });

  if (person < MIN_PERSON_MS) {
    return {
      total: null,
      raw: null,
      grade: "–",
      label: "Málo údajov",
      verdict: "V zábere si bol menej ako 10 sekúnd. Postav sa pred kameru a skús to znova.",
      categories,
      caps: [],
    };
  }

  const scored = categories.filter((c) => c.score !== null);
  const weight = scored.reduce((a, c) => a + c.weight, 0) || 1;
  // žiadny bonus za dobré momenty: 100 sa dá dosiahnuť len bez jedinej chyby
  const raw = Math.round(scored.reduce((a, c) => a + c.weight * c.score!, 0) / weight);

  // stropy: niektoré problémy znemožnia vysoké skóre bez ohľadu na zvyšok
  const caps: FinalScore["caps"] = [];
  for (const r of RULES) {
    if (!isEnabled(r.id) || r.group === "setup") continue;
    const f = share(r.id);
    const n = issueById.get(r.id)?.count ?? 0;
    if (r.severity === "bad" && f > 0.15) {
      caps.push({ limit: 69, reason: `„${r.title}“ počas ${pct(f)} tréningu` });
    } else if (r.severity === "bad" && n > 0) {
      // jediná závažná chyba = žiadne A
      caps.push({ limit: 89, reason: `„${r.title}“ sa stalo ${n}×. Každá vážna chyba vylučuje známku A` });
    } else if (r.severity === "warn" && (r.scoreWeight ?? 1) >= 1 && f > 0.36) {
      caps.push({ limit: 74, reason: `„${r.title}“ počas ${pct(f)} tréningu` });
    }
  }
  // rečník, ktorý sa celý prejav nepohne z miesta, nemôže dostať A
  if (isEnabled("rooted") && person >= CONFIG.rootedMs * 2) {
    const rooted = share("rooted");
    if (rooted > 0.5) caps.push({ limit: 89, reason: `${pct(rooted)} prejavu bez pohybu v priestore` });
  }
  const clean = s.cleanShare;
  if (clean < 0.5) caps.push({ limit: 74, reason: `Bez chyby len ${pct(clean)} času` });
  else if (clean < 0.7) caps.push({ limit: 84, reason: `Bez chyby len ${pct(clean)} času (cieľ 85 %+)` });
  else if (clean < 0.85) caps.push({ limit: 92, reason: `${pct(clean)} času bez chyby. Na A treba 85 %+` });
  const inFrame = s.durationMs ? person / s.durationMs : 1;
  if (inFrame < 0.8) caps.push({ limit: 79, reason: `Mimo záberu si bol ${pct(1 - inFrame)} tréningu` });
  const setupShare = share("too-close") + share("too-far");
  if (setupShare > 0.3) caps.push({ limit: 75, reason: `Záber kamery nesedel ${pct(setupShare)} času` });
  if (person < SHORT_SESSION_MS) caps.push({ limit: 85, reason: "Menej ako minúta je príliš málo na preukázanie stálosti" });

  const limit = Math.min(100, ...caps.map((c) => c.limit));
  const total = Math.min(raw, limit);
  return {
    total,
    raw,
    ...gradeFor(total),
    categories,
    // zobrazíme len stropy, ktoré skóre naozaj znížili
    caps: caps.filter((c) => c.limit < raw).sort((a, b) => a.limit - b.limit),
  };
}
