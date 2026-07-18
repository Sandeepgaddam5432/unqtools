/**
 * Video Frame Extractor — pure logic.
 *
 * Pure helpers only — no DOM, no <video>, no Canvas. The actual frame
 * capture happens in ui.tsx via the HTML5 <video> element's seeked event
 * (or requestVideoFrameCallback when available) and a Canvas element.
 *
 * This module contains:
 *   - Extraction mode presets (single, sequence, interval)
 *   - Timestamp parser (4 formats: seconds, decimal, MM:SS, HH:MM:SS)
 *   - Timestamp list parser
 *   - 6 interval presets
 *   - 3 output format presets (PNG, JPEG, WebP)
 *   - 4 JPEG quality presets
 *   - Frame filename generator (zero-padded frame-001.png)
 *   - Frame count calculator (interval mode)
 *   - Pure-JS ZIP archive builder (STORE method, no deps)
 *   - Resolution calculator (full / half / quarter)
 *   - Text + CSV report renderers
 *   - History (localStorage, last 20)
 *   - Shareable URL (URLSearchParams)
 *   - Summary stats
 */

// ---- Extraction modes ----

export type ExtractionMode = "single" | "sequence" | "interval";

export const MODE_LABELS: Record<ExtractionMode, string> = {
  "single": "Single frame — capture one frame at a timestamp",
  "sequence": "Sequence — capture a frame at each timestamp in a list",
  "interval": "Interval — capture a frame every N seconds",
};

// ---- Interval presets ----

export type IntervalPreset = "1s" | "5s" | "10s" | "30s" | "1min" | "5min";

export const INTERVAL_PRESETS: Record<IntervalPreset, number> = {
  "1s": 1,
  "5s": 5,
  "10s": 10,
  "30s": 30,
  "1min": 60,
  "5min": 300,
};

export const INTERVAL_LABELS: Record<IntervalPreset, string> = {
  "1s": "Every 1 second",
  "5s": "Every 5 seconds",
  "10s": "Every 10 seconds",
  "30s": "Every 30 seconds",
  "1min": "Every 1 minute",
  "5min": "Every 5 minutes",
};

// ---- Output formats ----

export type OutputFormat = "png" | "jpeg" | "webp";

export const FORMAT_MIME: Record<OutputFormat, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

export const FORMAT_LABELS: Record<OutputFormat, string> = {
  png: "PNG (lossless)",
  jpeg: "JPEG (smaller, lossy)",
  webp: "WebP (modern, smaller)",
};

export const FORMAT_EXTENSIONS: Record<OutputFormat, string> = {
  png: "png",
  jpeg: "jpg",
  webp: "webp",
};

// ---- JPEG quality presets ----

export type JpegQualityPreset = "50%" | "75%" | "90%" | "100%";

export const JPEG_QUALITY_VALUES: Record<JpegQualityPreset, number> = {
  "50%": 0.5,
  "75%": 0.75,
  "90%": 0.9,
  "100%": 1.0,
};

export const JPEG_QUALITY_LABELS: Record<JpegQualityPreset, string> = {
  "50%": "50% (smaller file)",
  "75%": "75% (balanced)",
  "90%": "90% (high quality)",
  "100%": "100% (best quality)",
};

// ---- Resolution scaling ----

export type ResolutionScale = "full" | "half" | "quarter";

export const RESOLUTION_SCALE_VALUES: Record<ResolutionScale, number> = {
  "full": 1,
  "half": 0.5,
  "quarter": 0.25,
};

export const RESOLUTION_SCALE_LABELS: Record<ResolutionScale, string> = {
  "full": "Full resolution (100%)",
  "half": "Half resolution (50%)",
  "quarter": "Quarter resolution (25%)",
};

/** Calculate the scaled width and height for the given source dimensions. */
export function calculateScaledResolution(
  sourceWidth: number,
  sourceHeight: number,
  scale: ResolutionScale,
): { width: number; height: number } {
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    return { width: 0, height: 0 };
  }
  const factor = RESOLUTION_SCALE_VALUES[scale];
  const width = Math.max(1, Math.round(sourceWidth * factor));
  const height = Math.max(1, Math.round(sourceHeight * factor));
  return { width, height };
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
export function parseTimestamp(input: string): number {
  if (typeof input !== "string") return Number.NaN;
  const s = input.trim();
  if (s === "") return Number.NaN;

  // HH:MM:SS or HH:MM:SS.ms
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

  // MM:SS or MM:SS.ms
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

  // Plain seconds
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : Number.NaN;
}

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

/**
 * Parse a list of timestamps separated by newlines, commas, semicolons, or
 * whitespace. Returns an array of seconds (invalid entries skipped).
 */
export function parseTimestampList(input: string): number[] {
  if (!input) return [];
  const parts = input.split(/[\n,;\s]+/).map((s) => s.trim()).filter(Boolean);
  const out: number[] = [];
  for (const p of parts) {
    const s = parseTimestamp(p);
    if (Number.isFinite(s) && s >= 0) out.push(s);
  }
  // Sort ascending and dedupe (within 0.01 s tolerance)
  const sorted = out.sort((a, b) => a - b);
  const deduped: number[] = [];
  for (const t of sorted) {
    if (deduped.length === 0 || Math.abs(t - deduped[deduped.length - 1]!) > 0.01) {
      deduped.push(t);
    }
  }
  return deduped;
}

// ---- Frame count calculator ----

/**
 * Compute the list of timestamps for interval mode given a total duration
 * and an interval in seconds. The first frame is at t=interval (NOT t=0)
 * so we don't extract a black frame at the very start; the last extracted
 * timestamp is the largest multiple of `interval` that is strictly less
 * than `totalDuration`.
 *
 * Returns an empty array if inputs are invalid.
 */
export function computeIntervalTimestamps(
  totalDuration: number,
  intervalSeconds: number,
  options?: { includeStart?: boolean },
): number[] {
  if (!Number.isFinite(totalDuration) || totalDuration <= 0) return [];
  if (!Number.isFinite(intervalSeconds) || intervalSeconds <= 0) return [];
  const includeStart = options?.includeStart ?? false;
  const out: number[] = [];
  if (includeStart) out.push(0);
  let t = intervalSeconds;
  // Cap iterations to avoid pathological inputs
  const maxIter = 10_000;
  let iter = 0;
  while (t < totalDuration && iter < maxIter) {
    out.push(t);
    t += intervalSeconds;
    iter++;
  }
  return out;
}

/** Compute the expected frame count for interval mode. */
export function computeFrameCount(
  totalDuration: number,
  intervalSeconds: number,
  options?: { includeStart?: boolean },
): number {
  return computeIntervalTimestamps(totalDuration, intervalSeconds, options).length;
}

// ---- Frame filename generator ----

/**
 * Generate a frame filename like "frame-001.png".
 * The zero-padding width is at least 3 digits, or wider if needed.
 */
export function generateFrameFilename(
  index: number,
  total: number,
  format: OutputFormat,
  prefix: string = "frame",
): string {
  const safeTotal = Math.max(1, total);
  const padLen = Math.max(3, String(safeTotal).length);
  const padded = String(index + 1).padStart(padLen, "0");
  const ext = FORMAT_EXTENSIONS[format];
  return `${prefix}-${padded}.${ext}`;
}

// ---- Validation ----

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

/** Validate a single timestamp against the total duration. */
export function validateTimestamp(
  timestamp: number,
  totalDuration: number,
): ValidationResult {
  if (!Number.isFinite(timestamp) || timestamp < 0) {
    return { ok: false, error: `Invalid timestamp: ${timestamp}.` };
  }
  if (totalDuration > 0 && timestamp >= totalDuration) {
    return {
      ok: false,
      error: `Timestamp ${formatTime(timestamp)} exceeds total duration (${formatTime(totalDuration)}).`,
    };
  }
  return { ok: true };
}

/** Validate a list of timestamps against the total duration. */
export function validateTimestamps(
  timestamps: number[],
  totalDuration: number,
): { ok: boolean; error?: string; valid: number[] } {
  if (timestamps.length === 0) {
    return { ok: false, error: "No timestamps provided.", valid: [] };
  }
  const valid: number[] = [];
  for (const t of timestamps) {
    const r = validateTimestamp(t, totalDuration);
    if (!r.ok) {
      return { ok: false, error: r.error, valid: [] };
    }
    valid.push(t);
  }
  return { ok: true, valid };
}

// ---- Pure-JS ZIP archive builder (STORE method, no deps) ----

export interface ZipFile { name: string; data: Uint8Array; }

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
    const size = file.data.length;

    if (size > 0xffffffff) {
      throw new Error(`File "${file.name}" exceeds 4 GB (ZIP64 not supported).`);
    }
    if (nameBytes.length > 65535) {
      throw new Error(`Filename "${file.name.slice(0, 40)}..." is too long.`);
    }

    const crc = crc32(file.data);

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

// ---- Frame result type ----

export interface FrameResult {
  index: number;            // 0-based
  timestampSeconds: number;
  filename: string;
  sizeBytes: number;
  mimeType: string;
}

export interface ExtractionSummary {
  mode: ExtractionMode;
  format: OutputFormat;
  totalFrames: number;
  totalSizeBytes: number;
  avgFrameSizeBytes: number;
  width: number;
  height: number;
}

/** Compute summary stats for a list of frame results. */
export function computeSummaryStats(
  frames: FrameResult[],
  mode: ExtractionMode,
  format: OutputFormat,
  width: number,
  height: number,
): ExtractionSummary {
  const totalFrames = frames.length;
  const totalSizeBytes = frames.reduce((s, f) => s + f.sizeBytes, 0);
  const avgFrameSizeBytes = totalFrames > 0 ? Math.round(totalSizeBytes / totalFrames) : 0;
  return {
    mode,
    format,
    totalFrames,
    totalSizeBytes,
    avgFrameSizeBytes,
    width,
    height,
  };
}

// ---- Text report ----

export function renderTextReport(
  frames: FrameResult[],
  summary: ExtractionSummary,
  originalFileName: string,
): string {
  const lines: string[] = [];
  lines.push("=== Video Frame Extraction Report ===");
  lines.push("");
  lines.push("SOURCE");
  lines.push(`  Original file : ${originalFileName}`);
  lines.push("");
  lines.push("SETTINGS");
  lines.push(`  Mode          : ${MODE_LABELS[summary.mode]}`);
  lines.push(`  Format        : ${FORMAT_LABELS[summary.format]}`);
  lines.push(`  Output size   : ${summary.width}×${summary.height}`);
  lines.push("");
  lines.push("SUMMARY");
  lines.push(`  Total frames  : ${summary.totalFrames}`);
  lines.push(`  Total size    : ${formatBytes(summary.totalSizeBytes)} (${summary.totalSizeBytes.toLocaleString()} B)`);
  lines.push(`  Avg frame size: ${formatBytes(summary.avgFrameSizeBytes)}`);
  lines.push("");
  lines.push("FRAMES");
  if (frames.length === 0) {
    lines.push("  (no frames)");
  } else {
    for (const f of frames) {
      lines.push(
        `  ${f.index + 1}. ${f.filename}  @ ${formatTime(f.timestampSeconds)}  (${formatBytes(f.sizeBytes)})`,
      );
    }
  }
  lines.push("");
  lines.push("=== End of report ===");
  return lines.join("\n");
}

// ---- CSV report ----

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function renderCsvReport(
  frames: FrameResult[],
  summary: ExtractionSummary,
  originalFileName: string,
): string {
  const lines: string[] = [];
  lines.push("field,value");
  lines.push(`source_file,${escapeCsv(originalFileName)}`);
  lines.push(`mode,${summary.mode}`);
  lines.push(`format,${summary.format}`);
  lines.push(`output_width,${summary.width}`);
  lines.push(`output_height,${summary.height}`);
  lines.push(`total_frames,${summary.totalFrames}`);
  lines.push(`total_size_bytes,${summary.totalSizeBytes}`);
  lines.push(`avg_frame_size_bytes,${summary.avgFrameSizeBytes}`);
  lines.push("");
  lines.push("frame_number,timestamp_seconds,timestamp_formatted,filename,size_bytes,mime_type");
  for (const f of frames) {
    lines.push([
      f.index + 1,
      f.timestampSeconds.toFixed(3),
      formatTime(f.timestampSeconds),
      escapeCsv(f.filename),
      f.sizeBytes,
      f.mimeType,
    ].join(","));
  }
  return lines.join("\n");
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:video-frame-extractor:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  originalName: string;
  mode: ExtractionMode;
  format: OutputFormat;
  scale: ResolutionScale;
  frameCount: number;
  totalOutputBytes: number;
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
  mode: ExtractionMode;
  timestamp: string;          // single mode
  timestamps: string;         // sequence mode
  intervalPreset: IntervalPreset;
  customInterval: string;
  format: OutputFormat;
  jpegQuality: JpegQualityPreset;
  scale: ResolutionScale;
}

export function buildShareUrl(s: ShareSettings): string {
  const params = new URLSearchParams();
  params.set("mode", s.mode);
  if (s.timestamp) params.set("t", s.timestamp);
  if (s.timestamps) params.set("ts", s.timestamps);
  if (s.intervalPreset) params.set("iv", s.intervalPreset);
  if (s.customInterval) params.set("civ", s.customInterval);
  if (s.format) params.set("fmt", s.format);
  if (s.jpegQuality) params.set("q", s.jpegQuality);
  if (s.scale) params.set("sc", s.scale);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

const VALID_MODES: ExtractionMode[] = ["single", "sequence", "interval"];
const VALID_FORMATS: OutputFormat[] = ["png", "jpeg", "webp"];
const VALID_INTERVALS: IntervalPreset[] = ["1s", "5s", "10s", "30s", "1min", "5min"];
const VALID_QUALITIES: JpegQualityPreset[] = ["50%", "75%", "90%", "100%"];
const VALID_SCALES: ResolutionScale[] = ["full", "half", "quarter"];

export function parseShareUrl(hash: string): Partial<ShareSettings> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<ShareSettings> = {};

  const mode = params.get("mode");
  if (mode && VALID_MODES.includes(mode as ExtractionMode)) {
    out.mode = mode as ExtractionMode;
  }
  const t = params.get("t");
  if (t !== null) out.timestamp = t;
  const ts = params.get("ts");
  if (ts !== null) out.timestamps = ts;
  const iv = params.get("iv");
  if (iv && VALID_INTERVALS.includes(iv as IntervalPreset)) {
    out.intervalPreset = iv as IntervalPreset;
  }
  const civ = params.get("civ");
  if (civ !== null) out.customInterval = civ;
  const fmt = params.get("fmt");
  if (fmt && VALID_FORMATS.includes(fmt as OutputFormat)) {
    out.format = fmt as OutputFormat;
  }
  const q = params.get("q");
  if (q && VALID_QUALITIES.includes(q as JpegQualityPreset)) {
    out.jpegQuality = q as JpegQualityPreset;
  }
  const sc = params.get("sc");
  if (sc && VALID_SCALES.includes(sc as ResolutionScale)) {
    out.scale = sc as ResolutionScale;
  }
  return out;
}
