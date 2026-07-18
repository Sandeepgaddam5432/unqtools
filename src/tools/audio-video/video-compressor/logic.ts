/**
 * Video Compressor — pure logic.
 *
 * Pure helpers only — no DOM, no <video>, no AudioContext, no MediaRecorder.
 * The actual frame capture and re-encoding happens in ui.tsx via the
 * HTML5 <video> + <canvas> + MediaRecorder pipeline. This module contains:
 * bitrate / resolution / frame-rate presets, aspect-ratio-aware resolution
 * calculator, compression ratio calculator, file-size estimator, quality
 * score calculator (0-100), format support lookup (webm/mp4 via
 * MediaRecorder.isTypeSupported), codec support lookup (VP8, VP9, H.264,
 * AV1), filename generator, history (localStorage), shareable URL, and
 * summary stats.
 */

export type BitratePreset = "very-low" | "low" | "medium" | "high";
export type ResolutionPreset = "240p" | "360p" | "480p" | "720p" | "1080p";
export type FrameRatePreset = "24" | "30" | "60";
export type OutputFormat = "webm" | "mp4";
export type VideoCodec = "vp8" | "vp9" | "h264" | "av1";

/** Bitrate presets in bits per second. */
export const BITRATE_PRESETS: Record<BitratePreset, number> = {
  "very-low": 500_000,
  low: 1_000_000,
  medium: 2_500_000,
  high: 5_000_000,
};

export const BITRATE_LABELS: Record<BitratePreset, string> = {
  "very-low": "Very low — 500 kbps (smallest)",
  low: "Low — 1 Mbps",
  medium: "Medium — 2.5 Mbps",
  high: "High — 5 Mbps (largest)",
};

/** Resolution presets as target heights. */
export const RESOLUTION_HEIGHTS: Record<ResolutionPreset, number> = {
  "240p": 240,
  "360p": 360,
  "480p": 480,
  "720p": 720,
  "1080p": 1080,
};

export const RESOLUTION_LABELS: Record<ResolutionPreset, string> = {
  "240p": "240p (very small)",
  "360p": "360p (low)",
  "480p": "480p (SD)",
  "720p": "720p (HD)",
  "1080p": "1080p (Full HD)",
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

/** MIME types used for MediaRecorder. */
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

/** Codec → MIME strings used for the codec-support lookup. */
export const CODEC_MIME: Record<VideoCodec, string> = {
  vp8: "video/webm;codecs=vp8",
  vp9: "video/webm;codecs=vp9",
  h264: "video/mp4;codecs=h264",
  av1: "video/webm;codecs=av01",
};

export const CODEC_LABELS: Record<VideoCodec, string> = {
  vp8: "VP8 (WebM, legacy)",
  vp9: "VP9 (WebM, modern)",
  h264: "H.264 / AVC (MP4, universal)",
  av1: "AV1 (modern, royalty-free)",
};

// ---- Resolution calculator (aspect-ratio aware) ----

export interface Resolution {
  width: number;
  height: number;
}

/**
 * Compute target resolution while maintaining aspect ratio.
 * Scales the source so that height = target height (rounded to even).
 * If the source is already smaller than the target, keeps the source
 * (don't upscale — that would just bloat the file).
 */
export function computeResolution(
  preset: ResolutionPreset,
  sourceWidth: number,
  sourceHeight: number,
): Resolution {
  if (sourceHeight <= 0 || sourceWidth <= 0) {
    return { width: 0, height: 0 };
  }
  const targetHeight = RESOLUTION_HEIGHTS[preset];
  // Don't upscale
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

// ---- Compression ratio calculator ----

export interface CompressionResult {
  ratio: number;
  reductionPct: number;
  savedBytes: number;
}

/**
 * Compute compression ratio (input / output) and percentage reduction.
 * A ratio of 4.0 means the output is 4× smaller.
 * Returns zeros if output >= input (compression "failed" or output grew).
 */
export function computeCompressionRatio(
  inputBytes: number,
  outputBytes: number,
): CompressionResult {
  if (inputBytes <= 0 || outputBytes <= 0) {
    return { ratio: 0, reductionPct: 0, savedBytes: 0 };
  }
  const ratio = inputBytes / outputBytes;
  const savedBytes = Math.max(0, inputBytes - outputBytes);
  const reductionPct = (savedBytes / inputBytes) * 100;
  return { ratio, reductionPct, savedBytes };
}

// ---- Quality score calculator (0-100) ----

export interface QualityInputs {
  bitrate: number;
  width: number;
  height: number;
  frameRate: number;
}

/**
 * Compute a quality score (0-100) based on bitrate, resolution, and frame
 * rate. Higher is better. The score combines:
 *   - bitrate score: 500kbps → 0, 5Mbps → 100 (linear)
 *   - resolution score: 240p → 0, 1080p → 100 (linear by height)
 *   - frame rate bonus: 60fps → +5, 30fps → 0, 24fps → -3
 * Final score is clamped to [0, 100].
 */
export function computeQualityScore(inputs: QualityInputs): number {
  const { bitrate, width, height, frameRate } = inputs;
  // Bitrate score (0..1)
  const bitrateClamped = Math.max(500_000, Math.min(5_000_000, bitrate));
  const bitrateScore = (bitrateClamped - 500_000) / (5_000_000 - 500_000);
  // Resolution score (0..1) — based on height
  const heightClamped = Math.max(240, Math.min(1080, height));
  const resScore = (heightClamped - 240) / (1080 - 240);
  // Weighted: 50% bitrate, 50% resolution
  const base = 0.5 * bitrateScore + 0.5 * resScore;
  let score = base * 100;
  // Frame-rate bonus
  if (frameRate >= 60) score += 5;
  else if (frameRate < 30) score -= 3;
  return Math.max(0, Math.min(100, Math.round(score)));
}

/** Render a quality score as a label. */
export function qualityLabel(score: number): string {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Fair";
  if (score >= 30) return "Low";
  return "Poor";
}

// ---- Format & codec support lookup ----

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
  return "webm";
}

/**
 * Check whether the current browser can ENCODE a given codec via
 * MediaRecorder. Returns false in non-browser environments.
 */
export function isCodecSupported(codec: VideoCodec): boolean {
  if (typeof MediaRecorder === "undefined") return false;
  try {
    return MediaRecorder.isTypeSupported(CODEC_MIME[codec]);
  } catch {
    return false;
  }
}

/** Return all supported codecs. */
export function detectSupportedCodecs(): VideoCodec[] {
  return (Object.keys(CODEC_MIME) as VideoCodec[]).filter((c) => isCodecSupported(c));
}

// ---- Filename generator ----

/** Strip the extension from a filename (last dot to end). */
export function stripExtension(filename: string): string {
  if (!filename) return "";
  const i = filename.lastIndexOf(".");
  return i > 0 ? filename.slice(0, i) : filename;
}

/**
 * Generate filename: <base>-compressed-YYYY-MM-DD-HHmmss.<ext>.
 * If no baseName provided, uses "compressed-...".
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
  const stem = base ? `${base}-compressed` : "compressed";
  return `${stem}-${y}-${m}-${d}-${hh}${mm}${ss}.${FORMAT_EXTENSIONS[format]}`;
}

// ---- Summary stats ----

export interface SummaryStats {
  inputSizeBytes: number;
  outputSizeBytes: number;
  savedBytes: number;
  reductionPct: number;
  ratio: number;
  qualityScore: number;
  durationSeconds: number;
  outputBitrate: number;
  outputResolution: string;
  outputFrameRate: number;
  outputFormat: OutputFormat;
}

export function computeSummaryStats(
  inputSizeBytes: number,
  outputSizeBytes: number,
  durationSeconds: number,
  qualityScore: number,
  outputBitrate: number,
  outputWidth: number,
  outputHeight: number,
  outputFrameRate: number,
  outputFormat: OutputFormat,
): SummaryStats {
  const comp = computeCompressionRatio(inputSizeBytes, outputSizeBytes);
  return {
    inputSizeBytes,
    outputSizeBytes,
    savedBytes: comp.savedBytes,
    reductionPct: comp.reductionPct,
    ratio: comp.ratio,
    qualityScore,
    durationSeconds,
    outputBitrate,
    outputResolution: `${outputWidth}×${outputHeight}`,
    outputFrameRate,
    outputFormat,
  };
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:video-compressor:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  originalName: string;
  inputSizeBytes: number;
  outputSizeBytes: number;
  reductionPct: number;
  ratio: number;
  qualityScore: number;
  durationSeconds: number;
  bitrate: number;
  resolution: string;
  frameRate: number;
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

// ---- Shareable URL ----

export interface ShareSettings {
  bitrate: BitratePreset;
  frameRate: FrameRatePreset;
  resolution: ResolutionPreset;
  format: OutputFormat;
}

export function buildShareUrl(settings: ShareSettings): string {
  const params = new URLSearchParams();
  params.set("bitrate", settings.bitrate);
  params.set("framerate", settings.frameRate);
  params.set("resolution", settings.resolution);
  params.set("format", settings.format);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ShareSettings> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<ShareSettings> = {};
  const br = params.get("bitrate");
  if (br && br in BITRATE_PRESETS) out.bitrate = br as BitratePreset;
  const fr = params.get("framerate");
  if (fr && fr in FRAMERATE_PRESETS) out.frameRate = fr as FrameRatePreset;
  const res = params.get("resolution");
  if (res && res in RESOLUTION_HEIGHTS) out.resolution = res as ResolutionPreset;
  const fmt = params.get("format");
  if (fmt && (fmt === "webm" || fmt === "mp4")) out.format = fmt as OutputFormat;
  return out;
}

// ---- Helpers ----

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}
