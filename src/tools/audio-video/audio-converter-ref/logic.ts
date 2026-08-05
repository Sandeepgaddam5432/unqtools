/**
 * Audio Converter Reference — pure logic.
 * Reference table for converting between common audio formats with quality,
 * bitrate, sample rate, and channel guidance plus compatibility matrix.
 */

export interface AudioFormatSpec {
  id: string;
  name: string;
  extension: string;
  mimeType: string;
  lossless: boolean;
  /** Recommended encoder (open-source, command-line id). */
  encoder: string;
  /** Compatible browsers (display names). */
  browsers: string[];
  /** Compatible hardware/OS platforms. */
  platforms: string[];
  /** Recommended bitrate range in kbps for stereo music (lossy formats). */
  bitrateRange: [number, number];
  /** Default/typical sample rates in Hz. */
  sampleRates: number[];
  /** Max supported channels. */
  maxChannels: number;
  pros: string[];
  cons: string[];
  useCases: string[];
}

const FORMATS: AudioFormatSpec[] = [
  {
    id: "mp3", name: "MP3 (MPEG-1 Layer III)", extension: ".mp3", mimeType: "audio/mpeg",
    lossless: false, encoder: "lame", browsers: ["All"], platforms: ["All"],
    bitrateRange: [128, 320], sampleRates: [32000, 44100, 48000], maxChannels: 2,
    pros: ["Universal compatibility", "Small file size"],
    cons: ["Lossy", "Outdated encoder", "No multi-channel"],
    useCases: ["Music streaming", "Podcasts", "Audio books"],
  },
  {
    id: "wav", name: "WAV (PCM)", extension: ".wav", mimeType: "audio/wav",
    lossless: true, encoder: "pcm_s16le", browsers: ["All"], platforms: ["All"],
    bitrateRange: [1411, 1411], sampleRates: [8000, 22050, 44100, 48000, 96000], maxChannels: 8,
    pros: ["Uncompressed", "Editing friendly", "Universal"],
    cons: ["Very large files", "No compression"],
    useCases: ["Audio editing", "Sound effects", "Mastering"],
  },
  {
    id: "aac", name: "AAC (Advanced Audio Coding)", extension: ".m4a", mimeType: "audio/aac",
    lossless: false, encoder: "aac", browsers: ["All modern"], platforms: ["iOS", "Android", "macOS"],
    bitrateRange: [96, 256], sampleRates: [44100, 48000, 96000], maxChannels: 8,
    pros: ["Better than MP3 at same bitrate", "Apple ecosystem native"],
    cons: ["Lossy", "Licensing required"],
    useCases: ["Apple Music", "YouTube", "Streaming"],
  },
  {
    id: "ogg", name: "Ogg Vorbis", extension: ".ogg", mimeType: "audio/ogg",
    lossless: false, encoder: "libvorbis", browsers: ["Firefox", "Chrome"], platforms: ["Linux", "Android"],
    bitrateRange: [64, 500], sampleRates: [44100, 48000], maxChannels: 8,
    pros: ["Open source", "Better than MP3 at low bitrates"],
    cons: ["Not in Safari", "Smaller device support"],
    useCases: ["Web audio", "Game audio", "Open-source projects"],
  },
  {
    id: "flac", name: "FLAC (Free Lossless Audio Codec)", extension: ".flac", mimeType: "audio/flac",
    lossless: true, encoder: "flac", browsers: ["Chrome", "Firefox", "Edge"], platforms: ["Most modern"],
    bitrateRange: [800, 1100], sampleRates: [44100, 48000, 96000, 192000], maxChannels: 8,
    pros: ["Lossless", "Open source", "50-70% smaller than WAV"],
    cons: ["Larger than lossy formats", "Not Safari <11"],
    useCases: ["Music archiving", "Hi-Fi playback", "Studio masters"],
  },
  {
    id: "opus", name: "Opus", extension: ".opus", mimeType: "audio/opus",
    lossless: false, encoder: "libopus", browsers: ["Chrome", "Firefox", "Edge"], platforms: ["Android 5.1+", "Linux"],
    bitrateRange: [6, 510], sampleRates: [8000, 12000, 16000, 24000, 48000], maxChannels: 8,
    pros: ["State-of-the-art quality", "Low latency", "Highly efficient"],
    cons: ["Limited device support", "No native iOS older"],
    useCases: ["VoIP", "Real-time comms", "Streaming"],
  },
];

export interface QualityPreset {
  id: string;
  label: string;
  description: string;
  /** Recommended bitrate (kbps) for stereo music (lossy formats). */
  bitrateKbps: number;
  /** Recommended sample rate (Hz). */
  sampleRate: number;
  /** Perceived quality score 0-100. */
  qualityScore: number;
}

const QUALITY_PRESETS: QualityPreset[] = [
  { id: "voice", label: "Voice / Speech", description: "Low bitrate, optimised for speech.", bitrateKbps: 64, sampleRate: 22050, qualityScore: 40 },
  { id: "stream", label: "Streaming", description: "Good balance for online streaming.", bitrateKbps: 128, sampleRate: 44100, qualityScore: 65 },
  { id: "standard", label: "Standard music", description: "Transparent for casual listeners.", bitrateKbps: 192, sampleRate: 44100, qualityScore: 80 },
  { id: "high", label: "High quality", description: "Near-transparent for most music.", bitrateKbps: 256, sampleRate: 48000, qualityScore: 90 },
  { id: "transparent", label: "Transparent", description: "Indistinguishable from source for nearly all listeners.", bitrateKbps: 320, sampleRate: 48000, qualityScore: 95 },
  { id: "lossless", label: "Lossless", description: "Bit-perfect copy of source. Use FLAC/WAV only.", bitrateKbps: 1000, sampleRate: 96000, qualityScore: 100 },
];

/** Common sample rates in Hz with their typical use cases. */
export const SAMPLE_RATES: { hz: number; label: string; useCase: string }[] = [
  { hz: 8000, label: "8 kHz", useCase: "Telephone quality" },
  { hz: 16000, label: "16 kHz", useCase: "Voice over IP (narrowband)" },
  { hz: 22050, label: "22.05 kHz", useCase: "Voice / low-quality audio" },
  { hz: 32000, label: "32 kHz", useCase: "MiniDV / DAT (long play)" },
  { hz: 44100, label: "44.1 kHz", useCase: "Audio CD (Red Book)" },
  { hz: 48000, label: "48 kHz", useCase: "Pro audio / video / DVD" },
  { hz: 96000, label: "96 kHz", useCase: "Hi-res / studio" },
  { hz: 192000, label: "192 kHz", useCase: "Ultra hi-res" },
];

/** Channel configuration options. */
export interface ChannelConfig {
  id: string;
  label: string;
  channelCount: number;
  description: string;
}

export const CHANNEL_CONFIGS: ChannelConfig[] = [
  { id: "mono", label: "Mono", channelCount: 1, description: "Single channel — voice, podcasts." },
  { id: "stereo", label: "Stereo", channelCount: 2, description: "Left + right — standard music." },
  { id: "2.1", label: "2.1", channelCount: 3, description: "Stereo + subwoofer." },
  { id: "5.1", label: "5.1 Surround", channelCount: 6, description: "5 speakers + subwoofer — cinema." },
  { id: "7.1", label: "7.1 Surround", channelCount: 8, description: "7 speakers + subwoofer — home theatre." },
];

export function getAllFormats(): AudioFormatSpec[] {
  return [...FORMATS];
}

export function getFormatById(id: string): AudioFormatSpec | null {
  return FORMATS.find((f) => f.id === id) ?? null;
}

export function getFormatByExtension(ext: string): AudioFormatSpec | null {
  const e = ext.toLowerCase().trim().replace(/^\./, "");
  return FORMATS.find((f) => f.extension.replace(/^\./, "") === e) ?? null;
}

export function getQualityPresets(): QualityPreset[] {
  return [...QUALITY_PRESETS];
}

export function getQualityPreset(id: string): QualityPreset | null {
  return QUALITY_PRESETS.find((q) => q.id === id) ?? null;
}

export function getSampleRates() {
  return [...SAMPLE_RATES];
}

export function getChannelConfigs(): ChannelConfig[] {
  return [...CHANNEL_CONFIGS];
}

export function filterLossless(lossless: boolean): AudioFormatSpec[] {
  return FORMATS.filter((f) => f.lossless === lossless);
}

/** Compatibility matrix: which formats play on which browsers. */
export interface CompatibilityCell {
  formatId: string;
  browser: string;
  supported: "yes" | "no" | "partial";
  note?: string;
}

const BROWSERS = ["Chrome", "Firefox", "Safari", "Edge", "Opera"];
const COMPAT: Record<string, Record<string, "yes" | "no" | "partial">> = {
  mp3: { Chrome: "yes", Firefox: "yes", Safari: "yes", Edge: "yes", Opera: "yes" },
  wav: { Chrome: "yes", Firefox: "yes", Safari: "yes", Edge: "yes", Opera: "yes" },
  aac: { Chrome: "yes", Firefox: "yes", Safari: "yes", Edge: "yes", Opera: "yes" },
  ogg: { Chrome: "yes", Firefox: "yes", Safari: "no", Edge: "yes", Opera: "yes" },
  flac: { Chrome: "yes", Firefox: "yes", Safari: "partial", Edge: "yes", Opera: "yes" },
  opus: { Chrome: "yes", Firefox: "yes", Safari: "partial", Edge: "yes", Opera: "yes" },
};

export function getCompatibilityMatrix(): CompatibilityCell[] {
  const out: CompatibilityCell[] = [];
  for (const f of FORMATS) {
    for (const b of BROWSERS) {
      const supported = COMPAT[f.id]?.[b] ?? "no";
      out.push({ formatId: f.id, browser: b, supported });
    }
  }
  return out;
}

export function getCompatForFormat(formatId: string): CompatibilityCell[] {
  return getCompatibilityMatrix().filter((c) => c.formatId === formatId);
}

/** Estimate output file size in bytes for a bitrate + duration (seconds). */
export function estimateFileSize(bitrateKbps: number, seconds: number): number {
  if (bitrateKbps < 0 || seconds < 0) return 0;
  return Math.round((bitrateKbps * 1000 * seconds) / 8);
}

/** Estimate WAV (PCM) file size for given sampleRate, channels, bits, duration (s). */
export function estimateWavSize(sampleRate: number, channels: number, bitsPerSample: number, seconds: number): number {
  if (seconds < 0) return 0;
  return Math.round(44 + sampleRate * channels * (bitsPerSample / 8) * seconds);
}

/** Format bytes human-readable. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

export interface ConversionJob {
  sourceFormat: string;
  targetFormat: string;
  qualityPreset: string;
  channelConfig: string;
  durationSeconds: number;
}

export interface ConversionResult {
  job: ConversionJob;
  source: AudioFormatSpec | null;
  target: AudioFormatSpec | null;
  preset: QualityPreset | null;
  channels: ChannelConfig | null;
  estimatedSizeBytes: number;
  estimatedSizeHuman: string;
  recommendedEncoderArgs: string;
  warnings: string[];
  notes: string[];
}

/** Validate a conversion job and produce a result with size estimate & guidance. */
export function planConversion(job: ConversionJob): ConversionResult {
  const warnings: string[] = [];
  const notes: string[] = [];
  const source = getFormatById(job.sourceFormat);
  const target = getFormatById(job.targetFormat);
  const preset = getQualityPreset(job.qualityPreset);
  const channels = getChannelConfigs().find((c) => c.id === job.channelConfig) ?? null;

  if (!source) warnings.push("Unknown source format.");
  if (!target) warnings.push("Unknown target format.");
  if (!preset) warnings.push("Unknown quality preset.");
  if (!channels) warnings.push("Unknown channel configuration.");

  if (source && target) {
    if (target.lossless && !source.lossless) {
      notes.push(`Converting lossy ${source.name} → lossless ${target.name} will NOT restore lost data; file size will balloon with no quality gain.`);
    }
    if (channels && target.maxChannels < channels.channelCount) {
      warnings.push(`${target.name} supports up to ${target.maxChannels} channels; down-mixing from ${channels.channelCount}.`);
    }
    if (preset?.id === "lossless" && !target.lossless) {
      warnings.push("Lossless preset selected but target format is lossy — switch target to FLAC or WAV.");
    }
  }

  let estimatedSizeBytes = 0;
  let recommendedEncoderArgs = "";
  if (target && preset && channels) {
    if (target.lossless) {
      const sampleRate = preset.sampleRate;
      const bits = 16;
      estimatedSizeBytes = estimateWavSize(sampleRate, channels.channelCount, bits, job.durationSeconds);
      recommendedEncoderArgs = target.id === "flac"
        ? `ffmpeg -i input.${source?.extension.slice(1) ?? "wav"} -c:a flac -compression_level 8 output.flac`
        : `ffmpeg -i input.${source?.extension.slice(1) ?? "wav"} -c:a pcm_s16le -ar ${sampleRate} -ac ${channels.channelCount} output.wav`;
    } else {
      estimatedSizeBytes = estimateFileSize(preset.bitrateKbps, job.durationSeconds);
      recommendedEncoderArgs = `ffmpeg -i input.${source?.extension.slice(1) ?? "wav"} -c:a ${target.encoder} -b:a ${preset.bitrateKbps}k -ar ${preset.sampleRate} -ac ${channels.channelCount} output${target.extension}`;
    }
  }

  return {
    job, source, target, preset, channels,
    estimatedSizeBytes,
    estimatedSizeHuman: formatBytes(estimatedSizeBytes),
    recommendedEncoderArgs,
    warnings, notes,
  };
}

/** Plan multiple conversions in batch; returns results array. */
export function planBatch(jobs: ConversionJob[]): ConversionResult[] {
  return jobs.map(planConversion);
}

/** Render a batch result as CSV. */
export function renderBatchCsv(results: ConversionResult[]): string {
  const lines: string[] = ["source,target,quality,channels,duration_s,size_bytes,size_human"];
  for (const r of results) {
    lines.push([
      r.job.sourceFormat, r.job.targetFormat, r.job.qualityPreset, r.job.channelConfig,
      r.job.durationSeconds.toFixed(2), String(r.estimatedSizeBytes), r.estimatedSizeHuman,
    ].join(","));
  }
  return lines.join("\n");
}

/** Render a single result as plain text report. */
export function renderReport(r: ConversionResult): string {
  const lines: string[] = [];
  lines.push("Audio Conversion Plan");
  lines.push("======================");
  lines.push(`Source: ${r.source?.name ?? "—"} (${r.source?.extension ?? "—"})`);
  lines.push(`Target: ${r.target?.name ?? "—"} (${r.target?.extension ?? "—"})`);
  lines.push(`Quality: ${r.preset?.label ?? "—"} (${r.preset?.bitrateKbps ?? "—"} kbps, ${r.preset?.sampleRate ?? "—"} Hz)`);
  lines.push(`Channels: ${r.channels?.label ?? "—"}`);
  lines.push(`Duration: ${r.job.durationSeconds.toFixed(2)} s`);
  lines.push(`Estimated size: ${r.estimatedSizeHuman} (${r.estimatedSizeBytes} bytes)`);
  lines.push("");
  lines.push("Recommended encoder command:");
  lines.push(r.recommendedEncoderArgs || "—");
  if (r.warnings.length) {
    lines.push("");
    lines.push("Warnings:");
    r.warnings.forEach((w) => lines.push(`  ! ${w}`));
  }
  if (r.notes.length) {
    lines.push("");
    lines.push("Notes:");
    r.notes.forEach((n) => lines.push(`  • ${n}`));
  }
  return lines.join("\n");
}

/** Search formats by name/extension/use case. */
export function searchFormats(query: string): AudioFormatSpec[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...FORMATS];
  return FORMATS.filter((f) =>
    f.name.toLowerCase().includes(q) || f.id.includes(q) || f.extension.includes(q) ||
    f.useCases.some((u) => u.toLowerCase().includes(q)) || f.encoder.includes(q)
  );
}
