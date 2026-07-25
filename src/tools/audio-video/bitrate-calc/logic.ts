/**
 * Bitrate Calculator — pure logic.
 * Calculate raw/uncompressed and compressed bitrate for audio and video.
 */

export interface VideoBitrateInput {
  width: number;
  height: number;
  fps: number;
  colorDepth: number; // bits per channel per pixel (8, 10, 12)
  chromaSubsampling: "4:4:4" | "4:2:2" | "4:2:0";
}

export interface AudioBitrateInput {
  sampleRate: number; // Hz
  bitDepth: number; // 16, 24, 32
  channels: number; // 1, 2, 6, 8
}

export interface BitrateResult {
  rawBitrateBps: number;
  rawBitrateKbps: number;
  rawBitrateMbps: number;
  compressedBitrateKbps: number; // user-supplied target compression factor
  compressedBitrateMbps: number;
}

/** Multiplier from chroma subsampling (compared to 4:4:4). */
export function chromaMultiplier(subsampling: VideoBitrateInput["chromaSubsampling"]): number {
  switch (subsampling) {
    case "4:4:4": return 1.0;
    case "4:2:2": return 2 / 3;
    case "4:2:0": return 0.5;
    default: return 1.0;
  }
}

export function calculateVideoBitrate(input: VideoBitrateInput, compressionFactor = 0.02): BitrateResult {
  if (input.width <= 0 || input.height <= 0 || input.fps <= 0 || input.colorDepth <= 0) {
    return { rawBitrateBps: 0, rawBitrateKbps: 0, rawBitrateMbps: 0, compressedBitrateKbps: 0, compressedBitrateMbps: 0 };
  }
  const pixelsPerFrame = input.width * input.height;
  const bytesPerPixel = (input.colorDepth / 8) * 3 * chromaMultiplier(input.chromaSubsampling);
  const bytesPerFrame = pixelsPerFrame * bytesPerPixel;
  const rawBitrateBps = bytesPerFrame * input.fps * 8;
  const rawBitrateKbps = rawBitrateBps / 1000;
  const rawBitrateMbps = rawBitrateKbps / 1000;
  const compressedBitrateKbps = rawBitrateKbps * compressionFactor;
  const compressedBitrateMbps = compressedBitrateKbps / 1000;
  return { rawBitrateBps, rawBitrateKbps, rawBitrateMbps, compressedBitrateKbps, compressedBitrateMbps };
}

export function calculateAudioBitrate(input: AudioBitrateInput, compressionFactor = 0.1): BitrateResult {
  if (input.sampleRate <= 0 || input.bitDepth <= 0 || input.channels <= 0) {
    return { rawBitrateBps: 0, rawBitrateKbps: 0, rawBitrateMbps: 0, compressedBitrateKbps: 0, compressedBitrateMbps: 0 };
  }
  const rawBitrateBps = input.sampleRate * input.bitDepth * input.channels;
  const rawBitrateKbps = rawBitrateBps / 1000;
  const rawBitrateMbps = rawBitrateKbps / 1000;
  const compressedBitrateKbps = rawBitrateKbps * compressionFactor;
  const compressedBitrateMbps = compressedBitrateKbps / 1000;
  return { rawBitrateBps, rawBitrateKbps, rawBitrateMbps, compressedBitrateKbps, compressedBitrateMbps };
}

/** Estimate file size in MB from bitrate (kbps) and duration (seconds). */
export function estimateFileSizeMB(bitrateKbps: number, durationSeconds: number): number {
  if (bitrateKbps < 0 || durationSeconds < 0) return 0;
  const bytes = (bitrateKbps * 1000 * durationSeconds) / 8;
  return bytes / (1024 * 1024);
}

/** Suggest a reasonable compression factor based on codec. */
export function suggestCompressionFactor(codec: "h264" | "h265" | "av1" | "vp9" | "mp3" | "aac" | "opus" | "flac"): number {
  switch (codec) {
    case "h264": return 0.02;
    case "h265": return 0.012;
    case "av1": return 0.008;
    case "vp9": return 0.012;
    case "mp3": return 0.1;
    case "aac": return 0.08;
    case "opus": return 0.05;
    case "flac": return 0.5;
    default: return 0.02;
  }
}

export function formatBitrate(kbps: number): string {
  if (kbps >= 1000) return `${(kbps / 1000).toFixed(2)} Mbps`;
  return `${kbps.toFixed(0)} kbps`;
}

export function validateVideoInput(input: VideoBitrateInput): string | null {
  if (input.width <= 0 || input.height <= 0) return "Resolution must be positive.";
  if (input.fps <= 0 || input.fps > 240) return "FPS must be between 1 and 240.";
  if (![8, 10, 12, 16].includes(input.colorDepth)) return "Color depth must be 8, 10, 12, or 16.";
  return null;
}

export function validateAudioInput(input: AudioBitrateInput): string | null {
  if (input.sampleRate <= 0) return "Sample rate must be positive.";
  if (![8, 16, 24, 32].includes(input.bitDepth)) return "Bit depth must be 8, 16, 24, or 32.";
  if (input.channels <= 0 || input.channels > 16) return "Channels must be 1-16.";
  return null;
}
