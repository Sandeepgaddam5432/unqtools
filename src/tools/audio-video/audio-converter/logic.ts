/**
 * Audio Converter — pure logic.
 *
 * Pure helpers only — no DOM, no AudioContext, no MediaRecorder. The actual
 * decoding and re-encoding happens in ui.tsx via Web Audio API. This module
 * contains: format/MIME/ext tables, bitrate/sample-rate/channel presets,
 * 44-byte RIFF WAV header builder, Float32 to 16-bit PCM converter, channel
 * interleaving, file-size estimator, quality score, lossless-vs-lossy
 * compatibility checker, filename generator, history (localStorage),
 * shareable URL, and summary stats.
 */

export type AudioFormat = "wav" | "mp3" | "webm" | "ogg" | "m4a";

export type BitratePreset = "low" | "medium" | "high" | "lossless";

export type ChannelPreset = "mono" | "stereo" | "auto";

export type SampleRatePreset = "8000" | "16000" | "22050" | "44100" | "48000" | "96000" | "auto";

/** Format → MIME type used for MediaRecorder. WAV is not MediaRecorder-encoded. */
export const FORMAT_MIME: Record<AudioFormat, string> = {
  wav: "audio/wav",
  mp3: "audio/mpeg",
  webm: "audio/webm;codecs=opus",
  ogg: "audio/ogg;codecs=opus",
  m4a: "audio/mp4",
};

/** Plain MIME (no codec suffix) — used for Blob.type and download. */
export const FORMAT_PLAIN_MIME: Record<AudioFormat, string> = {
  wav: "audio/wav",
  mp3: "audio/mpeg",
  webm: "audio/webm",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
};

export const FORMAT_EXTENSIONS: Record<AudioFormat, string> = {
  wav: "wav",
  mp3: "mp3",
  webm: "webm",
  ogg: "ogg",
  m4a: "m4a",
};

/** Display labels for each format (with short description). */
export const FORMAT_LABELS: Record<AudioFormat, string> = {
  wav: "WAV — PCM 16-bit, lossless",
  mp3: "MP3 — lossy, universal",
  webm: "WebM — Opus, modern",
  ogg: "OGG — Opus/Vorbis",
  m4a: "M4A — AAC",
};

/** Display order (most popular first). */
export const FORMAT_ORDER: AudioFormat[] = ["wav", "mp3", "webm", "ogg", "m4a"];

/** Lossless formats preserve the exact PCM stream. */
export const LOSSLESS_FORMATS: AudioFormat[] = ["wav"];

/** Bitrate presets (bits/second) for lossy encoders. */
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

/** Sample-rate presets (Hz). "auto" means keep the source rate. */
export const SAMPLE_RATE_PRESETS: Record<SampleRatePreset, number> = {
  "8000": 8_000,
  "16000": 16_000,
  "22050": 22_050,
  "44100": 44_100,
  "48000": 48_000,
  "96000": 96_000,
  auto: 0,
};

export const SAMPLE_RATE_LABELS: Record<SampleRatePreset, string> = {
  "8000": "8,000 Hz (telephone)",
  "16000": "16,000 Hz (voice)",
  "22050": "22,050 Hz (radio)",
  "44100": "44,100 Hz (CD)",
  "48000": "48,000 Hz (DVD/pro)",
  "96000": "96,000 Hz (hi-res)",
  auto: "Auto (keep source)",
};

export const CHANNEL_LABELS: Record<ChannelPreset, string> = {
  mono: "Mono (1 channel)",
  stereo: "Stereo (2 channels)",
  auto: "Auto (keep source)",
};

// ---- Format support detection ----

/**
 * Check whether the current browser can ENCODE a given format via
 * MediaRecorder. WAV is always supported (pure-JS encoder). Returns false
 * in non-browser environments for non-WAV formats.
 */
export function isFormatEncodable(format: AudioFormat): boolean {
  if (format === "wav") return true; // pure-JS encoder always works
  if (typeof MediaRecorder === "undefined") return false;
  try {
    return MediaRecorder.isTypeSupported(FORMAT_MIME[format]) ||
      MediaRecorder.isTypeSupported(FORMAT_PLAIN_MIME[format]);
  } catch {
    return false;
  }
}

/** Return all encodable formats in display order. */
export function detectEncodableFormats(): AudioFormat[] {
  return FORMAT_ORDER.filter((f) => isFormatEncodable(f));
}

/** Pick a sensible default output format given browser support. */
export function pickDefaultOutputFormat(encodable: AudioFormat[]): AudioFormat {
  if (encodable.includes("mp3")) return "mp3";
  if (encodable.includes("webm")) return "webm";
  if (encodable.includes("ogg")) return "ogg";
  if (encodable.includes("m4a")) return "m4a";
  return "wav"; // always encodable (pure JS)
}

// ---- Target sample rate / channel resolution ----

/** Resolve a sample-rate preset against a source rate. */
export function resolveSampleRate(preset: SampleRatePreset, sourceRate: number): number {
  if (preset === "auto") return sourceRate > 0 ? sourceRate : 44_100;
  return SAMPLE_RATE_PRESETS[preset];
}

/** Resolve a channel preset against a source channel count. */
export function resolveChannelCount(preset: ChannelPreset, sourceChannels: number): number {
  if (preset === "auto") return sourceChannels > 0 ? sourceChannels : 1;
  if (preset === "mono") return 1;
  return 2;
}

/** Check if sample-rate conversion is needed. */
export function needsResample(sourceRate: number, targetRate: number): boolean {
  return sourceRate !== targetRate;
}

/** Check if channel conversion is needed. */
export function needsChannelChange(sourceChannels: number, targetChannels: number): boolean {
  return sourceChannels !== targetChannels;
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

// ---- Float32 → 16-bit PCM converter ----

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
 * Downmix multi-channel Float32 sample arrays to a single mono Float32Array
 * by averaging. Used when target channels = 1 and source > 1.
 */
export function downmixToMono(channels: Float32Array[]): Float32Array {
  if (channels.length === 0) return new Float32Array(0);
  if (channels.length === 1) return channels[0].slice();
  const length = channels[0].length;
  const out = new Float32Array(length);
  const n = channels.length;
  for (let i = 0; i < length; i++) {
    let sum = 0;
    for (let c = 0; c < n; c++) sum += channels[c][i];
    out[i] = sum / n;
  }
  return out;
}

/**
 * Upmix mono Float32 sample array to stereo (duplicates the channel).
 * Used when target channels = 2 and source = 1.
 */
export function upmixToStereo(mono: Float32Array): Float32Array[] {
  const copy = mono.slice();
  return [copy, copy.slice()];
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

/**
 * Estimate output size for any format given a bitrate (bits/second) and
 * duration (seconds). For lossy formats. size = bitrate × duration / 8.
 */
export function estimateLossySizeBytes(bitrate: number, durationSeconds: number): number {
  if (bitrate <= 0 || durationSeconds <= 0) return 0;
  return Math.round((bitrate * durationSeconds) / 8);
}

/**
 * Estimate output size given target format, duration, sample rate, channels.
 * WAV uses PCM math; lossy formats use bitrate × duration / 8.
 */
export function estimateOutputSizeBytes(
  format: AudioFormat,
  durationSeconds: number,
  sampleRate: number,
  channels: number,
  bitrate: number,
): number {
  if (format === "wav") {
    const sampleCount = Math.round(durationSeconds * sampleRate);
    return estimateWavSizeBytes(sampleCount, channels);
  }
  return estimateLossySizeBytes(bitrate, durationSeconds);
}

// ---- Quality score calculator (0-100) ----

/**
 * Compute a quality score (0-100) based on bitrate (for lossy) or
 * sample rate × bit depth (for lossless WAV). Higher is better.
 */
export function computeQualityScore(
  format: AudioFormat,
  bitrate: number,
  sampleRate: number,
  channels: number,
): number {
  if (format === "wav") {
    // Score based on sample rate and channels.
    // CD quality (44.1k stereo) = 100; lower rates scale down.
    const srScore = Math.min(1, sampleRate / 44_100);
    const chScore = channels >= 2 ? 1 : 0.7;
    return Math.round(srScore * chScore * 100);
  }
  // Lossy: 320 kbps = 100, 64 kbps = ~20
  // Linear scale: 64k -> 20, 320k -> 100
  const clamped = Math.max(64_000, Math.min(320_000, bitrate));
  return Math.round(20 + ((clamped - 64_000) / (320_000 - 64_000)) * 80);
}

/** Render a quality score as a label. */
export function qualityLabel(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Fair";
  if (score >= 30) return "Low";
  return "Poor";
}

// ---- Format compatibility checker ----

export interface CompatibilityInfo {
  lossless: boolean;
  reason: string;
}

/**
 * Check whether converting from srcFormat to dstFormat is lossless (no
 * generation loss) or lossy (re-quantization / re-compression).
 */
export function checkFormatCompatibility(
  srcFormat: AudioFormat | "unknown",
  dstFormat: AudioFormat,
): CompatibilityInfo {
  // If source is unknown (e.g. raw upload), we can only assume lossless to WAV.
  if (srcFormat === "unknown") {
    if (dstFormat === "wav") {
      return { lossless: true, reason: "WAV is uncompressed PCM — no generation loss." };
    }
    return { lossless: false, reason: `Re-encoding to ${dstFormat.toUpperCase()} applies lossy compression.` };
  }
  // Same format → lossless (no transcoding).
  if (srcFormat === dstFormat) {
    return { lossless: true, reason: "Same format — no transcoding needed." };
  }
  // Lossy → lossy always loses quality.
  const srcLossy = !LOSSLESS_FORMATS.includes(srcFormat);
  const dstLossy = !LOSSLESS_FORMATS.includes(dstFormat);
  if (srcLossy && dstLossy) {
    return {
      lossless: false,
      reason: `Both ${srcFormat.toUpperCase()} and ${dstFormat.toUpperCase()} are lossy — generation loss occurs.`,
    };
  }
  // Lossless → lossy loses quality.
  if (!srcLossy && dstLossy) {
    return {
      lossless: false,
      reason: `${srcFormat.toUpperCase()} → ${dstFormat.toUpperCase()} applies lossy compression.`,
    };
  }
  // Lossy → lossless: no further loss (but no recovery either).
  if (srcLossy && !dstLossy) {
    return {
      lossless: true,
      reason: `${dstFormat.toUpperCase()} is lossless — no additional generation loss (lost data is not recovered).`,
    };
  }
  // Lossless → lossless.
  return { lossless: true, reason: "Both formats are lossless — no generation loss." };
}

// ---- Filename generator ----

/** Strip the extension from a filename (last dot to end). */
export function stripExtension(filename: string): string {
  if (!filename) return "";
  const i = filename.lastIndexOf(".");
  return i > 0 ? filename.slice(0, i) : filename;
}

/** Detect an audio format from a filename extension. Returns "unknown" if unrecognized. */
export function detectFormatFromFilename(filename: string): AudioFormat | "unknown" {
  if (!filename) return "unknown";
  const lower = filename.toLowerCase();
  const ext = lower.slice(lower.lastIndexOf(".") + 1);
  if (ext === "wav") return "wav";
  if (ext === "mp3") return "mp3";
  if (ext === "webm") return "webm";
  if (ext === "ogg" || ext === "oga") return "ogg";
  if (ext === "m4a" || ext === "mp4" || ext === "aac") return "m4a";
  return "unknown";
}

/** Generate an output filename: <base>-converted-YYYY-MM-DD-HHmmss.<ext> */
export function generateFilename(
  baseName: string,
  format: AudioFormat,
  date: Date = new Date(),
): string {
  const base = stripExtension(baseName) || "audio";
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  const hh = pad2(date.getHours());
  const mm = pad2(date.getMinutes());
  const ss = pad2(date.getSeconds());
  return `${base}-converted-${y}-${m}-${d}-${hh}${mm}${ss}.${FORMAT_EXTENSIONS[format]}`;
}

// ---- Byte / time formatting ----

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

/** Format seconds as M:SS (e.g. 90 → "1:30"). */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${pad2(s)}`;
}

// ---- Summary stats ----

export interface SummaryStats {
  originalSizeBytes: number;
  outputSizeBytes: number;
  sizeDiffBytes: number;
  sizeDiffPct: number;
  durationSeconds: number;
  outputBitrate: number;
  outputSampleRate: number;
  outputChannels: number;
}

export function computeSummaryStats(
  originalSizeBytes: number,
  outputSizeBytes: number,
  durationSeconds: number,
  outputBitrate: number,
  outputSampleRate: number,
  outputChannels: number,
): SummaryStats {
  const sizeDiffBytes = outputSizeBytes - originalSizeBytes;
  const sizeDiffPct = originalSizeBytes > 0
    ? (sizeDiffBytes / originalSizeBytes) * 100
    : 0;
  return {
    originalSizeBytes,
    outputSizeBytes,
    sizeDiffBytes,
    sizeDiffPct,
    durationSeconds,
    outputBitrate,
    outputSampleRate,
    outputChannels,
  };
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:audio-converter:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  originalName: string;
  originalFormat: AudioFormat | "unknown";
  outputFormat: AudioFormat;
  originalSizeBytes: number;
  outputSizeBytes: number;
  durationSeconds: number;
  sampleRate: number;
  channels: number;
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

// ---- Shareable URL ----

export interface ShareSettings {
  format: AudioFormat;
  bitrate: BitratePreset;
  sampleRate: SampleRatePreset;
  channels: ChannelPreset;
}

export function buildShareUrl(settings: ShareSettings): string {
  const params = new URLSearchParams();
  params.set("format", settings.format);
  params.set("bitrate", settings.bitrate);
  params.set("samplerate", settings.sampleRate);
  params.set("channels", settings.channels);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ShareSettings> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<ShareSettings> = {};
  const fmt = params.get("format");
  if (fmt && (FORMAT_ORDER as string[]).includes(fmt)) out.format = fmt as AudioFormat;
  const br = params.get("bitrate");
  if (br && br in BITRATE_PRESETS) out.bitrate = br as BitratePreset;
  const sr = params.get("samplerate");
  if (sr && sr in SAMPLE_RATE_PRESETS) out.sampleRate = sr as SampleRatePreset;
  const ch = params.get("channels");
  if (ch && (ch === "mono" || ch === "stereo" || ch === "auto")) out.channels = ch as ChannelPreset;
  return out;
}

// ---- Full WAV encoder helper ----

/**
 * Build a complete WAV file (header + interleaved 16-bit PCM data) from
 * per-channel Float32 sample arrays. Pure helper — ui.tsx calls this after
 * rendering the decoded buffer through an OfflineAudioContext if needed.
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

// ---- Helpers ----

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}
