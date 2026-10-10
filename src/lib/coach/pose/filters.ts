import type { Point } from "./metrics";

/**
 * One Euro filter (Casiez et al. 2012): pri pomalom pohybe silno vyhladzuje
 * (žiadne trasenie), pri rýchlom pohybe takmer nevyhladzuje (žiadne oneskorenie).
 */
class OneEuro {
  private x: number | null = null;
  private dx = 0;
  private t = 0;

  constructor(
    private minCutoff: number,
    private beta: number,
    private dCutoff = 1,
  ) {}

  private static alpha(cutoff: number, dt: number) {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }

  filter(value: number, tMs: number): number {
    if (this.x === null) {
      this.x = value;
      this.t = tMs;
      return value;
    }
    const dt = Math.max((tMs - this.t) / 1000, 1e-3);
    this.t = tMs;
    const rawDx = (value - this.x) / dt;
    this.dx += (rawDx - this.dx) * OneEuro.alpha(this.dCutoff, dt);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += (value - this.x) * OneEuro.alpha(cutoff, dt);
    return this.x;
  }

  reset() {
    this.x = null;
    this.dx = 0;
  }
}

/** One Euro filter pre bod v pixeloch. */
export class PointFilter {
  private fx: OneEuro;
  private fy: OneEuro;

  constructor(minCutoff = 1.0, beta = 0.007) {
    this.fx = new OneEuro(minCutoff, beta);
    this.fy = new OneEuro(minCutoff, beta);
  }

  /** null = bod nevidno, filter sa vynuluje */
  filter(p: Point | null, tMs: number): Point | null {
    if (!p) {
      this.reset();
      return null;
    }
    return { x: this.fx.filter(p.x, tMs), y: this.fy.filter(p.y, tMs) };
  }

  reset() {
    this.fx.reset();
    this.fy.reset();
  }
}
