import type { SessionMeasurements } from "@/lib/reports/measured";

/*
  Spätná väzba k prednesu odvodená iba z meraní, pravidlami (nie AI).
  Prahy sú ASSUMPTION: orientačné hodnoty pre slovenskú reč na stretnutí, nie norma.
  Overiť na dátach z reálnych používateľov a upraviť (pozri README → Otvorené otázky).
*/

export const DELIVERY_THRESHOLDS = {
  fastWpm: 175,
  slowWpm: 95,
  slowStartLatencyMs: 4_000,
  fillerPer100: 5,
  monotoneVolumeDb: 2.5,
  monotonePitchSemitones: 1.5,
  lowFacingCamera: 0.6,
  lowFaceVisible: 0.8,
  lowCentered: 0.7,
} as const;

export type DeliveryObservation = {
  id: string;
  area: "pace" | "length" | "latency" | "pauses" | "fillers" | "voice" | "camera";
  /** measured = priame meranie; indicative = orientačný signál. */
  reliability: "measured" | "indicative";
  tone: "attention" | "positive" | "info";
  title: string;
  detail: string;
};

function formatSeconds(seconds: number): string {
  return seconds >= 60 ? `${Math.floor(seconds / 60)} min ${Math.round(seconds % 60)} s` : `${Math.round(seconds)} s`;
}

export function deliveryObservations(m: SessionMeasurements): DeliveryObservation[] {
  const observations: DeliveryObservation[] = [];
  const t = DELIVERY_THRESHOLDS;

  if (m.pace.medianWpm !== null) {
    if (m.pace.medianWpm > t.fastWpm) {
      observations.push({
        id: "pace-fast",
        area: "pace",
        reliability: "measured",
        tone: "attention",
        title: "Rýchle tempo",
        detail: `Medián ${Math.round(m.pace.medianWpm)} slov za minútu. Pri číslach a kľúčových vetách spomaľ, aby ich investor stihol zachytiť.`,
      });
    } else if (m.pace.medianWpm < t.slowWpm) {
      observations.push({
        id: "pace-slow",
        area: "pace",
        reliability: "measured",
        tone: "attention",
        title: "Pomalé tempo",
        detail: `Medián ${Math.round(m.pace.medianWpm)} slov za minútu. Skús skrátiť úvody a začať rovno pointou.`,
      });
    } else {
      observations.push({
        id: "pace-ok",
        area: "pace",
        reliability: "measured",
        tone: "positive",
        title: "Tempo v bežnom rozsahu",
        detail: `Medián ${Math.round(m.pace.medianWpm)} slov za minútu (rozsah ${Math.round(m.pace.minWpm ?? 0)} až ${Math.round(m.pace.maxWpm ?? 0)}).`,
      });
    }
  }

  if (m.answerLength.overTargetCount > 0 && m.answerLength.longestSeconds !== null) {
    observations.push({
      id: "length-long",
      area: "length",
      reliability: "measured",
      tone: "attention",
      title: "Dlhé odpovede",
      detail: `${m.answerLength.overTargetCount} z ${m.founderTurns} odpovedí prekročilo ${formatSeconds(m.answerLength.targetSeconds)}. Najdlhšia trvala ${formatSeconds(m.answerLength.longestSeconds)}. Začni odpoveďou, potom dôkazom.`,
    });
  }

  if (m.latency.medianMs !== null && m.latency.medianMs > t.slowStartLatencyMs) {
    observations.push({
      id: "latency-slow",
      area: "latency",
      reliability: "measured",
      tone: "info",
      title: "Dlhší nábeh na odpoveď",
      detail: `Medián ${(m.latency.medianMs / 1000).toFixed(1)} s od konca otázky po začiatok odpovede. Krátka pauza na premyslenie je v poriadku; pri opakovaných otázkach (trh, čísla) by mala byť odpoveď pripravená.`,
    });
  }

  if (m.pauses.longPauses > 0) {
    observations.push({
      id: "pauses-long",
      area: "pauses",
      reliability: "measured",
      tone: "info",
      title: "Dlhé pauzy uprostred odpovede",
      detail: `${m.pauses.longPauses} odpovedí obsahovalo pauzu dlhšiu ako 2,5 s. Ak išlo o hľadanie čísla, priprav si ho vopred.`,
    });
  }

  if (m.fillers.per100Words !== null && m.fillers.per100Words > t.fillerPer100) {
    const top = m.fillers.top.slice(0, 3).map((item) => `„${item.phrase}“ ${item.count}×`).join(", ");
    observations.push({
      id: "fillers-high",
      area: "fillers",
      reliability: "measured",
      tone: "attention",
      title: "Výplňové slová",
      detail: `Aspoň ${m.fillers.per100Words} na 100 slov (${top}). Prepis zaváhania často vynecháva, skutočný počet môže byť vyšší.`,
    });
  }

  if (m.voice.volumeVariabilityDb !== null && m.voice.volumeVariabilityDb < t.monotoneVolumeDb) {
    observations.push({
      id: "voice-flat-volume",
      area: "voice",
      reliability: "indicative",
      tone: "info",
      title: "Málo zmien hlasitosti",
      detail: `Hlasitosť sa menila len málo (${m.voice.volumeVariabilityDb.toFixed(1)} dB). Orientačné meranie: závisí od mikrofónu a potláčania šumu.`,
    });
  }

  if (m.voice.pitchVariabilitySemitones !== null && m.voice.pitchVariabilitySemitones < t.monotonePitchSemitones) {
    observations.push({
      id: "voice-flat-pitch",
      area: "voice",
      reliability: "indicative",
      tone: "info",
      title: "Málo intonácie",
      detail: `Výška hlasu sa menila málo (${m.voice.pitchVariabilitySemitones.toFixed(1)} poltónu). Zdôrazni kľúčové čísla a závery. Orientačné meranie.`,
    });
  }

  const visual = m.visual;
  if (visual?.reliable) {
    if (visual.faceVisibleRatio !== null && visual.faceVisibleRatio < t.lowFaceVisible) {
      observations.push({
        id: "camera-face-hidden",
        area: "camera",
        reliability: "indicative",
        tone: "attention",
        title: "Tvár často mimo záberu",
        detail: `Tvár bola viditeľná v ${Math.round(visual.faceVisibleRatio * 100)} % snímok. Skontroluj umiestnenie kamery a svetlo.`,
      });
    }
    if (visual.facingCameraRatio !== null && visual.facingCameraRatio < t.lowFacingCamera) {
      observations.push({
        id: "camera-facing",
        area: "camera",
        reliability: "indicative",
        tone: "info",
        title: "Hlava často otočená mimo kamery",
        detail: `Približne ${Math.round(visual.facingCameraRatio * 100)} % času bola hlava natočená ku kamere. Ide o odhad z polohy hlavy, nie o meranie očného kontaktu.`,
      });
    }
    if (visual.faceCenteredRatio !== null && visual.faceCenteredRatio < t.lowCentered) {
      observations.push({
        id: "camera-centered",
        area: "camera",
        reliability: "indicative",
        tone: "info",
        title: "Poloha v zábere",
        detail: `Tvár bola v strede záberu v ${Math.round(visual.faceCenteredRatio * 100)} % snímok. Posuň kameru alebo seba tak, aby si bol v strede.`,
      });
    }
  }

  return observations;
}
