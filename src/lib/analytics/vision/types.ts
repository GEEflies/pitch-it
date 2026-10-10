/*
  Signály z jednej snímky kamery. Vznikajú vo Web Workeri a obsahujú iba odvodené
  hodnoty, nikdy obraz ani súradnice bodov tváre.
*/

export type VisionSample = {
  /** Čas od začiatku relácie v ms. */
  t: number;
  faceVisible: boolean;
  /** Tvár je v strednej časti záberu. */
  faceCentered: boolean | null;
  /** Veľkosť tváre: príliš ďaleko / v poriadku / príliš blízko. */
  faceDistance: "far" | "ok" | "close" | null;
  yawDeg: number | null;
  pitchDeg: number | null;
  /** Hlava natočená približne ku kamere (orientačné). */
  facingCamera: boolean | null;
  /** Oči smerujú približne ku kamere (orientačné, z blendshapes). */
  gazeTowardCamera: boolean | null;
  /** Poloha nosa (normalizovaná), iba na výpočet stability. */
  headX: number | null;
  headY: number | null;
  upperBodyVisible: boolean | null;
  shoulderX: number | null;
  shoulderY: number | null;
  handsVisible: boolean | null;
  /** Pohyb zápästí od predchádzajúcej snímky relatívne k šírke ramien. */
  handMotion: number | null;
};

export type WorkerInit = {
  type: "init";
  wasmBase: string;
  faceModel: string;
  poseModel: string;
};

export type WorkerFrame = { type: "frame"; bitmap: ImageBitmap; t: number };

export type WorkerRequest = WorkerInit | WorkerFrame | { type: "close" };

export type WorkerResponse =
  | { type: "ready"; delegate: "GPU" | "CPU" }
  | { type: "sample"; sample: VisionSample }
  | { type: "skipped" }
  | { type: "error"; message: string };
