import type { TurnPayload } from "@/lib/validation/schemas";

/*
  Fronta na ukladanie ťahov s opakovaním. Ťahy sú idempotentné podľa seq,
  takže opakované odoslanie po výpadku siete nič nezdvojí.
*/

export type SendTurns = (turns: TurnPayload[]) => Promise<"ok" | "retry" | "stop">;

const RETRY_DELAYS_MS = [1_000, 2_000, 5_000, 10_000, 20_000];
const BATCH = 20;

export class PersistQueue {
  private pending = new Map<number, TurnPayload>();
  private saved = new Set<number>();
  private flushing: Promise<void> | null = null;
  private attempt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  private readonly send: SendTurns;
  private readonly onStateChange?: (state: { pending: number; failing: boolean }) => void;
  private readonly schedule: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;

  constructor(
    send: SendTurns,
    onStateChange?: (state: { pending: number; failing: boolean }) => void,
    schedule: (fn: () => void, ms: number) => ReturnType<typeof setTimeout> = setTimeout,
  ) {
    this.send = send;
    this.onStateChange = onStateChange;
    this.schedule = schedule;
  }

  /** Ťahy už uložené na serveri (napr. po obnovení stránky). */
  markSaved(seqs: Iterable<number>): void {
    for (const seq of seqs) this.saved.add(seq);
  }

  isKnown(seq: number): boolean {
    return this.saved.has(seq) || this.pending.has(seq);
  }

  get pendingCount(): number {
    return this.pending.size;
  }

  enqueue(turns: TurnPayload[]): void {
    let added = false;
    for (const turn of turns) {
      if (this.saved.has(turn.seq) || this.pending.has(turn.seq)) continue;
      this.pending.set(turn.seq, turn);
      added = true;
    }
    if (added) {
      this.notify();
      void this.flush();
    }
  }

  private notify(): void {
    this.onStateChange?.({ pending: this.pending.size, failing: this.attempt > 0 });
  }

  /** Odošle všetko čakajúce. Súbežné volania čakajú na rovnaký beh. */
  flush(): Promise<void> {
    if (this.stopped) return Promise.resolve();
    if (this.flushing) return this.flushing;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.flushing = this.run().finally(() => {
      this.flushing = null;
    });
    return this.flushing;
  }

  private async run(): Promise<void> {
    while (this.pending.size > 0 && !this.stopped) {
      const batch = [...this.pending.values()].sort((a, b) => a.seq - b.seq).slice(0, BATCH);
      let result: "ok" | "retry" | "stop";
      try {
        result = await this.send(batch);
      } catch {
        result = "retry";
      }

      if (result === "ok") {
        for (const turn of batch) {
          this.pending.delete(turn.seq);
          this.saved.add(turn.seq);
        }
        this.attempt = 0;
        this.notify();
        continue;
      }
      if (result === "stop") {
        this.stopped = true;
        this.notify();
        return;
      }

      const delay = RETRY_DELAYS_MS[Math.min(this.attempt, RETRY_DELAYS_MS.length - 1)];
      this.attempt += 1;
      this.notify();
      this.timer = this.schedule(() => void this.flush(), delay);
      return;
    }
  }

  /** Pred ukončením: skúsi odoslať všetko a počká najviac timeoutMs. */
  async drain(timeoutMs: number): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (this.pending.size > 0 && !this.stopped && Date.now() < deadline) {
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
      }
      await this.flush();
      if (this.pending.size > 0) await new Promise((resolve) => setTimeout(resolve, 500));
    }
    return this.pending.size === 0;
  }

  restart(): void {
    this.stopped = false;
    if (this.pending.size > 0) void this.flush();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
  }
}
