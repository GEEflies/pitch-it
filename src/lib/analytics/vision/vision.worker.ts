/// <reference lib="webworker" />

/*
  Web Worker s MediaPipe Face Landmarker a Pose Landmarker.
  Dostáva snímky ako ImageBitmap, vracia iba odvodené signály (VisionSample).
  Snímky ani body tváre neopúšťajú worker.
*/

import { FaceLandmarker, FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import { computeSample, type Point, type RawFrame } from "@/lib/analytics/vision/features";
import type { WorkerRequest, WorkerResponse } from "@/lib/analytics/vision/types";

declare const self: DedicatedWorkerGlobalScope & { import?: (url: string) => Promise<unknown> };

// Module worker nemá importScripts: MediaPipe načíta ESM loader cez self.import.
self.import = (url: string) => import(/* webpackIgnore: true */ /* turbopackIgnore: true */ url);

let face: FaceLandmarker | null = null;
let pose: PoseLandmarker | null = null;
let busy = false;
let lastTimestamp = 0;
let previous: { wrists: Array<Point | null>; shoulderWidth: number | null } | null = null;

function post(message: WorkerResponse) {
  self.postMessage(message);
}

async function create(init: Extract<WorkerRequest, { type: "init" }>, delegate: "GPU" | "CPU") {
  const fileset = await FilesetResolver.forVisionTasks(init.wasmBase, true);
  const createdFace = await FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: init.faceModel, delegate },
    runningMode: "VIDEO",
    numFaces: 1,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true,
  });
  const createdPose = await PoseLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: init.poseModel, delegate },
    runningMode: "VIDEO",
    numPoses: 1,
  });
  return { createdFace, createdPose };
}

async function initialize(init: Extract<WorkerRequest, { type: "init" }>) {
  try {
    const { createdFace, createdPose } = await create(init, "GPU");
    face = createdFace;
    pose = createdPose;
    post({ type: "ready", delegate: "GPU" });
  } catch {
    try {
      const { createdFace, createdPose } = await create(init, "CPU");
      face = createdFace;
      pose = createdPose;
      post({ type: "ready", delegate: "CPU" });
    } catch (error) {
      post({ type: "error", message: error instanceof Error ? error.message : "MediaPipe sa nenačítal." });
    }
  }
}

function analyze(bitmap: ImageBitmap, t: number) {
  if (!face || !pose || busy) {
    bitmap.close();
    post({ type: "skipped" });
    return;
  }
  busy = true;
  try {
    // MediaPipe vyžaduje rastúce časové značky.
    const timestamp = Math.max(lastTimestamp + 1, Math.round(t));
    lastTimestamp = timestamp;
    const faceResult = face.detectForVideo(bitmap, timestamp);
    const poseResult = pose.detectForVideo(bitmap, timestamp);

    const blendshapes = faceResult.faceBlendshapes?.[0]?.categories
      ? Object.fromEntries(faceResult.faceBlendshapes[0].categories.map((category) => [category.categoryName, category.score]))
      : null;

    const raw: RawFrame = {
      t,
      faceLandmarks: faceResult.faceLandmarks?.[0] ?? null,
      faceMatrix: faceResult.facialTransformationMatrixes?.[0]?.data ?? null,
      blendshapes,
      poseLandmarks: poseResult.landmarks?.[0] ?? null,
    };
    const computed = computeSample(raw, previous);
    previous = { wrists: computed.wrists, shoulderWidth: computed.shoulderWidth };
    post({ type: "sample", sample: computed.sample });
  } catch (error) {
    post({ type: "error", message: error instanceof Error ? error.message : "Analýza snímky zlyhala." });
  } finally {
    bitmap.close();
    busy = false;
  }
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  if (message.type === "init") void initialize(message);
  else if (message.type === "frame") analyze(message.bitmap, message.t);
  else if (message.type === "close") {
    face?.close();
    pose?.close();
    face = null;
    pose = null;
    self.close();
  }
};
