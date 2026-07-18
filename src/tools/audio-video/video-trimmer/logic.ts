/**
 * Video Trimmer — pure logic.
 *
 * Pure helpers only — no DOM, no <video>, no AudioContext, no MediaRecorder.
 * The actual frame capture and re-encoding happens in ui.tsx via the
 * HTML5 <video> + <canvas> + MediaRecorder pipeline. This module contains:
 * time parsing/formatting (4 formats), trim validation, output-format
 * support lookup (MediaRecorder.isTypeSupported), bitrate / frame-rate /
 * resolution presets, fade in/out presets, file-size estimator, filename
 * generator, history (localStorage), shareable URL, and summary stats.
 */

export type BitratePreset = "low" | "medium" | "high" | "very-high";
export type FrameRatePreset = "24" | "30" | "60";
export type ResolutionPreset = "480p" | "720p" | "1080p" | "original";
export type OutputFormat = "webm" | "mp4";
export type FadePreset = "0ms" | "250ms" | "500ms" | "1s" | "2s";

/** Bitrate presets in bits per second. */
export const BITRATE_PRESETS: Record<BitratePreset, number> = {
  low: 1_000_000,
  medium: 2_500_000,
  high: 5_000_000,
  "very-high": 8_000_000,
};

export const BITRATE_LABELS: Record<BitratePreset, string> = {
  low: "Low — 1 Mbps",
  medium: "Medium — 2.5 Mbps",
  high: "High — 5 Mbps",
  "very-high": "Very high — 8 Mbps",
};

/** Frame-rate presets in frames per second. */
export const FRAMERATE_PRESETS: Record<FrameRatePreset, number> = {
  "24": 24,
  "30": 30,
  "60": 60,
};

export const FRAMERATE_LABELS: Record<FrameRatePreset, string> = {
  "24": "24 fps (cinema)",
  "30": "30 fps (web)",
  "60": "60 fps (smooth)",
};

/** Resolution presets as target heights. "original" keeps source height. */
export const RESOLUTION_HEIGHTS: Record<ResolutionPreset, number> = {
  "480p": 480,
  "720p": 720,
  "1080p": 1080,
  original: 0, // 0 = keep source
};

export const RESOLUTION_LABELS: Record<ResolutionPreset, string> = {
  "480p": "480p (SD)",
  "720p": "720p (HD)",
  "1080p": "1080p (Full HD)",
  original: "Original (keep source)",
};

/** Fade presets in milliseconds. */
export const FADE_PRESETS_MS: Record<FadePreset, number> = {
  "0ms": 0,
  "250ms": 250,
  "500ms": 500,
  "1s": 1000,
  "2s": 2000,
};

export const FADE_LABELS: Record<FadePreset, string> = {
  "0ms": "None (0 ms)",
  "250ms": "250 ms",
  "500ms": "500 ms",
  "1s": "1 second",
  "2s": "2 seconds",
};

/** MIME types used for MediaRecorder (codec-suffixed where possible). */
export const FORMAT_MIME: Record<OutputFormat, string> = {
  webm: "video/webm;codecs=vp9,opus",
  mp4: "video/mp4;codecs=h264,aac",
};

/** Plain MIME (no codec suffix) — fallback for MediaRecorder and Blob.type. */
export const FORMAT_PLAIN_MIME: Record<OutputFormat, string> = {
  webm: "video/webm",
  mp4: "video/mp4",
};

export const FORMAT_EXTENSIONS: Record<OutputFormat, string> = {
  webm: "webm",
  mp4: "mp4",
};

export const FORMAT_LABELS: Record<OutputFormat, string> = {
  webm: "WebM (VP9+Opus) — most browser support",
  mp4: "MP4 (H.264+AAC) — Safari/Chrome where supported",
};

/** Preferred fallback chain for output format. */
export const FORMAT_FALLBACK_ORDER: OutputFormat[] = ["webm", "mp4"];

// ---- Time parsing (shared with audio-trimmer pattern) ----

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

// ---- Trim validation ----

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

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

/** Trimmed duration in seconds. */
export function trimmedDuration(startSeconds: number, endSeconds: number): number {
  return Math.max(0, endSeconds - startSeconds);
}

// ---- Output format support lookup ----

/**
 * Check whether the current browser can ENCODE a given video format via
 * MediaRecorder. Returns false in non-browser environments.
 */
export function isFormatEncodable(format: OutputFormat): boolean {
  if (typeof MediaRecorder === "undefined") return false;
  try {
    return (
      MediaRecorder.isTypeSupported(FORMAT_MIME[format]) ||
      MediaRecorder.isTypeSupported(FORMAT_PLAIN_MIME[format])
    );
  } catch {
    return false;
  }
}

/** Return all encodable output formats in fallback order. */
export function detectEncodableFormats(): OutputFormat[] {
  return FORMAT_FALLBACK_ORDER.filter((f) => isFormatEncodable(f));
}

/** Pick a sensible default output format given browser support. */
export function pickDefaultOutputFormat(encodable: OutputFormat[]): OutputFormat {
  if (encodable.includes("webm")) return "webm";
  if (encodable.includes("mp4")) return "mp4";
  return "webm"; // default fallback
}

// ---- Resolution calculator ----

export interface Resolution {
  width: number;
  height: number;
}

/**
 * Compute target resolution while maintaining aspect ratio.
 * If preset is "original", keeps source dimensions.
 * Otherwise, scales the source so that height = target (rounded to even).
 */
export function computeResolution(
  preset: ResolutionPreset,
  sourceWidth: number,
  sourceHeight: number,
): Resolution {
  if (preset === "original" || sourceHeight <= 0 || sourceWidth <= 0) {
    return {
      width: Math.max(0, sourceWidth),
      height: Math.max(0, sourceHeight),
    };
  }
  const targetHeight = RESOLUTION_HEIGHTS[preset];
  if (targetHeight <= 0) {
    return { width: sourceWidth, height: sourceHeight };
  }
  // If source is smaller than target, keep source (don't upscale).
  if (sourceHeight <= targetHeight) {
    return { width: sourceWidth, height: sourceHeight };
  }
  const aspect = sourceWidth / sourceHeight;
  const h = roundEven(targetHeight);
  const w = roundEven(targetHeight * aspect);
  return { width: w, height: h };
}

/** Round to even (required by many video encoders). */
export function roundEven(n: number): number {
  const r = Math.round(n);
  return r % 2 === 0 ? r : r + 1;
}

// ---- Fade in/out helpers ----

/** Convert a fade preset to milliseconds. */
export function fadePresetToMs(preset: FadePreset): number {
  return FADE_PRESETS_MS[preset];
}

/**
 * Compute the gain (0..1) at a given time t (seconds) within a clip of the
 * given total duration, applying linear fade in and fade out.
 */
export function fadeGainAt(
  tSeconds: number,
  totalDurationSeconds: number,
  fadeInMs: number,
  fadeOutMs: number,
): number {
  if (totalDurationSeconds <= 0) return 1;
  const t = Math.max(0, Math.min(tSeconds, totalDurationSeconds));
  // Fade in
  if (fadeInMs > 0 && t * 1000 < fadeInMs) {
    return t * 1000 / fadeInMs;
  }
  // Fade out
  const remainingMs = (totalDurationSeconds - t) * 1000;
  if (fadeOutMs > 0 && remainingMs < fadeOutMs) {
    return Math.max(0, remainingMs / fadeOutMs);
  }
  return 1;
}

// ---- File size estimator ----

/**
 * Estimate output video file size:
 *   bitrate (bits/sec) × duration (sec) / 8 (bytes/bit)
 */
export function estimateFileSizeBytes(bitrate: number, durationSeconds: number): number {
  if (bitrate <= 0 || durationSeconds <= 0) return 0;
  return Math.round((bitrate * durationSeconds) / 8);
}

/** Format bytes human-readable. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

// ---- Filename generator ----

/**
 * Generate filename: trimmed-YYYY-MM-DD-HHmmss.<ext>.
 * If a baseName is provided, uses <base>-trimmed-... instead.
 */
export function generateFilename(
  baseName: string | null,
  format: OutputFormat,
  date: Date = new Date(),
): string {
  const base = baseName ? stripExtension(baseName) : "";
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  const hh = pad2(date.getHours());
  const mm = pad2(date.getMinutes());
  const ss = pad2(date.getSeconds());
  const stem = base ? `${base}-trimmed` : "trimmed";
  return `${stem}-${y}-${m}-${d}-${hh}${mm}${ss}.${FORMAT_EXTENSIONS[format]}`;
}

/** Strip the extension from a filename (last dot to end). */
export function stripExtension(filename: string): string {
  if (!filename) return "";
  const i = filename.lastIndexOf(".");
  return i > 0 ? filename.slice(0, i) : filename;
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:video-trimmer:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  originalName: string;
  originalDurationMs: number;
  trimmedDurationMs: number;
  outputSizeBytes: number;
  startSeconds: number;
  endSeconds: number;
  bitrate: number;
  frameRate: number;
  resolution: string;
  format: OutputFormat;
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
  bitrate: BitratePreset;
  frameRate: FrameRatePreset;
  resolution: ResolutionPreset;
  fadeIn: FadePreset;
  fadeOut: FadePreset;
  format: OutputFormat;
}

export function buildShareUrl(settings: ShareSettings): string {
  const params = new URLSearchParams();
  if (settings.start) params.set("start", settings.start);
  if (settings.end) params.set("end", settings.end);
  params.set("bitrate", settings.bitrate);
  params.set("framerate", settings.frameRate);
  params.set("resolution", settings.resolution);
  params.set("fadein", settings.fadeIn);
  params.set("fadeout", settings.fadeOut);
  params.set("format", settings.format);
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
  const br = params.get("bitrate");
  if (br && br in BITRATE_PRESETS) out.bitrate = br as BitratePreset;
  const fr = params.get("framerate");
  if (fr && fr in FRAMERATE_PRESETS) out.frameRate = fr as FrameRatePreset;
  const res = params.get("resolution");
  if (res && res in RESOLUTION_HEIGHTS) out.resolution = res as ResolutionPreset;
  const fi = params.get("fadein");
  if (fi && fi in FADE_PRESETS_MS) out.fadeIn = fi as FadePreset;
  const fo = params.get("fadeout");
  if (fo && fo in FADE_PRESETS_MS) out.fadeOut = fo as FadePreset;
  const fmt = params.get("format");
  if (fmt && (fmt === "webm" || fmt === "mp4")) out.format = fmt as OutputFormat;
  return out;
}
