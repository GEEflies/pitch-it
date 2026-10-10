import { countFillers, countWords, fillerRate, repeatedTrigramRatio, wordsPerMinute } from "@/lib/analytics/speech/text-metrics";

/*
  Objektívne merania relácie. Čisté funkcie: vstupom sú uložené ťahy a merania,
  výstup sa ukladá do feedback_reports.measured a používa v histórii a porovnaní.
  Nič tu nie je úsudok AI.
*/

export const MEASURED_VERSION = 1;

export type MeasuredTurnInput = {
  seq: number;
  speaker: "investor" | "founder";
  text: string;
  startedMs: number | null;
  endedMs: number | null;
  interrupted: boolean;
  source: "realtime" | "text";
};

export type MeasuredAudioInput = {
  turnSeq: number;
  speechMs: number;
  wordsPerMinute: number | null;
  responseLatencyMs: number | null;
  pauseCount: number;
  pauseTotalMs: number;
  longestPauseMs: number;
  volumeVariability: number | null;
  pitchVariabilitySemitones: number | null;
  pitchReliable: boolean;
  transcriptConfidence: number | null;
};

export type MeasuredVisualInput = {
  framesAnalyzed: number;
  faceVisibleRatio: number | null;
  faceCenteredRatio: number | null;
  facingCameraRatio: number | null;
  gazeTowardCameraRatio: number | null;
  headMovementIndex: number | null;
  upperBodyVisibleRatio: number | null;
  postureStabilityIndex: number | null;
  handsVisibleRatio: number | null;
  gestureActivityIndex: number | null;
  framingIssues: string[];
};

export type AnswerMeasurement = {
  seq: number;
  words: number;
  speechSeconds: number | null;
  wordsPerMinute: number | null;
  responseLatencyMs: number | null;
  pauseCount: number | null;
  longestPauseMs: number | null;
  fillers: number;
  repeatedTrigramRatio: number | null;
  interruptedInvestor: boolean;
  overTarget: boolean;
  transcriptFailed: boolean;
};

export type SessionMeasurements = {
  version: typeof MEASURED_VERSION;
  transport: "realtime" | "text";
  durationSeconds: number | null;
  investorTurns: number;
  founderTurns: number;
  answers: AnswerMeasurement[];
  totals: {
    founderWords: number;
    founderSpeechSeconds: number | null;
    /** Podiel času, keď hovoril founder (iba hlas). */
    founderTalkShare: number | null;
  };
  pace: { medianWpm: number | null; minWpm: number | null; maxWpm: number | null; answersMeasured: number };
  answerLength: {
    medianWords: number | null;
    medianSeconds: number | null;
    longestSeconds: number | null;
    targetSeconds: number;
    overTargetCount: number;
  };
  latency: { medianMs: number | null; maxMs: number | null; measured: number };
  pauses: { perMinute: number | null; longPauses: number; longestMs: number | null };
  fillers: { total: number; per100Words: number | null; top: Array<{ phrase: string; count: number }> };
  voice: {
    volumeVariabilityDb: number | null;
    pitchVariabilitySemitones: number | null;
    pitchReliableAnswers: number;
  };
  transcript: { meanConfidence: number | null; failedTurns: number };
  visual: (MeasuredVisualInput & { reliable: boolean }) | null;
  dataQuality: string[];
};

/** Pauza od 2,5 s sa počíta ako dlhá. */
export const LONG_PAUSE_MS = 2_500;

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  return Math.round(value * 10) / 10;
}

function round(value: number | null, digits = 1): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function computeMeasurements(input: {
  transport: "realtime" | "text";
  durationSeconds: number | null;
  targetAnswerSeconds: number;
  turns: MeasuredTurnInput[];
  audio: MeasuredAudioInput[];
  visual: MeasuredVisualInput | null;
}): SessionMeasurements {
  const turns = [...input.turns].sort((a, b) => a.seq - b.seq);
  const audioBySeq = new Map(input.audio.map((row) => [row.turnSeq, row]));
  const founderTurns = turns.filter((turn) => turn.speaker === "founder");
  const investorTurns = turns.filter((turn) => turn.speaker === "investor");
  const isVoice = input.transport === "realtime";

  const answers: AnswerMeasurement[] = founderTurns.map((turn) => {
    const audio = audioBySeq.get(turn.seq);
    const words = countWords(turn.text);
    const speechMs = audio?.speechMs ?? null;
    const fillers = countFillers(turn.text);
    const previous = turns.filter((other) => other.seq < turn.seq).at(-1);
    return {
      seq: turn.seq,
      words,
      speechSeconds: speechMs !== null ? round(speechMs / 1000) : null,
      wordsPerMinute: speechMs !== null ? wordsPerMinute(words, speechMs) : null,
      responseLatencyMs: audio?.responseLatencyMs ?? null,
      pauseCount: audio ? audio.pauseCount : null,
      longestPauseMs: audio ? audio.longestPauseMs : null,
      fillers: fillers.total,
      repeatedTrigramRatio: repeatedTrigramRatio(turn.text),
      interruptedInvestor: Boolean(previous && previous.speaker === "investor" && previous.interrupted),
      overTarget: speechMs !== null && speechMs / 1000 > input.targetAnswerSeconds,
      transcriptFailed: isVoice && words === 0,
    };
  });

  const measuredAnswers = answers.filter((answer) => !answer.transcriptFailed);
  const wpms = measuredAnswers.map((answer) => answer.wordsPerMinute).filter((value): value is number => value !== null);
  const seconds = measuredAnswers.map((answer) => answer.speechSeconds).filter((value): value is number => value !== null);
  const latencies = measuredAnswers
    .map((answer) => answer.responseLatencyMs)
    .filter((value): value is number => value !== null);

  const founderWords = measuredAnswers.reduce((sum, answer) => sum + answer.words, 0);
  const founderSpeechMs = isVoice
    ? founderTurns.reduce((sum, turn) => sum + (audioBySeq.get(turn.seq)?.speechMs ?? 0), 0)
    : null;

  const allPauses = founderTurns.map((turn) => audioBySeq.get(turn.seq)).filter((row): row is MeasuredAudioInput => Boolean(row));
  const pauseCount = allPauses.reduce((sum, row) => sum + row.pauseCount, 0);
  const longPauses = allPauses.filter((row) => row.longestPauseMs >= LONG_PAUSE_MS).length;

  const fillerTotals: Record<string, number> = {};
  let fillerCount = 0;
  for (const turn of founderTurns) {
    const counted = countFillers(turn.text);
    fillerCount += counted.total;
    for (const [phrase, count] of Object.entries(counted.byPhrase)) {
      fillerTotals[phrase] = (fillerTotals[phrase] ?? 0) + count;
    }
  }

  const volume = allPauses.map((row) => row.volumeVariability).filter((value): value is number => value !== null);
  const pitchRows = allPauses.filter((row) => row.pitchReliable && row.pitchVariabilitySemitones !== null);
  const confidences = allPauses.map((row) => row.transcriptConfidence).filter((value): value is number => value !== null);

  const totalSpeechMinutes = founderSpeechMs !== null ? founderSpeechMs / 60_000 : null;
  const durationMs = input.durationSeconds !== null ? input.durationSeconds * 1000 : null;

  const dataQuality: string[] = [];
  if (founderTurns.length === 0) dataQuality.push("V relácii nezaznela žiadna odpoveď foundera.");
  if (isVoice && wpms.length < 2) dataQuality.push("Na spoľahlivé tempo reči bolo málo dlhších odpovedí.");
  if (isVoice) {
    dataQuality.push(
      "Prepis reči môže vynechávať zaváhania („ehm“, „eee“). Počet výplňových slov je preto dolný odhad.",
    );
  }
  if (!isVoice) dataQuality.push("Textový režim: tempo, pauzy a hlas sa nemerali.");
  const failed = answers.filter((answer) => answer.transcriptFailed).length;
  if (failed > 0) dataQuality.push(`${failed} odpovedí sa nepodarilo prepísať, v rozbore chýbajú.`);

  const visual =
    input.visual && input.visual.framesAnalyzed > 0
      ? { ...input.visual, reliable: input.visual.framesAnalyzed >= 150 }
      : null;
  if (visual && !visual.reliable) dataQuality.push("Z kamery bolo málo snímok na spoľahlivé neverbálne signály.");

  return {
    version: MEASURED_VERSION,
    transport: input.transport,
    durationSeconds: input.durationSeconds,
    investorTurns: investorTurns.length,
    founderTurns: founderTurns.length,
    answers,
    totals: {
      founderWords,
      founderSpeechSeconds: founderSpeechMs !== null ? round(founderSpeechMs / 1000) : null,
      founderTalkShare:
        founderSpeechMs !== null && durationMs && durationMs > 0 ? round(Math.min(1, founderSpeechMs / durationMs), 2) : null,
    },
    pace: {
      medianWpm: median(wpms),
      minWpm: wpms.length ? Math.min(...wpms) : null,
      maxWpm: wpms.length ? Math.max(...wpms) : null,
      answersMeasured: wpms.length,
    },
    answerLength: {
      medianWords: median(measuredAnswers.map((answer) => answer.words)),
      medianSeconds: median(seconds),
      longestSeconds: seconds.length ? Math.max(...seconds) : null,
      targetSeconds: input.targetAnswerSeconds,
      overTargetCount: answers.filter((answer) => answer.overTarget).length,
    },
    latency: {
      medianMs: median(latencies),
      maxMs: latencies.length ? Math.max(...latencies) : null,
      measured: latencies.length,
    },
    pauses: {
      perMinute: totalSpeechMinutes && totalSpeechMinutes >= 0.5 ? round(pauseCount / totalSpeechMinutes) : null,
      longPauses,
      longestMs: allPauses.length ? Math.max(...allPauses.map((row) => row.longestPauseMs)) : null,
    },
    fillers: {
      total: fillerCount,
      per100Words: fillerRate(fillerCount, founderWords),
      top: Object.entries(fillerTotals)
        .map(([phrase, count]) => ({ phrase, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
    },
    voice: {
      volumeVariabilityDb: median(volume),
      pitchVariabilitySemitones: median(pitchRows.map((row) => row.pitchVariabilitySemitones as number)),
      pitchReliableAnswers: pitchRows.length,
    },
    transcript: {
      meanConfidence: confidences.length
        ? round(confidences.reduce((sum, value) => sum + value, 0) / confidences.length, 3)
        : null,
      failedTurns: failed,
    },
    visual,
    dataQuality,
  };
}
