import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { aggregateVision, framingIssues, recentVision } from "../src/lib/analytics/vision/aggregate.ts";
import { computeSample, headAngles, type Point } from "../src/lib/analytics/vision/features.ts";
import type { VisionSample } from "../src/lib/analytics/vision/types.ts";

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function yawMatrix(degrees: number): number[] {
  const r = (degrees * Math.PI) / 180;
  // Rotácia okolo osi Y, column-major.
  return [Math.cos(r), 0, -Math.sin(r), 0, 0, 1, 0, 0, Math.sin(r), 0, Math.cos(r), 0, 0, 0, 0, 1];
}

function face(centerX: number, width: number): Point[] {
  return Array.from({ length: 10 }, (_, index) => ({ x: centerX - width / 2 + (index / 9) * width, y: 0.45 + (index % 2) * 0.1 }));
}

function pose(wristX: number): Point[] {
  const points: Point[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.1 }));
  points[11] = { x: 0.35, y: 0.75, visibility: 0.9 };
  points[12] = { x: 0.65, y: 0.75, visibility: 0.9 };
  points[15] = { x: wristX, y: 0.9, visibility: 0.9 };
  return points;
}

describe("signály z kamery", () => {
  test("natočenie hlavy z matice", () => {
    assert.deepEqual(headAngles(IDENTITY), { yaw: 0, pitch: 0 });
    assert.ok(Math.abs((headAngles(yawMatrix(40))?.yaw ?? 0) - 40) < 0.5);
    assert.equal(headAngles(null), null);
  });

  test("tvár v strede, ku kamere, pohyb ruky relatívne k ramenám", () => {
    const first = computeSample({ t: 0, faceLandmarks: face(0.5, 0.25), faceMatrix: IDENTITY, blendshapes: { eyeLookOutLeft: 0.1 }, poseLandmarks: pose(0.4) }, null);
    assert.equal(first.sample.faceVisible, true);
    assert.equal(first.sample.faceCentered, true);
    assert.equal(first.sample.faceDistance, "ok");
    assert.equal(first.sample.facingCamera, true);
    assert.equal(first.sample.gazeTowardCamera, true);
    assert.equal(first.sample.handMotion, null);

    const second = computeSample(
      { t: 200, faceLandmarks: face(0.9, 0.05), faceMatrix: yawMatrix(45), blendshapes: { eyeLookOutLeft: 0.8 }, poseLandmarks: pose(0.46) },
      { wrists: first.wrists, shoulderWidth: first.shoulderWidth },
    );
    assert.equal(second.sample.faceCentered, false);
    assert.equal(second.sample.faceDistance, "far");
    assert.equal(second.sample.facingCamera, false);
    assert.equal(second.sample.gazeTowardCamera, false);
    assert.ok(Math.abs((second.sample.handMotion ?? 0) - 0.2) < 0.01);
  });

  test("bez tváre a bez tela sú signály neznáme, nie nulové", () => {
    const sample = computeSample({ t: 0, faceLandmarks: null, faceMatrix: null, blendshapes: null, poseLandmarks: null }, null).sample;
    assert.equal(sample.faceVisible, false);
    assert.equal(sample.facingCamera, null);
    assert.equal(sample.upperBodyVisible, null);
  });
});

function sample(t: number, overrides: Partial<VisionSample>): VisionSample {
  return {
    t,
    faceVisible: true,
    faceCentered: true,
    faceDistance: "ok",
    yawDeg: 0,
    pitchDeg: 0,
    facingCamera: true,
    gazeTowardCamera: true,
    headX: 0.5,
    headY: 0.5,
    upperBodyVisible: true,
    shoulderX: 0.5,
    shoulderY: 0.75,
    handsVisible: false,
    handMotion: null,
    ...overrides,
  };
}

describe("agregácia za reláciu", () => {
  const samples = [
    ...Array.from({ length: 40 }, (_, index) => sample(index * 200, {})),
    ...Array.from({ length: 10 }, (_, index) => sample(8_000 + index * 200, { faceVisible: false, facingCamera: null, faceCentered: null, faceDistance: null, headX: null })),
  ];

  test("pomery počítajú iba známe hodnoty", () => {
    const aggregate = aggregateVision(samples, [{ turnSeq: 1, startMs: 0, endMs: 4_000 }]);
    assert.equal(aggregate.framesAnalyzed, 50);
    assert.equal(aggregate.faceVisibleRatio, 0.8);
    assert.equal(aggregate.facingCameraRatio, 1);
    assert.equal(aggregate.perTurn.length, 1);
    assert.equal(aggregate.perTurn[0].turnSeq, 1);
  });

  test("problémy s rámovaním a posledné okno", () => {
    assert.deepEqual(framingIssues(samples.map((item) => ({ ...item, faceDistance: "far" as const }))), ["too_far"]);
    const recent = recentVision(samples, 10_000, 2_000);
    assert.equal(recent.faceVisibleRatio, 0);
  });
});
