import { emptyUsage, PLANS } from "@/lib/billing/plans";
import type { Recommendation } from "@/lib/dashboard/recommendation";
import type { SessionListItem, SessionWithReport } from "@/lib/db/sessions";
import type { ExerciseRow, ReportRow, TurnRow } from "@/lib/db/types";
import type { ComparableSession } from "@/lib/history/compare";
import { validateAssessmentEvidence, type Assessment } from "@/lib/reports/assessment";
import { computeMeasurements, type MeasuredAudioInput, type SessionMeasurements } from "@/lib/reports/measured";
import type { LiveTurn } from "@/lib/session/live-state";

/*
  UKÁŽKOVÉ DÁTA pre vývojový režim /ukazka. Vymyslený startup, nikdy sa nezobrazujú
  v produkcii ani skutočným používateľom. Merania sa počítajú rovnakými funkciami ako v aplikácii.
*/

export const PREVIEW_PROJECT = { id: "00000000-0000-4000-8000-0000000000a1", name: "Faktúrka" };
export const PREVIEW_SESSION_ID = "00000000-0000-4000-8000-0000000000b1";

const turnTexts: Array<[TurnRow["speaker"], string]> = [
  ["investor", "Dobrý deň, ďakujem za čas. Na slide uvádzate trh štyri celé dva miliardy eur. Koľko z toho dokážete reálne osloviť v najbližších troch rokoch?"],
  ["founder", "Ehm, trh je naozaj obrovský a stále rastie. Aj keby sme získali iba jedno percento, je to štyridsaťdva miliónov eur, takže v podstate je tam veľký priestor pre nás aj pre ďalších hráčov."],
  ["investor", "Jedno percento z čoho presne? Koľko konkrétnych zákazníkov to je a ako sa k nim dostanete?"],
  ["founder", "Cielime na e-shopy na Slovensku, v Česku a v Poľsku s obratom nad milión eur. Je ich zhruba šesťtisíc. Pri cene tritisíc eur ročne je to osemnásť miliónov eur, a to je náš reálny trh na tri roky."],
  ["investor", "Dobre. Koľko z tých šesťtisíc firiem dnes platí?"],
  ["founder", "Dnes máme štyridsaťosem platiacich zákazníkov a mesačne pribúda zhruba päť až šesť nových, väčšinou z odporúčaní."],
  ["investor", "Spomínali ste odporúčania. Čo sa stane s cenou získania zákazníka, keď sa organické kanály vyčerpajú?"],
  ["founder", "Myslíme si, že zostane podobná, máme silnú značku a ľudia nás odporúčajú ďalej, takže si nemyslím, že to bude problém, a vlastne aj konkurencia je pomalá, takže máme čas, kým nás dobehnú, a dovtedy budeme mať náskok."],
  ["investor", "Rozumiem. Ďakujem, to je pre dnešok všetko."],
];

const timing = [
  [0, 9_000],
  [10_800, 26_000],
  [27_000, 33_000],
  [34_200, 51_000],
  [52_000, 55_000],
  [55_900, 63_500],
  [64_500, 72_000],
  [76_200, 97_000],
  [98_000, 101_000],
];

export const PREVIEW_TURNS: TurnRow[] = turnTexts.map(([speaker, text], seq) => ({
  id: `turn-${seq}`,
  session_id: PREVIEW_SESSION_ID,
  seq,
  speaker,
  text,
  started_ms: timing[seq][0],
  ended_ms: timing[seq][1],
  interrupted: false,
  source: "realtime",
  provider_item_id: null,
  created_at: "2026-10-09T15:00:00Z",
}));

const audio: MeasuredAudioInput[] = [
  { turnSeq: 1, speechMs: 13_400, wordsPerMinute: null, responseLatencyMs: 1_800, pauseCount: 1, pauseTotalMs: 2_900, longestPauseMs: 2_900, volumeVariability: 4.1, pitchVariabilitySemitones: 2.3, pitchReliable: true, transcriptConfidence: 0.91 },
  { turnSeq: 3, speechMs: 15_600, wordsPerMinute: null, responseLatencyMs: 1_200, pauseCount: 0, pauseTotalMs: 0, longestPauseMs: 0, volumeVariability: 4.6, pitchVariabilitySemitones: 2.6, pitchReliable: true, transcriptConfidence: 0.94 },
  { turnSeq: 5, speechMs: 7_100, wordsPerMinute: null, responseLatencyMs: 900, pauseCount: 0, pauseTotalMs: 0, longestPauseMs: 0, volumeVariability: 3.9, pitchVariabilitySemitones: 2.1, pitchReliable: true, transcriptConfidence: 0.95 },
  { turnSeq: 7, speechMs: 16_800, wordsPerMinute: null, responseLatencyMs: 4_200, pauseCount: 2, pauseTotalMs: 5_600, longestPauseMs: 3_100, volumeVariability: 3.2, pitchVariabilitySemitones: 1.8, pitchReliable: true, transcriptConfidence: 0.89 },
];

const visual = {
  framesAnalyzed: 486,
  faceVisibleRatio: 0.96,
  faceCenteredRatio: 0.88,
  facingCameraRatio: 0.71,
  gazeTowardCameraRatio: 0.58,
  headMovementIndex: 0.42,
  upperBodyVisibleRatio: 0.9,
  postureStabilityIndex: 0.8,
  handsVisibleRatio: 0.35,
  gestureActivityIndex: 3.1,
  framingIssues: [] as string[],
};

export const PREVIEW_MEASURED: SessionMeasurements = computeMeasurements({
  transport: "realtime",
  durationSeconds: 101,
  targetAnswerSeconds: 60,
  turns: PREVIEW_TURNS.map((turn) => ({
    seq: turn.seq,
    speaker: turn.speaker,
    text: turn.text,
    startedMs: turn.started_ms,
    endedMs: turn.ended_ms,
    interrupted: turn.interrupted,
    source: turn.source,
  })),
  audio,
  visual,
});

const rawAssessment: Assessment = {
  summary:
    "Výpočet trhu zdola a počet platiacich zákazníkov obstáli. Najslabšie miesto je cena získania zákazníka: odpoveď stojí na dojme, nie na dátach, a odbočuje ku konkurencii.",
  content_dimensions: [
    { key: "relevance", rating: "adequate", explanation: "Tri zo štyroch odpovedí mieria priamo na otázku. Pri otázke na CAC odpoveď odbočila ku konkurencii.", evidence: [{ turn_seq: 3, quote: "Cielime na e-shopy na Slovensku, v Česku a v Poľsku" }] },
    { key: "specificity", rating: "weak", explanation: "Prvá odpoveď na trh je všeobecná a opiera sa o percento z celého trhu namiesto konkrétnych zákazníkov.", evidence: [{ turn_seq: 1, quote: "Aj keby sme získali iba jedno percento" }] },
    { key: "evidence_numbers", rating: "adequate", explanation: "Počet zákazníkov a výpočet trhu sú konkrétne. Chýba zdroj čísla šesťtisíc firiem a dáta o akvizícii.", evidence: [{ turn_seq: 5, quote: "štyridsaťosem platiacich zákazníkov" }] },
    { key: "consistency", rating: "adequate", explanation: "Počet zákazníkov sa mierne líši od podkladu, inak odpovede s podkladmi sedia.", evidence: [] },
    { key: "brevity_structure", rating: "adequate", explanation: "Väčšina odpovedí je stručná. Posledná odpoveď sa naťahuje a pridáva tvrdenia, na ktoré sa nikto nepýtal.", evidence: [{ turn_seq: 7, quote: "a vlastne aj konkurencia je pomalá" }] },
    { key: "tough_questions", rating: "weak", explanation: "Na jedinú naozaj nepríjemnú otázku (CAC po vyčerpaní organiky) prišla odpoveď bez dát.", evidence: [{ turn_seq: 7, quote: "Myslíme si, že zostane podobná" }] },
  ],
  questions: [
    { investor_turn_seq: 0, topic: "Dostupný trh", answer_turn_seqs: [1], verdict: "partially_answered", note: "Číslo zaznelo, ale bez definície zákazníka." },
    { investor_turn_seq: 2, topic: "Výpočet zdola", answer_turn_seqs: [3], verdict: "answered", note: "Segment, počet firiem a cena dávajú zmysluplný výpočet." },
    { investor_turn_seq: 4, topic: "Platiaci zákazníci", answer_turn_seqs: [5], verdict: "answered", note: "Konkrétne číslo aj tempo rastu." },
    { investor_turn_seq: 6, topic: "CAC mimo organiky", answer_turn_seqs: [7], verdict: "evaded", note: "Namiesto dát presvedčenie a odbočka ku konkurencii." },
  ],
  consistency_issues: [
    { turn_seq: 5, claim: "štyridsaťosem platiacich zákazníkov", conflicts_with: "Na slide 5 je uvedených 52 platiacich zákazníkov (august 2026).", source: "deck", severity: "medium" },
  ],
  unsupported_claims: [
    { turn_seq: 7, claim: "máme silnú značku", why: "podiel zákazníkov z odporúčaní, NPS alebo výsledok testu platených kanálov" },
  ],
  strengths: [
    { turn_seq: 3, point: "Výpočet trhu zdola: segment, počet firiem a ročná cena." },
    { turn_seq: 5, point: "Konkrétny počet platiacich zákazníkov a tempo, akým pribúdajú." },
  ],
  weaknesses: [
    {
      title: "Trh cez „jedno percento“",
      turn_seq: 1,
      original_excerpt: "Aj keby sme získali iba jedno percento, je to štyridsaťdva miliónov eur",
      problem: "Percento z celého trhu nehovorí, kto je zákazník ani ako ho získate. Investor sa preto musel pýtať znova.",
      improved_example:
        "Celý európsky trh je 4,2 miliardy, ale náš trh na tri roky sú e-shopy na Slovensku, v Česku a v Poľsku s obratom nad milión eur. Je ich zhruba 6 000 [doplň: zdroj odhadu]. Pri cene 3 000 eur ročne je to 18 miliónov eur.",
      exercise: { category: "market", title: "Veľkosť trhu výpočtom zdola", prompt: "Ako veľký je trh pre Faktúrku? Ukážte mi, ako ste sa k tomu číslu dopracovali.", success_criteria: ["Pomenuje segment", "Uvedie počet zákazníkov a zdroj", "Vynásobí cenou"] },
    },
    {
      title: "Cena získania zákazníka bez dát",
      turn_seq: 7,
      original_excerpt: "Myslíme si, že zostane podobná, máme silnú značku a ľudia nás odporúčajú ďalej",
      problem: "Investor chce vedieť, či rast nezastane, keď sa odporúčania vyčerpajú. „Myslíme si“ bez čísla toto riziko neodstráni.",
      improved_example:
        "Dnes prichádza [doplň: podiel] zákazníkov z odporúčaní. V teste platených kanálov vyšiel CAC [doplň: hodnota]. Pri LTV [doplň: hodnota] je to stále návratné do [doplň: mesiace] mesiacov.",
      exercise: { category: "traction_unit_economics", title: "CAC po vyčerpaní organiky", prompt: "Čo sa stane s cenou získania zákazníka, keď sa organické kanály vyčerpajú?", success_criteria: ["Rozdelí CAC podľa kanálov", "Uvedie výsledok testu platenej akvizície", "Porovná s LTV"] },
    },
    {
      title: "Odbočka ku konkurencii",
      turn_seq: 7,
      original_excerpt: "a vlastne aj konkurencia je pomalá, takže máme čas, kým nás dobehnú",
      problem: "Otázka bola o akvizícii. Odbočka pridáva nové tvrdenie, ktoré otvára ďalšiu nepríjemnú otázku.",
      improved_example: "Odpovedz najprv na CAC jednou vetou s číslom. Konkurenciu spomeň, až keď sa na ňu investor opýta.",
      exercise: { category: "concise_answers", title: "Odpoveď do 30 sekúnd", prompt: "Jednou-dvoma vetami: ako budete získavať zákazníkov, keď odporúčania nebudú stačiť?", success_criteria: ["Zmestí sa do 30 sekúnd", "Začína pointou", "Neodbočuje k iným témam"] },
    },
  ],
  data_gaps: ["CAC podľa kanálov", "Retencia zákazníkov po kohortách"],
  pitch_coverage: null,
  uncertainty: "Krátky rozhovor (4 odpovede): zvládnutie náročných otázok vychádza z jednej otázky.",
};

export const PREVIEW_ASSESSMENT: Assessment = validateAssessmentEvidence(
  rawAssessment,
  new Map(PREVIEW_TURNS.filter((turn) => turn.speaker === "founder").map((turn) => [turn.seq, turn.text])),
  new Set(PREVIEW_TURNS.filter((turn) => turn.speaker === "investor").map((turn) => turn.seq)),
);

export const PREVIEW_REPORT: Pick<ReportRow, "status" | "error_code" | "measured" | "assessment"> = {
  status: "ready",
  error_code: null,
  measured: PREVIEW_MEASURED as unknown as Record<string, unknown>,
  assessment: PREVIEW_ASSESSMENT,
};

export const PREVIEW_SESSION = {
  id: PREVIEW_SESSION_ID,
  mode: "coach" as const,
  status: "completed" as const,
  project_id: PREVIEW_PROJECT.id,
  investor_key: "market",
  scenario_key: "first_meeting",
  created_at: "2026-10-09T15:00:00Z",
  camera_enabled: true,
  billed_seconds: 101,
};

export const PREVIEW_EXERCISES: Array<Pick<ExerciseRow, "id" | "title" | "origin">> = PREVIEW_ASSESSMENT.weaknesses.map(
  (weakness, index) => ({ id: `ex-${index}`, title: weakness.exercise.title, origin: "report" as const }),
);

/* ───────────── História: štyri tréningy rovnakého typu (ukážkové čísla) ───────────── */

function variant(base: SessionMeasurements, overrides: { wpm: number; seconds: number; latencyMs: number; fillers: number; longPauses: number; facing: number }): SessionMeasurements {
  return {
    ...base,
    pace: { ...base.pace, medianWpm: overrides.wpm },
    answerLength: { ...base.answerLength, medianSeconds: overrides.seconds },
    latency: { ...base.latency, medianMs: overrides.latencyMs },
    fillers: { ...base.fillers, per100Words: overrides.fillers },
    pauses: { ...base.pauses, longPauses: overrides.longPauses },
    visual: base.visual ? { ...base.visual, facingCameraRatio: overrides.facing } : null,
  };
}

const historyPoints = [
  { id: "00000000-0000-4000-8000-0000000000c1", date: "2026-09-18T15:00:00Z", wpm: 188, seconds: 52, latencyMs: 3_900, fillers: 6.8, longPauses: 3, facing: 0.52 },
  { id: "00000000-0000-4000-8000-0000000000c2", date: "2026-09-25T15:00:00Z", wpm: 176, seconds: 41, latencyMs: 3_100, fillers: 5.1, longPauses: 2, facing: 0.6 },
  { id: "00000000-0000-4000-8000-0000000000c3", date: "2026-10-02T15:00:00Z", wpm: 168, seconds: 33, latencyMs: 2_400, fillers: 4.4, longPauses: 2, facing: 0.66 },
  { id: PREVIEW_SESSION_ID, date: PREVIEW_SESSION.created_at, wpm: PREVIEW_MEASURED.pace.medianWpm ?? 150, seconds: PREVIEW_MEASURED.answerLength.medianSeconds ?? 15, latencyMs: PREVIEW_MEASURED.latency.medianMs ?? 1_500, fillers: PREVIEW_MEASURED.fillers.per100Words ?? 3, longPauses: PREVIEW_MEASURED.pauses.longPauses, facing: 0.71 },
];

export const PREVIEW_HISTORY: Array<Pick<SessionWithReport, "id" | "mode" | "status" | "investor_key" | "scenario_key" | "created_at" | "billed_seconds" | "projects" | "feedback_reports">> =
  [...historyPoints].reverse().map((point, index) => ({
    id: point.id,
    mode: "coach",
    status: "completed",
    investor_key: index % 2 === 0 ? "market" : "financial",
    scenario_key: "first_meeting",
    created_at: point.date,
    billed_seconds: 101 + index * 140,
    projects: { name: PREVIEW_PROJECT.name },
    feedback_reports: { status: "ready", measured: {}, assessment: null },
  }));

export const PREVIEW_COMPARABLE: ComparableSession[] = historyPoints.map((point) => ({
  id: point.id,
  mode: "coach",
  transport: "realtime",
  createdAt: point.date,
  measured: variant(PREVIEW_MEASURED, point),
  assessment: point.id === PREVIEW_SESSION_ID ? PREVIEW_ASSESSMENT : null,
}));

export const PREVIEW_DASHBOARD_SESSIONS: Array<Pick<SessionListItem, "id" | "status" | "mode" | "investor_key" | "created_at" | "billed_seconds" | "projects" | "feedback_reports">> =
  PREVIEW_HISTORY.map((session) => ({ ...session, feedback_reports: { status: "ready" as const } }));

export const PREVIEW_BILLING = {
  plan: PLANS.free,
  usage: { ...emptyUsage(), realtime_seconds: 9 * 60 + 20, report: 2, deck_analysis: 1 },
};

export const PREVIEW_RECOMMENDATION: Recommendation = {
  kind: "practice_weakness",
  title: "Precvič: CAC po vyčerpaní organiky",
  reason: "Toto cvičenie vzniklo zo slabiny v tvojom poslednom rozhovore. Krátke opakovanie pred ďalšou simuláciou.",
  href: "/app/cvicenia/ex-1",
  cta: "Otvoriť cvičenie",
};

/* ───────────── Podklady ───────────── */

export const PREVIEW_DOCUMENTS = [
  {
    id: "doc-1",
    fileName: "Fakturka_pitch_deck_2026-09.pdf",
    fileType: "pdf" as const,
    status: "ready" as const,
    slideCount: 12,
    errorCode: null,
    summary:
      "Deck predstavuje automatické spracovanie faktúr pre e-shopy (SK, CZ, PL). Obsahuje veľkosť trhu, trakciu (52 platiacich zákazníkov), cenník a požiadavku 500 000 €. Chýba slide o konkurencii a použití peňazí.",
    createdLabel: "9. októbra 15:02",
  },
];

export const PREVIEW_FACTS = [
  { id: "f1", category: "traction" as const, label: "Platiaci zákazníci", valueText: "48", period: "október 2026", sourceType: "user" as const, status: "confirmed" as const, confidence: null, slideNumber: null, quote: null },
  { id: "f2", category: "traction" as const, label: "Platiaci zákazníci", valueText: "52", period: "august 2026", sourceType: "document" as const, status: "needs_review" as const, confidence: "high" as const, slideNumber: 5, quote: "52 platiacich zákazníkov k augustu 2026" },
  { id: "f3", category: "market" as const, label: "Celkový trh (TAM)", valueText: "4,2 mld €", period: null, sourceType: "document" as const, status: "needs_review" as const, confidence: "high" as const, slideNumber: 3, quote: "Európsky trh e-commerce účtovníctva: 4,2 mld €" },
  { id: "f4", category: "unit_economics" as const, label: "Odhad LTV", valueText: "približne 9 000 € (3 roky × 3 000 €)", period: null, sourceType: "ai_inference" as const, status: "needs_review" as const, confidence: "low" as const, slideNumber: 7, quote: "Cena 3 000 € ročne, priemerná doba zákazníka 3 roky" },
  { id: "f5", category: "fundraising" as const, label: "Požadovaná investícia", valueText: "500 000 €", period: null, sourceType: "document" as const, status: "confirmed" as const, confidence: "high" as const, slideNumber: 12, quote: "Hľadáme 500 000 € v pre-seed kole" },
];

export const PREVIEW_ISSUES = [
  { id: "i1", kind: "conflict" as const, description: "Počet platiacich zákazníkov: na slide 5 je 52 (august), v profile 48 (október). Investor sa opýta, či zákazníci odchádzajú.", slideNumber: 5, status: "open" as const },
  { id: "i2", kind: "missing" as const, description: "Chýba slide o konkurencii. Investor sa pýta, čo zákazník robí dnes namiesto vás.", slideNumber: null, status: "open" as const },
  { id: "i3", kind: "unsupported_claim" as const, description: "„Najrýchlejšie rastúci nástroj na trhu“ bez porovnania alebo zdroja.", slideNumber: 2, status: "open" as const },
];

/* ───────────── Scenár živej ukážky v miestnosti ───────────── */

export const PREVIEW_ROOM_SCRIPT: Array<{ speaker: LiveTurn["speaker"]; text: string }> = turnTexts.map(([speaker, text]) => ({ speaker, text }));

export const PREVIEW_HINT = {
  approach: "Investor overuje, či viete, kto je váš zákazník, nie veľkosť celého trhu.",
  structure: [
    "Začni segmentom: e-shopy v SK, CZ a PL s obratom nad milión eur.",
    "Povedz počet firiem a zdroj odhadu.",
    "Vynásob ročnou cenou a povedz výsledok.",
  ],
  facts_to_use: ["Cena 3 000 € ročne (slide 7)", "Celkový trh 4,2 mld € (slide 3, na kontrolu)"],
  avoid: "Argument „stačí nám jedno percento trhu“.",
  missing_data: "Zdroj počtu cieľových e-shopov.",
};
