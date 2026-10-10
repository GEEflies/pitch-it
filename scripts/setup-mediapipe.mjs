/*
  Pripraví súbory MediaPipe do public/mediapipe, aby sa analýza kamery načítavala
  z vlastnej domény (bez CDN). WASM sa kopíruje z node_modules, modely sa stiahnu raz.
  Zlyhanie sťahovania nie je fatálne: prehliadač potom použije oficiálne URL modelov.
*/
import { copyFile, mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const target = path.join(root, "public", "mediapipe");

const WASM_FILES = ["vision_wasm_module_internal.js", "vision_wasm_module_internal.wasm"];
const MODELS = {
  "face_landmarker.task":
    "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
  "pose_landmarker_lite.task":
    "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
};

async function exists(file) {
  try {
    return (await stat(file)).size > 0;
  } catch {
    return false;
  }
}

async function main() {
  await mkdir(path.join(target, "wasm"), { recursive: true });
  await mkdir(path.join(target, "models"), { recursive: true });

  for (const file of WASM_FILES) {
    const from = path.join(source, file);
    if (!(await exists(from))) {
      console.warn(`[mediapipe] chýba ${from} – je nainštalovaný @mediapipe/tasks-vision?`);
      continue;
    }
    await copyFile(from, path.join(target, "wasm", file));
  }
  console.log("[mediapipe] WASM skopírované do public/mediapipe/wasm");

  for (const [file, url] of Object.entries(MODELS)) {
    const destination = path.join(target, "models", file);
    if (await exists(destination)) continue;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await writeFile(destination, Buffer.from(await response.arrayBuffer()));
      console.log(`[mediapipe] stiahnutý model ${file}`);
    } catch (error) {
      console.warn(`[mediapipe] model ${file} sa nestiahol (${error.message}); použije sa oficiálna URL.`);
    }
  }
}

main().catch((error) => {
  console.warn("[mediapipe] príprava zlyhala:", error.message);
});
