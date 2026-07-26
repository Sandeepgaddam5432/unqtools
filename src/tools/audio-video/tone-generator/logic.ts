/**
 * Tone Generator — pure logic.
 * Computes pure-tone waveform samples for sine, square, triangle, sawtooth,
 * and pulse waves at a given frequency, volume, duration, and sample rate.
 * Also includes amplitude envelopes (ADSR) and frequency sweep support.
 */

export type Waveform = "sine" | "square" | "triangle" | "sawtooth" | "pulse";

export interface ToneParams {
  frequency: number; // Hz (20..20000)
  volume: number; // 0..1
  duration: number; // seconds
  waveform: Waveform;
  sampleRate: number; // typically 44100
  pulseWidth?: number; // 0..1 (default 0.5)
  attack?: number; // seconds (ADSR attack)
  decay?: number; // seconds
  sustain?: number; // 0..1 sustain level
  release?: number; // seconds
}

export const DEFAULT_PARAMS: ToneParams = {
  frequency: 440,
  volume: 0.5,
  duration: 1,
  waveform: "sine",
  sampleRate: 44100,
  pulseWidth: 0.5,
  attack: 0.01,
  decay: 0.05,
  sustain: 0.8,
  release: 0.1,
};

export const FREQ_MIN = 20;
export const FREQ_MAX = 20000;

/** Validate a ToneParams object. */
export function validateParams(p: ToneParams): { ok: boolean; reason?: string } {
  if (!Number.isFinite(p.frequency) || p.frequency < FREQ_MIN || p.frequency > FREQ_MAX) {
    return { ok: false, reason: `Frequency must be between ${FREQ_MIN} and ${FREQ_MAX} Hz.` };
  }
  if (!Number.isFinite(p.volume) || p.volume < 0 || p.volume > 1) {
    return { ok: false, reason: "Volume must be between 0 and 1." };
  }
  if (!Number.isFinite(p.duration) || p.duration <= 0) {
    return { ok: false, reason: "Duration must be positive." };
  }
  if (!Number.isFinite(p.sampleRate) || p.sampleRate < 8000) {
    return { ok: false, reason: "Sample rate must be at least 8000 Hz." };
  }
  return { ok: true };
}

/** Generate a single sample for the given waveform and phase (0..1). */
export function waveformSample(waveform: Waveform, phase: number, pulseWidth = 0.5): number {
  // phase is fractional (0..1) — wrap for safety
  const p = phase - Math.floor(phase);
  switch (waveform) {
    case "sine": return Math.sin(2 * Math.PI * p);
    case "square": return p < 0.5 ? 1 : -1;
    case "triangle": {
      const t = p * 2;
      return t < 1 ? 2 * t - 1 : 3 - 2 * t;
    }
    case "sawtooth": return 2 * p - 1;
    case "pulse": return p < (pulseWidth ?? 0.5) ? 1 : -1;
  }
}

/** ADSR envelope value at time t. Returns 0..1. */
export function adsrEnvelope(t: number, total: number, attack: number, decay: number, sustain: number, release: number): number {
  if (t < 0 || t >= total) return 0;
  const releaseStart = total - release;
  if (t < attack) {
    return attack > 0 ? t / attack : 1;
  }
  if (t < attack + decay) {
    const dt = (t - attack) / (decay || 1e-6);
    return 1 + (sustain - 1) * dt;
  }
  if (t < releaseStart) {
    return sustain;
  }
  // Release phase
  const rt = (t - releaseStart) / (release || 1e-6);
  return Math.max(0, sustain * (1 - rt));
}

/** Generate a buffer of tone samples (-1..1, mono). */
export function generateTone(p: ToneParams): Float32Array {
  const v = validateParams(p);
  if (!v.ok) return new Float32Array(0);
  const totalSamples = Math.floor(p.duration * p.sampleRate);
  const out = new Float32Array(totalSamples);
  const phaseInc = p.frequency / p.sampleRate;
  let phase = 0;
  for (let i = 0; i < totalSamples; i++) {
    const t = i / p.sampleRate;
    const env = adsrEnvelope(t, p.duration, p.attack ?? 0, p.decay ?? 0, p.sustain ?? 1, p.release ?? 0);
    const s = waveformSample(p.waveform, phase, p.pulseWidth);
    out[i] = s * env * p.volume;
    phase += phaseInc;
  }
  return out;
}

/** Convert a frequency to the nearest musical note name. */
export function frequencyToNote(freq: number): { note: string; octave: number; cents: number } {
  if (freq <= 0) return { note: "—", octave: 0, cents: 0 };
  const A4 = 440;
  const semitones = 12 * Math.log2(freq / A4);
  const roundedSemitones = Math.round(semitones);
  const cents = Math.round((semitones - roundedSemitones) * 100);
  const notes = ["A", "A#", "B", "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#"];
  // A4 is the 0th index; semitones from A4
  const noteIdx = ((roundedSemitones % 12) + 12) % 12;
  const octave = 4 + Math.floor((roundedSemitones + 9) / 12);
  return { note: notes[noteIdx], octave, cents };
}

/** Convert a musical note to a frequency. */
export function noteToFrequency(note: string, octave: number): number {
  const notes: Record<string, number> = { "C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11 };
  const semis = notes[note];
  if (semis === undefined) return 0;
  // C4 = 261.63 Hz; semitones from A4 = semis - 9 + 12 * (octave - 4)
  const totalSemis = semis - 9 + 12 * (octave - 4);
  return 440 * Math.pow(2, totalSemis / 12);
}

/** Compute peak amplitude of a buffer. */
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

/** Compute total energy. */
export function totalEnergy(samples: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return sum;
}

/** Format duration as mm:ss.s. */
export function formatDuration(seconds: number): string {
  if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return m > 0 ? `${m}m ${s.toFixed(1)}s` : `${s.toFixed(2)}s`;
}

/** Estimate buffer byte size (16-bit PCM mono). */
export function estimatePcmBytes(durationSec: number, sampleRate: number, channels = 1, bitsPerSample = 16): number {
  return Math.ceil(durationSec * sampleRate * channels * bitsPerSample / 8);
}

/** Format bytes. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** Generate a frequency sweep (linear chirp) from f0 to f1. */
export function generateSweep(f0: number, f1: number, duration: number, sampleRate: number, volume: number): Float32Array {
  const totalSamples = Math.floor(duration * sampleRate);
  const out = new Float32Array(totalSamples);
  const k = (f1 - f0) / duration;
  let phase = 0;
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const freq = f0 + k * t;
    phase += (2 * Math.PI * freq) / sampleRate;
    out[i] = Math.sin(phase) * volume;
  }
  return out;
}

/** Generate a list of musical note frequencies within a range. */
export function noteRange(lowOctave: number, highOctave: number): Array<{ note: string; octave: number; freq: number }> {
  const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const out: Array<{ note: string; octave: number; freq: number }> = [];
  for (let oct = lowOctave; oct <= highOctave; oct++) {
    for (const n of notes) {
      out.push({ note: n, octave: oct, freq: noteToFrequency(n, oct) });
    }
  }
  return out;
}
