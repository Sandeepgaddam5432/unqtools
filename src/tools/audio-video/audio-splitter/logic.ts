/**
 * Audio Splitter — pure logic.
 *
 * Pure helpers only — no DOM, no AudioContext. The actual decoding and
 * per-segment WAV encoding happens in ui.tsx via Web Audio API. This module
 * contains: four split modes, equal-duration split calculator, silence
 * detector (amplitude threshold + min duration), manual timestamp parser
 * (4 time formats), split-point validator, segment extractor, per-segment
 * WAV encoder (44-byte RIFF, 16-bit PCM), pure-JS ZIP archive builder
 * (STORE method, no deps), per-segment filename generator, history
 * (localStorage), shareable URL, summary stats, and silence threshold /
 * min-duration presets.
 */

// ---- Split modes ----

export type SplitMode = "equal-count" | "equal-duration" | "silence" | "manual";

export const MODE_LABELS: Record<SplitMode, string> = {
  "equal-count": "Equal count — split into N parts",
  "equal-duration": "Equal duration — each part = X seconds",
  "silence": "Silence detection — auto-split at quiet points",
  "manual": "Manual timestamps — split at user points",
};

// ---- Silence presets ----

export type SilenceThresholdPreset = "-30dB" | "-40dB" | "-50dB" | "-60dB" | "-80dB";
export type SilenceMinDurationPreset = "100ms" | "250ms" | "500ms" | "1s" | "2s";

export const SILENCE_THRESHOLD_DB: Record<SilenceThresholdPreset, number> = {
  "-30dB": -30,
  "-40dB": -40,
  "-50dB": -50,
  "-60dB": -60,
  "-80dB": -80,
};

export const SILENCE_THRESHOLD_LABELS: Record<SilenceThresholdPreset, string> = {
  "-30dB": "−30 dB (loud)",
  "-40dB": "−40 dB",
  "-50dB": "−50 dB (default)",
  "-60dB": "−60 dB",
  "-80dB": "−80 dB (very quiet)",
};

export const SILENCE_MIN_MS: Record<SilenceMinDurationPreset, number> = {
  "100ms": 100,
  "250ms": 250,
  "500ms": 500,
  "1s": 1000,
  "2s": 2000,
};

export const SILENCE_MIN_LABELS: Record<SilenceMinDurationPreset, string> = {
  "100ms": "100 ms",
  "250ms": "250 ms",
  "500ms": "500 ms (default)",
  "1s": "1 second",
  "2s": "2 seconds",
};

// ---- Types ----

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

export interface SilenceRegion {
  startSample: number;
  endSample: number;
  length: number;
  durationSeconds: number;
}

export interface ZipFile { name: string; data: Uint8Array; }

// ---- Time / byte formatting ----

/** Format seconds as MM:SS.ms. */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const totalMs = Math.round(seconds * 1000);
  const minutes = Math.floor(totalMs / 60_000);
  const secs = Math.floor((totalMs % 60_000) / 1000);
  const ms = totalMs % 1000;
  return `${pad2(minutes)}:${pad2(secs)}.${pad3(ms)}`;
}

/** Format seconds as HH:MM:SS. */
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

// ---- Time parsing (4 formats) ----

/**
 * Parse a time string in any of:
 *   - "12"        → 12 seconds
 *   - "12.5"      → 12.5 seconds
 *   - "01:30"     → MM:SS = 90 seconds
 *   - "01:30.250" → MM:SS.ms = 90.25 seconds
 *   - "01:02:03"  → HH:MM:SS = 3723 seconds
 * Returns NaN for unparseable input.
 */
export function parseTime(input: string): number {
  if (typeof input !== "string") return Number.NaN;
  const s = input.trim();
  if (s === "") return Number.NaN;

  if (s.indexOf(":") !== s.lastIndexOf(":")) {
    const m = s.match(/^(\d+):(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/);
    if (m) {
      const h = parseInt(m[1]!, 10);
      const min = parseInt(m[2]!, 10);
      const sec = parseFloat(m[3]!);
      if (min >= 60 || sec >= 60) return Number.NaN;
      return h * 3600 + min * 60 + sec;
    }
    return Number.NaN;
  }

  if (s.includes(":")) {
    const m = s.match(/^(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/);
    if (m) {
      const min = parseInt(m[1]!, 10);
      const sec = parseFloat(m[2]!);
      if (sec >= 60) return Number.NaN;
      return min * 60 + sec;
    }
    return Number.NaN;
  }

  const n = parseFloat(s);
  return Number.isFinite(n) ? n : Number.NaN;
}

/**
 * Parse a list of timestamps separated by newlines, commas, semicolons, or
 * whitespace. Examples:
 *   "0:00, 1:30, 3:45"
 *   "10\n20\n30"
 *   "5 10 15"
 * Returns an array of seconds (invalid entries are skipped).
 */
export function parseTimestamps(input: string): number[] {
  if (!input) return [];
  const parts = input.split(/[\n,;\s]+/).map((s) => s.trim()).filter(Boolean);
  const out: number[] = [];
  for (const p of parts) {
    const s = parseTime(p);
    if (Number.isFinite(s) && s >= 0) out.push(s);
  }
  return out;
}

// ---- Equal duration split calculator ----

/**
 * Compute split point sample indices (NOT including 0 or total) for
 * equal-duration splitting.
 *   - If `count` is given (≥2): split into `count` equal parts.
 *   - Else if `durationSeconds` is given (>0): split into parts of that duration.
 * Returns an array of split sample indices.
 */
export function computeEqualSplitPoints(
  totalSamples: number,
  sampleRate: number,
  options: { count?: number; durationSeconds?: number },
): number[] {
  if (totalSamples <= 0 || sampleRate <= 0) return [];
  const points: number[] = [];

  if (options.count && options.count >= 2) {
    const n = options.count;
    const partSize = totalSamples / n;
    for (let i = 1; i < n; i++) {
      points.push(Math.floor(partSize * i));
    }
    return points;
  }

  if (options.durationSeconds && options.durationSeconds > 0) {
    const partSamples = Math.floor(options.durationSeconds * sampleRate);
    if (partSamples <= 0) return [];
    let pos = partSamples;
    while (pos < totalSamples) {
      points.push(pos);
      pos += partSamples;
    }
    return points;
  }

  return [];
}

// ---- Silence detector ----

/** Convert dBFS to linear amplitude. -Infinity → 0. */
export function dbToAmplitude(db: number): number {
  if (!Number.isFinite(db)) return 0;
  return Math.pow(10, db / 20);
}

/** Convert linear amplitude to dBFS. 0 → -Infinity. */
export function amplitudeToDb(amp: number): number {
  if (amp <= 0) return Number.NEGATIVE_INFINITY;
  return 20 * Math.log10(amp);
}

/**
 * Detect silence regions in a Float32 sample buffer.
 * A "silent" sample has amplitude (|sample|) below `thresholdAmplitude`
 * (linear, NOT dB). A silence region is a run of silent samples whose
 * duration exceeds `minDurationMs`. Returns start/end sample indices.
 */
export function detectSilence(
  samples: Float32Array,
  sampleRate: number,
  thresholdAmplitude: number,
  minDurationMs: number,
): SilenceRegion[] {
  if (samples.length === 0 || sampleRate <= 0) return [];
  const minSamples = Math.floor((minDurationMs / 1000) * sampleRate);
  const regions: SilenceRegion[] = [];
  let runStart = -1;
  for (let i = 0; i < samples.length; i++) {
    const amp = Math.abs(samples[i]!);
    if (amp < thresholdAmplitude) {
      if (runStart < 0) runStart = i;
    } else if (runStart >= 0) {
      const len = i - runStart;
      if (len >= minSamples) {
        regions.push({
          startSample: runStart,
          endSample: i,
          length: len,
          durationSeconds: len / sampleRate,
        });
      }
      runStart = -1;
    }
  }
  // Final run (extends to end of buffer)
  if (runStart >= 0) {
    const len = samples.length - runStart;
    if (len >= minSamples) {
      regions.push({
        startSample: runStart,
        endSample: samples.length,
        length: len,
        durationSeconds: len / sampleRate,
      });
    }
  }
  return regions;
}

/** Convert silence regions to split points (midpoint of each region). */
export function silenceRegionsToSplitPoints(regions: SilenceRegion[]): number[] {
  return regions.map((r) => Math.floor((r.startSample + r.endSample) / 2));
}

// ---- Split point validator ----

/**
 * Validate split points (in seconds) against total duration.
 *   - Must be > 0 and < totalDuration (if totalDuration > 0)
 *   - Must be strictly increasing (no duplicates)
 * Returns sorted unique points if valid.
 */
export function validateSplitPoints(
  pointsSeconds: number[],
  totalDurationSeconds: number,
): { ok: boolean; error?: string; sorted: number[] } {
  if (pointsSeconds.length === 0) {
    return { ok: false, error: "No split points provided.", sorted: [] };
  }
  for (const p of pointsSeconds) {
    if (!Number.isFinite(p) || p < 0) {
      return { ok: false, error: `Invalid split point: ${p}.`, sorted: [] };
    }
    if (p === 0) {
      return { ok: false, error: "Split point at 0 is not allowed (it's the start).", sorted: [] };
    }
    if (totalDurationSeconds > 0 && p >= totalDurationSeconds) {
      return {
        ok: false,
        error: `Split point ${formatTime(p)} exceeds total duration (${formatTime(totalDurationSeconds)}).`,
        sorted: [],
      };
    }
  }
  const sorted = [...pointsSeconds].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1]) {
      return { ok: false, error: `Duplicate split point at ${formatTime(sorted[i]!)}.`, sorted: [] };
    }
  }
  return { ok: true, sorted };
}

// ---- Segment extractor ----

/**
 * Extract a segment from a Float32Array between startSample (inclusive) and
 * endSample (exclusive). Returns a copy of the subarray.
 */
export function extractSegment(
  samples: Float32Array,
  startSample: number,
  endSample: number,
): Float32Array {
  const start = Math.max(0, Math.floor(startSample));
  const end = Math.max(start, Math.min(Math.floor(endSample), samples.length));
  return samples.slice(start, end);
}

// ---- WAV encoder (44-byte RIFF, 16-bit PCM) ----

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
  view.setUint16(20, 1, true);
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

/** Apply linear fade in to the first `fadeSamples` samples (in place). */
export function applyFadeIn(samples: Float32Array, fadeSamples: number): void {
  const n = Math.max(0, Math.min(Math.floor(fadeSamples), samples.length));
  for (let i = 0; i < n; i++) {
    samples[i] = (samples[i] ?? 0) * (i / n);
  }
}

/** Apply linear fade out to the last `fadeSamples` samples (in place). */
export function applyFadeOut(samples: Float32Array, fadeSamples: number): void {
  const n = Math.max(0, Math.min(Math.floor(fadeSamples), samples.length));
  const len = samples.length;
  for (let j = 0; j < n; j++) {
    samples[len - 1 - j] = (samples[len - 1 - j] ?? 0) * (j / n);
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

/** Interleave multi-channel Float32 sample arrays into one Float32Array. */
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
 * per-channel Float32 sample arrays. Applies fade in/out on copies (does
 * NOT mutate the input arrays).
 */
export function encodeWav(
  channels: Float32Array[],
  sampleRate: number,
  fadeInSamples = 0,
  fadeOutSamples = 0,
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
  const header = buildWavHeader(pcm.length, sampleRate, copies.length);
  const out = new Uint8Array(header.length + pcm.length);
  out.set(header, 0);
  out.set(pcm, header.length);
  return out;
}

// ---- Pure-JS ZIP archive builder (STORE method, no deps) ----

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Build a ZIP archive (STORE method — no compression) from binary entries.
 * Returns a Uint8Array. Each entry contributes:
 *   - Local file header (30 bytes + name)
 *   - File data
 *   - Central directory entry (46 bytes + name)
 * At the end, an End of Central Directory (EOCD, 22 bytes) record is appended.
 *
 * Limitation: 4 GB max per file and total (no ZIP64). Filename ≤ 65535 bytes.
 */
export function buildZip(files: ZipFile[]): Uint8Array {
  if (files.length === 0) {
    // Return a valid empty ZIP (just EOCD)
    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    return eocd;
  }

  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  const enc = new TextEncoder();

  for (const file of files) {
    const nameBytes = enc.encode(file.name);
    const crc = crc32(file.data);
    const size = file.data.length;

    if (size > 0xffffffff) {
      throw new Error(`File "${file.name}" exceeds 4 GB (ZIP64 not supported).`);
    }
    if (nameBytes.length > 65535) {
      throw new Error(`Filename "${file.name.slice(0, 40)}..." is too long.`);
    }

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true); // local file header signature
    lv.setUint16(4, 20, true);         // version needed
    lv.setUint16(6, 0, true);          // general purpose bit flag
    lv.setUint16(8, 0, true);          // compression method = STORE
    lv.setUint16(10, 0, true);         // last mod time
    lv.setUint16(12, 0, true);         // last mod date
    lv.setUint32(14, crc, true);       // CRC-32
    lv.setUint32(18, size, true);      // compressed size
    lv.setUint32(22, size, true);      // uncompressed size
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);         // extra field length
    localHeader.set(nameBytes, 30);
    localParts.push(localHeader);
    localParts.push(file.data);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true); // central dir signature
    cv.setUint16(4, 20, true);         // version made by
    cv.setUint16(6, 20, true);         // version needed
    cv.setUint16(8, 0, true);          // bit flag
    cv.setUint16(10, 0, true);         // compression = STORE
    cv.setUint16(12, 0, true);         // last mod time
    cv.setUint16(14, 0, true);         // last mod date
    cv.setUint32(16, crc, true);       // CRC-32
    cv.setUint32(20, size, true);      // compressed size
    cv.setUint32(24, size, true);      // uncompressed size
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);         // extra field length
    cv.setUint16(32, 0, true);         // comment length
    cv.setUint16(34, 0, true);         // disk number start
    cv.setUint16(36, 0, true);         // internal attrs
    cv.setUint32(38, 0, true);         // external attrs
    cv.setUint32(42, offset, true);    // local header offset
    centralHeader.set(nameBytes, 46);
    centralParts.push(centralHeader);

    offset += localHeader.length + file.data.length;
  }

  const centralSize = centralParts.reduce((s, p) => s + p.length, 0);
  const centralOffset = offset;
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);   // EOCD signature
  ev.setUint16(4, 0, true);            // disk number
  ev.setUint16(6, 0, true);            // disk with central dir
  ev.setUint16(8, files.length, true); // entries on this disk
  ev.setUint16(10, files.length, true); // total entries
  ev.setUint32(12, centralSize, true); // central dir size
  ev.setUint32(16, centralOffset, true); // central dir offset
  ev.setUint16(20, 0, true);           // comment length

  const allParts = [...localParts, ...centralParts, eocd];
  const totalLength = allParts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(totalLength);
  let pos = 0;
  for (const p of allParts) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}

/** Convenience wrapper: build a ZIP and return as a Blob. */
export function createZipBlob(files: ZipFile[]): Blob {
  const bytes = buildZip(files);
  return new Blob([bytes.buffer as ArrayBuffer], { type: "application/zip" });
}

// ---- Per-segment filename generator ----

/**
 * Generate a per-segment filename like "split-001.wav".
 * The zero-padding width is at least 3 digits, or wider if needed.
 */
export function generateSegmentFilename(
  index: number,
  total: number,
  ext: string = "wav",
  prefix: string = "split",
): string {
  const safeTotal = Math.max(1, total);
  const padLen = Math.max(3, String(safeTotal).length);
  const padded = String(index + 1).padStart(padLen, "0");
  const safeExt = ext.startsWith(".") ? ext.slice(1) : ext;
  return `${prefix}-${padded}.${safeExt}`;
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:audio-splitter:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  originalName: string;
  originalDurationMs: number;
  segmentCount: number;
  mode: SplitMode;
  totalOutputBytes: number;
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

export interface SegmentStats {
  durationSeconds: number;
  sizeBytes: number;
}

export interface SummaryStats {
  segmentCount: number;
  totalDurationSeconds: number;
  totalOutputBytes: number;
  avgSegmentSeconds: number;
  minSegmentSeconds: number;
  maxSegmentSeconds: number;
  sampleRate: number;
  channels: number;
}

export function computeSummaryStats(
  segments: SegmentStats[],
  totalDurationSeconds: number,
  sampleRate: number,
  channels: number,
): SummaryStats {
  const segmentCount = segments.length;
  const totalOutputBytes = segments.reduce((s, x) => s + x.sizeBytes, 0);
  if (segmentCount === 0) {
    return {
      segmentCount: 0,
      totalDurationSeconds,
      totalOutputBytes,
      avgSegmentSeconds: 0,
      minSegmentSeconds: 0,
      maxSegmentSeconds: 0,
      sampleRate,
      channels,
    };
  }
  const durations = segments.map((s) => s.durationSeconds);
  const sum = durations.reduce((s, x) => s + x, 0);
  const min = durations.reduce((m, x) => (x < m ? x : m), durations[0]!);
  const max = durations.reduce((m, x) => (x > m ? x : m), durations[0]!);
  return {
    segmentCount,
    totalDurationSeconds,
    totalOutputBytes,
    avgSegmentSeconds: sum / segmentCount,
    minSegmentSeconds: min,
    maxSegmentSeconds: max,
    sampleRate,
    channels,
  };
}

// ---- Shareable URL ----

export interface ShareSettings {
  mode: SplitMode;
  count: number;
  durationSeconds: number;
  thresholdDb: number;
  minSilenceMs: number;
  manualTimestamps: string;
}

export function buildShareUrl(settings: ShareSettings): string {
  const params = new URLSearchParams();
  params.set("mode", settings.mode);
  if (settings.count > 0) params.set("count", String(settings.count));
  if (settings.durationSeconds > 0) params.set("dur", String(settings.durationSeconds));
  if (Number.isFinite(settings.thresholdDb)) params.set("thr", String(settings.thresholdDb));
  if (settings.minSilenceMs > 0) params.set("min", String(settings.minSilenceMs));
  if (settings.manualTimestamps) params.set("ts", settings.manualTimestamps);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ShareSettings> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<ShareSettings> = {};
  const mode = params.get("mode");
  if (mode && mode in MODE_LABELS) out.mode = mode as SplitMode;
  const count = params.get("count");
  if (count !== null) {
    const n = Number(count);
    if (Number.isFinite(n) && n > 0) out.count = n;
  }
  const dur = params.get("dur");
  if (dur !== null) {
    const n = Number(dur);
    if (Number.isFinite(n) && n > 0) out.durationSeconds = n;
  }
  const thr = params.get("thr");
  if (thr !== null) {
    const n = Number(thr);
    if (Number.isFinite(n)) out.thresholdDb = n;
  }
  const min = params.get("min");
  if (min !== null) {
    const n = Number(min);
    if (Number.isFinite(n) && n > 0) out.minSilenceMs = n;
  }
  const ts = params.get("ts");
  if (ts !== null) out.manualTimestamps = ts;
  return out;
}
