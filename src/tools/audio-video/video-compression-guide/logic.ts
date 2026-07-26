/**
 * Video Compression Guide — pure logic.
 * Codec selection, CRF settings, resolution scaling, bitrate calc, quality presets.
 */

export interface VideoCodec {
  id: string;
  name: string;
  /** ffmpeg encoder name. */
  encoder: string;
  /** H.264 generation tier — higher = newer. */
  generation: number;
  /** Royalty-free flag. */
  royaltyFree: boolean;
  /** Hardware encoding support notes. */
  hwSupport: string;
  /** Typical CRF range for x264/x265 family. */
  crfRange: [number, number];
  /** Recommended CRF for general use. */
  defaultCrf: number;
  /** Compatibility tier (1 = universal, 5 = newest). */
  compatTier: number;
  /** Pixel formats supported. */
  pixelFormats: string[];
  pros: string[];
  cons: string[];
}

const CODECS: VideoCodec[] = [
  {
    id: "h264", name: "H.264 (AVC)", encoder: "libx264", generation: 2, royaltyFree: false,
    hwSupport: "Universal (Intel QSV, NVENC, VAAPI, VideoToolbox)",
    crfRange: [18, 28], defaultCrf: 23, compatTier: 1, pixelFormats: ["yuv420p", "yuv422p", "yuv444p"],
    pros: ["Universal playback", "Hardware encoding everywhere", "Fast"],
    cons: ["Larger files vs HEVC/AV1", "Patent-encumbered"],
  },
  {
    id: "h265", name: "H.265 (HEVC)", encoder: "libx265", generation: 3, royaltyFree: false,
    hwSupport: "Modern GPUs (NVENC, QSV, VideoToolbox)",
    crfRange: [20, 30], defaultCrf: 28, compatTier: 3, pixelFormats: ["yuv420p", "yuv420p10le"],
    pros: ["~50% smaller than H.264 at same quality", "10-bit support"],
    cons: ["Slower encode", "Licensing headaches", "Safari only with HEIF container"],
  },
  {
    id: "vp9", name: "VP9", encoder: "libvpx-vp9", generation: 3, royaltyFree: true,
    hwSupport: "Chrome on supported GPUs",
    crfRange: [20, 35], defaultCrf: 31, compatTier: 2, pixelFormats: ["yuv420p", "yuv422p", "yuv444p"],
    pros: ["Royalty-free", "Better than H.264 at low bitrate"],
    cons: ["Slow encoding", "No Safari support"],
  },
  {
    id: "av1", name: "AV1", encoder: "libsvtav1", generation: 4, royaltyFree: true,
    hwSupport: "Latest GPUs (RTX 40, Arc, RDNA3)",
    crfRange: [25, 40], defaultCrf: 32, compatTier: 3, pixelFormats: ["yuv420p", "yuv420p10le", "yuv420p12le"],
    pros: ["State-of-the-art compression (~30% better than HEVC)", "Royalty-free", "Future-proof"],
    cons: ["Very slow encode", "Limited HW decode on older devices"],
  },
];

export interface QualityPreset {
  id: string;
  label: string;
  description: string;
  /** CRF value (lower = better quality, larger file). */
  crf: number;
  /** Preset speed (ffmpeg preset name). */
  preset: string;
  /** Perceived quality score 0-100. */
  qualityScore: number;
}

const QUALITY_PRESETS: QualityPreset[] = [
  { id: "archive", label: "Archive / Visually lossless", description: "Indistinguishable from source.", crf: 18, preset: "slow", qualityScore: 98 },
  { id: "high", label: "High quality", description: "Excellent quality, larger file.", crf: 20, preset: "slow", qualityScore: 92 },
  { id: "balanced", label: "Balanced (default)", description: "Recommended for most uses.", crf: 23, preset: "medium", qualityScore: 85 },
  { id: "stream", label: "Streaming", description: "Good quality, smaller file for web.", crf: 26, preset: "medium", qualityScore: 75 },
  { id: "mobile", label: "Mobile / Low bandwidth", description: "Smaller file, reduced quality.", crf: 28, preset: "fast", qualityScore: 65 },
  { id: "smallest", label: "Smallest file", description: "Maximum compression.", crf: 30, preset: "fast", qualityScore: 55 },
];

export interface ResolutionSpec {
  id: string;
  label: string;
  width: number;
  height: number;
  /** Megapixels for bitrate estimation. */
  mp: number;
  typicalUse: string;
}

const RESOLUTIONS: ResolutionSpec[] = [
  { id: "4k", label: "4K UHD", width: 3840, height: 2160, mp: 8.3, typicalUse: "Cinema, premium displays" },
  { id: "2k", label: "2K QHD", width: 2560, height: 1440, mp: 3.7, typicalUse: "Premium streaming" },
  { id: "1080p", label: "1080p Full HD", width: 1920, height: 1080, mp: 2.1, typicalUse: "Standard HD streaming" },
  { id: "720p", label: "720p HD", width: 1280, height: 720, mp: 0.9, typicalUse: "Web video, mobile" },
  { id: "480p", label: "480p SD", width: 854, height: 480, mp: 0.4, typicalUse: "Low-bandwidth mobile" },
  { id: "360p", label: "360p", width: 640, height: 360, mp: 0.2, typicalUse: "Thumbnails, previews" },
];

export interface FpsOption {
  fps: number;
  label: string;
  useCase: string;
}

const FPS_OPTIONS: FpsOption[] = [
  { fps: 24, label: "24 fps", useCase: "Cinema" },
  { fps: 25, label: "25 fps", useCase: "PAL broadcast" },
  { fps: 30, label: "30 fps", useCase: "NTSC broadcast, web" },
  { fps: 50, label: "50 fps", useCase: "Sports (PAL)" },
  { fps: 60, label: "60 fps", useCase: "Gaming, sports, smooth motion" },
  { fps: 120, label: "120 fps", useCase: "Slow-motion capture" },
];

export function getAllCodecs(): VideoCodec[] {
  return [...CODECS];
}

export function getCodecById(id: string): VideoCodec | null {
  return CODECS.find((c) => c.id === id) ?? null;
}

export function getQualityPresets(): QualityPreset[] {
  return [...QUALITY_PRESETS];
}

export function getQualityPreset(id: string): QualityPreset | null {
  return QUALITY_PRESETS.find((q) => q.id === id) ?? null;
}

export function getResolutions(): ResolutionSpec[] {
  return [...RESOLUTIONS];
}

export function getResolution(id: string): ResolutionSpec | null {
  return RESOLUTIONS.find((r) => r.id === id) ?? null;
}

export function getFpsOptions(): FpsOption[] {
  return [...FPS_OPTIONS];
}

/** Estimate bitrate (kbps) using pixel-count × factor model. */
export function estimateBitrateKbps(codec: string, resolutionId: string, fps: number, qualityPreset: string): number {
  const res = getResolution(resolutionId);
  const preset = getQualityPreset(qualityPreset);
  const c = getCodecById(codec);
  if (!res || !preset || !c) return 0;
  // Base bitrate per megapixel at 30fps for H.264 at balanced preset (CRF 23).
  const basePerMp = 1800; // kbps per MP
  let multiplier = 1;
  if (c.id === "h265") multiplier = 0.55;
  if (c.id === "vp9") multiplier = 0.55;
  if (c.id === "av1") multiplier = 0.40;
  // CRF impact — lower CRF means higher bitrate. Linear approx around CRF 23.
  const crfDelta = preset.crf - 23;
  const crfFactor = Math.pow(1.15, -crfDelta);
  // FPS scaling
  const fpsFactor = Math.max(0.5, fps / 30);
  return Math.round(res.mp * basePerMp * multiplier * crfFactor * fpsFactor);
}

export interface CompressionJob {
  codec: string;
  resolution: string;
  fps: number;
  qualityPreset: string;
  durationSeconds: number;
  audioBitrateKbps: number;
}

export interface CompressionResult {
  job: CompressionJob;
  codec: VideoCodec | null;
  resolution: ResolutionSpec | null;
  preset: QualityPreset | null;
  videoBitrateKbps: number;
  audioBitrateKbps: number;
  totalBitrateKbps: number;
  estimatedSizeBytes: number;
  estimatedSizeHuman: string;
  ffmpegCommand: string;
  warnings: string[];
  notes: string[];
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

export function planCompression(job: CompressionJob): CompressionResult {
  const codec = getCodecById(job.codec);
  const resolution = getResolution(job.resolution);
  const preset = getQualityPreset(job.qualityPreset);
  const warnings: string[] = [];
  const notes: string[] = [];

  if (!codec) warnings.push("Unknown codec.");
  if (!resolution) warnings.push("Unknown resolution.");
  if (!preset) warnings.push("Unknown quality preset.");
  if (job.fps < 1 || job.fps > 240) warnings.push("FPS should be between 1 and 240.");
  if (job.durationSeconds < 0) warnings.push("Duration must be ≥ 0.");
  if (job.audioBitrateKbps < 0 || job.audioBitrateKbps > 512) warnings.push("Audio bitrate out of range (0-512 kbps).");

  const videoBitrateKbps = estimateBitrateKbps(job.codec, job.resolution, job.fps, job.qualityPreset);
  const audioBitrateKbps = Math.max(0, Math.min(512, job.audioBitrateKbps || 0));
  const totalBitrateKbps = videoBitrateKbps + audioBitrateKbps;
  const estimatedSizeBytes = Math.round((totalBitrateKbps * 1000 * job.durationSeconds) / 8);

  if (codec && preset) {
    if (preset.crf < codec.crfRange[0]) {
      warnings.push(`CRF ${preset.crf} below recommended range [${codec.crfRange[0]}, ${codec.crfRange[1]}] for ${codec.name} — file may be unnecessarily large.`);
    }
    if (preset.crf > codec.crfRange[1]) {
      warnings.push(`CRF ${preset.crf} above recommended range [${codec.crfRange[0]}, ${codec.crfRange[1]}] for ${codec.name} — visible quality loss likely.`);
    }
    if (codec.id === "av1" && preset.preset === "slow") {
      notes.push("AV1 with 'slow' preset is extremely CPU-intensive; consider 'medium' for testing.");
    }
    if (codec.id === "h265" && job.resolution === "4k") {
      notes.push("HEVC at 4K benefits greatly from hardware encoding (NVENC/QSV) — use 'hevc_nvenc' or 'hevc_qsv'.");
    }
  }

  const ffmpegCommand = codec && resolution && preset
    ? `ffmpeg -i input.mp4 -c:v ${codec.encoder} -preset ${preset.preset} -crf ${preset.crf} -b:v ${videoBitrateKbps}k -s ${resolution.width}x${resolution.height} -r ${job.fps} -c:a aac -b:a ${audioBitrateKbps}k output.mp4`
    : "";

  return {
    job, codec, resolution, preset,
    videoBitrateKbps, audioBitrateKbps, totalBitrateKbps,
    estimatedSizeBytes, estimatedSizeHuman: formatBytes(estimatedSizeBytes),
    ffmpegCommand, warnings, notes,
  };
}

export function planBatch(jobs: CompressionJob[]): CompressionResult[] {
  return jobs.map(planCompression);
}

export function renderBatchCsv(results: CompressionResult[]): string {
  const lines: string[] = ["codec,resolution,fps,quality,duration_s,video_kbps,audio_kbps,total_kbps,size_bytes"];
  for (const r of results) {
    lines.push([
      r.job.codec, r.job.resolution, r.job.fps, r.job.qualityPreset, r.job.durationSeconds.toFixed(2),
      r.videoBitrateKbps, r.audioBitrateKbps, r.totalBitrateKbps, r.estimatedSizeBytes,
    ].join(","));
  }
  return lines.join("\n");
}

export function renderReport(r: CompressionResult): string {
  const lines: string[] = [];
  lines.push("Video Compression Plan");
  lines.push("=======================");
  lines.push(`Codec: ${r.codec?.name ?? "—"} (${r.codec?.encoder ?? "—"})`);
  lines.push(`Resolution: ${r.resolution?.label ?? "—"} (${r.resolution?.width ?? "—"}×${r.resolution?.height ?? "—"})`);
  lines.push(`FPS: ${r.job.fps}`);
  lines.push(`Quality: ${r.preset?.label ?? "—"} (CRF ${r.preset?.crf ?? "—"}, preset ${r.preset?.preset ?? "—"})`);
  lines.push(`Video bitrate: ${r.videoBitrateKbps} kbps`);
  lines.push(`Audio bitrate: ${r.audioBitrateKbps} kbps`);
  lines.push(`Total bitrate: ${r.totalBitrateKbps} kbps`);
  lines.push(`Duration: ${r.job.durationSeconds.toFixed(2)} s`);
  lines.push(`Estimated size: ${r.estimatedSizeHuman} (${r.estimatedSizeBytes} bytes)`);
  lines.push("");
  lines.push("ffmpeg command:");
  lines.push(r.ffmpegCommand || "—");
  if (r.warnings.length) { lines.push(""); lines.push("Warnings:"); r.warnings.forEach((w) => lines.push(`  ! ${w}`)); }
  if (r.notes.length) { lines.push(""); lines.push("Notes:"); r.notes.forEach((n) => lines.push(`  • ${n}`)); }
  return lines.join("\n");
}

/** Recommend a codec for a given use case. */
export function recommendCodec(useCase: "web" | "archive" | "broadcast" | "mobile" | "gaming"): VideoCodec | null {
  switch (useCase) {
    case "web": return getCodecById("h264");
    case "archive": return getCodecById("h265");
    case "broadcast": return getCodecById("h264");
    case "mobile": return getCodecById("h264");
    case "gaming": return getCodecById("h264");
    default: return null;
  }
}

/** Suggest a target resolution based on source pixel count. */
export function suggestResolution(sourceWidth: number, sourceHeight: number): ResolutionSpec | null {
  const mp = (sourceWidth * sourceHeight) / 1_000_000;
  let best: ResolutionSpec | null = null;
  let bestDist = Infinity;
  for (const r of RESOLUTIONS) {
    const d = Math.abs(r.mp - mp);
    if (d < bestDist) { bestDist = d; best = r; }
  }
  return best;
}
