/**
 * GIF Splitter — pure logic.
 * Parses a GIF into frame descriptors with timing, disposal, and transparency
 * info, and produces per-frame PNG export plans. Decoding GIF bytes is the
 * runtime responsibility; this module exposes typed helpers to extract
 * metadata and plan exports.
 */

export interface GifFrame {
  index: number;
  delayMs: number;
  left: number;
  top: number;
  width: number;
  height: number;
  disposal: 0 | 1 | 2 | 3;
  transparentIndex: number | null;
  interlaced: boolean;
  colorTableSize: number;
}

export interface GifMetadata {
  width: number;
  height: number;
  globalColorCount: number;
  backgroundColorIndex: number;
  loopCount: number; // 0 = infinite
  frames: GifFrame[];
  totalDurationMs: number;
  avgFps: number;
  hasTransparency: boolean;
  sourceBytes: number;
}

/** Compute the number of bytes a GIF file is expected to occupy for color table sizing. */
export function colorTableByteSize(entryCount: number): number {
  const power = Math.pow(2, Math.ceil(Math.log2(Math.max(2, entryCount))));
  return power * 3;
}

/** Parse a 16-bit little-endian unsigned int from a Uint8Array. */
export function readUint16LE(bytes: Uint8Array, offset: number): number {
  if (offset + 1 >= bytes.length) return 0;
  return bytes[offset] | (bytes[offset + 1] << 8);
}

/** Parse the GIF header (logical screen descriptor + global color table size). */
export function parseHeader(bytes: Uint8Array): {
  width: number;
  height: number;
  globalColorCount: number;
  backgroundColorIndex: number;
} {
  if (bytes.length < 13) return { width: 0, height: 0, globalColorCount: 0, backgroundColorIndex: 0 };
  const width = readUint16LE(bytes, 6);
  const height = readUint16LE(bytes, 8);
  const packed = bytes[10];
  const globalColorFlag = (packed & 0x80) !== 0;
  const globalColorSize = globalColorFlag ? 1 << ((packed & 0x07) + 1) : 0;
  const bgIndex = bytes[11];
  return { width, height, globalColorCount: globalColorSize, backgroundColorIndex: bgIndex };
}

/** Plan a frame export: target filename, expected PNG byte size, and grouping for batch. */
export interface FrameExportPlan {
  filename: string;
  width: number;
  height: number;
  estimatedPngBytes: number;
  delayMs: number;
}

/** Build export plans for every frame. */
export function buildExportPlans(frames: GifFrame[], prefix = "frame"): FrameExportPlan[] {
  return frames.map((f, i) => {
    const num = String(i + 1).padStart(4, "0");
    const raw = f.width * f.height * 4;
    const png = Math.round(64 + raw / 2.5);
    return {
      filename: `${prefix}-${num}.png`,
      width: f.width,
      height: f.height,
      estimatedPngBytes: png,
      delayMs: f.delayMs,
    };
  });
}

/** Group export plans into zip-friendly batches. */
export function batchPlans(plans: FrameExportPlan[], batchSize = 50): FrameExportPlan[][] {
  const out: FrameExportPlan[][] = [];
  for (let i = 0; i < plans.length; i += batchSize) {
    out.push(plans.slice(i, i + batchSize));
  }
  return out;
}

/** Compute average FPS from frame delays. */
export function computeAvgFps(frames: GifFrame[]): number {
  const total = frames.reduce((s, f) => s + f.delayMs, 0);
  if (total === 0) return 0;
  return Math.round((frames.length / total) * 1000 * 10) / 10;
}

/** Detect frames whose disposal method is "restore to background" (2). */
export function findBackgroundRestoreFrames(frames: GifFrame[]): number[] {
  return frames.filter((f) => f.disposal === 2).map((f) => f.index);
}

/** Detect frames with sub-second delays that may be playback-critical. */
export function findFastFrames(frames: GifFrame[], threshold = 50): number[] {
  return frames.filter((f) => f.delayMs > 0 && f.delayMs < threshold).map((f) => f.index);
}

/** Estimate total output PNG bytes for all frames. */
export function estimateTotalPngBytes(frames: GifFrame[]): number {
  return frames.reduce((s, f) => s + (64 + (f.width * f.height * 4) / 2.5), 0);
}

/** Format bytes for display. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** Format milliseconds as a human duration string. */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(2)}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${Math.round(s - m * 60)}s`;
}

/** Validate a GIF signature (GIF87a or GIF89a). */
export function isGifSignature(bytes: Uint8Array): boolean {
  if (bytes.length < 6) return false;
  const sig = String.fromCharCode(bytes[0], bytes[1], bytes[2]);
  const ver = String.fromCharCode(bytes[3], bytes[4], bytes[5]);
  return sig === "GIF" && (ver === "87a" || ver === "89a");
}

/** Build a complete GifMetadata object from a frame list. */
export function buildMetadata(
  width: number,
  height: number,
  globalColorCount: number,
  backgroundColorIndex: number,
  loopCount: number,
  frames: GifFrame[],
  sourceBytes: number,
): GifMetadata {
  const totalDurationMs = frames.reduce((s, f) => s + f.delayMs, 0);
  const hasTransparency = frames.some((f) => f.transparentIndex !== null);
  return {
    width,
    height,
    globalColorCount,
    backgroundColorIndex,
    loopCount,
    frames,
    totalDurationMs,
    avgFps: computeAvgFps(frames),
    hasTransparency,
    sourceBytes,
  };
}

/** Generate a CSV summary of frame metadata. */
export function framesToCsv(frames: GifFrame[]): string {
  const rows = ["index,delay_ms,width,height,disposal,transparent,interlaced"];
  for (const f of frames) {
    rows.push(
      `${f.index},${f.delayMs},${f.width},${f.height},${f.disposal},${f.transparentIndex ?? ""},${f.interlaced ? 1 : 0}`,
    );
  }
  return rows.join("\n");
}

/** Generate a JSON montage descriptor (frame file list with timing). */
export function buildMontageJson(frames: GifFrame[], prefix = "frame"): string {
  return JSON.stringify(
    {
      frames: frames.map((f, i) => ({
        file: `${prefix}-${String(i + 1).padStart(4, "0")}.png`,
        delay_ms: f.delayMs,
        width: f.width,
        height: f.height,
        disposal: f.disposal,
      })),
    },
    null,
    2,
  );
}
