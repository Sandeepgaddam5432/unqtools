/**
 * Video Bitrate Guide — pure logic.
 * bitrate = width × height × fps × bitDepth × compression factor.
 */

export interface CodecInfo {
  id: string;
  name: string;
  /** Bits per pixel per frame target (good-quality). */
  bpp: number;
  efficiency: number; // 0..1 — modern codec efficiency vs H.264 baseline
  typicalUse: string;
  notes: string;
}

export const CODECS: CodecInfo[] = [
  { id: "h264", name: "H.264 / AVC", bpp: 0.1, efficiency: 0.55, typicalUse: "YouTube, web, streaming baseline", notes: "Universal compatibility." },
  { id: "h265", name: "H.265 / HEVC", bpp: 0.05, efficiency: 0.75, typicalUse: "4K streaming, HDR, mobile", notes: "~50% smaller than H.264 at same quality." },
  { id: "av1", name: "AV1", bpp: 0.03, efficiency: 0.9, typicalUse: "YouTube 8K, Netflix premium", notes: "Open-source, slow to encode, very efficient." },
  { id: "vp9", name: "VP9", bpp: 0.045, efficiency: 0.78, typicalUse: "YouTube, WebM", notes: "Google's open-source codec." },
  { id: "prores", name: "Apple ProRes 422", bpp: 0.5, efficiency: 0.3, typicalUse: "Editing, mastering", notes: "I-frame only, near-lossless, large files." },
  { id: "prores-hq", name: "Apple ProRes 422 HQ", bpp: 0.66, efficiency: 0.25, typicalUse: "Broadcast mastering", notes: "Higher bitrate ProRes variant." },
  { id: "dnxhr", name: "DNxHR HQX", bpp: 0.6, efficiency: 0.28, typicalUse: "Avid mastering", notes: "Avid's intermediate codec." },
];

export interface ResolutionInfo {
  id: string;
  name: string;
  width: number;
  height: number;
  category: "SD" | "HD" | "FHD" | "4K" | "8K";
}

export const RESOLUTIONS: ResolutionInfo[] = [
  { id: "480p", name: "480p (SD)", width: 854, height: 480, category: "SD" },
  { id: "720p", name: "720p (HD)", width: 1280, height: 720, category: "HD" },
  { id: "1080p", name: "1080p (FHD)", width: 1920, height: 1080, category: "FHD" },
  { id: "1440p", name: "1440p (QHD)", width: 2560, height: 1440, category: "FHD" },
  { id: "4k", name: "4K (UHD)", width: 3840, height: 2160, category: "4K" },
  { id: "8k", name: "8K (FUHD)", width: 7680, height: 4320, category: "8K" },
];

export function getAllCodecs(): CodecInfo[] {
  return [...CODECS];
}

export function getCodecById(id: string): CodecInfo | null {
  return CODECS.find((c) => c.id === id) ?? null;
}

export function getAllResolutions(): ResolutionInfo[] {
  return [...RESOLUTIONS];
}

export function getResolutionById(id: string): ResolutionInfo | null {
  return RESOLUTIONS.find((r) => r.id === id) ?? null;
}

/** Bits per pixel (bpp) calculation. */
export function computeBpp(bitrateMbps: number, width: number, height: number, fps: number): number {
  if (width <= 0 || height <= 0 || fps <= 0) return 0;
  const bitsPerSec = bitrateMbps * 1_000_000;
  return bitsPerSec / (width * height * fps);
}

/** Recommended bitrate (Mbps) for given resolution/fps/codec. */
export function recommendBitrate(width: number, height: number, fps: number, codec: CodecInfo, bitDepth = 8): number {
  if (width <= 0 || height <= 0 || fps <= 0) return 0;
  const pixels = width * height;
  const depthMultiplier = bitDepth > 8 ? 1 + (bitDepth - 8) * 0.15 : 1;
  const bitsPerSec = pixels * fps * codec.bpp * depthMultiplier;
  return bitsPerSec / 1_000_000;
}

/** Estimate file size (MB) for bitrate (Mbps) and duration (sec). */
export function estimateFileSizeMb(durationSec: number, bitrateMbps: number): number {
  if (durationSec <= 0 || bitrateMbps <= 0) return 0;
  return (durationSec * bitrateMbps) / 8;
}

/** Bandwidth needed for streaming (Mbps, with 20% overhead). */
export function streamingBandwidth(bitrateMbps: number): number {
  return bitrateMbps * 1.2;
}

/** Quality rating from bpp. */
export function rateQuality(bpp: number): { label: string; color: string } {
  if (bpp >= 0.2) return { label: "Excellent (lossless-tier)", color: "emerald" };
  if (bpp >= 0.1) return { label: "Good", color: "blue" };
  if (bpp >= 0.05) return { label: "Acceptable", color: "amber" };
  if (bpp >= 0.02) return { label: "Streaming-tier (lossy)", color: "orange" };
  return { label: "Poor / blocky", color: "red" };
}

/** Compare codecs for the same resolution/fps — returns estimated bitrate & size. */
export function compareCodecs(width: number, height: number, fps: number, durationSec: number): Array<{ codec: string; bitrateMbps: number; sizeMb: number; bpp: number }> {
  return CODECS.map((c) => {
    const bitrate = recommendBitrate(width, height, fps, c);
    return {
      codec: c.name,
      bitrateMbps: bitrate,
      sizeMb: estimateFileSizeMb(durationSec, bitrate),
      bpp: c.bpp,
    };
  });
}

/** Format as CSV. */
export function exportComparisonCSV(width: number, height: number, fps: number, durationSec: number): string {
  const header = ["codec", "bitrate_mbps", "size_mb", "bpp"];
  const rows = compareCodecs(width, height, fps, durationSec).map((r) =>
    [r.codec, r.bitrateMbps.toFixed(3), r.sizeMb.toFixed(2), r.bpp.toFixed(4)].join(","),
  );
  return [header.join(","), ...rows].join("\n");
}

/** Suggest codec for given constraints. */
export function suggestCodec(constraints: { qualityPriority: boolean; editing: boolean; bandwidthLimited: boolean }): CodecInfo {
  if (constraints.editing) return getCodecById("prores")!;
  if (constraints.bandwidthLimited) return getCodecById("av1")!;
  if (constraints.qualityPriority) return getCodecById("h265")!;
  return getCodecById("h264")!;
}

/** Validate inputs. */
export function validateInputs(width: number, height: number, fps: number, bitrate: number): string[] {
  const w: string[] = [];
  if (width <= 0 || height <= 0) w.push("Resolution must be positive.");
  if (fps <= 0 || fps > 1000) w.push("FPS must be between 1 and 1000.");
  if (bitrate < 0) w.push("Bitrate cannot be negative.");
  if (bitrate > 1000) w.push("Bitrate above 1000 Mbps is unusual — verify your hardware encoder supports it.");
  return w;
}

/** YouTube recommended bitrate table. */
export function youtubeRecommended(resolutionId: string, fps: number): { standard: number; high: number } | null {
  const r = getResolutionById(resolutionId);
  if (!r) return null;
  const isHighFps = fps >= 50;
  const map: Record<string, [number, number]> = {
    "480p": [2.5, 4],
    "720p": [5, 7.5],
    "1080p": [8, 12],
    "1440p": [16, 24],
    "4k": [40, 60],
    "8k": [120, 180],
  };
  const entry = map[resolutionId];
  if (!entry) return null;
  return { standard: entry[0] * (isHighFps ? 1.5 : 1), high: entry[1] * (isHighFps ? 1.5 : 1) };
}

/** Calculate estimated CRF (constant rate factor) recommendation for H.264. */
export function recommendCRF(qualityTarget: "draft" | "standard" | "high" | "archive"): number {
  const map = { draft: 28, standard: 23, high: 18, archive: 14 };
  return map[qualityTarget];
}

/** Format recommendation as text. */
export function formatRecommendation(width: number, height: number, fps: number, codec: CodecInfo, bitrate: number): string {
  const q = rateQuality(computeBpp(bitrate, width, height, fps));
  return [
    `${width}×${height} @ ${fps}fps — ${codec.name}`,
    `Recommended bitrate: ${bitrate.toFixed(2)} Mbps`,
    `Bits per pixel:      ${computeBpp(bitrate, width, height, fps).toFixed(4)}`,
    `Quality rating:      ${q.label}`,
  ].join("\n");
}
