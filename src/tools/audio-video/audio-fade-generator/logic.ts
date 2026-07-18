/**
 * Audio Fade Generator — pure logic.
 *
 * Pure helpers only — no DOM, no AudioContext. The actual decoding and
 * re-encoding happens in ui.tsx via Web Audio API. This module contains:
 * 4 fade curve types (linear, logarithmic, exponential, S-curve), fade
 * gain array generator, per-sample fade applier, 6 fade duration presets,
 * fade validation, sample-range calculator, 44-byte RIFF WAV header
 * builder, Float32 → 16-bit PCM converter, full WAV encoder, ASCII curve
 * visualizer, history (localStorage), shareable URL, and summary stats.
 */

// ---- Fade curve types ----

export type FadeCurve = "linear" | "logarithmic" | "exponential" | "s-curve";

export const FADE_CURVES: FadeCurve[] = [
  "linear",
  "logarithmic",
  "exponential",
  "s-curve",
];

export const FADE_CURVE_LABELS: Record<FadeCurve, string> = {
  linear: "Linear — constant rate",
  logarithmic: "Logarithmic — slow start, fast end",
  exponential: "Exponential — fast start, slow end",
  "s-curve": "S-curve — smooth both ends (cosine)",
};

export const FADE_CURVE_DESCRIPTIONS: Record<FadeCurve, string> = {
  linear: "Gain increases at a constant rate. Simple, but can sound abrupt.",
  logarithmic: "Gain rises slowly at first, then faster. Useful for avoiding clicks on the attack.",
  exponential: "Gain rises quickly at first, then slowly. Useful for emphasizing the start.",
  "s-curve": "Gain follows a cosine shape, smooth at both ends. Most musical; recommended default.",
};

// ---- Fade duration presets ----

export type FadeDurationPreset = "100ms" | "250ms" | "500ms" | "1s" | "2s" | "5s";

export const FADE_DURATION_PRESETS_MS: Record<FadeDurationPreset, number> = {
  "100ms": 100,
  "250ms": 250,
  "500ms": 500,
  "1s": 1000,
  "2s": 2000,
  "5s": 5000,
};

export const FADE_DURATION_LABELS: Record<FadeDurationPreset, string> = {
  "100ms": "100 ms (very fast)",
  "250ms": "250 ms (fast)",
  "500ms": "500 ms (default)",
  "1s": "1 s (smooth)",
  "2s": "2 s (long)",
  "5s": "5 s (very long / ambient)",
};

export const DEFAULT_FADE_CURVE: FadeCurve = "s-curve";
export const DEFAULT_FADE_IN: FadeDurationPreset = "500ms";
export const DEFAULT_FADE_OUT: FadeDurationPreset = "500ms";

// ---- Per-curve gain functions (single sample) ----

/**
 * Linear fade gain at position i/N:  g = i/N.
 * Constant rate of change.
 */
export function linearGain(i: number, n: number): number {
  if (n <= 0) return 1;
  return i / n;
}

/**
 * Logarithmic fade gain:  g = log10(1 + 9·i/N).
 * Slow start, fast end. At i=0 → 0, at i=N → 1.
 */
export function logarithmicGain(i: number, n: number): number {
  if (n <= 0) return 1;
  const x = i / n;
  return Math.log10(1 + 9 * x);
}

/**
 * Exponential fade gain:  g = (i/N)².
 * Fast start, slow end.
 */
export function exponentialGain(i: number, n: number): number {
  if (n <= 0) return 1;
  const x = i / n;
  return x * x;
}

/**
 * S-curve fade gain:  g = 0.5 − 0.5·cos(π·i/N).
 * Smooth at both ends (zero derivative at 0 and at N).
 */
export function sCurveGain(i: number, n: number): number {
  if (n <= 0) return 1;
  const x = i / n;
  return 0.5 - 0.5 * Math.cos(Math.PI * x);
}

/**
 * Dispatch: compute the gain for a single sample given the curve type.
 */
export function gainForCurve(curve: FadeCurve, i: number, n: number): number {
  switch (curve) {
    case "linear": return linearGain(i, n);
    case "logarithmic": return logarithmicGain(i, n);
    case "exponential": return exponentialGain(i, n);
    case "s-curve": return sCurveGain(i, n);
    default: return linearGain(i, n);
  }
}

// ---- Fade gain array generators ----

/**
 * Generate a fade-in gain array of length `n` (0 → 1).
 * Element at index i is the gain applied to sample i.
 */
export function generateFadeInGainArray(
  curve: FadeCurve,
  n: number,
): Float32Array {
  const len = Math.max(0, Math.floor(n));
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    out[i] = gainForCurve(curve, i, len);
  }
  // Ensure endpoints are exact (floating-point can drift)
  if (len > 0) {
    out[0] = 0;
    out[len - 1] = 1;
  }
  return out;
}

/**
 * Generate a fade-out gain array of length `n` (1 → 0).
 * Element at index i (counting from the start of the fade-out region) is
 * the gain applied to that sample. To apply to the last `n` samples of a
 * buffer, sample at position (length - n + i) gets gain[i].
 */
export function generateFadeOutGainArray(
  curve: FadeCurve,
  n: number,
): Float32Array {
  const len = Math.max(0, Math.floor(n));
  const out = new Float32Array(len);
  // Fade out is the reverse of fade in: gain at i = fade_in_gain(len - 1 - i)
  for (let i = 0; i < len; i++) {
    out[i] = gainForCurve(curve, len - 1 - i, len);
  }
  if (len > 0) {
    out[0] = 1;
    out[len - 1] = 0;
  }
  return out;
}

// ---- Fade applier (multiply samples by gain array) ----

/**
 * Apply fade in to a Float32Array of samples (in place).
 * The first `gainArray.length` samples are multiplied by the gain values.
 * If the array is longer than the samples, only the available samples are
 * multiplied (and gain values beyond are ignored).
 */
export function applyFadeInGain(
  samples: Float32Array,
  gainArray: Float32Array,
): void {
  const n = Math.min(samples.length, gainArray.length);
  for (let i = 0; i < n; i++) {
    samples[i] *= gainArray[i];
  }
}

/**
 * Apply fade out to a Float32Array of samples (in place).
 * The last `gainArray.length` samples are multiplied by the gain values,
 * with gainArray[0] applied to the first sample of the fade-out region.
 */
export function applyFadeOutGain(
  samples: Float32Array,
  gainArray: Float32Array,
): void {
  const len = samples.length;
  const n = Math.min(len, gainArray.length);
  // gainArray[0] applies to sample (len - n), gainArray[n-1] applies to sample (len - 1)
  for (let i = 0; i < n; i++) {
    samples[len - n + i] *= gainArray[i];
  }
}

/**
 * Apply both fade in and fade out to a Float32Array (in place).
 * Returns the same array for convenience.
 */
export function applyFades(
  samples: Float32Array,
  fadeInGain: Float32Array,
  fadeOutGain: Float32Array,
): Float32Array {
  applyFadeInGain(samples, fadeInGain);
  applyFadeOutGain(samples, fadeOutGain);
  return samples;
}

// ---- Fade duration presets → samples ----

/** Convert a fade duration preset to a sample count given a sample rate. */
export function fadePresetToSamples(
  preset: FadeDurationPreset,
  sampleRate: number,
): number {
  const ms = FADE_DURATION_PRESETS_MS[preset];
  return Math.round((ms / 1000) * sampleRate);
}

/** Convert milliseconds to sample count given a sample rate. */
export function msToSamples(ms: number, sampleRate: number): number {
  if (sampleRate <= 0) return 0;
  return Math.max(0, Math.round((ms / 1000) * sampleRate));
}

// ---- Sample range calculator ----

export interface FadeSampleRange {
  fadeInStart: number;       // always 0
  fadeInEnd: number;         // = fadeInSamples
  fadeOutStart: number;      // = totalSamples - fadeOutSamples
  fadeOutEnd: number;        // = totalSamples
  fadeInSamples: number;
  fadeOutSamples: number;
  totalSamples: number;
}

/**
 * Compute sample ranges for fade in and fade out.
 * Clamps fade lengths so they don't exceed half the total samples
 * (preventing overlap when in + out > total).
 */
export function computeFadeSampleRange(
  fadeInSamples: number,
  fadeOutSamples: number,
  totalSamples: number,
): FadeSampleRange {
  const total = Math.max(0, Math.floor(totalSamples));
  // Clamp individual fades to total
  let fi = Math.max(0, Math.min(Math.floor(fadeInSamples), total));
  let fo = Math.max(0, Math.min(Math.floor(fadeOutSamples), total));
  // If they overlap, halve each
  if (fi + fo > total) {
    const half = Math.floor(total / 2);
    fi = Math.min(fi, half);
    fo = Math.min(fo, half);
  }
  return {
    fadeInStart: 0,
    fadeInEnd: fi,
    fadeOutStart: total - fo,
    fadeOutEnd: total,
    fadeInSamples: fi,
    fadeOutSamples: fo,
    totalSamples: total,
  };
}

// ---- Fade validation ----

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

/**
 * Validate fade durations against the total audio duration.
 * Returns ok=false if fade in + fade out exceeds total duration.
 */
export function validateFade(
  fadeInSeconds: number,
  fadeOutSeconds: number,
  totalDurationSeconds: number,
): ValidationResult {
  if (!Number.isFinite(fadeInSeconds) || !Number.isFinite(fadeOutSeconds)) {
    return { ok: false, error: "Fade durations must be valid numbers." };
  }
  if (fadeInSeconds < 0) {
    return { ok: false, error: "Fade in duration cannot be negative." };
  }
  if (fadeOutSeconds < 0) {
    return { ok: false, error: "Fade out duration cannot be negative." };
  }
  if (totalDurationSeconds > 0 && fadeInSeconds + fadeOutSeconds > totalDurationSeconds + 0.001) {
    return {
      ok: false,
      error: `Fade in (${formatSeconds(fadeInSeconds)}) + fade out (${formatSeconds(fadeOutSeconds)}) exceeds total duration (${formatSeconds(totalDurationSeconds)}).`,
    };
  }
  return { ok: true };
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

/** Convert Float32 samples (range -1..1) to 16-bit little-endian PCM bytes. */
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

/**
 * Build a complete WAV file (header + interleaved 16-bit PCM data) from
 * per-channel Float32 sample arrays. Applies fade in/out on copies (does
 * not mutate the input arrays).
 */
export function encodeWav(
  channels: Float32Array[],
  sampleRate: number,
  fadeInGain: Float32Array,
  fadeOutGain: Float32Array,
): Uint8Array {
  if (channels.length === 0) {
    return buildWavHeader(0, sampleRate, 1);
  }
  // Copy and apply fades
  const copies = channels.map((c) => c.slice());
  for (const c of copies) {
    applyFadeInGain(c, fadeInGain);
    applyFadeOutGain(c, fadeOutGain);
  }
  const interleaved = interleaveChannels(copies);
  const pcm = floatSamplesTo16BitPCM(interleaved);
  const header = buildWavHeader(pcm.length, sampleRate, channels.length);
  const out = new Uint8Array(header.length + pcm.length);
  out.set(header, 0);
  out.set(pcm, header.length);
  return out;
}

// ---- ASCII curve visualizer ----

/**
 * Render an ASCII chart of the gain envelope over time.
 * Shows both fade in (rising) and fade out (falling) on the same chart.
 * `width` is the number of columns; `height` is the number of rows.
 */
export function renderCurveAscii(
  curve: FadeCurve,
  fadeInSamples: number,
  fadeOutSamples: number,
  totalSamples: number,
  width = 60,
  height = 10,
): string {
  const w = Math.max(20, Math.floor(width));
  const h = Math.max(1, Math.floor(height));
  const total = Math.max(1, Math.floor(totalSamples));
  const fi = Math.max(0, Math.min(Math.floor(fadeInSamples), total));
  const fo = Math.max(0, Math.min(Math.floor(fadeOutSamples), total));

  // Build gain envelope across the whole buffer, sampled at `w` columns.
  const envelope: number[] = [];
  for (let col = 0; col < w; col++) {
    const sampleIdx = Math.floor((col / (w - 1)) * (total - 1));
    let g = 1;
    if (fi > 0 && sampleIdx < fi) {
      g = gainForCurve(curve, sampleIdx, fi);
    } else if (fo > 0 && sampleIdx >= total - fo) {
      // Fade out: position within the fade-out region (0 at start, fo-1 at end)
      const pos = sampleIdx - (total - fo);
      g = gainForCurve(curve, fo - 1 - pos, fo);
    }
    envelope.push(Math.max(0, Math.min(1, g)));
  }

  // Build the chart row by row (top = gain 1, bottom = gain 0)
  const rows: string[] = [];
  for (let r = 0; r < h; r++) {
    const threshold = 1 - (r + 0.5) / h; // midline of row r
    let line = "";
    for (let col = 0; col < w; col++) {
      line += envelope[col] >= threshold ? "█" : " ";
    }
    rows.push(line);
  }

  // Axis labels
  const labels = [
    `Curve: ${curve}  |  fade in ${fi} samples  |  fade out ${fo} samples  |  total ${total} samples`,
    "1.0 ┬" + "─".repeat(w),
    ...rows.map((row) => "    │" + row),
    "0.0 ┴" + "─".repeat(w),
  ];

  return labels.join("\n");
}

// ---- Summary stats ----

export interface SummaryStats {
  fadeInDurationSeconds: number;
  fadeOutDurationSeconds: number;
  totalDurationSeconds: number;
  fadeInSamples: number;
  fadeOutSamples: number;
  totalSamples: number;
  fadedSamples: number;
  unfadedSamples: number;
  fadedPct: number;
  outputSizeBytes: number;
  curve: FadeCurve;
}

export function computeSummaryStats(
  fadeInSeconds: number,
  fadeOutSeconds: number,
  totalDurationSeconds: number,
  sampleRate: number,
  channels: number,
  outputSizeBytes: number,
  curve: FadeCurve,
): SummaryStats {
  const total = Math.max(0, Math.floor(totalDurationSeconds * sampleRate));
  const fi = Math.max(0, Math.min(Math.floor(fadeInSeconds * sampleRate), total));
  const fo = Math.max(0, Math.min(Math.floor(fadeOutSeconds * sampleRate), total));
  // Recompute clamped (after overlap prevention) using computeFadeSampleRange
  const range = computeFadeSampleRange(fi, fo, total);
  const faded = range.fadeInSamples + range.fadeOutSamples;
  const unfaded = Math.max(0, total - faded);
  return {
    fadeInDurationSeconds: range.fadeInSamples / sampleRate,
    fadeOutDurationSeconds: range.fadeOutSamples / sampleRate,
    totalDurationSeconds: totalDurationSeconds,
    fadeInSamples: range.fadeInSamples,
    fadeOutSamples: range.fadeOutSamples,
    totalSamples: total,
    fadedSamples: faded,
    unfadedSamples: unfaded,
    fadedPct: total > 0 ? (faded / total) * 100 : 0,
    outputSizeBytes,
    curve,
  };
}

// ---- Formatting helpers ----

export function formatSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0s";
  if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
  if (seconds < 60) return `${seconds.toFixed(2)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}m${s < 10 ? "0" : ""}${s}s`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

/** Format a Float32 gain value as a 4-decimal string. */
export function formatGain(g: number): string {
  if (!Number.isFinite(g)) return "—";
  return g.toFixed(4);
}

// ---- Filename generator ----

/** Generate filename: faded-YYYY-MM-DD-HHmmss.wav. */
export function generateFilename(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  const hh = pad2(date.getHours());
  const mm = pad2(date.getMinutes());
  const ss = pad2(date.getSeconds());
  return `faded-${y}-${m}-${d}-${hh}${mm}${ss}.wav`;
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:audio-fade-generator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  originalName: string;
  curve: FadeCurve;
  fadeInMs: number;
  fadeOutMs: number;
  totalDurationMs: number;
  outputSizeBytes: number;
  sampleRate: number;
  channels: number;
  filename: string;
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

// ---- Shareable URL ----

export interface ShareSettings {
  curve: FadeCurve;
  fadeIn: FadeDurationPreset;
  fadeOut: FadeDurationPreset;
}

export function buildShareUrl(settings: ShareSettings): string {
  const params = new URLSearchParams();
  params.set("curve", settings.curve);
  params.set("fadein", settings.fadeIn);
  params.set("fadeout", settings.fadeOut);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ShareSettings> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<ShareSettings> = {};
  const curve = params.get("curve");
  if (curve && FADE_CURVES.includes(curve as FadeCurve)) out.curve = curve as FadeCurve;
  const fi = params.get("fadein");
  if (fi && fi in FADE_DURATION_PRESETS_MS) out.fadeIn = fi as FadeDurationPreset;
  const fo = params.get("fadeout");
  if (fo && fo in FADE_DURATION_PRESETS_MS) out.fadeOut = fo as FadeDurationPreset;
  return out;
}

// ---- Helpers ----

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}
