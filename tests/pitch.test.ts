import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildMetrics, countSyllables, pausesLabel, tempoPosition, tempoVerdict } from "../src/lib/pitch/metrics.ts";
import { overallScore, weakestCategory, type ContentScore } from "../src/lib/pitch/content.ts";
import { summarizeBody } from "../src/lib/pitch/body.ts";
import type { VisionSample } from "../src/lib/analytics/vision/types.ts";

describe("nahraný pitch – merania", () => {
  test("slabiky v slovenčine vrátane dvojhlások a slabikotvorného r", () => {
    assert.equal(countSyllables("trh"), 1);
    assert.equal(countSyllables("investor"), 3);
    assert.equal(countSyllables("riešenie"), 3);
    assert.equal(countSyllables("vlk"), 1);
    assert.equal(countSyllables("Problém,"), 2);
  });

  test("pauzy po vete sú dôraz, uprostred vety zaváhanie", () => {
    const words = [
      { word: "Máme", start: 0, end: 0.4 },
      { word: "problém.", start: 0.45, end: 1.0 },
      { word: "Naša", start: 2.6, end: 3.0 },
      { word: "appka", start: 3.05, end: 3.5 },
      { word: "vlastne", start: 4.8, end: 5.3 },
      { word: "pomáha.", start: 5.35, end: 6.0 },
    ];
    const m = buildMetrics({ text: "Máme problém. Naša appka vlastne pomáha.", words, durationMs: 6500 });
    assert.deepEqual(
      m.pauses.map((p) => p.kind),
      ["emphasis", "hesitation"],
    );
    assert.equal(m.longestPauseMs, 1600);
    assert.equal(m.fillers.total, 1);
    assert.ok(m.tokens.some((t) => t.type === "word" && t.filler && t.text === "vlastne"));
  });

  test("stupnica tempa: cieľové okno je stredných 40 %", () => {
    assert.equal(tempoPosition(3.5), 36);
    assert.equal(tempoPosition(5), 64);
    assert.equal(tempoVerdict(4.6), "target");
    assert.equal(tempoVerdict(5.4), "fast");
    assert.equal(pausesLabel(5), "páuz nad 1 sekundu");
  });
});

describe("nahraný pitch – obsah a reč tela", () => {
  const content: ContentScore = {
    categories: [
      { key: "problem", score: 8, advice: "a" },
      { key: "solution", score: 7, advice: "b" },
      { key: "market", score: 5, advice: "c" },
      { key: "traction", score: 4, advice: "d" },
      { key: "ask", score: 6, advice: "e" },
    ],
  };

  test("váhy podľa publika menia celkové skóre", () => {
    assert.ok(overallScore(content, "team") > overallScore(content, "investor"));
    assert.equal(weakestCategory(content), "traction");
  });

  test("očný kontakt a nepokojné ruky z kamery", () => {
    const sample = (t: number, gaze: boolean, motion: number): VisionSample => ({
      t, faceVisible: true, faceCentered: true, faceDistance: "ok", yawDeg: 0, pitchDeg: 0, facingCamera: true,
      gazeTowardCamera: gaze, headX: 0.5, headY: 0.5, upperBodyVisible: true, shoulderX: 0.5, shoulderY: 0.6,
      handsVisible: true, handMotion: motion,
    });
    const samples = [...Array.from({ length: 10 }, (_, i) => sample(i * 300, true, 0.02)), ...Array.from({ length: 10 }, (_, i) => sample(3000 + i * 300, true, 0.3))];
    const body = summarizeBody(samples);
    assert.equal(body.eyeContactPct, 100);
    assert.deepEqual(body.events.map((e) => e.kind), ["steady_eye_contact", "restless_hands"]);
  });
});
