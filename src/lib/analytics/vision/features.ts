import type { VisionSample } from "@/lib/analytics/vision/types";

/*
  Výpočet signálov zo surových výstupov MediaPipe. Čisté funkcie (bez MediaPipe),
  aby sa dali testovať a aby bolo jasné, čo presne meriame.
*/

export type Point = { x: number; y: number; z?: number; visibility?: number };

export type RawFrame = {
  t: number;
  faceLandmarks: Point[] | null;
  /** 4×4 matica transformácie tváre (column-major), ak je k dispozícii. */
  faceMatrix: number[] | null;
  blendshapes: Record<string, number> | null;
  poseLandmarks: Point[] | null;
};

const NOSE_TIP = 1;
const LEFT_SHOULDER = 11;
const RIGHT_SHOULDER = 12;
const LEFT_WRIST = 15;
const RIGHT_WRIST = 16;

/** Prahy sú orientačné (ASSUMPTION): webkamera nad alebo pod úrovňou očí posúva sklon hlavy. */
export const VISION_THRESHOLDS = {
  facingYawDeg: 22,
  facingPitchDeg: 25,
  gazeBlendshapeMax: 0.5,
  faceFarWidth: 0.12,
  faceCloseWidth: 0.55,
  visibility: 0.6,
} as const;

const toDeg = (radians: number) => (radians * 180) / Math.PI;

/** Natočenie hlavy z matice transformácie tváre. */
export function headAngles(matrix: number[] | null): { yaw: number; pitch: number } | null {
  if (!matrix || matrix.length < 16) return null;
  // Column-major: R[row][col] = m[col * 4 + row].
  const r20 = matrix[2];
  const r21 = matrix[6];
  const r22 = matrix[10];
  const yaw = toDeg(Math.atan2(-r20, Math.hypot(r21, r22)));
  const pitch = toDeg(Math.atan2(r21, r22));
  if (!Number.isFinite(yaw) || !Number.isFinite(pitch)) return null;
  // „+ 0“ odstráni zápornú nulu (-0), ktorá by sa inak zobrazila ako „-0°“.
  return { yaw: yaw + 0, pitch: pitch + 0 };
}

function bounds(points: Point[]) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }
  return { minX, maxX, minY, maxY };
}

const GAZE_KEYS = [
  "eyeLookInLeft",
  "eyeLookOutLeft",
  "eyeLookUpLeft",
  "eyeLookDownLeft",
  "eyeLookInRight",
  "eyeLookOutRight",
  "eyeLookUpRight",
  "eyeLookDownRight",
];

function visible(point: Point | undefined): point is Point {
  return Boolean(point && (point.visibility ?? 1) >= VISION_THRESHOLDS.visibility && point.y <= 1 && point.y >= 0);
}

/** Z jednej snímky vypočíta signály. `previous` slúži na pohyb rúk. */
export function computeSample(frame: RawFrame, previous: { wrists: Array<Point | null>; shoulderWidth: number | null } | null): {
  sample: VisionSample;
  wrists: Array<Point | null>;
  shoulderWidth: number | null;
} {
  const face = frame.faceLandmarks && frame.faceLandmarks.length > NOSE_TIP ? frame.faceLandmarks : null;
  const angles = face ? headAngles(frame.faceMatrix) : null;

  let faceCentered: boolean | null = null;
  let faceDistance: VisionSample["faceDistance"] = null;
  if (face) {
    const box = bounds(face);
    const centerX = (box.minX + box.maxX) / 2;
    const centerY = (box.minY + box.maxY) / 2;
    faceCentered = centerX >= 0.3 && centerX <= 0.7 && centerY >= 0.2 && centerY <= 0.7;
    const width = box.maxX - box.minX;
    faceDistance =
      width < VISION_THRESHOLDS.faceFarWidth ? "far" : width > VISION_THRESHOLDS.faceCloseWidth ? "close" : "ok";
  }

  const facingCamera = angles
    ? Math.abs(angles.yaw) <= VISION_THRESHOLDS.facingYawDeg && Math.abs(angles.pitch) <= VISION_THRESHOLDS.facingPitchDeg
    : null;

  let gazeTowardCamera: boolean | null = null;
  if (facingCamera !== null && frame.blendshapes) {
    const maxLook = Math.max(...GAZE_KEYS.map((key) => frame.blendshapes?.[key] ?? 0));
    gazeTowardCamera = facingCamera && maxLook < VISION_THRESHOLDS.gazeBlendshapeMax;
  }

  const pose = frame.poseLandmarks;
  const leftShoulder = pose?.[LEFT_SHOULDER];
  const rightShoulder = pose?.[RIGHT_SHOULDER];
  const shouldersVisible = visible(leftShoulder) && visible(rightShoulder);
  const shoulderWidth = shouldersVisible ? Math.hypot(leftShoulder.x - rightShoulder.x, leftShoulder.y - rightShoulder.y) : null;

  const wrists: Array<Point | null> = pose
    ? [pose[LEFT_WRIST], pose[RIGHT_WRIST]].map((point) => (visible(point) ? point : null))
    : [null, null];
  const handsVisible = pose ? wrists.some(Boolean) : null;

  let handMotion: number | null = null;
  const scale = shoulderWidth ?? previous?.shoulderWidth ?? null;
  if (previous && scale && scale > 0.02) {
    const moves: number[] = [];
    wrists.forEach((wrist, index) => {
      const before = previous.wrists[index];
      if (wrist && before) moves.push(Math.hypot(wrist.x - before.x, wrist.y - before.y) / scale);
    });
    if (moves.length > 0) handMotion = moves.reduce((sum, value) => sum + value, 0) / moves.length;
  }

  return {
    sample: {
      t: frame.t,
      faceVisible: Boolean(face),
      faceCentered,
      faceDistance,
      yawDeg: angles ? Math.round(angles.yaw * 10) / 10 : null,
      pitchDeg: angles ? Math.round(angles.pitch * 10) / 10 : null,
      facingCamera,
      gazeTowardCamera,
      headX: face ? face[NOSE_TIP].x : null,
      headY: face ? face[NOSE_TIP].y : null,
      upperBodyVisible: pose ? shouldersVisible : null,
      shoulderX: shouldersVisible ? (leftShoulder.x + rightShoulder.x) / 2 : null,
      shoulderY: shouldersVisible ? (leftShoulder.y + rightShoulder.y) / 2 : null,
      handsVisible,
      handMotion,
    },
    wrists,
    shoulderWidth,
  };
}
