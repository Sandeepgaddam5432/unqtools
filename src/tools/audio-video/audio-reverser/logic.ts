/**
 * Audio Reverser — pure logic.
 *
 * Pure helpers only — no DOM, no AudioContext. The actual decoding and
 * re-encoding happen in ui.tsx via Web Audio API. This module contains:
 * reverse modes & segment presets, full reverse, per-channel reverse,
 * segment-based reverse, interleaved reverse, fade in/out generator,
 * zero-crossing click detector, time & file-size estimators, 44-byte RIFF
 * WAV header builder, Float32 → 16-bit PCM converter, WAV encoder, filename
 * generator, history (localStorage), shareable URL, and summary stats.
 */

// ---- Reverse modes & segment presets ----

export type ReverseMode =
  | "full"
  | "per-channel"
  | "segment"
  | "interleaved";

export const REVERSE_MODES: ReverseMode[] = ["full", "per-channel", "segment", "interleaved"];

export const REVERSE_MODE_LABELS: Record<ReverseMode, string> = {
  "full": "Full — reverse the entire buffer end-to-start",
  "per-channel": "Per-channel — reverse each channel independently",
  "segment": "Segment — split into N segments, reverse each segment",
  "interleaved": "Interleaved — reverse an interleaved stereo stream",
};

export const REVERSE_MODE_DESCRIPTIONS: Record<ReverseMode, string> = {
  "full": "Standard reverse: the entire audio plays backwards. This is the default mode.",
  "per-channel": "Each channel's Float32Array is reversed independently. Functionally equivalent to Full for normal audio, but more explicit about how the operation works.",
  "segment": "Split the buffer into N equal segments and reverse each segment individually, keeping the segment order. Useful for creating stutter / glitch effects.",
  "interleaved": "Reverse an interleaved stereo stream (L R L R → R L R L). Different from per-channel: this changes channel order as well as time direction. Rarely needed.",
};

/** 5 segment count presets: 1, 2, 4, 8, 16. */
export const SEGMENT_PRESETS: number[] = [1, 2, 4, 8, 16];

export const DEFAULT_SEGMENTS = 1;

// ---- Full reverse (per-channel Float32Array) ----

/**
 * Reverse a Float32Array, returning a NEW array (does not mutate input).
 */
export function reverseSamples(samples: Float32Array): Float32Array {
  const len = samples.length;
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    out[i] = samples[len - 1 - i];
  }
  return out;
}

/**
 * Reverse each channel independently. Returns NEW Float32Arrays.
 */
export function reverseChannels(channels: Float32Array[]): Float32Array[] {
  return channels.map((c) => reverseSamples(c));
}

// ---- Segment reverse ----

/**
 * Split a Float32Array into `segmentCount` equal segments, reverse each
 * segment individually, and concatenate them back in the original segment
 * order. Returns a NEW Float32Array of the same length as the input.
 *
 * If the input length is not evenly divisible by segmentCount, the last
 * segment absorbs the remainder.
 */
export function reverseSegments(samples: Float32Array, segmentCount: number): Float32Array {
  const len = samples.length;
  if (len === 0) return new Float32Array(0);
  const segs = Math.max(1, Math.floor(segmentCount));
  if (segs === 1) return reverseSamples(samples);
  const segLen = Math.floor(len / segs);
  const out = new Float32Array(len);
  let offset = 0;
  for (let s = 0; s < segs; s++) {
    const start = s * segLen;
    const end = (s === segs - 1) ? len : (s + 1) * segLen;
    const segLenActual = end - start;
    for (let i = 0; i < segLenActual; i++) {
      out[offset + i] = samples[end - 1 - i];
    }
    offset += segLenActual;
  }
  return out;
}

/** Reverse each channel's segments. Returns NEW Float32Arrays. */
export function reverseChannelsSegments(channels: Float32Array[], segmentCount: number): Float32Array[] {
  return channels.map((c) => reverseSegments(c, segmentCount));
}

/**
 * Compute segment boundaries (sample indices) for a buffer of length N split
 * into `segmentCount` segments. Useful for the click detector.
 */
export function computeSegmentBoundaries(totalSamples: number, segmentCount: number): number[] {
  if (totalSamples === 0) return [];
  const segs = Math.max(1, Math.floor(segmentCount));
  if (segs === 1) return [0, totalSamples];
  const segLen = Math.floor(totalSamples / segs);
  const out: number[] = [];
  for (let s = 0; s < segs; s++) {
    out.push(s * segLen);
  }
  out.push(totalSamples);
  return out;
}

// ---- Interleaved reverse (stereo) ----

/**
 * Interleave multi-channel Float32 sample arrays into a single Float32Array.
 * (Same as audio-trimmer's helper — reproduced here so this module is self-contained.)
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

/**
 * De-interleave a single Float32Array back into N channel arrays.
 */
export function deinterleaveChannels(samples: Float32Array, channelCount: number): Float32Array[] {
  if (channelCount <= 0) return [];
  const frameCount = Math.floor(samples.length / channelCount);
  const out: Float32Array[] = [];
  for (let c = 0; c < channelCount; c++) {
    out.push(new Float32Array(frameCount));
  }
  for (let i = 0; i < frameCount; i++) {
    for (let c = 0; c < channelCount; c++) {
      out[c][i] = samples[i * channelCount + c];
    }
  }
  return out;
}

/**
 * Reverse an interleaved stream end-to-start. The sample at output index i
 * is the sample at input index (len-1-i). For stereo this swaps L/R ordering
 * per frame AND reverses time, producing a different effect than per-channel.
 *
 * Returns the reversed interleaved Float32Array.
 */
export function reverseInterleaved(samples: Float32Array, channelCount: number): Float32Array {
  const len = samples.length;
  const out = new Float32Array(len);
  // Reverse frame by frame so channel order within each frame is preserved
  // (i.e. L R L R L R → L R L R L R, but in reverse frame order).
  if (channelCount <= 1) {
    return reverseSamples(samples);
  }
  const frameCount = Math.floor(len / channelCount);
  for (let f = 0; f < frameCount; f++) {
    const srcFrame = frameCount - 1 - f;
    for (let c = 0; c < channelCount; c++) {
      out[f * channelCount + c] = samples[srcFrame * channelCount + c];
    }
  }
  // Copy any leftover samples (if len % channelCount != 0) verbatim
  for (let i = frameCount * channelCount; i < len; i++) {
    out[i] = samples[i];
  }
  return out;
}

/**
 * Convenience: reverse interleaved stereo from per-channel arrays and return
 * per-channel arrays (de-interleaved back). Functionally this is the same as
 * reverseChannels for typical use, but uses the interleaved code path.
 */
export function reverseInterleavedChannels(channels: Float32Array[]): Float32Array[] {
  if (channels.length === 0) return [];
  const interleaved = interleaveChannels(channels);
  const reversed = reverseInterleaved(interleaved, channels.length);
  return deinterleaveChannels(reversed, channels.length);
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

// ---- Click detector (zero-crossing analysis) ----

export interface ClickAnalysis {
  boundarySamples: number[]; // sample indices where boundaries occur
  hasClicks: boolean;
  clickCount: number;
  maxAmplitude: number; // max |sample| across all boundaries
}

/**
 * Analyze boundary samples for potential clicks. A boundary is "clicky" if
 * the sample at that index has an absolute value above `threshold` (default
 * 0.05 on the -1..1 scale). Returns the count of clicky boundaries.
 *
 * For full reverse, the only boundaries are the start (index 0) and end
 * (index length-1) of the buffer. For segment reverse, there are
 * `segmentCount + 1` boundaries.
 */
export function detectClicks(
  samples: Float32Array,
  boundaryIndices: number[],
  threshold = 0.05,
): ClickAnalysis {
  let clickCount = 0;
  let maxAmp = 0;
  for (const idx of boundaryIndices) {
    if (idx < 0 || idx >= samples.length) continue;
    const amp = Math.abs(samples[idx]);
    if (amp > maxAmp) maxAmp = amp;
    if (amp > threshold) clickCount++;
  }
  return {
    boundarySamples: boundaryIndices,
    hasClicks: clickCount > 0,
    clickCount,
    maxAmplitude: maxAmp,
  };
}

/** Detect clicks across multiple channels at shared boundary indices. */
export function detectClicksMulti(
  channels: Float32Array[],
  boundaryIndices: number[],
  threshold = 0.05,
): ClickAnalysis {
  let clickCount = 0;
  let maxAmp = 0;
  for (const idx of boundaryIndices) {
    let maxAtBoundary = 0;
    for (const c of channels) {
      if (idx < 0 || idx >= c.length) continue;
      const amp = Math.abs(c[idx]);
      if (amp > maxAtBoundary) maxAtBoundary = amp;
    }
    if (maxAtBoundary > maxAmp) maxAmp = maxAtBoundary;
    if (maxAtBoundary > threshold) clickCount++;
  }
  return {
    boundarySamples: boundaryIndices,
    hasClicks: clickCount > 0,
    clickCount,
    maxAmplitude: maxAmp,
  };
}

// ---- Time & file-size estimators ----

/** Reverse does not change duration. Returns the input unchanged. */
export function computeDuration(durationSeconds: number): number {
  return durationSeconds;
}

/**
 * Estimate WAV file size for the reversed output:
 *   header (44 bytes) + sampleCount × channels × 2 bytes (16-bit PCM)
 * Reverse doesn't change sample count.
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
 * Generate filename: reversed-<mode>-YYYY-MM-DD-HHmmss.wav.
 * For segment mode, include segment count: reversed-segment-N-...
 */
export function generateFilename(mode: ReverseMode, segments: number, date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  const hh = pad2(date.getHours());
  const mm = pad2(date.getMinutes());
  const ss = pad2(date.getSeconds());
  const segPart = mode === "segment" && segments > 1 ? `-${segments}` : "";
  return `reversed-${mode}${segPart}-${y}-${m}-${d}-${hh}${mm}${ss}.wav`;
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:audio-reverser:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  originalName: string;
  durationMs: number;
  mode: ReverseMode;
  segments: number;
  channels: number;
  sampleRate: number;
  outputSizeBytes: number;
  clickCount: number;
  appliedFadeMs: number;
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
  durationSeconds: number;
  channels: number;
  sampleRate: number;
  segmentCount: number;
  inputSizeBytes: number;
  outputSizeBytes: number;
  mode: ReverseMode;
  clickCount: number;
  appliedFadeMs: number;
}

export function computeSummaryStats(
  durationSeconds: number,
  channels: number,
  sampleRate: number,
  segmentCount: number,
  inputSizeBytes: number,
  outputSizeBytes: number,
  mode: ReverseMode,
  clickCount: number,
  appliedFadeMs: number,
): SummaryStats {
  return {
    durationSeconds,
    channels,
    sampleRate,
    segmentCount,
    inputSizeBytes,
    outputSizeBytes,
    mode,
    clickCount,
    appliedFadeMs,
  };
}

// ---- Shareable URL ----

export interface ShareSettings {
  mode: ReverseMode;
  segments: number;
  applyFade: boolean;
  fadeMs: number;
}

export function buildShareUrl(settings: ShareSettings): string {
  const params = new URLSearchParams();
  params.set("mode", settings.mode);
  if (settings.mode === "segment") params.set("segs", String(settings.segments));
  params.set("fade", settings.applyFade ? "1" : "0");
  if (settings.applyFade) params.set("fadems", String(settings.fadeMs));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ShareSettings> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<ShareSettings> = {};
  const mode = params.get("mode");
  if (mode && REVERSE_MODES.includes(mode as ReverseMode)) {
    out.mode = mode as ReverseMode;
  }
  const segs = params.get("segs");
  if (segs !== null) {
    const n = parseInt(segs, 10);
    if (Number.isFinite(n) && n > 0) out.segments = n;
  }
  const fade = params.get("fade");
  if (fade === "1") out.applyFade = true;
  else if (fade === "0") out.applyFade = false;
  const fadeMs = params.get("fadems");
  if (fadeMs !== null) {
    const n = parseFloat(fadeMs);
    if (Number.isFinite(n) && n >= 0) out.fadeMs = n;
  }
  return out;
}
