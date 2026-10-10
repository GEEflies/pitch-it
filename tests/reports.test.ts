import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { compareSessions, verdictFor, METRICS, type ComparableSession } from "../src/lib/history/compare.ts";
import { validateAssessmentEvidence, type Assessment } from "../src/lib/reports/assessment.ts";
import { deliveryObservations } from "../src/lib/reports/delivery-feedback.ts";
import { computeMeasurements, median } from "../src/lib/reports/measured.ts";

const turns = [
  { seq: 0, speaker: "investor" as const, text: "Aký je váš trh?", startedMs: 0, endedMs: 3_000, interrupted: false, source: "realtime" as const },
  {
    seq: 1,
    speaker: "founder" as const,
    text: "Ehm, náš trh je obrovský, v podstate celá Európa a rastie každý rok o desiatky percent podľa štúdií.",
    startedMs: 4_000,
    endedMs: 14_000,
    interrupted: false,
    source: "realtime" as const,
  },
  { seq: 2, speaker: "investor" as const, text: "Koľko zákazníkov to je?", startedMs: 15_000, endedMs: 17_000, interrupted: false, source: "realtime" as const },
  {
    seq: 3,
    speaker: "founder" as const,
    text: "Šesťtisíc e-shopov na Slovensku, v Česku a Poľsku s obratom nad milión eur, pri cene tritisíc eur ročne je to osemnásť miliónov.",
    startedMs: 18_000,
    endedMs: 90_000,
    interrupted: false,
    source: "realtime" as const,
  },
];

const audio = [
  { turnSeq: 1, speechMs: 8_000, wordsPerMinute: null, responseLatencyMs: 1_000, pauseCount: 0, pauseTotalMs: 0, longestPauseMs: 0, volumeVariability: 2, pitchVariabilitySemitones: 1, pitchReliable: true, transcriptConfidence: 0.9 },
  { turnSeq: 3, speechMs: 70_000, wordsPerMinute: null, responseLatencyMs: 5_000, pauseCount: 2, pauseTotalMs: 6_000, longestPauseMs: 4_000, volumeVariability: 2, pitchVariabilitySemitones: 1.2, pitchReliable: true, transcriptConfidence: 0.8 },
];

describe("computeMeasurements", () => {
  const m = computeMeasurements({ transport: "realtime", durationSeconds: 95, targetAnswerSeconds: 60, turns, audio, visual: null });

  test("počty ťahov, odpovede nad cieľom a pauzy", () => {
    assert.equal(m.founderTurns, 2);
    assert.equal(m.investorTurns, 2);
    assert.equal(m.answerLength.overTargetCount, 1);
    assert.equal(m.pauses.longPauses, 1);
    assert.equal(m.latency.medianMs, 3_000);
    assert.equal(m.fillers.total, 2);
  });

  test("upozornenie na dolný odhad výplňových slov je vždy v dátach o kvalite", () => {
    assert.ok(m.dataQuality.some((note) => note.includes("dolný odhad")));
  });

  test("pravidlá prednesu vrátia iba podložené pozorovania", () => {
    const ids = deliveryObservations(m).map((observation) => observation.id);
    assert.ok(ids.includes("length-long"));
    assert.ok(ids.includes("pauses-long"));
    assert.ok(ids.includes("voice-flat-volume"));
    assert.ok(!ids.some((id) => id.startsWith("camera")));
  });

  test("textový režim nemeria hlas", () => {
    const text = computeMeasurements({ transport: "text", durationSeconds: 300, targetAnswerSeconds: 60, turns, audio: [], visual: null });
    assert.equal(text.pace.medianWpm, null);
    assert.equal(text.totals.founderSpeechSeconds, null);
    assert.ok(text.dataQuality.some((note) => note.includes("Textový režim")));
  });

  test("medián", () => {
    assert.equal(median([3, 1, 2]), 2);
    assert.equal(median([1, 2, 3, 4]), 2.5);
    assert.equal(median([]), null);
  });
});

describe("validateAssessmentEvidence", () => {
  const assessment: Assessment = {
    summary: "s",
    content_dimensions: [
      {
        key: "specificity",
        rating: "weak",
        explanation: "e",
        evidence: [
          { turn_seq: 1, quote: "náš trh je obrovský" },
          { turn_seq: 1, quote: "toto founder nikdy nepovedal" },
          { turn_seq: 0, quote: "Aký je váš trh?" },
        ],
      },
    ],
    questions: [
      { investor_turn_seq: 0, topic: "Trh", answer_turn_seqs: [1, 99], verdict: "partially_answered", note: "n" },
      { investor_turn_seq: 42, topic: "?", answer_turn_seqs: [], verdict: "not_answered", note: "n" },
    ],
    consistency_issues: [],
    unsupported_claims: [{ turn_seq: 7, claim: "c", why: "w" }],
    strengths: [],
    weaknesses: [
      {
        title: "Všeobecný trh",
        turn_seq: 1,
        original_excerpt: "Ehm, náš trh je obrovský",
        problem: "p",
        improved_example: "[doplň: počet zákazníkov]",
        exercise: { category: "market", title: "t", prompt: "p", success_criteria: ["a"] },
      },
      {
        title: "Vymyslená citácia",
        turn_seq: 3,
        original_excerpt: "máme milión zákazníkov",
        problem: "p",
        improved_example: "x",
        exercise: { category: "market", title: "t", prompt: "p", success_criteria: ["a"] },
      },
    ],
    data_gaps: [],
    pitch_coverage: null,
    uncertainty: null,
  };
  const founder = new Map(turns.filter((turn) => turn.speaker === "founder").map((turn) => [turn.seq, turn.text]));
  const investor = new Set([0, 2]);
  const result = validateAssessmentEvidence(assessment, founder, investor);

  test("ponechá iba citácie, ktoré sú v prepise foundera", () => {
    assert.deepEqual(result.content_dimensions[0].evidence.map((item) => item.quote), ["náš trh je obrovský"]);
    assert.deepEqual(result.weaknesses.map((weakness) => weakness.title), ["Všeobecný trh"]);
  });

  test("odstráni odkazy na neexistujúce ťahy", () => {
    assert.equal(result.questions.length, 1);
    assert.deepEqual(result.questions[0].answer_turn_seqs, [1]);
    assert.equal(result.unsupported_claims.length, 0);
  });
});

describe("porovnanie tréningov", () => {
  const base = computeMeasurements({ transport: "realtime", durationSeconds: 95, targetAnswerSeconds: 60, turns, audio, visual: null });
  const session = (id: string, mode: ComparableSession["mode"], transport: ComparableSession["transport"] = "realtime"): ComparableSession => ({
    id,
    mode,
    transport,
    createdAt: `2026-10-0${id}T10:00:00Z`,
    measured: base,
    assessment: null,
  });

  test("rôzne režimy sa neporovnávajú", () => {
    const result = compareSessions(session("1", "coach"), session("2", "delivery"));
    assert.equal(result.comparable, false);
  });

  test("hlasové merania sa pri textovom tréningu vynechajú, nič sa nedopočíta", () => {
    const result = compareSessions(session("1", "simulation"), session("2", "simulation", "text"));
    assert.equal(result.comparable, true);
    if (result.comparable) {
      assert.ok(result.metrics.every((metric) => !["wpm", "latency"].includes(metric.key)));
      assert.ok(result.skipped.length > 0);
    }
  });

  test("smer zlepšenia podľa metriky a tolerancia malých zmien", () => {
    const latency = METRICS.find((metric) => metric.key === "latency")!;
    assert.equal(verdictFor(latency, 5, 3), "better");
    assert.equal(verdictFor(latency, 3, 3.1), "same");
    const wpm = METRICS.find((metric) => metric.key === "wpm")!;
    assert.equal(verdictFor(wpm, 200, 160), "better");
    assert.equal(verdictFor(wpm, 140, 160), "same");
    assert.equal(verdictFor(wpm, 150, 80), "worse");
  });
});
