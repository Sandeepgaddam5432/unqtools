/**
 * Audio Bitrate Calculator — pure logic.
 *
 * Pure helpers only — no DOM, no AudioContext. Computes audio bitrate,
 * file size, streaming bandwidth, quality scores, and reverse calculations
 * for PCM/WAV, FLAC, ALAC, MP3, AAC, OGG/Vorbis, and Opus.
 */

// ---- Types ----

export type AudioFormatId = "pcm" | "flac" | "alac" | "mp3" | "aac" | "ogg" | "opus";

export type BitDepthId = "8" | "16" | "24" | "32" | "32-float";

export type ChannelLayoutId = "mono" | "stereo" | "5.1" | "7.1";

export type QualityPreset = "low" | "medium" | "high" | "voice" | "music";

export type CompressionType = "lossless" | "lossy";

// ---- Presets ----

export interface SampleRateOption {
  hz: number;
  label: string;
}

export const SAMPLE_RATES: SampleRateOption[] = [
  { hz: 8000,   label: "8 kHz (telephone)" },
  { hz: 16000,  label: "16 kHz (voice)" },
  { hz: 22050,  label: "22.05 kHz (low quality)" },
  { hz: 44100,  label: "44.1 kHz (CD)" },
  { hz: 48000,  label: "48 kHz (DVD/pro)" },
  { hz: 96000,  label: "96 kHz (hi-res)" },
  { hz: 192000, label: "192 kHz (studio hi-res)" },
];

export interface BitDepthOption {
  id: BitDepthId;
  bits: number;
  format: "int" | "float";
  label: string;
}

export const BIT_DEPTHS: BitDepthOption[] = [
  { id: "8",        bits: 8,  format: "int",   label: "8-bit integer" },
  { id: "16",       bits: 16, format: "int",   label: "16-bit (CD quality)" },
  { id: "24",       bits: 24, format: "int",   label: "24-bit (studio)" },
  { id: "32",       bits: 32, format: "int",   label: "32-bit integer" },
  { id: "32-float", bits: 32, format: "float", label: "32-bit float" },
];

export function getBitDepth(id: BitDepthId): BitDepthOption {
  return BIT_DEPTHS.find((b) => b.id === id) ?? BIT_DEPTHS[1];
}

export interface ChannelLayoutOption {
  id: ChannelLayoutId;
  channels: number;
  label: string;
  description: string;
}

export const CHANNEL_LAYOUTS: ChannelLayoutOption[] = [
  { id: "mono",   channels: 1, label: "Mono (1.0)",   description: "Voice, AM radio" },
  { id: "stereo", channels: 2, label: "Stereo (2.0)", description: "Music, podcasts" },
  { id: "5.1",    channels: 6, label: "Surround 5.1", description: "Cinema, DVD" },
  { id: "7.1",    channels: 8, label: "Surround 7.1", description: "Blu-ray" },
];

export function getChannelLayout(id: ChannelLayoutId): ChannelLayoutOption {
  return CHANNEL_LAYOUTS.find((c) => c.id === id) ?? CHANNEL_LAYOUTS[1];
}

export interface FormatOption {
  id: AudioFormatId;
  label: string;
  compression: CompressionType;
  /** Whether sample rate / bit depth / channels affect the bitrate. */
  rateDependsOnPcmParams: boolean;
  /** Whether a quality preset is selectable (lossy formats). */
  hasQualityPreset: boolean;
}

export const FORMATS: FormatOption[] = [
  { id: "pcm",   label: "PCM / WAV (uncompressed)", compression: "lossless", rateDependsOnPcmParams: true,  hasQualityPreset: false },
  { id: "flac",  label: "FLAC (lossless)",           compression: "lossless", rateDependsOnPcmParams: true,  hasQualityPreset: false },
  { id: "alac",  label: "ALAC (Apple Lossless)",     compression: "lossless", rateDependsOnPcmParams: true,  hasQualityPreset: false },
  { id: "mp3",   label: "MP3",                       compression: "lossy",    rateDependsOnPcmParams: false, hasQualityPreset: true },
  { id: "aac",   label: "AAC",                       compression: "lossy",    rateDependsOnPcmParams: false, hasQualityPreset: true },
  { id: "ogg",   label: "OGG / Vorbis",              compression: "lossy",    rateDependsOnPcmParams: false, hasQualityPreset: true },
  { id: "opus",  label: "Opus",                      compression: "lossy",    rateDependsOnPcmParams: false, hasQualityPreset: true },
];

export function getFormat(id: AudioFormatId): FormatOption {
  return FORMATS.find((f) => f.id === id) ?? FORMATS[0];
}

export interface QualityOption {
  id: QualityPreset;
  label: string;
  description: string;
}

export const QUALITY_PRESETS: QualityOption[] = [
  { id: "low",    label: "Low",    description: "Minimum acceptable quality — speech, low-bandwidth streaming" },
  { id: "medium", label: "Medium", description: "Standard streaming quality — podcasts, talk radio" },
  { id: "high",   label: "High",   description: "High quality — music streaming, downloads" },
  { id: "voice",  label: "Voice",  description: "Optimized for speech (narrowband)" },
  { id: "music",  label: "Music",  description: "Transparent for most listeners (high bitrate)" },
];

export function getQualityPreset(id: QualityPreset): QualityOption {
  return QUALITY_PRESETS.find((q) => q.id === id) ?? QUALITY_PRESETS[1];
}

// ---- Lossy quality → bitrate mapping table ----

/**
 * Typical bitrates (kbps) for each lossy format × quality preset.
 * Based on common encoder defaults (LAME -V, Fraunhofer FDK AAC, libvorbis -q, libopus --bitrate).
 */
export const QUALITY_BITRATE_MAP: Record<AudioFormatId, Partial<Record<QualityPreset, number>>> = {
  pcm:  {},
  flac: {},
  alac: {},
  mp3:  { low: 96,  medium: 128, high: 192, voice: 64,  music: 320 },
  aac:  { low: 96,  medium: 128, high: 192, voice: 64,  music: 256 },
  ogg:  { low: 96,  medium: 128, high: 192, voice: 64,  music: 256 },
  opus: { low: 32,  medium: 64,  high: 128, voice: 24,  music: 192 },
};

/** Look up the typical bitrate (kbps) for a lossy format × quality. Returns 0 if N/A. */
export function mapQualityToBitrate(format: AudioFormatId, quality: QualityPreset): number {
  return QUALITY_BITRATE_MAP[format]?.[quality] ?? 0;
}

// ---- Compression ratios for lossless codecs ----

/**
 * Average compression ratio (0..1) — what fraction of PCM size the lossless
 * codec typically produces. FLAC averages 55%, ALAC slightly worse at 60%.
 */
export const LOSSLESS_RATIOS: Record<"flac" | "alac", number> = {
  flac: 0.55,
  alac: 0.60,
};

// ---- PCM bitrate calculator ----

/**
 * Compute PCM bitrate (bits per second) = sampleRate × bitDepth × channels.
 */
export function computePcmBitrate(
  sampleRateHz: number,
  bitDepth: BitDepthId,
  channels: ChannelLayoutId,
): number {
  const depth = getBitDepth(bitDepth).bits;
  const ch = getChannelLayout(channels).channels;
  return sampleRateHz * depth * ch;
}

// ---- File size calculator ----

/**
 * Compute file size in bytes from bitrate (bits/sec) and duration (seconds).
 *   size = bitrate × duration / 8
 */
export function computeFileSizeBytes(bitrateBps: number, durationSeconds: number): number {
  if (bitrateBps < 0 || durationSeconds < 0) return 0;
  return (bitrateBps * durationSeconds) / 8;
}

/**
 * Estimate the file size for a given format. For PCM, this is the raw PCM size.
 * For FLAC/ALAC, the size is the PCM size multiplied by the lossless ratio.
 * For lossy formats, the bitrate is taken from the quality map.
 */
export function estimateFileSize(
  format: AudioFormatId,
  durationSeconds: number,
  sampleRateHz: number,
  bitDepth: BitDepthId,
  channels: ChannelLayoutId,
  quality: QualityPreset,
  compressionRatio = LOSSLESS_RATIOS.flac,
): number {
  if (durationSeconds <= 0) return 0;
  if (format === "pcm") {
    const bps = computePcmBitrate(sampleRateHz, bitDepth, channels);
    return computeFileSizeBytes(bps, durationSeconds);
  }
  if (format === "flac" || format === "alac") {
    const pcmBps = computePcmBitrate(sampleRateHz, bitDepth, channels);
    const ratio = format === "flac" ? compressionRatio : LOSSLESS_RATIOS.alac;
    return computeFileSizeBytes(pcmBps * ratio, durationSeconds);
  }
  // Lossy: bitrate from quality preset
  const kbps = mapQualityToBitrate(format, quality);
  if (kbps === 0) return 0;
  const bps = kbps * 1000;
  return computeFileSizeBytes(bps, durationSeconds);
}

/** Compute the effective bitrate (bits/sec) for a given configuration. */
export function computeEffectiveBitrate(
  format: AudioFormatId,
  sampleRateHz: number,
  bitDepth: BitDepthId,
  channels: ChannelLayoutId,
  quality: QualityPreset,
  compressionRatio = LOSSLESS_RATIOS.flac,
): number {
  if (format === "pcm") {
    return computePcmBitrate(sampleRateHz, bitDepth, channels);
  }
  if (format === "flac" || format === "alac") {
    const pcmBps = computePcmBitrate(sampleRateHz, bitDepth, channels);
    const ratio = format === "flac" ? compressionRatio : LOSSLESS_RATIOS.alac;
    return Math.round(pcmBps * ratio);
  }
  return mapQualityToBitrate(format, quality) * 1000;
}

// ---- FLAC/ALAC compression estimator ----

/**
 * Estimate FLAC/ALAC compressed file size as a fraction of PCM size.
 * Default ratio 0.55 (55%) for FLAC, 0.60 for ALAC.
 */
export function estimateLosslessSize(
  pcmSizeBytes: number,
  ratio: number,
): number {
  if (ratio < 0) ratio = 0;
  if (ratio > 1) ratio = 1;
  return Math.round(pcmSizeBytes * ratio);
}

// ---- Streaming bandwidth ----

/**
 * Streaming bandwidth requirement equals the audio bitrate (in bps).
 * The connection speed must be ≥ this value for uninterrupted playback.
 */
export function computeStreamingRequirement(bitrateBps: number): number {
  return Math.max(0, bitrateBps);
}

// ---- Reverse calculator ----

/**
 * Given a target file size (MB) and duration (seconds), compute the required
 * bitrate in kbps. Returns 0 if inputs are invalid.
 *   bitrate_kbps = (size_bytes × 8) / duration / 1000
 */
export function reverseCalculateBitrate(
  targetFileSizeMB: number,
  durationSeconds: number,
): number {
  if (durationSeconds <= 0 || targetFileSizeMB <= 0) return 0;
  const sizeBytes = targetFileSizeMB * 1024 * 1024;
  const bps = (sizeBytes * 8) / durationSeconds;
  return bps / 1000;
}

// ---- Quality score (0–100) ----

/**
 * Compute a quality score (0–100) based on the format and bitrate.
 * Higher bitrate = higher score, with diminishing returns past transparency.
 *
 * For lossless formats (PCM/FLAC/ALAC), the score is based on bit depth and
 * sample rate (CD quality = 80, hi-res = 95+).
 *
 * For lossy formats, the score uses format-specific bitrate thresholds.
 */
export function computeQualityScore(
  format: AudioFormatId,
  bitrateKbps: number,
  sampleRateHz?: number,
  bitDepth?: BitDepthId,
): number {
  if (format === "pcm" || format === "flac" || format === "alac") {
    // Lossless: score based on bit depth + sample rate
    let score = 70;
    if (bitDepth) {
      const depth = getBitDepth(bitDepth).bits;
      if (depth >= 24) score = 90;
      else if (depth >= 16) score = 80;
      else if (depth >= 8) score = 60;
    }
    if (sampleRateHz) {
      if (sampleRateHz >= 96000) score = Math.min(100, score + 8);
      else if (sampleRateHz >= 48000) score = Math.min(100, score + 4);
      else if (sampleRateHz < 22050) score = Math.max(0, score - 15);
    }
    return score;
  }
  // Lossy: format-specific thresholds
  // thresholds[kbps] for [min, low, medium, high, transparent]
  const thresholds: Record<AudioFormatId, [number, number, number, number, number]> = {
    pcm:   [0, 0, 0, 0, 0],
    flac:  [0, 0, 0, 0, 0],
    alac:  [0, 0, 0, 0, 0],
    mp3:   [32, 96, 128, 192, 320],
    aac:   [32, 96, 128, 192, 256],
    ogg:   [32, 96, 128, 192, 256],
    opus:  [16, 48, 96, 128, 192],
  };
  const [min, low, med, high, transparent] = thresholds[format];
  if (bitrateKbps <= 0) return 0;
  if (bitrateKbps >= transparent) return 100;
  if (bitrateKbps >= high) return 90;
  if (bitrateKbps >= med) return 75;
  if (bitrateKbps >= low) return 60;
  if (bitrateKbps >= min) return 40;
  return 20;
}

// ---- Summary stats ----

export interface SummaryStats {
  format: AudioFormatId;
  bitrateBps: number;
  bitrateKbps: number;
  fileSizeBytes: number;
  durationSeconds: number;
  qualityScore: number;
  streamingBps: number;
}

export interface ComputeInput {
  format: AudioFormatId;
  durationSeconds: number;
  sampleRateHz: number;
  bitDepth: BitDepthId;
  channels: ChannelLayoutId;
  quality: QualityPreset;
  compressionRatio?: number;
}

export function computeAll(input: ComputeInput): SummaryStats {
  const bitrateBps = computeEffectiveBitrate(
    input.format,
    input.sampleRateHz,
    input.bitDepth,
    input.channels,
    input.quality,
    input.compressionRatio,
  );
  const bitrateKbps = bitrateBps / 1000;
  const fileSizeBytes = computeFileSizeBytes(bitrateBps, input.durationSeconds);
  const qualityScore = computeQualityScore(
    input.format,
    bitrateKbps,
    input.sampleRateHz,
    input.bitDepth,
  );
  return {
    format: input.format,
    bitrateBps,
    bitrateKbps,
    fileSizeBytes,
    durationSeconds: input.durationSeconds,
    qualityScore,
    streamingBps: computeStreamingRequirement(bitrateBps),
  };
}

// ---- Comparison mode ----

export interface ComparisonRow {
  property: string;
  formatA: string;
  formatB: string;
}

export function compareFormats(a: SummaryStats, b: SummaryStats): ComparisonRow[] {
  return [
    { property: "Format",         formatA: getFormat(a.format).label, formatB: getFormat(b.format).label },
    { property: "Bitrate (kbps)", formatA: a.bitrateKbps.toFixed(1),  formatB: b.bitrateKbps.toFixed(1) },
    { property: "File size",      formatA: formatBytes(a.fileSizeBytes), formatB: formatBytes(b.fileSizeBytes) },
    { property: "Streaming bps",  formatA: a.streamingBps.toLocaleString(), formatB: b.streamingBps.toLocaleString() },
    { property: "Quality score",  formatA: `${a.qualityScore}/100`, formatB: `${b.qualityScore}/100` },
    { property: "Duration (s)",   formatA: a.durationSeconds.toString(), formatB: b.durationSeconds.toString() },
    {
      property: "Size difference",
      formatA: "—",
      formatB: `${b.fileSizeBytes > a.fileSizeBytes ? "+" : ""}${((b.fileSizeBytes - a.fileSizeBytes) / 1024 / 1024).toFixed(2)} MB (${(((b.fileSizeBytes - a.fileSizeBytes) / Math.max(a.fileSizeBytes, 1)) * 100).toFixed(1)}%)`,
    },
  ];
}

// ---- Formatting ----

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

export function formatBitrate(bps: number): string {
  if (!Number.isFinite(bps) || bps <= 0) return "0 bps";
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(2)} Mbps`;
  if (bps >= 1000) return `${(bps / 1000).toFixed(1)} kbps`;
  return `${bps} bps`;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const pad = (n: number) => n < 10 ? `0${n}` : `${n}`;
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

// ---- Renderers ----

export function renderTextReport(stats: SummaryStats): string {
  const lines: string[] = [];
  lines.push("=== Audio Bitrate Calculator Report ===");
  lines.push(`Format:           ${getFormat(stats.format).label}`);
  lines.push(`Duration:         ${formatDuration(stats.durationSeconds)} (${stats.durationSeconds} s)`);
  lines.push(`Bitrate:          ${formatBitrate(stats.bitrateBps)} (${stats.bitrateKbps.toFixed(1)} kbps)`);
  lines.push(`File size:        ${formatBytes(stats.fileSizeBytes)} (${stats.fileSizeBytes.toLocaleString()} bytes)`);
  lines.push(`Streaming req:    ${formatBitrate(stats.streamingBps)} (must be ≤ connection speed)`);
  lines.push(`Quality score:    ${stats.qualityScore}/100`);
  lines.push("");
  lines.push("--- Quality score guide ---");
  lines.push("  90–100: Transparent (indistinguishable from source)");
  lines.push("  75–89:  High quality (small artifacts on critical listening)");
  lines.push("  60–74:  Medium quality (acceptable for casual listening)");
  lines.push("  40–59:  Low quality (noticeable artifacts)");
  lines.push("  0–39:   Very low quality (suitable for speech only)");
  return lines.join("\n");
}

export function renderCsvReport(stats: SummaryStats): string {
  const rows: [string, string][] = [
    ["property", "value"],
    ["format", getFormat(stats.format).label],
    ["format_id", stats.format],
    ["duration_seconds", stats.durationSeconds.toString()],
    ["duration_formatted", formatDuration(stats.durationSeconds)],
    ["bitrate_bps", stats.bitrateBps.toString()],
    ["bitrate_kbps", stats.bitrateKbps.toFixed(2)],
    ["file_size_bytes", stats.fileSizeBytes.toString()],
    ["file_size_formatted", formatBytes(stats.fileSizeBytes)],
    ["streaming_bps", stats.streamingBps.toString()],
    ["quality_score", stats.qualityScore.toString()],
  ];
  return rows.map(([k, v]) => `${escapeCsv(k)},${escapeCsv(v)}`).join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:audio-bitrate-calculator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  format: AudioFormatId;
  durationSeconds: number;
  bitrateKbps: number;
  fileSizeBytes: number;
  qualityScore: number;
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
  format: AudioFormatId;
  duration: string;
  sampleRate: string;
  bitDepth: BitDepthId;
  channels: ChannelLayoutId;
  quality: QualityPreset;
}

export function buildShareUrl(settings: ShareSettings): string {
  const params = new URLSearchParams();
  params.set("format", settings.format);
  if (settings.duration) params.set("duration", settings.duration);
  if (settings.sampleRate) params.set("samplerate", settings.sampleRate);
  params.set("bitdepth", settings.bitDepth);
  params.set("channels", settings.channels);
  params.set("quality", settings.quality);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ShareSettings> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<ShareSettings> = {};
  const fmt = params.get("format");
  if (fmt && FORMATS.some((f) => f.id === fmt)) out.format = fmt as AudioFormatId;
  const dur = params.get("duration");
  if (dur !== null) out.duration = dur;
  const sr = params.get("samplerate");
  if (sr !== null) out.sampleRate = sr;
  const bd = params.get("bitdepth");
  if (bd && BIT_DEPTHS.some((b) => b.id === bd)) out.bitDepth = bd as BitDepthId;
  const ch = params.get("channels");
  if (ch && CHANNEL_LAYOUTS.some((c) => c.id === ch)) out.channels = ch as ChannelLayoutId;
  const q = params.get("quality");
  if (q && QUALITY_PRESETS.some((p) => p.id === q)) out.quality = q as QualityPreset;
  return out;
}
