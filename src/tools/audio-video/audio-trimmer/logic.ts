/**
 * Audio Trimmer — pure logic.
 *
 * Pure helpers only — no DOM, no AudioContext. The actual decoding and
 * re-encoding happens in ui.tsx via Web Audio API. This module contains:
 * time parsing/formatting (4 formats), sample range calculation, 44-byte RIFF
 * WAV header builder, 16-bit PCM sample converter, fade in/out generator,
 * crossfade calculator, file size estimator, trim validation, history
 * (localStorage), shareable URL, and summary stats.
 */

export type FadePreset = "0ms" | "100ms" | "500ms" | "1s" | "2s";

export const FADE_PRESETS_MS: Record<FadePreset, number> = {
  "0ms": 0,
  "100ms": 100,
  "500ms": 500,
  "1s": 1000,
  "2s": 2000,
};

export const FADE_LABELS: Record<FadePreset, string> = {
  "0ms": "None (0 ms)",
  "100ms": "100 ms",
  "500ms": "500 ms",
  "1s": "1 second",
  "2s": "2 seconds",
};

export interface TrimRange {
  startSeconds: number;
  endSeconds: number;
}

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

// ---- Time parsing ----

/**
 * Parse a time string in any of:
 *   - "12"        → 12 seconds
 *   - "12.5"      → 12.5 seconds
 *   - "01:30"     → MM:SS = 90 seconds
 *   - "01:30.250" → MM:SS.ms = 90.25 seconds
 *   - "01:02:03"  → HH:MM:SS = 3723 seconds
 *
 * Returns NaN for unparseable input.
 */
export function parseTime(input: string): number {
  if (typeof input !== "string") return Number.NaN;
  const s = input.trim();
  if (s === "") return Number.NaN;

  // HH:MM:SS or HH:MM:SS.ms
  if (s.indexOf(":") !== s.lastIndexOf(":")) {
    const m = s.match(/^(\d+):(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/);
    if (m) {
      const h = parseInt(m[1], 10);
      const min = parseInt(m[2], 10);
      const sec = parseFloat(m[3]);
      if (min >= 60 || sec >= 60) return Number.NaN;
      return h * 3600 + min * 60 + sec;
    }
    return Number.NaN;
  }

  // MM:SS or MM:SS.ms
  if (s.includes(":")) {
    const m = s.match(/^(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/);
    if (m) {
      const min = parseInt(m[1], 10);
      const sec = parseFloat(m[2]);
      if (sec >= 60) return Number.NaN;
      return min * 60 + sec;
    }
    return Number.NaN;
  }

  // Plain seconds
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : Number.NaN;
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

/** Format seconds as HH:MM:SS (no ms). */
export function formatTimeHMS(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

function pad2(n: number): string { return n < 10 ? `0${n}` : `${n}`; }
function pad3(n: number): string {
  if (n < 10) return `00${n}`;
  if (n < 100) return `0${n}`;
  return `${n}`;
}

// ---- Sample range calculator ----

export interface SampleRange {
  startSample: number;
  endSample: number;
  totalSamples: number;
}

/**
 * Convert start/end times (seconds) to sample indices.
 * Clamps end to totalSamples.
 */
export function computeSampleRange(
  startSeconds: number,
  endSeconds: number,
  sampleRate: number,
  totalSamples: number,
): SampleRange {
  const startSample = Math.max(0, Math.min(Math.floor(startSeconds * sampleRate), totalSamples));
  const endSample = Math.max(startSample, Math.min(Math.floor(endSeconds * sampleRate), totalSamples));
  return { startSample, endSample, totalSamples };
}

/** Number of samples between start and end. */
export function trimmedSampleCount(range: SampleRange): number {
  return Math.max(0, range.endSample - range.startSample);
}

/** Trimmed duration in seconds. */
export function trimmedDurationSeconds(range: SampleRange, sampleRate: number): number {
  if (sampleRate <= 0) return 0;
  return trimmedSampleCount(range) / sampleRate;
}

// ---- WAV header builder (44-byte RIFF) ----

/** Build a 44-byte RIFF WAV header for PCM 16-bit data. */
export function buildWavHeader(
  dataLength: number,
  sampleRate: number,
  channels: number,
  bitsPerSample = 16,
): Uint8Array {
  const byteRate = sampleRate * channels * bitsPerSample / 8;
  const blockAlign = channels * bitsPerSample / 8;
  const header = new Uint8Array(44);
  const view = new DataView(header.buffer);

  // RIFF identifier
  writeString(view, 0, "RIFF");
  // file size = data + 36 (header minus 8 bytes for RIFF + size)
  view.setUint32(4, 36 + dataLength, true);
  // RIFF type
  writeString(view, 8, "WAVE");

  // fmt chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);             // subchunk1 size
  view.setUint16(20, 1, true);              // audio format = PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data chunk
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
    // Clamp
    if (s > 1) s = 1;
    else if (s < -1) s = -1;
    // Convert to signed 16-bit
    const int16 = Math.round(s * 32767);
    view.setInt16(i * 2, int16, true);
  }
  return out;
}

/**
 * Interleave multi-channel Float32 sample arrays into a single interleaved
 * Float32Array. Each input array is one channel of length N.
 */
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

// ---- Fade in/out ----

/**
 * Apply linear fade in to the first `fadeSamples` samples (in place).
 * Sample at index i (i < fadeSamples) is multiplied by (i / fadeSamples).
 */
export function applyFadeIn(samples: Float32Array, fadeSamples: number): void {
  const n = Math.max(0, Math.min(Math.floor(fadeSamples), samples.length));
  for (let i = 0; i < n; i++) {
    samples[i] *= i / n;
  }
}

/**
 * Apply linear fade out to the last `fadeSamples` samples (in place).
 * Sample at index (length - 1 - j) for j in [0, fadeSamples) is multiplied by (j / fadeSamples).
 */
export function applyFadeOut(samples: Float32Array, fadeSamples: number): void {
  const n = Math.max(0, Math.min(Math.floor(fadeSamples), samples.length));
  const len = samples.length;
  for (let j = 0; j < n; j++) {
    samples[len - 1 - j] *= j / n;
  }
}

/** Convert a fade preset to a sample count given a sample rate. */
export function fadePresetToSamples(preset: FadePreset, sampleRate: number): number {
  const ms = FADE_PRESETS_MS[preset];
  return Math.round((ms / 1000) * sampleRate);
}

// ---- Crossfade calculator ----

export interface CrossfadeResult {
  overlapSamples: number;
  outputLength: number;
}

/**
 * Compute the crossfade overlap (in samples) for joining two segments.
 * The overlap cannot exceed the shorter of the two segments.
 */
export function computeCrossfade(
  segmentA: number,
  segmentB: number,
  crossfadeSamples: number,
): CrossfadeResult {
  const overlap = Math.max(0, Math.min(crossfadeSamples, Math.min(segmentA, segmentB)));
  const outputLength = segmentA + segmentB - overlap;
  return { overlapSamples: overlap, outputLength };
}

// ---- File size estimator ----

/**
 * Estimate output WAV file size:
 *   header (44 bytes) + samples × channels × 2 bytes (16-bit)
 */
export function estimateWavSizeBytes(
  sampleCount: number,
  channels: number,
  bitsPerSample = 16,
): number {
  return 44 + sampleCount * channels * (bitsPerSample / 8);
}

/** Format bytes human-readable. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

// ---- Validation ----

/** Validate trim range against total duration. */
export function validateTrim(
  startSeconds: number,
  endSeconds: number,
  totalDurationSeconds: number,
): ValidationResult {
  if (!Number.isFinite(startSeconds) || !Number.isFinite(endSeconds)) {
    return { ok: false, error: "Start and end times must be valid numbers." };
  }
  if (startSeconds < 0) {
    return { ok: false, error: "Start time cannot be negative." };
  }
  if (endSeconds <= startSeconds) {
    return { ok: false, error: "End time must be greater than start time." };
  }
  if (totalDurationSeconds > 0 && endSeconds > totalDurationSeconds + 0.001) {
    return { ok: false, error: `End time cannot exceed total duration (${formatTime(totalDurationSeconds)}).` };
  }
  return { ok: true };
}

// ---- Filename generator ----

/** Generate filename: trimmed-YYYY-MM-DD-HHmmss.wav. */
export function generateFilename(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  const hh = pad2(date.getHours());
  const mm = pad2(date.getMinutes());
  const ss = pad2(date.getSeconds());
  return `trimmed-${y}-${m}-${d}-${hh}${mm}${ss}.wav`;
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:audio-trimmer:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  originalName: string;
  originalDurationMs: number;
  trimmedDurationMs: number;
  outputSizeBytes: number;
  startSeconds: number;
  endSeconds: number;
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
  trimmedDurationSeconds: number;
  removedSeconds: number;
  removedPct: number;
  outputSizeBytes: number;
}

export function computeSummaryStats(
  originalDurationSeconds: number,
  trimmedDurationSeconds: number,
  outputSizeBytes: number,
): SummaryStats {
  const removedSeconds = Math.max(0, originalDurationSeconds - trimmedDurationSeconds);
  const removedPct = originalDurationSeconds > 0
    ? (removedSeconds / originalDurationSeconds) * 100
    : 0;
  return {
    originalDurationSeconds,
    trimmedDurationSeconds,
    removedSeconds,
    removedPct,
    outputSizeBytes,
  };
}

// ---- Shareable URL ----

export interface ShareSettings {
  start: string;
  end: string;
  fadeIn: FadePreset;
  fadeOut: FadePreset;
}

export function buildShareUrl(settings: ShareSettings): string {
  const params = new URLSearchParams();
  if (settings.start) params.set("start", settings.start);
  if (settings.end) params.set("end", settings.end);
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
  const start = params.get("start");
  if (start !== null) out.start = start;
  const end = params.get("end");
  if (end !== null) out.end = end;
  const fi = params.get("fadein");
  if (fi && fi in FADE_PRESETS_MS) out.fadeIn = fi as FadePreset;
  const fo = params.get("fadeout");
  if (fo && fo in FADE_PRESETS_MS) out.fadeOut = fo as FadePreset;
  return out;
}

// ---- Full WAV encoder helper ----

/**
 * Build a complete WAV file (header + interleaved 16-bit PCM data) from
 * per-channel Float32 sample arrays. This is the pure helper — ui.tsx calls
 * this after extracting the trimmed samples via OfflineAudioContext.
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
  // Copy samples (don't mutate caller's data)
  const copies = channels.map((c) => c.slice());
  // Apply fade to each channel
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
