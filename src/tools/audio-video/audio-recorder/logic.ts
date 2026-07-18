/**
 * Audio Recorder — pure logic.
 *
 * Pure helpers only — no DOM, no MediaRecorder, no AudioContext. The actual
 * audio capture happens in ui.tsx via MediaRecorder. This module contains
 * testable utilities: format support lookup, bitrate/duration presets, MIME
 * mapping, time/byte formatting, filename generation, history (localStorage),
 * shareable URL helpers, and summary stats.
 */

export type AudioFormat = "webm" | "ogg" | "mp3";

export type BitratePreset = "low" | "medium" | "high" | "lossless";

export type DurationPreset = "30s" | "60s" | "5min" | "10min" | "30min" | "unlimited";

export const BITRATE_PRESETS: Record<BitratePreset, number> = {
  low: 64_000,
  medium: 128_000,
  high: 192_000,
  lossless: 320_000,
};

export const BITRATE_LABELS: Record<BitratePreset, string> = {
  low: "Low — 64 kbps",
  medium: "Medium — 128 kbps",
  high: "High — 192 kbps",
  lossless: "Lossless — 320 kbps",
};

export const DURATION_PRESETS: Record<DurationPreset, number> = {
  "30s": 30_000,
  "60s": 60_000,
  "5min": 5 * 60_000,
  "10min": 10 * 60_000,
  "30min": 30 * 60_000,
  unlimited: 0,
};

export const DURATION_LABELS: Record<DurationPreset, string> = {
  "30s": "30 seconds",
  "60s": "1 minute",
  "5min": "5 minutes",
  "10min": "10 minutes",
  "30min": "30 minutes",
  unlimited: "Unlimited",
};

/** Format → MIME type (with codec hints for higher-quality defaults). */
export const FORMAT_MIME: Record<AudioFormat, string> = {
  webm: "audio/webm;codecs=opus",
  ogg: "audio/ogg;codecs=opus",
  mp3: "audio/mpeg",
};

/** Plain MIME (no codec suffix) — used for Blob.type and download. */
export const FORMAT_PLAIN_MIME: Record<AudioFormat, string> = {
  webm: "audio/webm",
  ogg: "audio/ogg",
  mp3: "audio/mpeg",
};

export const FORMAT_EXTENSIONS: Record<AudioFormat, string> = {
  webm: "webm",
  ogg: "ogg",
  mp3: "mp3",
};

/**
 * Check whether the current browser can record a given format. Returns false
 * in non-browser environments. Pure relative to its input — does NOT cache.
 */
export function isFormatSupported(format: AudioFormat): boolean {
  if (typeof MediaRecorder === "undefined") return false;
  try {
    return MediaRecorder.isTypeSupported(FORMAT_MIME[format]) ||
      MediaRecorder.isTypeSupported(FORMAT_PLAIN_MIME[format]);
  } catch {
    return false;
  }
}

/** Return only the formats supported by the current browser (in display order). */
export function detectSupportedFormats(): AudioFormat[] {
  const order: AudioFormat[] = ["webm", "ogg", "mp3"];
  return order.filter((f) => isFormatSupported(f));
}

/** Pick a sensible default format given browser support (prefers webm). */
export function pickDefaultFormat(supported: AudioFormat[]): AudioFormat {
  if (supported.includes("webm")) return "webm";
  if (supported.includes("ogg")) return "ogg";
  if (supported.includes("mp3")) return "mp3";
  return "webm"; // graceful fallback (UI will warn)
}

/** Convert milliseconds to MM:SS.ms display string. */
export function formatTime(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const millis = Math.floor(ms % 1000);
  return `${pad2(minutes)}:${pad2(seconds)}.${pad3(millis)}`;
}

function pad2(n: number): string { return n < 10 ? `0${n}` : `${n}`; }
function pad3(n: number): string {
  if (n < 10) return `00${n}`;
  if (n < 100) return `0${n}`;
  return `${n}`;
}

/** Format bytes human-readable (KB / MB). */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

/**
 * Estimate file size from bitrate and duration.
 *
 * size = bitrate (bits/s) × duration (s) / 8 (bytes per bit)
 *
 * Note: this is an estimate. Actual compressed size depends on codec and
 * content. For lossless codecs it is exact; for Opus/Vorbis it may differ.
 */
export function estimateFileSizeBytes(bitrate: number, durationMs: number): number {
  if (bitrate <= 0 || durationMs <= 0) return 0;
  return Math.round((bitrate * durationMs) / 8 / 1000);
}

/** Format → MediaRecorder options object. */
export function buildRecorderOptions(
  format: AudioFormat,
  bitrate: number,
): MediaRecorderOptions {
  return {
    mimeType: FORMAT_MIME[format],
    audioBitsPerSecond: bitrate,
  };
}

/**
 * Generate a timestamped filename: recording-YYYY-MM-DD-HHmmss.<ext>
 * Pure: takes a Date (default = now) for testability.
 */
export function generateFilename(format: AudioFormat, date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  const hh = pad2(date.getHours());
  const mm = pad2(date.getMinutes());
  const ss = pad2(date.getSeconds());
  return `recording-${y}-${m}-${d}-${hh}${mm}${ss}.${FORMAT_EXTENSIONS[format]}`;
}

/** Validation: is max duration reached? */
export function isMaxDurationReached(elapsedMs: number, maxMs: number): boolean {
  if (maxMs <= 0) return false; // unlimited
  return elapsedMs >= maxMs;
}

/** Validation: is elapsed over a hard cap (safety margin of 250ms)? */
export function isOverHardCap(elapsedMs: number, maxMs: number): boolean {
  if (maxMs <= 0) return false;
  return elapsedMs >= maxMs + 250;
}

/** Map a getUserMedia / MediaRecorder error to a friendly message. */
export function describeRecorderError(errorName: string): string {
  switch (errorName) {
    case "NotAllowedError":
    case "SecurityError":
      return "Microphone permission denied. Please allow microphone access in your browser and try again.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "No microphone found. Please connect a microphone and try again.";
    case "NotReadableError":
      return "Microphone is being used by another application. Close it and try again.";
    case "AbortError":
      return "Recording was aborted unexpectedly. Please try again.";
    case "InvalidStateError":
      return "Recorder entered an invalid state. Please reload the page.";
    default:
      return `Recording error: ${errorName}`;
  }
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:audio-recorder:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  durationMs: number;
  format: AudioFormat;
  sizeBytes: number;
  bitrate: number;
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

export interface SummaryStats {
  totalRecordings: number;
  totalDurationMs: number;
  totalSizeBytes: number;
  byFormat: Record<AudioFormat, number>;
}

/** Compute summary stats across history entries. */
export function computeSummaryStats(history: HistoryEntry[]): SummaryStats {
  const stats: SummaryStats = {
    totalRecordings: history.length,
    totalDurationMs: 0,
    totalSizeBytes: 0,
    byFormat: { webm: 0, ogg: 0, mp3: 0 },
  };
  for (const h of history) {
    stats.totalDurationMs += h.durationMs;
    stats.totalSizeBytes += h.sizeBytes;
    if (h.format in stats.byFormat) {
      stats.byFormat[h.format] += 1;
    }
  }
  return stats;
}

// ---- Shareable URL ----

export interface ShareSettings {
  format: AudioFormat;
  bitrate: BitratePreset;
  duration: DurationPreset;
}

export function buildShareUrl(settings: ShareSettings): string {
  const params = new URLSearchParams();
  params.set("format", settings.format);
  params.set("bitrate", settings.bitrate);
  params.set("duration", settings.duration);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ShareSettings> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<ShareSettings> = {};
  const fmt = params.get("format");
  if (fmt === "webm" || fmt === "ogg" || fmt === "mp3") out.format = fmt;
  const br = params.get("bitrate");
  if (br === "low" || br === "medium" || br === "high" || br === "lossless") out.bitrate = br;
  const du = params.get("duration");
  if (du === "30s" || du === "60s" || du === "5min" || du === "10min" || du === "30min" || du === "unlimited") {
    out.duration = du;
  }
  return out;
}
