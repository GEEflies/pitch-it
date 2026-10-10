import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import type { Point } from "./metrics";

export type BodySide = "left" | "right";
/** open = otvorená dlaň, fist = päsť, point = ukazovák, count = počítanie (2–3 prsty / ukazovák hore) */
export type HandShape = "open" | "fist" | "point" | "count" | "relaxed";

export type HandInfo = {
  side: BodySide;
  pts: Point[];
  size: number;
  extendedFingers: number;
  shape: HandShape;
  /** dlaň otočená ku kamere (k publiku) */
  palmFacing: boolean;
};

export type Hands = Record<BodySide, HandInfo | null>;

// indexy landmarkov ruky
const WRIST = 0;
const THUMB_IP = 3;
const THUMB_TIP = 4;
const INDEX_MCP = 5;
const MIDDLE_MCP = 9;
const PINKY_MCP = 17;
const FINGERS = [
  { mcp: 5, pip: 6, tip: 8 },
  { mcp: 9, pip: 10, tip: 12 },
  { mcp: 13, pip: 14, tip: 16 },
  { mcp: 17, pip: 18, tip: 20 },
];

export const HAND_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
];

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

function analyze(pts: Point[], side: BodySide): HandInfo {
  const w = pts[WRIST];
  const size = Math.max(dist(w, pts[MIDDLE_MCP]), 1);

  const extended = FINGERS.map((f) => dist(w, pts[f.tip]) > dist(w, pts[f.pip]) * 1.1);
  const curled = FINGERS.map((f) => dist(w, pts[f.tip]) < dist(w, pts[f.mcp]) * 1.15);
  const thumbOut = dist(pts[THUMB_TIP], pts[PINKY_MCP]) > dist(pts[THUMB_IP], pts[PINKY_MCP]) * 1.05;
  const n = extended.filter(Boolean).length;

  let shape: HandShape = "relaxed";
  if (curled.every(Boolean)) shape = "fist";
  else if (n >= 4) shape = "open";
  else if (n === 1 && extended[0] && curled[2] && curled[3]) {
    // ukazovák hore = "po prvé", ukazovák do strany/dopredu = ukazovanie prstom
    const dx = pts[8].x - pts[INDEX_MCP].x;
    const dy = pts[8].y - pts[INDEX_MCP].y;
    shape = -dy > Math.abs(dx) * 1.2 ? "count" : "point";
  } else if ((n === 2 || n === 3) && extended[0] && extended[1]) shape = "count";

  // Normála dlane z 2D vektorového súčinu. Obraz z kamery nie je zrkadlený:
  // pravá ruka rečníka dlaňou ku kamere má súčin záporný, ľavá kladný.
  const a = { x: pts[INDEX_MCP].x - w.x, y: pts[INDEX_MCP].y - w.y };
  const b = { x: pts[PINKY_MCP].x - w.x, y: pts[PINKY_MCP].y - w.y };
  const cross = (a.x * b.y - a.y * b.x) / (size * size);
  const palmFacing = side === "right" ? cross < -0.15 : cross > 0.15;

  return { side, pts, size, extendedFingers: n + (thumbOut ? 1 : 0), shape, palmFacing };
}

/**
 * Spáruje detegované ruky so zápästiami z pózy (podľa vzdialenosti), aby sme
 * vedeli, ktorá ruka je ľavá a ktorá pravá z pohľadu rečníka.
 */
export function analyzeHands(
  hands: NormalizedLandmark[][],
  width: number,
  height: number,
  poseLeft: Point,
  poseRight: Point,
  sw: number,
): Hands {
  const result: Hands = { left: null, right: null };
  const cands = hands.map((h) => h.map((p) => ({ x: p.x * width, y: p.y * height })));
  const pairs: { i: number; side: BodySide; d: number }[] = [];
  cands.forEach((pts, i) => {
    pairs.push({ i, side: "left", d: dist(pts[WRIST], poseLeft) });
    pairs.push({ i, side: "right", d: dist(pts[WRIST], poseRight) });
  });
  pairs.sort((x, y) => x.d - y.d);
  const used = new Set<number>();
  for (const p of pairs) {
    if (used.has(p.i) || result[p.side] || p.d > sw * 0.9) continue;
    used.add(p.i);
    result[p.side] = analyze(cands[p.i], p.side);
  }
  return result;
}
