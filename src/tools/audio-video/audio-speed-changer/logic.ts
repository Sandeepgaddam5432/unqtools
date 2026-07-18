/**
 * Audio Speed Changer — pure logic.
 *
 * Pure helpers only — no DOM, no AudioContext. The actual decoding and
 * re-encoding happen in ui.tsx via Web Audio API. This module contains:
 * speed presets, speed validation, duration calculator, linear-interpolation
 * resampler, pitch-shift (semitone) calculator, WSOLA chunk-size estimator,
 * file-size estimator, 44-byte RIFF WAV header builder, Float32 → 16-bit PCM
 * converter, fade in/out generator, WAV encoder, filename generator, history
 * (localStorage), shareable URL, and summary stats.
 */

// ---- Speed presets ----

export type SpeedPreset =
  | "0.5" | "0.75" | "1.0" | "1.25" | "1.5" | "1.75" | "2.0";

/** 7 speed presets from 0.5× to 2.0×. */
export const SPEED_PRESETS: SpeedPreset[] = [
  "0.5", "0.75", "1.0", "1.25", "1.5", "1.75", "2.0",
];

export const SPEED_PRESET_VALUES: Record<SpeedPreset, number> = {
  "0.5": 0.5,
  "0.75": 0.75,
  "1.0": 1.0,
  "1.25": 1.25,
  "1.5": 1.5,
  "1.75": 1.75,
  "2.0": 2.0,
};

export const SPEED_PRESET_LABELS: Record<SpeedPreset, string> = {
  "0.5": "0.5× (half speed)",
  "0.75": "0.75× (slow)",
  "1.0": "1.0× (original)",
  "1.25": "1.25× (slight speed-up)",
  "1.5": "1.5× (50% faster)",
  "1.75": "1.75× (fast)",
  "2.0": "2.0× (double speed)",
};

export const DEFAULT_SPEED: SpeedPreset = "1.0";

/** Min / max supported speed factors. */
export const MIN_SPEED = 0.25;
export const MAX_SPEED = 4.0;

// ---- Speed validation ----

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

/**
 * Validate a speed factor. Returns ok=true when 0.25 ≤ speed ≤ 4.0.
 */
export function validateSpeed(speed: number): ValidationResult {
  if (!Number.isFinite(speed)) {
    return { ok: false, error: "Speed must be a valid number." };
  }
  if (speed < MIN_SPEED) {
    return { ok: false, error: `Speed must be at least ${MIN_SPEED}×.` };
  }
  if (speed > MAX_SPEED) {
    return { ok: false, error: `Speed must be at most ${MAX_SPEED}×.` };
  }
  if (speed <= 0) {
    return { ok: false, error: "Speed must be greater than zero." };
  }
  return { ok: true };
}

/** Parse a free-form speed string ("1.5", "1.5x", "150%"). Returns NaN on failure. */
export function parseSpeed(input: string): number {
  if (typeof input !== "string") return Number.NaN;
  const s = input.trim().toLowerCase();
  if (s === "") return Number.NaN;
  let n: number;
  if (s.endsWith("%")) {
    const pct = parseFloat(s.slice(0, -1));
    n = Number.isFinite(pct) ? pct / 100 : Number.NaN;
  } else if (s.endsWith("x")) {
    n = parseFloat(s.slice(0, -1));
  } else {
    n = parseFloat(s);
  }
  return Number.isFinite(n) ? n : Number.NaN;
}

// ---- Duration calculator ----

/**
 * New duration (in seconds) = original duration / speed.
 * At 2× speed, a 10s clip becomes 5s. At 0.5× speed, it becomes 20s.
 */
export function computeNewDuration(originalDurationSeconds: number, speed: number): number {
  if (speed <= 0) return 0;
  return originalDurationSeconds / speed;
}

/** Difference in seconds (positive = output is shorter). */
export function computeDurationDelta(originalDurationSeconds: number, speed: number): number {
  const newDur = computeNewDuration(originalDurationSeconds, speed);
  return originalDurationSeconds - newDur;
}

// ---- Pitch-shift (semitone) calculator ----

/**
 * Pitch shift in semitones = 12 × log2(speed).
 * Doubling speed (2.0×) = +12 semitones (one octave up).
 * Halving speed (0.5×) = −12 semitones (one octave down).
 * Only meaningful when pitch preservation is OFF.
 */
export function computePitchShiftSemitones(speed: number): number {
  if (speed <= 0 || !Number.isFinite(speed)) return 0;
  return 12 * Math.log2(speed);
}

/** Format a semitone count (e.g. "+12.00 st" or "-3.86 st"). */
export function formatSemitones(semitones: number): string {
  if (!Number.isFinite(semitones)) return "0.00 st";
  const sign = semitones > 0 ? "+" : "";
  return `${sign}${semitones.toFixed(2)} st`;
}

/** Convert semitones to a frequency ratio (e.g. +12 st → 2.0). */
export function semitonesToRatio(semitones: number): number {
  return Math.pow(2, semitones / 12);
}

// ---- Linear-interpolation resampler ----

/**
 * Resample a Float32Array using linear interpolation.
 *
 * For speed > 1 (slower output / fewer output samples): we step through the
 * INPUT at rate `speed` and interpolate. Output length = floor(N / speed).
 *
 * For speed < 1 (faster output / more output samples): we step through the
 * OUTPUT and read positions at `speed` rate. Output length = floor(N / speed).
 *
 * Both branches are mathematically equivalent: outLength = floor(N / speed).
 *
 * This is the "tape-style" resampler used when pitch preservation is OFF —
 * both tempo and pitch shift together (pitch shifts by 12*log2(speed) semis).
 */
export function resampleLinear(samples: Float32Array, speed: number): Float32Array {
  if (speed <= 0 || !Number.isFinite(speed)) return new Float32Array(0);
  if (samples.length === 0) return new Float32Array(0);
  if (speed === 1) return samples.slice();
  const outLength = Math.max(0, Math.floor(samples.length / speed));
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const srcPos = i * speed;
    const i0 = Math.floor(srcPos);
    const i1 = Math.min(i0 + 1, samples.length - 1);
    const frac = srcPos - i0;
    out[i] = samples[i0] * (1 - frac) + samples[i1] * frac;
  }
  return out;
}

/** Resample all channels with the same speed factor. */
export function resampleChannelsLinear(channels: Float32Array[], speed: number): Float32Array[] {
  return channels.map((c) => resampleLinear(c, speed));
}

// ---- WSOLA-style chunk-size calculator ----

/**
 * Estimate a good WSOLA (Waveform Similarity Overlap-Add) analysis window
 * size in samples for a given speed factor and sample rate. This is a pure
 * helper — the actual WSOLA rendering happens in ui.tsx (and currently we
 * use OfflineAudioContext instead, but we expose this for the "advanced"
 * settings card and summary stats).
 *
 * Rule of thumb: window = 20-50 ms; we use 30 ms × sampleRate, clamped to
 * [256, 8192] and rounded to a power-of-two multiple for FFT friendliness.
 */
export function computeWsolaWindowSize(sampleRate: number, speed: number): number {
  if (sampleRate <= 0 || !Number.isFinite(speed) || speed <= 0) return 1024;
  const target = Math.round(0.03 * sampleRate); // 30 ms
  // Snap to nearest power of two within reasonable bounds
  const p = Math.max(8, Math.min(13, Math.round(Math.log2(target))));
  const snapped = Math.pow(2, p);
  return Math.max(256, Math.min(8192, snapped));
}

/** Hop size = window / 2 (50% overlap). */
export function computeWsolaHopSize(windowSize: number): number {
  return Math.max(1, Math.floor(windowSize / 2));
}

// ---- File-size estimator ----

/**
 * Estimate WAV file size for the speed-changed output:
 *   header (44 bytes) + newSampleCount × channels × 2 bytes (16-bit PCM)
 * where newSampleCount = floor(originalSampleCount / speed).
 */
export function estimateWavSizeBytes(
  originalSampleCount: number,
  channels: number,
  speed: number,
  bitsPerSample = 16,
): number {
  if (speed <= 0) return 44;
  const newSamples = Math.max(0, Math.floor(originalSampleCount / speed));
  return 44 + newSamples * channels * (bitsPerSample / 8);
}

/** Format bytes human-readable. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

/** Format seconds as MM:SS.ms (e.g. 90.25 → "01:30.250"). */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const totalMs = Math.round(seconds * 1000);
  const minutes = Math.floor(totalMs / 60_000);
  const secs = Math.floor((totalMs % 60_000) / 1000);
  const ms = totalMs % 1000;
  return `${pad2(minutes)}:${pad2(secs)}.${pad3(ms)}`;
}

function pad2(n: number): string { return n < 10 ? `0${n}` : `${n}`; }
function pad3(n: number): string {
  if (n < 10) return `00${n}`;
  if (n < 100) return `0${n}`;
  return `${n}`;
}

// ---- WAV header builder (44-byte RIFF) ----

/** Build a 44-byte RIFF WAV header for PCM 16-bit data. */
export function buildWavHeader(
  dataLength: number,
  sampleRate: number,
  channels: number,
  bitsPerSample = 16,
): Uint8Array {
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const header = new Uint8Array(44);
  const view = new DataView(header.buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, "WAVE");

  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  writeString(view, 36, "data");
  view.setUint32(40, dataLength, true);

  return header;
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

// ---- Sample to 16-bit PCM converter ----

/**
 * Convert Float32 samples (range -1..1) to 16-bit little-endian PCM bytes.
 * Clips values outside [-1, 1] before quantizing.
 */
export function floatSamplesTo16BitPCM(samples: Float32Array): Uint8Array {
  const out = new Uint8Array(samples.length * 2);
  const view = new DataView(out.buffer);
  for (let i = 0; i < samples.length; i++) {
    let s = samples[i];
    if (s > 1) s = 1;
    else if (s < -1) s = -1;
    const int16 = Math.round(s * 32767);
    view.setInt16(i * 2, int16, true);
  }
  return out;
}

/** Interleave multi-channel Float32 sample arrays into a single Float32Array. */
export function interleaveChannels(channels: Float32Array[]): Float32Array {
  if (channels.length === 0) return new Float32Array(0);
  const length = channels[0].length;
  const out = new Float32Array(length * channels.length);
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < channels.length; c++) {
      out[i * channels.length + c] = channels[c][i];
    }
  }
  return out;
}

// ---- Fade in/out (click prevention) ----

/** Apply linear fade in to the first `fadeSamples` samples (in place). */
export function applyFadeIn(samples: Float32Array, fadeSamples: number): void {
  const n = Math.max(0, Math.min(Math.floor(fadeSamples), samples.length));
  for (let i = 0; i < n; i++) {
    samples[i] *= i / n;
  }
}

/** Apply linear fade out to the last `fadeSamples` samples (in place). */
export function applyFadeOut(samples: Float32Array, fadeSamples: number): void {
  const n = Math.max(0, Math.min(Math.floor(fadeSamples), samples.length));
  const len = samples.length;
  for (let j = 0; j < n; j++) {
    samples[len - 1 - j] *= j / n;
  }
}

/** Convert milliseconds to sample count for a given sample rate. */
export function msToSamples(ms: number, sampleRate: number): number {
  return Math.round((ms / 1000) * sampleRate);
}

// ---- Full WAV encoder ----

/**
 * Build a complete WAV file (header + interleaved 16-bit PCM data) from
 * per-channel Float32 sample arrays. Applies fade in/out on copies
 * (does not mutate the inputs).
 */
export function encodeWav(
  channels: Float32Array[],
  sampleRate: number,
  fadeInSamples: number,
  fadeOutSamples: number,
): Uint8Array {
  if (channels.length === 0) {
    return buildWavHeader(0, sampleRate, 1);
  }
  const copies = channels.map((c) => c.slice());
  for (const c of copies) {
    applyFadeIn(c, fadeInSamples);
    applyFadeOut(c, fadeOutSamples);
  }
  const interleaved = interleaveChannels(copies);
  const pcm = floatSamplesTo16BitPCM(interleaved);
  const header = buildWavHeader(pcm.length, sampleRate, channels.length);
  const out = new Uint8Array(header.length + pcm.length);
  out.set(header, 0);
  out.set(pcm, header.length);
  return out;
}

// ---- Filename generator ----

/**
 * Generate filename: speed-<speed>x-YYYY-MM-DD-HHmmss.wav.
 * Speed is rendered without trailing zeros (1.5 → "1.5x", 1.0 → "1.0x").
 */
export function generateFilename(speed: number, date: Date = new Date()): string {
  const speedStr = Number.isFinite(speed) ? speed.toFixed(2).replace(/0+$/, "").replace(/\.$/, ".0") : "1.0";
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  const hh = pad2(date.getHours());
  const mm = pad2(date.getMinutes());
  const ss = pad2(date.getSeconds());
  return `speed-${speedStr}x-${y}-${m}-${d}-${hh}${mm}${ss}.wav`;
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:audio-speed-changer:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  originalName: string;
  originalDurationMs: number;
  newDurationMs: number;
  speed: number;
  preservePitch: boolean;
  pitchShiftSemitones: number;
  outputSizeBytes: number;
  sampleRate: number;
  channels: number;
}

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

// ---- Summary stats ----

export interface SummaryStats {
  originalDurationSeconds: number;
  newDurationSeconds: number;
  durationDeltaSeconds: number;
  speed: number;
  preservePitch: boolean;
  pitchShiftSemitones: number;
  outputSizeBytes: number;
  sampleRate: number;
  channels: number;
}

export function computeSummaryStats(
  originalDurationSeconds: number,
  speed: number,
  preservePitch: boolean,
  outputSizeBytes: number,
  sampleRate: number,
  channels: number,
): SummaryStats {
  const newDur = computeNewDuration(originalDurationSeconds, speed);
  const pitchShift = preservePitch ? 0 : computePitchShiftSemitones(speed);
  return {
    originalDurationSeconds,
    newDurationSeconds: newDur,
    durationDeltaSeconds: originalDurationSeconds - newDur,
    speed,
    preservePitch,
    pitchShiftSemitones: pitchShift,
    outputSizeBytes,
    sampleRate,
    channels,
  };
}

// ---- Shareable URL ----

export interface ShareSettings {
  speed: string;
  preservePitch: boolean;
}

export function buildShareUrl(settings: ShareSettings): string {
  const params = new URLSearchParams();
  if (settings.speed) params.set("speed", settings.speed);
  params.set("preserve", settings.preservePitch ? "1" : "0");
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ShareSettings> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<ShareSettings> = {};
  const speed = params.get("speed");
  if (speed !== null) out.speed = speed;
  const preserve = params.get("preserve");
  if (preserve === "1") out.preservePitch = true;
  else if (preserve === "0") out.preservePitch = false;
  return out;
}
