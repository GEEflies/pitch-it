/*
  Súhrn akustických signálov z mikrofónu pre jeden úsek reči (ťah foundera).
  Vstupom sú rámce z AudioWorkletu (~20 za sekundu): hladina v dBFS a odhad
  základnej frekvencie hlasu. Čisté funkcie, bez prístupu k audiu.

  Hlasitosť aj výška hlasu sú orientačné: závisia od mikrofónu, vzdialenosti,
  potláčania šumu a prehliadača. Porovnávať má zmysel iba pokusy z rovnakého zariadenia.
*/

export type VoiceFrame = {
  /** Čas od začiatku relácie v ms. */
  t: number;
  /** RMS hladina v dBFS (napr. -35). */
  db: number;
  /** Odhad základnej frekvencie v Hz, null ak rámec nie je znelý. */
  f0: number | null;
};

export type SpeechSegment = { startMs: number; endMs: number };

export type VoiceSummary = {
  speechMs: number;
  segments: SpeechSegment[];
  pauseCount: number;
  pauseTotalMs: number;
  longestPauseMs: number;
  /** Smerodajná odchýlka hladiny počas reči v dB. */
  volumeVariabilityDb: number | null;
  /** Smerodajná odchýlka výšky hlasu v poltónoch. */
  pitchVariabilitySemitones: number | null;
  pitchReliable: boolean;
  noiseFloorDb: number;
};

export const VOICE_DEFAULTS = {
  /** Rámec trvá približne toľko ms (pri 20 Hz). */
  frameMs: 50,
  /** O koľko dB nad šumom začína reč. */
  speechMarginDb: 10,
  /** Najnižší prah reči bez ohľadu na šum. */
  minSpeechDb: -55,
  /** Ticho kratšie ako toto sa nepočíta ako koniec segmentu. */
  hangoverMs: 300,
  /** Pauza je ticho medzi segmentmi aspoň takto dlhé. */
  minPauseMs: 1_000,
  /** Najmenej znelých rámcov pre spoľahlivý odhad výšky hlasu. */
  minVoicedFrames: 40,
  f0Min: 60,
  f0Max: 450,
} as const;

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return Number.NaN;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))));
  return sorted[index];
}

function standardDeviation(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/** Odhad hladiny šumu: 10. percentil hladín v okne (aspoň niečo ticha je takmer vždy). */
export function estimateNoiseFloor(frames: VoiceFrame[]): number {
  const sorted = frames.map((frame) => frame.db).filter(Number.isFinite).sort((a, b) => a - b);
  const floor = percentile(sorted, 0.1);
  return Number.isFinite(floor) ? floor : -70;
}

/** Rozdelí rámce na segmenty reči s hysterézou. */
export function detectSegments(
  frames: VoiceFrame[],
  threshold: number,
  options: { frameMs?: number; hangoverMs?: number } = {},
): SpeechSegment[] {
  const frameMs = options.frameMs ?? VOICE_DEFAULTS.frameMs;
  const hangoverMs = options.hangoverMs ?? VOICE_DEFAULTS.hangoverMs;
  const segments: SpeechSegment[] = [];
  let current: SpeechSegment | null = null;
  let lastSpeechAt = -Infinity;

  for (const frame of frames) {
    const isSpeech = frame.db >= threshold;
    if (isSpeech) {
      if (!current) current = { startMs: frame.t, endMs: frame.t + frameMs };
      current.endMs = frame.t + frameMs;
      lastSpeechAt = frame.t;
    } else if (current && frame.t - lastSpeechAt > hangoverMs) {
      segments.push(current);
      current = null;
    }
  }
  if (current) segments.push(current);
  return segments;
}

/**
 * Súhrn pre úsek [startMs, endMs]. `context` sú rámce pred úsekom (napr. posledných 30 s),
 * z ktorých sa spoľahlivejšie odhadne šum.
 */
export function summarizeVoice(
  frames: VoiceFrame[],
  startMs: number,
  endMs: number,
  context: VoiceFrame[] = [],
): VoiceSummary {
  const window = frames.filter((frame) => frame.t >= startMs && frame.t < endMs);
  const noiseFloorDb = estimateNoiseFloor([...context, ...window]);
  const threshold = Math.max(noiseFloorDb + VOICE_DEFAULTS.speechMarginDb, VOICE_DEFAULTS.minSpeechDb);
  const segments = detectSegments(window, threshold);

  const speechMs = segments.reduce((sum, segment) => sum + (segment.endMs - segment.startMs), 0);
  const pauses: number[] = [];
  for (let i = 1; i < segments.length; i += 1) {
    const gap = segments[i].startMs - segments[i - 1].endMs;
    if (gap >= VOICE_DEFAULTS.minPauseMs) pauses.push(gap);
  }

  const speechFrames = window.filter((frame) => frame.db >= threshold);
  const volume = standardDeviation(speechFrames.map((frame) => frame.db));

  const voiced = speechFrames
    .map((frame) => frame.f0)
    .filter((f0): f0 is number => f0 !== null && f0 >= VOICE_DEFAULTS.f0Min && f0 <= VOICE_DEFAULTS.f0Max);
  const pitchReliable = voiced.length >= VOICE_DEFAULTS.minVoicedFrames;
  let pitch: number | null = null;
  if (pitchReliable) {
    const sorted = [...voiced].sort((a, b) => a - b);
    const median = percentile(sorted, 0.5);
    // Poltóny voči mediánu: nezávislé od hlasového rozsahu človeka.
    pitch = standardDeviation(voiced.map((f0) => 12 * Math.log2(f0 / median)));
  }

  return {
    speechMs,
    segments,
    pauseCount: pauses.length,
    pauseTotalMs: pauses.reduce((sum, gap) => sum + gap, 0),
    longestPauseMs: pauses.length ? Math.max(...pauses) : 0,
    volumeVariabilityDb: volume === null ? null : Math.round(volume * 100) / 100,
    pitchVariabilitySemitones: pitch === null ? null : Math.round(pitch * 100) / 100,
    pitchReliable,
    noiseFloorDb: Math.round(noiseFloorDb * 10) / 10,
  };
}

/** Čas od konca reči investora po prvý segment reči foundera. */
export function responseLatencyMs(investorEndMs: number | null, founderSegments: SpeechSegment[]): number | null {
  if (investorEndMs === null || founderSegments.length === 0) return null;
  const latency = founderSegments[0].startMs - investorEndMs;
  return latency >= 0 ? Math.round(latency) : 0;
}
