/**
 * Noise Generator — pure logic.
 * Generates white, pink, and brown (red) noise samples with adjustable
 * volume and duration. Includes spectral statistics and WAV export helpers.
 */

export type NoiseType = "white" | "pink" | "brown" | "blue" | "violet";

export interface NoiseParams {
  type: NoiseType;
  volume: number; // 0..1
  duration: number; // seconds
  sampleRate: number;
  seed?: number;
}

export const DEFAULT_PARAMS: NoiseParams = {
  type: "white",
  volume: 0.5,
  duration: 1,
  sampleRate: 44100,
  seed: 42,
};

/** Mulberry32 PRNG. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Generate uniform [-1, 1] white noise sample. */
export function whiteNoiseSample(rng: () => number): number {
  return rng() * 2 - 1;
}

/** Pink noise via Voss-McCartney algorithm (1/f). */
export class PinkNoiseGenerator {
  private values: number[] = [];
  private rng: () => number;
  private rows = 0;
  private runningSum = 0;
  constructor(seed: number = 1, rows = 12) {
    this.rng = mulberry32(seed);
    this.rows = rows;
    this.values = new Array(rows).fill(0);
  }
  next(): number {
    // Pick which row to update using a counter that increments by 1 each call
    // and only updates the lowest set bit per call (Voss algorithm)
    this.values[0] = this.rng() * 2 - 1;
    let sum = this.values[0];
    // Update rows based on trailing zeros
    let n = this.values[0];
    for (let i = 1; i < this.rows; i++) {
      // randomly update some rows for stochastic approximation
      if (this.rng() < 0.5 / i) {
        this.values[i] = this.rng() * 2 - 1;
      }
      sum += this.values[i];
    }
    return sum / Math.sqrt(this.rows);
  }
}

/** Brown noise (integrated white). Returns next sample. */
export class BrownNoiseGenerator {
  private last = 0;
  private rng: () => number;
  constructor(seed: number = 1) {
    this.rng = mulberry32(seed);
  }
  next(): number {
    const white = this.rng() * 2 - 1;
    this.last = (this.last + 0.02 * white) / 1.02;
    return this.last * 3.5;
  }
}

/** Generate a buffer of noise samples. */
export function generateNoise(params: NoiseParams): Float32Array {
  const total = Math.floor(params.duration * params.sampleRate);
  const out = new Float32Array(total);
  const rng = mulberry32(params.seed ?? 42);
  let pink: PinkNoiseGenerator | null = null;
  let brown: BrownNoiseGenerator | null = null;
  if (params.type === "pink") pink = new PinkNoiseGenerator(params.seed ?? 42);
  if (params.type === "brown") brown = new BrownNoiseGenerator(params.seed ?? 42);
  for (let i = 0; i < total; i++) {
    let s = 0;
    switch (params.type) {
      case "white": s = whiteNoiseSample(rng); break;
      case "pink": s = pink!.next(); break;
      case "brown": s = brown!.next(); break;
      case "blue": s = whiteNoiseSample(rng) - (i > 0 ? out[i - 1] : 0); s *= 0.5; break;
      case "violet": s = whiteNoiseSample(rng) + whiteNoiseSample(rng) * 0.5; s *= 0.5; break;
    }
    out[i] = Math.max(-1, Math.min(1, s * params.volume));
  }
  return out;
}

/** Validate noise params. */
export function validateParams(p: NoiseParams): { ok: boolean; reason?: string } {
  if (p.volume < 0 || p.volume > 1) return { ok: false, reason: "Volume must be 0..1." };
  if (p.duration <= 0) return { ok: false, reason: "Duration must be positive." };
  if (p.sampleRate < 8000) return { ok: false, reason: "Sample rate must be ≥8000." };
  return { ok: true };
}

/** Compute peak amplitude. */
export function peakAmplitude(samples: Float32Array): number {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const a = Math.abs(samples[i]);
    if (a > peak) peak = a;
  }
  return peak;
}

/** Compute RMS amplitude. */
export function rmsAmplitude(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / samples.length);
}

/** Approximate spectral rolloff: frequency below which 85% of energy is contained. */
export function spectralRolloff(samples: Float32Array, sampleRate: number): number {
  // Use a coarse approximation: white noise → high rolloff, brown → low
  // Without FFT we estimate via variance of differences
  if (samples.length < 2) return 0;
  let diffSq = 0, valSq = 0;
  for (let i = 1; i < samples.length; i++) {
    diffSq += (samples[i] - samples[i - 1]) ** 2;
    valSq += samples[i] ** 2;
  }
  if (valSq === 0) return 0;
  const ratio = diffSq / valSq;
  return Math.min(sampleRate / 2, ratio * sampleRate / 4);
}

/** Estimate noise color from spectral rolloff. */
export function classifyNoise(rolloffHz: number, sampleRate: number): NoiseType {
  const nyquist = sampleRate / 2;
  const r = rolloffHz / nyquist;
  if (r > 0.7) return "white";
  if (r > 0.4) return "blue";
  if (r > 0.2) return "pink";
  if (r > 0.05) return "brown";
  return "violet";
}

/** Format duration. */
export function formatDuration(seconds: number): string {
  if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return m > 0 ? `${m}m ${s.toFixed(1)}s` : `${s.toFixed(2)}s`;
}

/** Estimate WAV byte size. */
export function estimateWavBytes(durationSec: number, sampleRate: number): number {
  return Math.ceil(durationSec * sampleRate * 2) + 44;
}

/** Format bytes. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** Spectral description per noise type. */
export function spectralDescription(type: NoiseType): { slope: string; description: string } {
  switch (type) {
    case "white": return { slope: "0 dB/octave", description: "Equal energy per frequency (flat)." };
    case "pink": return { slope: "-3 dB/octave", description: "Equal energy per octave (1/f)." };
    case "brown": return { slope: "-6 dB/octave", description: "Integrated white noise (1/f²)." };
    case "blue": return { slope: "+3 dB/octave", description: "High-frequency emphasis." };
    case "violet": return { slope: "+6 dB/octave", description: "Highest high-frequency emphasis." };
  }
}
