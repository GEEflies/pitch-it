"use client";

import type { VisionSample, WorkerRequest, WorkerResponse } from "@/lib/analytics/vision/types";

/*
  Hlavné vlákno: posiela snímky z <video> do workera ~5× za sekundu.
  Ak worker nestíha, snímku vynechá (nikdy nečaká a neblokuje UI).
*/

const FRAME_INTERVAL_MS = 200;
const MAX_SAMPLES = 12_000;

const LOCAL_BASE = "/mediapipe";
const REMOTE_MODELS = {
  face: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
  pose: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
};

export type VisionStatus = "idle" | "loading" | "running" | "failed";

async function exists(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: "HEAD" });
    return response.ok;
  } catch {
    return false;
  }
}

export class VisionAnalyzer {
  private worker: Worker | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inFlight = false;
  private samplesList: VisionSample[] = [];
  private statusListeners = new Set<(status: VisionStatus, error: string | null) => void>();
  private sampleListeners = new Set<(sample: VisionSample) => void>();
  status: VisionStatus = "idle";
  error: string | null = null;

  constructor(private readonly now: () => number) {}

  get samples(): VisionSample[] {
    return this.samplesList;
  }

  onStatus(listener: (status: VisionStatus, error: string | null) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  onSample(listener: (sample: VisionSample) => void): () => void {
    this.sampleListeners.add(listener);
    return () => this.sampleListeners.delete(listener);
  }

  private setStatus(status: VisionStatus, error: string | null = null) {
    this.status = status;
    this.error = error;
    for (const listener of this.statusListeners) listener(status, error);
  }

  async start(video: HTMLVideoElement): Promise<void> {
    this.stop();
    if (typeof Worker === "undefined" || typeof createImageBitmap === "undefined") {
      this.setStatus("failed", "Prehliadač nepodporuje analýzu videa vo worker vlákne.");
      return;
    }
    this.setStatus("loading");

    const [faceLocal, poseLocal, wasmLocal] = await Promise.all([
      exists(`${LOCAL_BASE}/models/face_landmarker.task`),
      exists(`${LOCAL_BASE}/models/pose_landmarker_lite.task`),
      exists(`${LOCAL_BASE}/wasm/vision_wasm_module_internal.js`),
    ]);
    if (!wasmLocal) {
      this.setStatus("failed", "Súbory MediaPipe chýbajú (spusti npm run mediapipe).");
      return;
    }

    const worker = new Worker(new URL("./vision.worker.ts", import.meta.url), { type: "module" });
    this.worker = worker;
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;
      if (message.type === "ready") {
        this.setStatus("running");
        this.loop(video);
      } else if (message.type === "sample") {
        this.inFlight = false;
        this.samplesList.push(message.sample);
        if (this.samplesList.length > MAX_SAMPLES) this.samplesList.splice(0, this.samplesList.length - MAX_SAMPLES);
        for (const listener of this.sampleListeners) listener(message.sample);
      } else if (message.type === "skipped") {
        this.inFlight = false;
      } else if (message.type === "error") {
        this.inFlight = false;
        if (this.status === "loading") this.setStatus("failed", message.message);
      }
    };
    worker.onerror = () => {
      this.setStatus("failed", "Analýza kamery sa nespustila.");
    };

    const origin = window.location.origin;
    const init: WorkerRequest = {
      type: "init",
      wasmBase: `${origin}${LOCAL_BASE}/wasm`,
      faceModel: faceLocal ? `${origin}${LOCAL_BASE}/models/face_landmarker.task` : REMOTE_MODELS.face,
      poseModel: poseLocal ? `${origin}${LOCAL_BASE}/models/pose_landmarker_lite.task` : REMOTE_MODELS.pose,
    };
    worker.postMessage(init);
  }

  private loop(video: HTMLVideoElement) {
    const tick = async () => {
      if (!this.worker || this.status !== "running") return;
      if (!this.inFlight && video.readyState >= 2 && video.videoWidth > 0 && !document.hidden) {
        try {
          const bitmap = await createImageBitmap(video);
          this.inFlight = true;
          this.worker.postMessage({ type: "frame", bitmap, t: this.now() } satisfies WorkerRequest, [bitmap]);
        } catch {
          this.inFlight = false;
        }
      }
      this.timer = setTimeout(tick, FRAME_INTERVAL_MS);
    };
    this.timer = setTimeout(tick, FRAME_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (this.worker) {
      this.worker.postMessage({ type: "close" } satisfies WorkerRequest);
      this.worker.terminate();
    }
    this.worker = null;
    this.inFlight = false;
    if (this.status !== "failed") this.setStatus("idle");
  }
}
