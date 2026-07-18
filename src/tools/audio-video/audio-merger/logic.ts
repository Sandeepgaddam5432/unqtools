/**
 * Audio Merger — pure logic.
 *
 * Pure helpers only — no DOM, no AudioContext. The actual decoding and
 * re-encoding happens in ui.tsx via Web Audio API. This module contains
 * testable utilities: sample-rate / channel unifiers, linear resampler,
 * channel upmixer, silence gap generator, crossfade calculator + linear
 * crossfade applier, buffer concatenator (gap or crossfade), total-duration
 * calculator, file-size estimator, pure-JS 44-byte RIFF WAV encoder
 * (16-bit PCM), timestamped filename generator, history (localStorage),
 * shareable URL, and summary stats.
 */

// ---- Presets ----

export type GapPreset = "0ms" | "100ms" | "250ms" | "500ms" | "1s" | "2s";
export type CrossfadePreset = "0ms" | "50ms" | "100ms" | "250ms" | "500ms" | "1s";

export const GAP_PRESETS_MS: Record<GapPreset, number> = {
  "0ms": 0,
  "100ms": 100,
  "250ms": 250,
  "500ms": 500,
  "1s": 1000,
  "2s": 2000,
};

export const GAP_LABELS: Record<GapPreset, string> = {
  "0ms": "None (0 ms)",
  "100ms": "100 ms",
  "250ms": "250 ms",
  "500ms": "500 ms",
  "1s": "1 second",
  "2s": "2 seconds",
};

export const CROSSFADE_PRESETS_MS: Record<CrossfadePreset, number> = {
  "0ms": 0,
  "50ms": 50,
  "100ms": 100,
  "250ms": 250,
  "500ms": 500,
  "1s": 1000,
};

export const CROSSFADE_LABELS: Record<CrossfadePreset, string> = {
  "0ms": "None (0 ms)",
  "50ms": "50 ms",
  "100ms": "100 ms",
  "250ms": "250 ms",
  "500ms": "500 ms",
  "1s": "1 second",
};

// ---- Types ----

export interface SegmentInfo {
  fileName: string;
  sampleRate: number;
  channels: number;
  length: number; // total samples per channel
  durationSeconds: number;
}

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

// ---- Time / byte formatting ----

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

/** Format bytes as a human-readable string. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

// ---- Sample rate / channel unifiers ----

/** Find the maximum sample rate from a list of values. */
export function unifySampleRate(rates: number[]): number {
  if (rates.length === 0) return 0;
  return rates.reduce((max, r) => (r > max ? r : max), 0);
}

/** Find the maximum channel count from a list of values. */
export function unifyChannels(channelCounts: number[]): number {
  if (channelCounts.length === 0) return 0;
  return channelCounts.reduce((max, c) => (c > max ? c : max), 0);
}

// ---- Resampling (linear interpolation) ----

/**
 * Resample a Float32Array from `fromRate` to `toRate` using linear
 * interpolation. If fromRate === toRate, returns the input unchanged.
 * For downsampling, this is a simple (non-anti-aliased) interpolation —
 * adequate for joining voice memos and clips.
 */
export function resampleLinear(
  samples: Float32Array,
  fromRate: number,
  toRate: number,
): Float32Array {
  if (fromRate === toRate || samples.length === 0) return samples;
  if (fromRate <= 0 || toRate <= 0) return new Float32Array(0);
  const ratio = toRate / fromRate;
  const newLength = Math.max(1, Math.round(samples.length * ratio));
  const out = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const srcPos = (i * fromRate) / toRate;
    const srcIdx = Math.floor(srcPos);
    const frac = srcPos - srcIdx;
    const a = samples[Math.min(srcIdx, samples.length - 1)]!;
    const b = samples[Math.min(srcIdx + 1, samples.length - 1)]!;
    out[i] = a + (b - a) * frac;
  }
  return out;
}

// ---- Channel upmix ----

/**
 * Upmix a list of channel Float32Arrays to `targetChannels` by duplicating
 * the last channel. If the input already has >= targetChannels, returns the
 * first `targetChannels` channels (downmix by truncation — typically unused
 * since the unifier picks max).
 */
export function upmixChannels(
  channels: Float32Array[],
  targetChannels: number,
): Float32Array[] {
  if (channels.length === 0) return [];
  if (channels.length >= targetChannels) return channels.slice(0, targetChannels);
  const out = channels.slice();
  while (out.length < targetChannels) {
    out.push(out[out.length - 1]!.slice());
  }
  return out;
}

// ---- Silence generator ----

/** Generate N samples of zero-amplitude (silence). */
export function generateSilence(numSamples: number): Float32Array {
  return new Float32Array(Math.max(0, Math.floor(numSamples)));
}

// ---- Crossfade ----

export interface CrossfadeResult {
  overlapSamples: number;
  outputLength: number;
}

/**
 * Compute the crossfade overlap (in samples) for joining two segments.
 * The overlap cannot exceed the shorter of the two segments.
 */
export function computeCrossfade(
  segmentALen: number,
  segmentBLen: number,
  crossfadeSamples: number,
): CrossfadeResult {
  const overlap = Math.max(0, Math.min(crossfadeSamples, Math.min(segmentALen, segmentBLen)));
  const outputLength = segmentALen + segmentBLen - overlap;
  return { overlapSamples: overlap, outputLength };
}

/**
 * Apply linear crossfade between the end of bufA and the start of bufB.
 * The last `overlap` samples of bufA fade out linearly (gain 1 → 0), while
 * the first `overlap` samples of bufB fade in linearly (gain 0 → 1). They
 * are summed sample-by-sample in the overlap region. Returns a new
 * Float32Array of length (bufA.length + bufB.length - overlap).
 */
export function applyLinearCrossfade(
  bufA: Float32Array,
  bufB: Float32Array,
  overlapSamples: number,
): Float32Array {
  const overlap = Math.max(0, Math.min(overlapSamples, Math.min(bufA.length, bufB.length)));
  const outLen = bufA.length + bufB.length - overlap;
  const out = new Float32Array(outLen);
  out.set(bufA, 0);
  if (overlap > 0) {
    const aStart = bufA.length - overlap;
    for (let i = 0; i < overlap; i++) {
      const aGain = (overlap - i - 1) / overlap; // 1 → 0
      const bGain = (i + 1) / overlap;           // 0 → 1
      out[aStart + i] = bufA[aStart + i]! * aGain + bufB[i]! * bGain;
    }
    // Copy the remainder of bufB
    out.set(bufB.subarray(overlap), bufA.length);
  } else {
    out.set(bufB, bufA.length);
  }
  return out;
}

// ---- Buffer concatenator ----

/**
 * Concatenate a list of per-channel Float32Arrays into a single array.
 * If crossfadeSamples > 0, applies linear crossfade between consecutive
 * segments (gaps are ignored in this case). Otherwise, inserts `gapSamples`
 * of silence between consecutive segments.
 *
 * Returns a new Float32Array.
 */
export function concatenateSegments(
  segments: Float32Array[],
  gapSamples: number,
  crossfadeSamples: number,
): Float32Array {
  if (segments.length === 0) return new Float32Array(0);
  if (segments.length === 1) return segments[0]!.slice();

  if (crossfadeSamples > 0) {
    let acc: Float32Array = segments[0]!.slice();
    for (let i = 1; i < segments.length; i++) {
      acc = applyLinearCrossfade(acc, segments[i]!, crossfadeSamples);
    }
    return acc;
  }

  const gap = generateSilence(gapSamples);
  let total = 0;
  for (let i = 0; i < segments.length; i++) {
    total += segments[i]!.length;
  }
  total += gap.length * (segments.length - 1);

  const out = new Float32Array(total);
  let pos = 0;
  for (let i = 0; i < segments.length; i++) {
    out.set(segments[i]!, pos);
    pos += segments[i]!.length;
    if (i < segments.length - 1) {
      out.set(gap, pos);
      pos += gap.length;
    }
  }
  return out;
}

// ---- Total duration calculator ----

/**
 * Compute the total output duration (seconds) for a merge of the given
 * segment lengths. If crossfadeMs > 0, subtracts the overlap (one per join).
 * Otherwise, if gapMs > 0, adds the gap (one per join).
 */
export function computeTotalDuration(
  segmentLengths: number[],
  sampleRate: number,
  gapMs: number,
  crossfadeMs: number,
): number {
  if (segmentLengths.length === 0 || sampleRate <= 0) return 0;
  let totalSamples = segmentLengths.reduce((s, n) => s + n, 0);
  const joins = segmentLengths.length - 1;
  if (crossfadeMs > 0 && joins > 0) {
    const crossfadeSamples = (crossfadeMs / 1000) * sampleRate;
    totalSamples -= crossfadeSamples * joins;
    if (totalSamples < 0) totalSamples = 0;
  } else if (gapMs > 0 && joins > 0) {
    const gapSamples = (gapMs / 1000) * sampleRate;
    totalSamples += gapSamples * joins;
  }
  return totalSamples / sampleRate;
}

// ---- File size estimator ----

/**
 * Estimate WAV file size:
 *   header (44 bytes) + samples × channels × 2 bytes (16-bit)
 */
export function estimateWavSizeBytes(
  sampleCount: number,
  channels: number,
  bitsPerSample = 16,
): number {
  return 44 + sampleCount * channels * (bitsPerSample / 8);
}

// ---- WAV header builder (44-byte RIFF) ----

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
  view.setUint32(16, 16, true);             // subchunk1 size
  view.setUint16(20, 1, true);              // audio format = PCM
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
    let s = samples[i]!;
    if (s > 1) s = 1;
    else if (s < -1) s = -1;
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
  const length = channels[0]!.length;
  const out = new Float32Array(length * channels.length);
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < channels.length; c++) {
      out[i * channels.length + c] = channels[c]![i]!;
    }
  }
  return out;
}

/**
 * Build a complete WAV file (header + interleaved 16-bit PCM data) from
 * per-channel Float32 sample arrays. Pure helper.
 */
export function encodeWav(
  channels: Float32Array[],
  sampleRate: number,
): Uint8Array {
  if (channels.length === 0) {
    return buildWavHeader(0, sampleRate, 1);
  }
  const interleaved = interleaveChannels(channels);
  const pcm = floatSamplesTo16BitPCM(interleaved);
  const header = buildWavHeader(pcm.length, sampleRate, channels.length);
  const out = new Uint8Array(header.length + pcm.length);
  out.set(header, 0);
  out.set(pcm, header.length);
  return out;
}

// ---- Filename generator ----

/** Generate filename: merged-YYYY-MM-DD-HHmmss.wav. */
export function generateFilename(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  const hh = pad2(date.getHours());
  const mm = pad2(date.getMinutes());
  const ss = pad2(date.getSeconds());
  return `merged-${y}-${m}-${d}-${hh}${mm}${ss}.wav`;
}

// ---- Validation ----

/** Validate the list of segments before merging. */
export function validateMerge(segments: SegmentInfo[]): ValidationResult {
  if (segments.length === 0) {
    return { ok: false, error: "Add at least one audio file to merge." };
  }
  if (segments.length === 1) {
    return { ok: false, error: "Add at least two audio files to merge." };
  }
  for (const s of segments) {
    if (s.length === 0) {
      return { ok: false, error: `Segment "${s.fileName}" has no audio data.` };
    }
    if (s.sampleRate <= 0) {
      return { ok: false, error: `Segment "${s.fileName}" has an invalid sample rate.` };
    }
    if (s.channels <= 0) {
      return { ok: false, error: `Segment "${s.fileName}" has an invalid channel count.` };
    }
  }
  return { ok: true };
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:audio-merger:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  segmentCount: number;
  totalDurationMs: number;
  outputSizeBytes: number;
  sampleRate: number;
  channels: number;
  gapMs: number;
  crossfadeMs: number;
  fileNames: string[];
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
  segmentCount: number;
  totalDurationSeconds: number;
  outputSizeBytes: number;
  sampleRate: number;
  channels: number;
  gapCount: number;
  crossfadeCount: number;
  joins: number;
}

export function computeSummaryStats(
  segments: SegmentInfo[],
  totalDurationSeconds: number,
  outputSizeBytes: number,
  gapMs: number,
  crossfadeMs: number,
): SummaryStats {
  const segmentCount = segments.length;
  const sampleRate = segments.length > 0 ? unifySampleRate(segments.map((s) => s.sampleRate)) : 0;
  const channels = segments.length > 0 ? unifyChannels(segments.map((s) => s.channels)) : 0;
  const joins = Math.max(0, segmentCount - 1);
  return {
    segmentCount,
    totalDurationSeconds,
    outputSizeBytes,
    sampleRate,
    channels,
    gapCount: crossfadeMs > 0 ? 0 : gapMs > 0 ? joins : 0,
    crossfadeCount: crossfadeMs > 0 ? joins : 0,
    joins,
  };
}

// ---- Shareable URL ----

export interface ShareSettings {
  gapMs: number;
  crossfadeMs: number;
}

export function buildShareUrl(settings: ShareSettings): string {
  const params = new URLSearchParams();
  params.set("gap", String(settings.gapMs));
  params.set("crossfade", String(settings.crossfadeMs));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ShareSettings> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<ShareSettings> = {};
  const gap = params.get("gap");
  if (gap !== null) {
    const n = Number(gap);
    if (Number.isFinite(n) && n >= 0) out.gapMs = n;
  }
  const cf = params.get("crossfade");
  if (cf !== null) {
    const n = Number(cf);
    if (Number.isFinite(n) && n >= 0) out.crossfadeMs = n;
  }
  return out;
}

// ---- Preset helpers ----

/** Convert a gap preset to its millisecond value. */
export function gapPresetToMs(preset: GapPreset): number {
  return GAP_PRESETS_MS[preset];
}

/** Convert a crossfade preset to its millisecond value. */
export function crossfadePresetToMs(preset: CrossfadePreset): number {
  return CROSSFADE_PRESETS_MS[preset];
}

/** Convert a gap preset to a sample count given a sample rate. */
export function gapPresetToSamples(preset: GapPreset, sampleRate: number): number {
  return Math.round((GAP_PRESETS_MS[preset] / 1000) * sampleRate);
}

/** Convert a crossfade preset to a sample count given a sample rate. */
export function crossfadePresetToSamples(preset: CrossfadePreset, sampleRate: number): number {
  return Math.round((CROSSFADE_PRESETS_MS[preset] / 1000) * sampleRate);
}
