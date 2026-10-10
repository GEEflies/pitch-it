"use client";

import type { VoiceFrame } from "@/lib/analytics/audio/voice-summary";

/*
  Napojí mikrofón na AudioWorklet a zbiera rámce hladiny a výšky hlasu.
  Rámce zostávajú v pamäti prehliadača (kruhový buffer), nikam sa neposielajú.
*/

const WORKLET_URL = "/worklets/voice-analyzer.js";
/** 30 minút pri 20 rámcoch za sekundu. */
const MAX_FRAMES = 36_000;

export class MicAnalyzer {
  private context: AudioContext | null = null;
  private node: AudioWorkletNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private sink: GainNode | null = null;
  private frames: VoiceFrame[] = [];
  private listeners = new Set<(frame: VoiceFrame) => void>();

  constructor(private readonly now: () => number) {}

  async start(stream: MediaStream): Promise<void> {
    await this.stop();
    const context = new AudioContext();
    await context.audioWorklet.addModule(WORKLET_URL);
    const source = context.createMediaStreamSource(stream);
    const node = new AudioWorkletNode(context, "voice-analyzer", {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      channelCount: 1,
    });
    // Tichý výstup, aby prehliadač uzol spracúval aj bez počúvania.
    const sink = context.createGain();
    sink.gain.value = 0;
    source.connect(node);
    node.connect(sink);
    sink.connect(context.destination);

    node.port.onmessage = (event: MessageEvent<{ db: number; f0: number | null }>) => {
      const frame: VoiceFrame = { t: this.now(), db: event.data.db, f0: event.data.f0 };
      this.frames.push(frame);
      if (this.frames.length > MAX_FRAMES) this.frames.splice(0, this.frames.length - MAX_FRAMES);
      for (const listener of this.listeners) listener(frame);
    };

    if (context.state === "suspended") await context.resume();
    this.context = context;
    this.node = node;
    this.source = source;
    this.sink = sink;
  }

  onFrame(listener: (frame: VoiceFrame) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Rámce v intervale [fromMs, toMs). */
  framesBetween(fromMs: number, toMs: number): VoiceFrame[] {
    return this.frames.filter((frame) => frame.t >= fromMs && frame.t < toMs);
  }

  async stop(): Promise<void> {
    this.node?.port.close();
    this.source?.disconnect();
    this.node?.disconnect();
    this.sink?.disconnect();
    if (this.context && this.context.state !== "closed") await this.context.close();
    this.context = null;
    this.node = null;
    this.source = null;
    this.sink = null;
  }

  clear(): void {
    this.frames = [];
  }
}
