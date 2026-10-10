import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import { PointFilter } from "./filters";

export type Rect = { x: number; y: number; w: number; h: number };

/** výrez musí obsahovať aj zdvihnuté ruky a hlavu, preto okolo tela necháme rezervu */
const MARGIN = 1.45;
/** viac ako ~2.2× nepriblížime, model potrebuje kontext okolia */
const MIN_HEIGHT_RATIO = 0.45;
/** po toľkých snímkach bez človeka sa vrátime na celý záber */
const LOST_FRAMES_TO_RESET = 3;
/** výrez meníme len pri väčšom posune, inak by sa vnútorné sledovanie modelu rozhádzalo */
const MOVE_THRESHOLD = 0.08;
const SIZE_THRESHOLD = 0.12;
const SMOOTHING = 0.35;

/**
 * Sleduje oblasť záberu, kde stojí rečník, a posiela modelu priblížený výrez.
 * Keď je človek ďalej od kamery, zaberá v obraze málo pixelov a model ho
 * ľahšie stratí; vo výreze je väčší a body tela sú presnejšie.
 */
export class RoiTracker {
  private rect: Rect | null = null;
  private lost = 0;

  constructor(
    private readonly W: number,
    private readonly H: number,
  ) {}

  /** aktuálny výrez v pixeloch videa (celý záber, ak nikoho nesledujeme) */
  current(): Rect {
    return this.rect ?? { x: 0, y: 0, w: this.W, h: this.H };
  }

  reset() {
    this.rect = null;
    this.lost = 0;
  }

  /** Prepočíta body z výrezu na súradnice celého záberu (normalizované 0–1). */
  toFull(lm: NormalizedLandmark[], r: Rect): NormalizedLandmark[] {
    return lm.map((p) => ({
      ...p,
      x: (r.x + p.x * r.w) / this.W,
      y: (r.y + p.y * r.h) / this.H,
    }));
  }

  /** Aktualizuje výrez podľa bodov tela v súradniciach celého záberu. */
  update(lmFull: NormalizedLandmark[] | null) {
    if (!lmFull) {
      if (++this.lost >= LOST_FRAMES_TO_RESET) this.reset();
      return;
    }
    this.lost = 0;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of lmFull) {
      if ((p.visibility ?? 1) < 0.3) continue;
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
    if (!isFinite(minX)) return;

    const aspect = this.W / this.H;
    const cx = ((minX + maxX) / 2) * this.W;
    const cy = ((minY + maxY) / 2) * this.H;
    // výrez má rovnaký pomer strán ako video, aby sa telo nedeformovalo
    let h = Math.max((maxY - minY) * this.H * MARGIN, ((maxX - minX) * this.W * MARGIN) / aspect);
    h = Math.min(this.H, Math.max(h, this.H * MIN_HEIGHT_RATIO));
    const w = h * aspect;
    const target: Rect = {
      x: Math.min(Math.max(cx - w / 2, 0), this.W - w),
      y: Math.min(Math.max(cy - h / 2, 0), this.H - h),
      w,
      h,
    };

    const cur = this.rect;
    if (!cur) {
      this.rect = target;
      return;
    }
    const moved =
      Math.abs(target.x + target.w / 2 - (cur.x + cur.w / 2)) / this.W > MOVE_THRESHOLD ||
      Math.abs(target.y + target.h / 2 - (cur.y + cur.h / 2)) / this.H > MOVE_THRESHOLD ||
      Math.abs(target.h - cur.h) / cur.h > SIZE_THRESHOLD;
    if (!moved) return;
    this.rect = {
      x: cur.x + (target.x - cur.x) * SMOOTHING,
      y: cur.y + (target.y - cur.y) * SMOOTHING,
      w: cur.w + (target.w - cur.w) * SMOOTHING,
      h: cur.h + (target.h - cur.h) * SMOOTHING,
    };
  }
}

/** One Euro filter na všetkých 33 bodoch tela: stabilná kostra bez trasenia. */
export class LandmarkSmoother {
  private filters: PointFilter[] = [];

  constructor(
    private readonly W: number,
    private readonly H: number,
  ) {}

  reset() {
    this.filters.forEach((f) => f.reset());
  }

  smooth(lm: NormalizedLandmark[], tMs: number): NormalizedLandmark[] {
    return lm.map((p, i) => {
      // filtrujeme v pixeloch, parametre filtra sú nastavené na pixely
      this.filters[i] ??= new PointFilter(1.2, 0.008);
      const q = this.filters[i].filter({ x: p.x * this.W, y: p.y * this.H }, tMs)!;
      return { ...p, x: q.x / this.W, y: q.y / this.H };
    });
  }
}
