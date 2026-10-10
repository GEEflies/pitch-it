import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { detectSegments, responseLatencyMs, summarizeVoice, type VoiceFrame } from "../src/lib/analytics/audio/voice-summary.ts";
import {
  countFillers,
  countWords,
  fillerRate,
  repeatedTrigramRatio,
  transcriptConfidence,
  wordsPerMinute,
} from "../src/lib/analytics/speech/text-metrics.ts";

describe("text-metrics", () => {
  test("počíta slová vrátane diakritiky a čísel", () => {
    assert.equal(countWords("Náš trh má 4,2 miliardy eur, t. j. veľa."), 10);
    assert.equal(countWords("   "), 0);
  });

  test("výplňové slová: zaváhania a viacslovné frázy bez dvojitého počítania", () => {
    const result = countFillers("Ehm, v podstate máme, eee, akože 40 zákazníkov. V podstate rastieme.");
    assert.equal(result.hesitation, 2);
    assert.equal(result.discourse, 3);
    assert.equal(result.byPhrase["v podstate"], 2);
    assert.equal(result.byPhrase.akože, 1);
  });

  test("slovo „v“ samostatne nie je výplň", () => {
    assert.equal(countFillers("Sme v Bratislave a v Brne.").total, 0);
  });

  test("tempo: slová za minútu iba pri dostatočnej dĺžke reči", () => {
    assert.equal(wordsPerMinute(150, 60_000), 150);
    assert.equal(wordsPerMinute(20, 3_000), null);
    assert.equal(wordsPerMinute(0, 60_000), null);
  });

  test("miera výplňových slov na 100 slov", () => {
    assert.equal(fillerRate(5, 100), 5);
    assert.equal(fillerRate(1, 10), null);
  });

  test("opakovanie trigramov rozpozná točenie sa v kruhu", () => {
    const repeated = Array.from({ length: 6 }, () => "náš produkt šetrí účtovníkom veľa času každý mesiac").join(" ");
    const varied = "Naši zákazníci sú e-shopy s obratom nad milión eur, ktoré dnes ručne prepisujú faktúry do účtovníctva a strácajú tým desiatky hodín mesačne, čo im naša integrácia so skladom a bankou odstráni hneď v prvom týždni používania produktu.";
    assert.ok((repeatedTrigramRatio(repeated) ?? 0) > 0.5);
    const variedRatio = repeatedTrigramRatio(varied);
    assert.ok(variedRatio === null || variedRatio < 0.1);
    assert.equal(repeatedTrigramRatio("krátka odpoveď"), null);
  });

  test("istota prepisu z logprobs", () => {
    assert.equal(transcriptConfidence([{ logprob: 0 }, { logprob: 0 }]), 1);
    assert.equal(transcriptConfidence(null), null);
  });
});

function frames(spec: Array<[number, number, number, number | null]>): VoiceFrame[] {
  // [od ms, do ms, dB, f0] → rámce po 50 ms
  const result: VoiceFrame[] = [];
  for (const [from, to, db, f0] of spec) {
    for (let t = from; t < to; t += 50) result.push({ t, db, f0 });
  }
  return result;
}

describe("voice-summary", () => {
  test("segmenty reči s hysterézou a pauzy od 1 s", () => {
    const data = frames([
      [0, 1_000, -70, null],
      [1_000, 4_000, -30, 120],
      [4_000, 4_200, -70, null], // krátke ticho, nie pauza
      [4_200, 6_000, -30, 130],
      [6_000, 8_000, -70, null], // pauza 2 s
      [8_000, 10_000, -32, 125],
      [10_000, 11_000, -70, null],
    ]);
    const summary = summarizeVoice(data, 0, 11_000);
    assert.equal(summary.segments.length, 2);
    assert.equal(summary.pauseCount, 1);
    assert.ok(summary.longestPauseMs >= 1_900 && summary.longestPauseMs <= 2_100);
    assert.ok(summary.speechMs >= 6_800 && summary.speechMs <= 7_200);
    assert.equal(summary.pitchReliable, true);
    assert.ok((summary.pitchVariabilitySemitones ?? 0) > 0);
  });

  test("málo znelej reči: výška hlasu nie je spoľahlivá", () => {
    const summary = summarizeVoice(frames([[0, 1_000, -30, 120], [1_000, 3_000, -70, null]]), 0, 3_000);
    assert.equal(summary.pitchReliable, false);
    assert.equal(summary.pitchVariabilitySemitones, null);
  });

  test("detectSegments vráti prázdne pole pre ticho", () => {
    assert.deepEqual(detectSegments(frames([[0, 2_000, -80, null]]), -50), []);
  });

  test("latencia odpovede od konca reči investora", () => {
    assert.equal(responseLatencyMs(1_000, [{ startMs: 2_500, endMs: 4_000 }]), 1_500);
    assert.equal(responseLatencyMs(3_000, [{ startMs: 2_500, endMs: 4_000 }]), 0);
    assert.equal(responseLatencyMs(null, [{ startMs: 2_500, endMs: 4_000 }]), null);
  });
});
