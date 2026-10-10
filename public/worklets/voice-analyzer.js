/*
  Pitch It: analýza hlasu v audio vlákne prehliadača.
  Každých ~50 ms pošle hladinu (dBFS) a odhad základnej frekvencie (YIN).
  Audio neopúšťa zariadenie; posielajú sa iba tieto dve čísla.
*/
const HOP_SECONDS = 0.05;
const WINDOW_SECONDS = 0.064;
const TARGET_RATE = 16000;
const F0_MIN = 60;
const F0_MAX = 450;
const YIN_THRESHOLD = 0.15;
const PITCH_MIN_DB = -50;

class VoiceAnalyzer extends AudioWorkletProcessor {
  constructor() {
    super();
    this.hop = Math.round(sampleRate * HOP_SECONDS);
    this.ring = new Float32Array(Math.round(sampleRate * WINDOW_SECONDS));
    this.write = 0;
    this.sinceEmit = 0;
    this.sumSquares = 0;
    this.samples = 0;
    this.step = Math.max(1, Math.floor(sampleRate / TARGET_RATE));
    this.rate = sampleRate / this.step;
    this.frame = new Float32Array(Math.floor(this.ring.length / this.step));
    this.maxLag = Math.min(Math.floor(this.rate / F0_MIN), this.frame.length - 2);
    this.minLag = Math.max(2, Math.floor(this.rate / F0_MAX));
    this.diff = new Float32Array(this.maxLag + 1);
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (!channel) return true;
    for (let i = 0; i < channel.length; i += 1) {
      const sample = channel[i];
      this.sumSquares += sample * sample;
      this.samples += 1;
      this.ring[this.write] = sample;
      this.write = (this.write + 1) % this.ring.length;
      this.sinceEmit += 1;
      if (this.sinceEmit >= this.hop) {
        this.emit();
        this.sinceEmit = 0;
      }
    }
    return true;
  }

  emit() {
    const rms = Math.sqrt(this.sumSquares / Math.max(1, this.samples));
    this.sumSquares = 0;
    this.samples = 0;
    const db = rms > 0 ? Math.max(-100, 20 * Math.log10(rms)) : -100;
    const f0 = db > PITCH_MIN_DB ? this.estimatePitch() : null;
    this.port.postMessage({ db, f0 });
  }

  estimatePitch() {
    const ringLength = this.ring.length;
    const frame = this.frame;
    for (let i = 0; i < frame.length; i += 1) {
      frame[i] = this.ring[(this.write + i * this.step) % ringLength];
    }

    const width = frame.length - this.maxLag;
    if (width <= 0) return null;
    const diff = this.diff;
    for (let lag = 1; lag <= this.maxLag; lag += 1) {
      let sum = 0;
      for (let j = 0; j < width; j += 1) {
        const delta = frame[j] - frame[j + lag];
        sum += delta * delta;
      }
      diff[lag] = sum;
    }

    // Kumulatívne normalizovaná diferenčná funkcia (YIN).
    let running = 0;
    for (let lag = 1; lag <= this.maxLag; lag += 1) {
      running += diff[lag];
      diff[lag] = running > 0 ? (diff[lag] * lag) / running : 1;
    }

    for (let lag = this.minLag; lag <= this.maxLag; lag += 1) {
      if (diff[lag] < YIN_THRESHOLD) {
        while (lag + 1 <= this.maxLag && diff[lag + 1] < diff[lag]) lag += 1;
        // Parabolická interpolácia okolo minima.
        const prev = diff[lag - 1];
        const next = lag + 1 <= this.maxLag ? diff[lag + 1] : diff[lag];
        const denominator = prev + next - 2 * diff[lag];
        const shift = denominator !== 0 ? (0.5 * (prev - next)) / denominator : 0;
        const period = lag + (Number.isFinite(shift) ? Math.max(-1, Math.min(1, shift)) : 0);
        const f0 = this.rate / period;
        return f0 >= F0_MIN && f0 <= F0_MAX ? f0 : null;
      }
    }
    return null;
  }
}

registerProcessor("voice-analyzer", VoiceAnalyzer);
