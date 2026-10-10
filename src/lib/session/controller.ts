"use client";

import { MicAnalyzer } from "@/lib/analytics/audio/mic-analyzer";
import { countFillers, countWords, transcriptConfidence, wordsPerMinute } from "@/lib/analytics/speech/text-metrics";
import { aggregateVision, recentVision } from "@/lib/analytics/vision/aggregate";
import { VisionAnalyzer, type VisionStatus } from "@/lib/analytics/vision/vision-analyzer";
import { OpenAiRealtimeConnection } from "@/lib/ai/realtime/openai-client";
import type { ListeningPolicy, RealtimeClientGrant, RealtimeConnection, RealtimeEvent } from "@/lib/ai/realtime/types";
import type { CoachFocus, EndReason, TrainingMode } from "@/lib/domain/labels";
import { CONTROL_NOTES, WRAP_UP_GRACE_SECONDS } from "@/lib/investor/control";
import type { Hint } from "@/lib/investor/hints";
import { END_MEETING_TOOL } from "@/lib/investor/instructions";
import { nudgeForCamera, nudgeForFinishedAnswer, nudgeForLongAnswer, shouldShowNudge, type Nudge } from "@/lib/session/coach";
import {
  initialLiveState,
  liveReducer,
  MAX_RECONNECT_ATTEMPTS,
  stateWithHistory,
  turnsReadyToPersist,
  type LiveAction,
  type LiveState,
  type LiveTurn,
} from "@/lib/session/live-state";
import { PersistQueue } from "@/lib/session/persist-queue";
import { buildFounderMetrics, toTurnPayload } from "@/lib/session/turn-metrics";
import type { TurnPayload, VisualAggregate } from "@/lib/validation/schemas";

/*
  Riadi živú reláciu v prehliadači: mikrofón, realtime spojenie, prepis, merania,
  čas, prerušenia, upozornenia, obnovu po výpadku, ukladanie a ukončenie.
  React ho číta cez subscribe/getSnapshot (useSyncExternalStore).
*/

export type RoomConfig = {
  sessionId: string;
  mode: TrainingMode;
  transport: "realtime" | "text";
  cameraEnabled: boolean;
  coachFocus: CoachFocus[];
  targetDurationSeconds: number;
  initialTurns: LiveTurn[];
  /** Vývojová ukážka: namiesto AI prehrá scenár, nič neposiela na server. */
  preview?: { script: Array<{ speaker: "investor" | "founder"; text: string }>; hint: Hint; reportUrl: string };
};

export type Stage = "preflight" | "connecting" | "live" | "reconnecting" | "ending" | "ended" | "failed";

export type HintState =
  | { status: "idle" }
  | { status: "loading"; question: string }
  | { status: "ready"; question: string; hint: Hint }
  | { status: "error"; question: string; message: string };

export type RoomSnapshot = {
  stage: Stage;
  transport: "realtime" | "text";
  live: LiveState;
  elapsedSeconds: number;
  limitSeconds: number | null;
  micLevel: number;
  micMuted: boolean;
  speakerVolume: number;
  audioBlocked: boolean;
  nudge: Nudge | null;
  saving: { pending: number; failing: boolean };
  vision: { status: VisionStatus; error: string | null };
  textPending: boolean;
  error: string | null;
  hint: HintState;
  reportUrl: string | null;
  canRetryFinish: boolean;
};

type ConnectResponse = {
  grant: RealtimeClientGrant;
  sessionLimitSeconds: number;
  elapsedSeconds: number;
  listening: ListeningPolicy;
  interruptAfterSeconds: number | null;
  targetAnswerSeconds: number;
  timeWarningAtSeconds: number;
};

type ApiErrorBody = { error?: { code?: string; message?: string } };

const RECONNECT_DELAYS_MS = [1_000, 3_000, 6_000];
const HEARTBEAT_MS = 25_000;
const TICK_MS = 250;
const COACH_INTERRUPT_EXTRA_SECONDS = 30;

async function postJson<T>(url: string, body: unknown): Promise<{ ok: true; data: T } | { ok: false; status: number; code: string; message: string }> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    if (response.ok) return { ok: true, data: (await response.json()) as T };
    const error = ((await response.json().catch(() => ({}))) as ApiErrorBody).error;
    return { ok: false, status: response.status, code: error?.code ?? "error", message: error?.message ?? "Požiadavka zlyhala." };
  } catch {
    return { ok: false, status: 0, code: "network", message: "Chýba pripojenie k internetu." };
  }
}

export class LiveSessionController {
  private live: LiveState;
  private snapshot: RoomSnapshot;
  private listeners = new Set<() => void>();
  private mic = new MicAnalyzer(() => this.now());
  private vision = new VisionAnalyzer(() => this.now());
  private micStream: MediaStream | null = null;
  private connection: RealtimeConnection | null = null;
  private audio: HTMLAudioElement | null = null;
  private queue: PersistQueue;
  private base: number | null = null;
  private tick: ReturnType<typeof setInterval> | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private wrapUpTimer: ReturnType<typeof setTimeout> | null = null;
  private connectInfo: ConnectResponse | null = null;
  private warnedTime = false;
  private timeUpSent = false;
  private founderSince = new Map<string, number>();
  private interruptedItems = new Set<string>();
  private awaitingBargeInRestore = false;
  private endAfterInvestorStops = false;
  private confidences = new Map<string, number | null>();
  private lastNudge: { id: string; at: number } | null = null;
  private nudgeTimer: ReturnType<typeof setTimeout> | null = null;
  private usage = { inputTokens: 0, outputTokens: 0, inputAudioTokens: 0, outputAudioTokens: 0, cachedTokens: 0, responses: 0 };
  private finishing: Promise<void> | null = null;
  private pendingEndReason: EndReason = "user_ended";
  private disposed = false;

  constructor(private readonly config: RoomConfig) {
    this.live = config.initialTurns.length > 0 ? stateWithHistory(config.initialTurns) : initialLiveState();
    this.queue = new PersistQueue(
      (turns) => this.sendTurns(turns),
      (state) => this.update({ saving: state }),
    );
    this.queue.markSaved(config.initialTurns.map((turn) => turn.seq));
    this.snapshot = {
      stage: "preflight",
      transport: config.transport,
      live: this.live,
      elapsedSeconds: 0,
      limitSeconds: config.transport === "realtime" ? config.targetDurationSeconds : null,
      micLevel: 0,
      micMuted: false,
      speakerVolume: 1,
      audioBlocked: false,
      nudge: null,
      saving: { pending: 0, failing: false },
      vision: { status: "idle", error: null },
      textPending: false,
      error: null,
      hint: { status: "idle" },
      reportUrl: null,
      canRetryFinish: false,
    };
    this.mic.onFrame((frame) => {
      // Úroveň pre meter: -60 dB → 0, -10 dB → 1.
      const level = Math.min(1, Math.max(0, (frame.db + 60) / 50));
      if (Math.abs(level - this.snapshot.micLevel) > 0.02) this.update({ micLevel: level });
    });
    this.vision.onStatus((status, error) => this.update({ vision: { status, error } }));
  }

  /* ───────────── React napojenie ───────────── */

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): RoomSnapshot => this.snapshot;

  private update(patch: Partial<RoomSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener();
  }

  private now(): number {
    return this.base === null ? 0 : performance.now() - this.base;
  }

  private dispatch(action: LiveAction) {
    const previous = this.live;
    this.live = liveReducer(this.live, action);
    if (this.live !== previous) {
      this.update({ live: this.live });
      this.afterStateChange();
    }
  }

  /* ───────────── Médiá ───────────── */

  async attachMicrophone(stream: MediaStream): Promise<void> {
    this.micStream?.getTracks().forEach((track) => track.stop());
    this.micStream = stream;
    try {
      await this.mic.start(stream);
    } catch {
      // Analyzátor je doplnok: bez neho chýbajú iba akustické merania.
    }
  }

  async attachCamera(video: HTMLVideoElement): Promise<void> {
    if (!this.config.cameraEnabled) return;
    await this.vision.start(video);
  }

  detachCamera(): void {
    this.vision.stop();
  }

  setAudioElement(audio: HTMLAudioElement): void {
    this.audio = audio;
    audio.volume = this.snapshot.speakerVolume;
  }

  toggleMicrophone(): void {
    const muted = !this.snapshot.micMuted;
    this.micStream?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
    this.connection?.setMicrophoneEnabled(!muted);
    this.update({ micMuted: muted });
  }

  setSpeakerVolume(volume: number): void {
    const value = Math.min(1, Math.max(0, volume));
    if (this.audio) this.audio.volume = value;
    this.update({ speakerVolume: value });
  }

  async resumeAudio(): Promise<void> {
    try {
      await this.audio?.play();
      this.update({ audioBlocked: false });
    } catch {
      this.update({ audioBlocked: true });
    }
  }

  /* ───────────── Štart ───────────── */

  async start(): Promise<void> {
    if (this.snapshot.stage !== "preflight" && this.snapshot.stage !== "failed") return;
    if (this.config.preview) {
      this.startPreview();
      return;
    }
    if (this.snapshot.transport === "text") {
      await this.startText();
      return;
    }
    if (!this.micStream) {
      this.update({ error: "Najprv povoľ mikrofón." });
      return;
    }
    this.update({ stage: "connecting", error: null });
    this.dispatch({ type: "connect_requested" });
    const ok = await this.connectRealtime(this.live.turns.length > 0);
    if (!ok) return;
    this.startTimers();
  }

  private async connectRealtime(resume: boolean): Promise<boolean> {
    const result = await postJson<ConnectResponse>(`/api/sessions/${this.config.sessionId}/connect`, { resume });
    if (!result.ok) {
      if (result.code === "realtime_not_configured" || result.code === "provider_unavailable") {
        this.update({ stage: "failed", error: `${result.message} Môžeš pokračovať textom.` });
      } else {
        this.update({ stage: "failed", error: result.message });
      }
      this.dispatch({ type: "failed", message: result.message });
      return false;
    }

    const info = result.data;
    this.connectInfo = info;
    if (this.base === null) {
      this.base = performance.now() - info.elapsedSeconds * 1000;
      this.mic.clear();
    }
    this.update({ limitSeconds: info.sessionLimitSeconds, elapsedSeconds: info.elapsedSeconds });

    const connection = new OpenAiRealtimeConnection();
    connection.onEvent((event) => this.handleEvent(event));
    connection.onStateChange((state) => {
      if (state === "lost" && this.connection === connection) this.handleConnectionLost();
    });

    const track = this.micStream?.getAudioTracks()[0];
    if (!track || !this.audio) {
      this.update({ stage: "failed", error: "Mikrofón nie je pripravený." });
      return false;
    }
    try {
      await connection.connect({ grant: info.grant, microphone: track, output: this.audio });
    } catch (error) {
      connection.close();
      if (resume) return false;
      this.update({
        stage: "failed",
        error: error instanceof Error ? `${error.message} Skús to znova alebo pokračuj textom.` : "Spojenie zlyhalo.",
      });
      this.dispatch({ type: "failed", message: "Spojenie zlyhalo." });
      return false;
    }

    this.connection = connection;
    if (this.snapshot.micMuted) connection.setMicrophoneEnabled(false);
    this.dispatch({ type: "connected" });
    this.update({ stage: "live", error: null });
    void this.resumeAudio();

    if (this.config.mode !== "delivery") {
      connection.requestResponse(resume ? CONTROL_NOTES.resume : CONTROL_NOTES.kickoff);
      this.dispatch({ type: "investor_thinking" });
    }
    return true;
  }

  private startTimers() {
    if (!this.tick) this.tick = setInterval(() => this.onTick(), TICK_MS);
    if (!this.heartbeat && this.snapshot.transport === "realtime" && !this.config.preview) {
      this.heartbeat = setInterval(() => {
        void postJson(`/api/sessions/${this.config.sessionId}/heartbeat`, {});
      }, HEARTBEAT_MS);
    }
  }

  /* ───────────── Udalosti poskytovateľa ───────────── */

  private handleEvent(event: RealtimeEvent) {
    const at = this.now();
    switch (event.type) {
      case "founder_speech_started":
        this.founderSince.set(event.itemId, at);
        break;
      case "founder_transcript_final":
        this.confidences.set(event.itemId, transcriptConfidence(event.logprobs));
        break;
      case "investor_response_done":
        if (event.usage) {
          this.usage.inputTokens += event.usage.inputTokens;
          this.usage.outputTokens += event.usage.outputTokens;
          this.usage.inputAudioTokens += event.usage.inputAudioTokens;
          this.usage.outputAudioTokens += event.usage.outputAudioTokens;
          this.usage.cachedTokens += event.usage.cachedTokens;
        }
        this.usage.responses += 1;
        break;
      case "investor_audio_stopped":
        if (this.awaitingBargeInRestore && this.connectInfo?.listening.kind === "conversation") {
          this.connection?.restoreBargeIn(this.connectInfo.listening.eagerness);
          this.awaitingBargeInRestore = false;
        }
        if (this.endAfterInvestorStops) {
          this.endAfterInvestorStops = false;
          void this.end("investor_ended");
        }
        break;
      case "tool_call":
        if (event.name === END_MEETING_TOOL) {
          this.connection?.acknowledgeTool(event.callId, JSON.stringify({ ok: true }));
          this.endAfterInvestorStops = true;
          // Ak investor už dohovoril alebo udalosť nepríde, ukončíme po chvíli sami.
          setTimeout(() => {
            if (this.endAfterInvestorStops) {
              this.endAfterInvestorStops = false;
              void this.end("investor_ended");
            }
          }, this.live.investorSpeaking ? 12_000 : 2_500);
        }
        break;
      case "provider_error":
        // Chyby potvrdenia prázdneho bufferu pri prerušení sú očakávané.
        if (event.code === "input_audio_buffer_commit_empty") return;
        console.warn("[realtime]", event.code, event.message);
        return;
      default:
        break;
    }
    this.dispatch({ type: "realtime", event, at });
  }

  private afterStateChange() {
    const ready = turnsReadyToPersist(this.live, (seq) => this.queue.isKnown(seq));
    if (ready.length === 0) return;
    const frames = this.mic.framesBetween(0, Number.POSITIVE_INFINITY);
    const payloads: TurnPayload[] = [];
    for (const turn of ready) {
      if (turn.source === "text") continue; // textové ťahy ukladá server
      const confidence = turn.itemId ? (this.confidences.get(turn.itemId) ?? null) : null;
      const metrics = turn.speaker === "founder" ? buildFounderMetrics(turn, this.live.turns, frames, confidence) : null;
      payloads.push(toTurnPayload(turn, metrics));

      if (turn.speaker === "founder" && this.config.mode === "coach" && metrics) {
        const words = countWords(turn.text);
        this.showNudge(
          nudgeForFinishedAnswer(this.config.coachFocus, {
            wordsPerMinute: wordsPerMinute(words, metrics.speechMs),
            fillers: countFillers(turn.text).total,
            words,
          }),
        );
      }
    }
    if (payloads.length > 0) this.queue.enqueue(payloads);
  }

  private async sendTurns(turns: TurnPayload[]): Promise<"ok" | "retry" | "stop"> {
    if (this.config.preview) return "ok";
    const result = await postJson(`/api/sessions/${this.config.sessionId}/turns`, { turns });
    if (result.ok) return "ok";
    if (result.status === 409 || result.status === 404 || result.status === 400 || result.status === 401) return "stop";
    return "retry";
  }

  /* ───────────── Čas, prerušenia, upozornenia ───────────── */

  private onTick() {
    if (this.snapshot.stage !== "live") return;
    const elapsed = this.now() / 1000;
    this.update({ elapsedSeconds: elapsed });
    const info = this.connectInfo;
    if (!info) return;

    if (this.config.mode === "delivery") {
      if (elapsed >= info.sessionLimitSeconds) void this.end("time_limit");
    } else {
      if (!this.warnedTime && elapsed >= info.timeWarningAtSeconds && info.timeWarningAtSeconds < info.sessionLimitSeconds) {
        this.warnedTime = true;
        if (!this.live.investorSpeaking && !this.live.founderItemId) this.connection?.requestResponse(CONTROL_NOTES.timeAlmostUp);
        else this.addNoteWhenQuiet(CONTROL_NOTES.timeAlmostUp);
      }
      if (!this.timeUpSent && elapsed >= info.sessionLimitSeconds) {
        this.timeUpSent = true;
        this.connection?.requestResponse(CONTROL_NOTES.timeUp);
        this.wrapUpTimer = setTimeout(() => void this.end("time_limit"), WRAP_UP_GRACE_SECONDS * 1000);
      }
    }

    const founderItem = this.live.founderItemId;
    if (founderItem && this.config.mode !== "delivery") {
      const since = this.founderSince.get(founderItem);
      if (since !== undefined) {
        const speaking = (this.now() - since) / 1000;
        if (this.config.mode === "coach") {
          this.showNudge(nudgeForLongAnswer(this.config.coachFocus, speaking, info.targetAnswerSeconds));
        }
        const limit =
          info.interruptAfterSeconds === null
            ? null
            : info.interruptAfterSeconds + (this.config.mode === "coach" ? COACH_INTERRUPT_EXTRA_SECONDS : 0);
        if (limit !== null && speaking >= limit && !this.interruptedItems.has(founderItem)) {
          this.interruptedItems.add(founderItem);
          this.awaitingBargeInRestore = true;
          this.connection?.interruptFounder(CONTROL_NOTES.interrupt);
        }
      }
    }

    if (this.config.mode === "coach" && this.config.cameraEnabled && this.vision.status === "running") {
      this.showNudge(nudgeForCamera(this.config.coachFocus, recentVision(this.vision.samples, this.now())));
    }
  }

  private quietNote: string | null = null;
  private addNoteWhenQuiet(note: string) {
    this.quietNote = note;
    const check = () => {
      if (!this.quietNote || this.snapshot.stage !== "live") return;
      if (!this.live.investorSpeaking && !this.live.founderItemId && !this.live.activeResponseId) {
        // Poznámka sa pridá ku konverzácii bez vynútenej odpovede; investor ju zohľadní v ďalšom ťahu.
        this.connection?.requestResponse(this.quietNote);
        this.quietNote = null;
      } else {
        setTimeout(check, 1_000);
      }
    };
    setTimeout(check, 1_000);
  }

  private showNudge(nudge: Nudge | null) {
    if (!nudge || this.config.mode !== "coach") return;
    const now = Date.now();
    if (!shouldShowNudge(nudge, this.lastNudge, now)) return;
    this.lastNudge = { id: nudge.id, at: now };
    this.update({ nudge });
    if (this.nudgeTimer) clearTimeout(this.nudgeTimer);
    this.nudgeTimer = setTimeout(() => this.update({ nudge: null }), 7_000);
  }

  dismissNudge(): void {
    this.update({ nudge: null });
  }

  /* ───────────── Výpadok a obnova ───────────── */

  private handleConnectionLost() {
    if (this.snapshot.stage === "ending" || this.snapshot.stage === "ended") return;
    this.connection?.close();
    this.connection = null;
    this.dispatch({ type: "connection_lost" });
    if (this.live.status === "failed") {
      this.update({
        stage: "failed",
        error: "Spojenie sa nepodarilo obnoviť. Pokračuj textom alebo tréning ukonči a pozri si rozbor.",
      });
      return;
    }
    this.update({ stage: "reconnecting" });
    const delay = RECONNECT_DELAYS_MS[Math.min(this.live.reconnectAttempts - 1, RECONNECT_DELAYS_MS.length - 1)];
    this.reconnectTimer = setTimeout(() => void this.reconnect(), delay);
  }

  private async reconnect() {
    if (this.disposed || this.snapshot.stage !== "reconnecting") return;
    await this.queue.flush();
    const ok = await this.connectRealtime(true);
    if (ok) return;
    if (this.live.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.dispatch({ type: "connection_lost" });
      this.update({
        stage: "failed",
        error: "Spojenie sa nepodarilo obnoviť. Pokračuj textom alebo tréning ukonči a pozri si rozbor.",
      });
      return;
    }
    this.handleConnectionLost();
  }

  /** Ručný nový pokus o pripojenie (tlačidlo v UI). */
  async retryConnection(): Promise<void> {
    if (this.snapshot.transport !== "realtime") return;
    this.update({ stage: "reconnecting", error: null });
    const ok = await this.connectRealtime(this.live.turns.length > 0);
    if (ok) this.startTimers();
  }

  /* ───────────── Textový režim ───────────── */

  private async startText() {
    this.update({ stage: "connecting", error: null, transport: "text" });
    if (this.base === null) this.base = performance.now();
    const hasInvestorTurn = this.live.turns.some((turn) => turn.speaker === "investor");
    const lastIsInvestor = this.live.turns.at(-1)?.speaker === "investor";
    this.update({ stage: "live" });
    this.dispatch({ type: "connected" });
    this.startTimers();
    if (!hasInvestorTurn || !lastIsInvestor) await this.requestTextTurn(null);
  }

  /** Prepne bežiacu reláciu do textu (napr. po výpadku hlasu). */
  async switchToText(): Promise<void> {
    this.connection?.close();
    this.connection = null;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    await this.queue.drain(5_000);
    this.update({ transport: "text", stage: "preflight", error: null });
    await this.startText();
  }

  async sendText(message: string): Promise<void> {
    const text = message.trim();
    if (!text || this.snapshot.textPending) return;
    await this.requestTextTurn(text);
  }

  private async requestTextTurn(message: string | null) {
    this.update({ textPending: true, error: null });
    this.dispatch({ type: "investor_thinking" });
    const result = await postJson<{
      founder: { seq: number; text: string } | null;
      investor: { seq: number; text: string };
      ended: boolean;
    }>(`/api/sessions/${this.config.sessionId}/text-turn`, { message });
    this.update({ textPending: false });
    if (!result.ok) {
      this.update({ error: result.message });
      return;
    }
    const at = this.now();
    if (result.data.founder) {
      this.queue.markSaved([result.data.founder.seq]);
      this.dispatch({ type: "text_turn", speaker: "founder", text: result.data.founder.text, at, seq: result.data.founder.seq });
    }
    this.queue.markSaved([result.data.investor.seq]);
    this.dispatch({ type: "text_turn", speaker: "investor", text: result.data.investor.text, at, seq: result.data.investor.seq });
    if (result.data.ended) setTimeout(() => void this.end("investor_ended"), 4_000);
  }

  /* ───────────── Nápoveda ───────────── */

  async requestHint(): Promise<void> {
    if (this.config.mode !== "coach") return;
    const question = [...this.live.turns].reverse().find((turn) => turn.speaker === "investor" && turn.text.trim())?.text;
    if (!question) {
      this.update({ hint: { status: "error", question: "", message: "Investor ešte nepoložil otázku." } });
      return;
    }
    this.update({ hint: { status: "loading", question } });
    if (this.config.preview) {
      const hint = this.config.preview.hint;
      setTimeout(() => this.update({ hint: { status: "ready", question, hint } }), 700);
      return;
    }
    const result = await postJson<{ hint: Hint }>(`/api/sessions/${this.config.sessionId}/hint`, { question });
    this.update({
      hint: result.ok ? { status: "ready", question, hint: result.data.hint } : { status: "error", question, message: result.message },
    });
  }

  /* ───────────── Ukážka bez AI (iba vývoj) ───────────── */

  private previewTimers: Array<ReturnType<typeof setTimeout>> = [];

  private startPreview() {
    const preview = this.config.preview;
    if (!preview) return;
    this.base = performance.now();
    this.mic.clear();
    this.connectInfo = {
      grant: { provider: "openai", model: "ukazka", clientSecret: "", expiresAt: 0 },
      sessionLimitSeconds: this.config.targetDurationSeconds,
      elapsedSeconds: 0,
      listening: { kind: "conversation", eagerness: "low" },
      interruptAfterSeconds: null,
      targetAnswerSeconds: 60,
      timeWarningAtSeconds: this.config.targetDurationSeconds - 60,
    };
    this.dispatch({ type: "connect_requested" });
    this.dispatch({ type: "connected" });
    this.update({ stage: "live", limitSeconds: this.config.targetDurationSeconds, error: null });
    this.startTimers();

    // Časová os udalostí: rovnaké udalosti, aké posiela realtime poskytovateľ.
    let at = 600;
    const schedule = (delay: number, event: RealtimeEvent) => {
      at += delay;
      this.previewTimers.push(setTimeout(() => this.handleEvent(event), at));
    };
    preview.script.forEach((line, index) => {
      const words = line.text.split(" ");
      if (line.speaker === "investor") {
        const responseId = `preview-r${index}`;
        const itemId = `preview-i${index}`;
        schedule(500, { type: "investor_response_started", responseId });
        schedule(600, { type: "investor_audio_started", responseId });
        words.forEach((word, wordIndex) =>
          schedule(140, { type: "investor_transcript_delta", itemId, responseId, delta: wordIndex === 0 ? word : ` ${word}` }),
        );
        schedule(200, { type: "investor_transcript_final", itemId, text: line.text });
        schedule(50, { type: "investor_response_done", responseId, status: "completed", usage: null });
        schedule(400, { type: "investor_audio_stopped", responseId, cleared: false });
      } else {
        const itemId = `preview-f${index}`;
        schedule(1_100, { type: "founder_speech_started", itemId });
        words.forEach((word, wordIndex) =>
          schedule(230, { type: "founder_transcript_delta", itemId, delta: wordIndex === 0 ? word : ` ${word}` }),
        );
        schedule(500, { type: "founder_speech_stopped", itemId });
        schedule(300, { type: "founder_transcript_final", itemId, text: line.text, logprobs: null });
      }
    });
    this.previewTimers.push(setTimeout(() => void this.end("investor_ended"), at + 2_500));
  }

  /* ───────────── Ukončenie ───────────── */

  private founderWindows() {
    return this.live.turns
      .filter((turn) => turn.speaker === "founder" && turn.startedMs !== null)
      .map((turn) => ({ turnSeq: turn.seq, startMs: turn.startedMs as number, endMs: (turn.endedMs ?? turn.startedMs) as number }));
  }

  end(reason: EndReason): Promise<void> {
    if (this.finishing) return this.finishing;
    this.pendingEndReason = reason;
    this.finishing = this.finish().finally(() => {
      this.finishing = null;
    });
    return this.finishing;
  }

  async retryFinish(): Promise<void> {
    if (this.snapshot.stage !== "failed" || !this.snapshot.canRetryFinish) return;
    await this.end(this.pendingEndReason);
  }

  private async finish() {
    this.update({ stage: "ending", error: null, canRetryFinish: false });
    this.dispatch({ type: "end_requested" });
    this.stopTimers();
    this.connection?.close();
    this.connection = null;
    this.dispatch({ type: "ended" });
    await this.queue.drain(8_000);

    let visual: VisualAggregate | null = null;
    if (this.config.cameraEnabled && this.vision.samples.length > 0) {
      visual = aggregateVision(this.vision.samples, this.founderWindows());
    }
    this.vision.stop();

    if (this.config.preview) {
      this.releaseMedia();
      this.update({ stage: "ended", reportUrl: this.config.preview.reportUrl });
      return;
    }

    const result = await postJson<{ reportUrl: string }>(`/api/sessions/${this.config.sessionId}/finish`, {
      endReason: this.pendingEndReason,
      visual,
      providerUsage: this.snapshot.transport === "realtime" && this.usage.responses > 0 ? this.usage : null,
    });
    if (!result.ok) {
      this.update({
        stage: "failed",
        error: `Tréning sa nepodarilo uzavrieť: ${result.message}`,
        canRetryFinish: true,
      });
      return;
    }
    this.releaseMedia();
    this.update({ stage: "ended", reportUrl: result.data.reportUrl });
  }

  private stopTimers() {
    this.previewTimers.forEach(clearTimeout);
    this.previewTimers = [];
    if (this.tick) clearInterval(this.tick);
    if (this.heartbeat) clearInterval(this.heartbeat);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.wrapUpTimer) clearTimeout(this.wrapUpTimer);
    if (this.nudgeTimer) clearTimeout(this.nudgeTimer);
    this.tick = null;
    this.heartbeat = null;
    this.reconnectTimer = null;
    this.wrapUpTimer = null;
  }

  private releaseMedia() {
    void this.mic.stop();
    this.vision.stop();
    this.micStream?.getTracks().forEach((track) => track.stop());
    this.micStream = null;
  }

  /** Po pripojení komponentu (aj opakovanom v React Strict Mode). */
  activate(): void {
    this.disposed = false;
    this.queue.restart();
  }

  /** Pri odchode zo stránky: uvoľní zariadenia. Rozbehnutá relácia sa uzavrie na serveri ako opustená. */
  dispose(): void {
    this.disposed = true;
    this.stopTimers();
    this.connection?.close();
    this.connection = null;
    this.queue.stop();
    this.releaseMedia();
  }
}
